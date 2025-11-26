// 加密/解密：结合密码与私钥实现密钥封装，数据用 AES-GCM 加密
(function(){
  // 辅助：字符串/字节转换
  function str2buf(str){ return new TextEncoder().encode(str); }
  function buf2str(buf){ return new TextDecoder().decode(buf); }
  function hex2buf(hex){ hex = hex.replace(/\s+/g,''); const u = new Uint8Array(hex.length/2); for(let i=0;i<u.length;i++){ u[i] = parseInt(hex.substr(i*2,2),16); } return u; }
  function xorBytes(a, b){ const len = Math.min(a.length, b.length); const out = new Uint8Array(len); for(let i=0;i<len;i++) out[i] = a[i]^b[i]; return out; }

  // 导入 PEM RSA 公钥/私钥
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

  async function deriveRawFromPassword(password, salt){
    const baseKey = await crypto.subtle.importKey('raw', str2buf(password), 'PBKDF2', false, ['deriveKey']);
    const k = await crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations: 150000, hash:'SHA-256' }, baseKey, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', k));
    return raw; // 32 bytes
  }
  async function importAesKey(raw){
    return crypto.subtle.importKey('raw', raw, { name:'AES-GCM' }, false, ['encrypt','decrypt']);
  }

  // 组合密钥要求同时持有密码与私钥：K = Krandom XOR Kpwd
  async function encryptDataWithHybrid(objUint8, publicPem, password){
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const Kpwd = await deriveRawFromPassword(password, salt);
    const Krand = crypto.getRandomValues(new Uint8Array(32));
    const K = xorBytes(Krand, Kpwd);
    const aesKey = await importAesKey(K);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, aesKey, objUint8));
    // 用公钥封装随机半部
    const pubKey = await importPublicKey(publicPem);
    const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name:'RSA-OAEP' }, pubKey, Krand));
    return { salt: Array.from(salt), iv: Array.from(iv), wrapped: Array.from(wrapped), ciphertext: Array.from(ciphertext) };
  }

  async function decryptDataWithHybrid(enc, privatePem, password){
    const salt = new Uint8Array(enc.salt);
    const iv = new Uint8Array(enc.iv);
    const wrapped = new Uint8Array(enc.wrapped);
    const ciphertext = new Uint8Array(enc.ciphertext);
    const priv = await importPrivateKey(privatePem);
    const Krand = new Uint8Array(await crypto.subtle.decrypt({ name:'RSA-OAEP' }, priv, wrapped));
    const Kpwd = await deriveRawFromPassword(password, salt);
    const K = xorBytes(Krand, Kpwd);
    const aesKey = await importAesKey(K);
    const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, aesKey, ciphertext);
    return new Uint8Array(plain);
  }

  window.TOTP_CRYPTO = { encryptDataWithHybrid, decryptDataWithHybrid, hex2buf, str2buf, buf2str };
})();