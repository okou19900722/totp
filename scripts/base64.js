(function () {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function decode(base64) {
    if (typeof base64 !== 'string') {
      throw new Error('输入必须是字符串');
    }

    // 移除可能的填充和空白字符
    base64 = base64.replace(/=/g, '').trim();
    base64 = base64.replace(/\n/g, '');

    // 验证 Base64 格式
    if (!/^[A-Za-z0-9+/]*$/.test(base64)) {
      throw new Error('无效的 Base64 字符串' + base64);
    }

    const len = base64.length;
    const bytes = new Uint8Array(Math.floor(len * 3 / 4));
    let bytePos = 0;

    for (let i = 0; i < len; i += 4) {
      // 将4个Base64字符转换为24位数据
      const enc1 = CHARS.indexOf(base64.charAt(i));
      const enc2 = CHARS.indexOf(base64.charAt(i + 1));
      const enc3 = CHARS.indexOf(base64.charAt(i + 2));
      const enc4 = CHARS.indexOf(base64.charAt(i + 3));

      // 组合成24位
      const triple = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4;

      // 分解为3个字节
      bytes[bytePos++] = (triple >>> 16) & 0xFF;
      if (enc3 !== -1) bytes[bytePos++] = (triple >>> 8) & 0xFF;
      if (enc4 !== -1) bytes[bytePos++] = triple & 0xFF;
    }

    // 返回正确长度的 Uint8Array
    return bytes.subarray(0, bytePos);
  }

  function encode(input) {
    let uint8Array;

    if (input instanceof ArrayBuffer) {
      uint8Array = new Uint8Array(input);
    } else if (input instanceof Uint8Array) {
      uint8Array = input;
    } else if (typeof input === 'string') {
      // 字符串转换为 Uint8Array
      const encoder = new TextEncoder();
      uint8Array = encoder.encode(input);
    } else {
      throw new Error('输入必须是 ArrayBuffer、Uint8Array 或字符串');
    }

    return _encodeUint8Array(uint8Array);
  }

  /**
   * 核心编码逻辑
   */
  function _encodeUint8Array(bytes) {
    let output = '';
    const len = bytes.length;
    let i = 0;

    while (i < len) {
      const byte1 = bytes[i++];
      const byte2 = i < len ? bytes[i++] : 0;
      const byte3 = i < len ? bytes[i++] : 0;

      // 3个字节 = 24位
      const triple = (byte1 << 16) | (byte2 << 8) | byte3;

      // 分成4个6位组
      output += CHARS[(triple >>> 18) & 0x3F];
      output += CHARS[(triple >>> 12) & 0x3F];
      output += CHARS[(triple >>> 6) & 0x3F];
      output += CHARS[triple & 0x3F];
    }

    // 添加填充
    const padding = len % 3;
    if (padding === 1) {
      output = output.slice(0, -2) + '==';
    } else if (padding === 2) {
      output = output.slice(0, -1) + '=';
    }

    return output;
  }

  window.TOTP_BASE64 = {decode, encode}
})()