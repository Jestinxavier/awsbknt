const KJUR = require('jsrsasign');
require('dotenv').config();

const generateSignat = async ()=>{
}
const generateSignatureMiddleware = async(req, res, next) => {
    console.log({body:req});
    const { sessionName, role, sessionKey, userIdentity } = req.body;
    const sdkKey = process.env.ZOOM_VIDEO_SDK_KEY;
    const sdkSecret = process.env.ZOOM_VIDEO_SDK_SECRET;
  
    const iat = Math.round(new Date().getTime() / 1000) - 30;
    const exp = iat + 60 * 60 * 2;
    const oHeader = { alg: 'HS256', typ: 'JWT' };
  
    const oPayload = {
      app_key: sdkKey,
      tpc: sessionName,
      role_type: role,
      session_key: sessionKey,
      user_identity: userIdentity,
      version: 1,
      iat: iat,
      exp: exp
    };
  
    const sHeader = JSON.stringify(oHeader);
    const sPayload = JSON.stringify(oPayload);
    
    try {
      const signature = KJUR.jws.JWS.sign('HS256', sHeader, sPayload, sdkSecret);
      req.signature = signature; // Attach the signature to the request object
      console.log(signature);
      next(); // Pass control to the next middleware function
    } catch (error) {
      next(error); // Pass the error to the error-handling middleware
    }
  };


module.exports = {generateSignat,generateSignatureMiddleware};