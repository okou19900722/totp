// 加密/解密：结合密码与私钥实现密钥封装，数据用 AES-GCM 加密
(function(){
  // 辅助：字符串/字节转换
  function hex2buf(hex){ hex = hex.replace(/\s+/g,''); const u = new Uint8Array(hex.length/2); for(let i=0;i<u.length;i++){ u[i] = parseInt(hex.substr(i*2,2),16); } return u; }

  async function importPublicKey(pem){
    const b64 = pem.replace(/-----[^-]+-----/g,'').replace(/\s+/g,'');
    const der = Uint8Array.from(atob(b64), c=>c.charCodeAt(0));
    return crypto.subtle.importKey('spki', der, { name:'RSA-OAEP', hash:'SHA-256' }, true, ['encrypt']);
  }
  async function importPrivateKey(pem){
    const b64 = pem.replace(/-----[^-]+-----/g,'').replace(/\s+/g,'');
    const der = Uint8Array.from(atob(b64), c=>c.charCodeAt(0));
    return crypto.subtle.importKey('pkcs8', der, { name:'RSA-OAEP', hash:'SHA-256' }, false, ['decrypt']);
  }

  // 生成AES密钥并用于加密数据，然后用RSA加密AES密钥
  async function encryptDataWithHybrid(data, publicKey){
    // 1. 生成随机AES密钥
    const aesKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // 2. 用AES加密数据
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      data
    );

    // 3. 导出AES密钥并用RSA加密
    const exportedKey = await crypto.subtle.exportKey("raw", aesKey);
    const encryptedKey = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      await importPublicKey(publicKey),
      exportedKey
    );

    // 4. 组合结果: IV + 加密的AES密钥 + 加密的数据
    const result = new Uint8Array(
      4 + iv.length +
      4 + encryptedKey.byteLength +
      encryptedData.byteLength
    );

    let offset = 0;

    // 写入IV长度和IV
    const view = new DataView(result.buffer);
    view.setUint32(offset, iv.length, false);
    offset += 4;
    result.set(iv, offset);
    offset += iv.length;

    // 写入加密密钥长度和密钥
    view.setUint32(offset, encryptedKey.byteLength, false);
    offset += 4;
    result.set(new Uint8Array(encryptedKey), offset);
    offset += encryptedKey.byteLength;

    // 写入加密数据
    result.set(new Uint8Array(encryptedData), offset);

    return result;
  }

  async function decryptDataWithHybrid(encryptedData, privateKey){
    let offset = 0;
    const view = new DataView(encryptedData.buffer);

    // 1. 读取IV
    const ivLength = view.getUint32(offset, false);
    offset += 4;
    const iv = encryptedData.slice(offset, offset + ivLength);
    offset += ivLength;

    // 2. 读取加密的AES密钥
    const keyLength = view.getUint32(offset, false);
    offset += 4;
    const encryptedKey = encryptedData.slice(offset, offset + keyLength);
    offset += keyLength;

    // 3. 读取加密数据
    const data = encryptedData.slice(offset);

    // 4. 用RSA解密AES密钥
    const decryptedKey = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      await importPrivateKey(privateKey),
      encryptedKey
    );

    // 5. 导入AES密钥
    const aesKey = await crypto.subtle.importKey(
      "raw",
      decryptedKey,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // 6. 用AES解密数据
    const decryptedData = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      data
    );

    return new Uint8Array(decryptedData);
  }

  window.TOTP_CRYPTO = { encryptDataWithHybrid, decryptDataWithHybrid, hex2buf};
})();