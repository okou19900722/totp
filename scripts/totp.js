// TOTP/HOTP 计算与 UI 列表刷新
(function(){
  function toBytes(secretStr){
    // 支持 Base32 或 Hex（简单判断）
    const s = secretStr.trim().toUpperCase();
    if(/^[0-9A-F]+$/.test(s)){
      return TOTP_CRYPTO.hex2buf(s);
    }
    // Base32 解码
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for(const ch of s.replace(/=+$/,'')){
      const val = alphabet.indexOf(ch);
      if(val < 0) continue;
      bits += val.toString(2).padStart(5,'0');
    }
    const bytes = new Uint8Array(Math.floor(bits.length/8));
    for(let i=0;i<bytes.length;i++) bytes[i] = parseInt(bits.slice(i*8,i*8+8),2);
    return bytes;
  }

  async function hmac(algorithm, keyBytes, msgBytes){
    const algoMap = { SHA1:'SHA-1', SHA256:'SHA-256', SHA512:'SHA-512' };
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name:'HMAC', hash:{ name: algoMap[algorithm]||'SHA-1' } }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgBytes);
    return new Uint8Array(sig);
  }

  function hotp(keyBytes, counter, digits, algorithm){
    const counterBuf = new ArrayBuffer(8);
    const dv = new DataView(counterBuf);
    dv.setUint32(0, Math.floor(counter / 0x100000000));
    dv.setUint32(4, counter >>> 0);
    return hmac(algorithm, keyBytes, new Uint8Array(counterBuf)).then(sig => {
      const offset = sig[sig.length - 1] & 0x0f;
      const binCode = ((sig[offset] & 0x7f) << 24) | ((sig[offset+1] & 0xff) << 16) | ((sig[offset+2] & 0xff) << 8) | (sig[offset+3] & 0xff);
      const mod = 10 ** digits;
      const code = (binCode % mod).toString().padStart(digits, '0');
      return code;
    });
  }

  function totp(keyBytes, timeStep, digits, algorithm){
    const counter = Math.floor(Date.now() / 1000 / timeStep);
    return hotp(keyBytes, counter, digits, algorithm);
  }

  function digitEnumToNumber(d){
    // 1 -> 6, 2 -> 8
    return d === 2 ? 8 : 6;
  }
  function algoEnumToString(a){
    return a === 2 ? 'SHA256' : a === 3 ? 'SHA512' : 'SHA1';
  }

  window.TOTP_CORE = { toBytes, hmac, hotp, totp, digitEnumToNumber, algoEnumToString };
})();