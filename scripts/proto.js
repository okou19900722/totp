// Protobuf 定义加载与编解码
(function(){
  const protoSrc = `
    syntax = "proto3";
    package KeePassOTP;
    
    message GoogleAuthenticatorImport {
      enum Algorithm {
        ALGORITHM_UNSPECIFIED = 0;
        ALGORITHM_SHA1 = 1;
        ALGORITHM_SHA256 = 2;
        ALGORITHM_SHA512 = 3;
        ALGORITHM_MD5 = 4;
      }
      enum DigitCount {
        DIGIT_COUNT_UNSPECIFIED = 0;
        DIGIT_COUNT_SIX = 1;
        DIGIT_COUNT_EIGHT = 2;
      }
      enum OtpType {
        OTP_TYPE_UNSPECIFIED = 0;
        OTP_TYPE_HOTP = 1;
        OTP_TYPE_TOTP = 2;
      }
      message OtpParameters {
        bytes secret = 1;
        string name = 2;
        string issuer = 3;
        Algorithm algorithm = 4;
        DigitCount digits = 5;
        OtpType type = 6;
        int64 counter = 7;
      }
      repeated OtpParameters otp_parameters = 1;
      int32 version = 2;
      int32 batch_size = 3;
      int32 batch_index = 4;
      int32 batch_id = 5;
    }
  `;

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
    console.log("obj", m)
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