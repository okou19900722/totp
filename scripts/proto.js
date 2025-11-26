// Protobuf 定义加载与编解码
(function(){
  const protoSrc = `syntax = "proto3";\npackage KeePassOTP;\nmessage GoogleAuthenticatorImport {\n enum Algorithm {\n  ALGORITHM_UNSPECIFIED = 0;\n  ALGORITHM_SHA1 = 1;\n  ALGORITHM_SHA256 = 2;\n  ALGORITHM_SHA512 = 3;\n  ALGORITHM_MD5 = 4;\n }\n enum DigitCount {\n  DIGIT_COUNT_UNSPECIFIED = 0;\n  DIGIT_COUNT_SIX = 1;\n  DIGIT_COUNT_EIGHT = 2;\n }\n enum OtpType {\n  OTP_TYPE_UNSPECIFIED = 0;\n  OTP_TYPE_HOTP = 1;\n  OTP_TYPE_TOTP = 2;\n }\n message OtpParameters {\n  bytes secret = 1;\n  string name = 2;\n  string issuer = 3;\n  Algorithm algorithm = 4;\n  DigitCount digits = 5;\n  OtpType type = 6;\n  int64 counter = 7;\n }\n repeated OtpParameters otp_parameters = 1;\n int32 version = 2;\n int32 batch_size = 3;\n int32 batch_index = 4;\n int32 batch_id = 5;\n}`;

  let Root, Message;

  async function init(){
    Root = await protobuf.parse(protoSrc).root;
    Message = Root.lookupType('KeePassOTP.GoogleAuthenticatorImport');
  }

  function decodeUint8(uint8){
    return Message.decode(uint8);
  }
  function encodeMessage(obj){
    const err = Message.verify(obj);
    if(err) throw new Error(err);
    const m = Message.create(obj);
    return Message.encode(m).finish();
  }

  // 新增：将 Message 转为普通对象，确保 bytes 用数组表示，longs/enums 归一化为 Number
  function toObject(message){
    return Message.toObject(message, { longs: Number, enums: Number, bytes: Array });
  }
  function decodeToObject(uint8){
    const msg = Message.decode(uint8);
    return toObject(msg);
  }

  window.TOTP_PROTO = { init, decodeUint8, encodeMessage, toObject, decodeToObject };
})();