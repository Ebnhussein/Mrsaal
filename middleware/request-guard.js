'use strict';
const SAFE=new Set(['GET','HEAD','OPTIONS']);
function trustedOrigin(){return new URL(process.env.BASE_URL||'https://mrsaal.ebnhussein.co').origin;}
module.exports=function requestGuard(req,res,next){
 if(SAFE.has(req.method))return next();
 const origin=req.get('Origin'),site=req.get('Sec-Fetch-Site');
 const trusted=origin===trustedOrigin()||(!origin&&(site==='same-origin'||req.get('X-Mrsaal-Request')==='1'));
 if(!trusted)return res.status(403).json({error:'طلب غير مسموح من خارج مرسال.',code:'REQUEST_ORIGIN'});
 return next();
};
