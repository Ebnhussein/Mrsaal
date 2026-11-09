'use strict';
const router=require('express').Router();
const wrap=require('../middleware/async-handler');
const {get,all}=require('../utils/db');
const {batch}=require('../utils/discovery/validate');
router.use(require('../middleware/auth').requireAuth);
router.use(wrap(async(req,res,next)=>{
 res.setHeader('Cache-Control','no-store');
 const user=await get('SELECT id,name,email FROM users WHERE id=$1',[req.session.userId]);
 if(!user)return res.status(401).json({error:'سجّل الدخول إلى مرسال أولًا.'});
 if(!require('../utils/discovery/access').allowed(user))return res.status(403).json({error:'تجربة Mrsaal Scraper متاحة حاليًا للحسابات المحددة فقط.',code:'DISCOVERY_PILOT_ONLY'});
 next();
}));
router.get('/extension.zip',wrap(async(req,res)=>{
 const fs=require('node:fs'),path=require('node:path');
 const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'mrsaal-official-extension-'));
 try{
  const bundle=require('../scripts/build-scraper-extension.cjs').build({appOrigin:'https://mrsaal.ebnhussein.co',out:dir});
  res.type('application/zip').attachment('mrsaal-scraper.zip').send(fs.readFileSync(bundle.zip));
 }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(dir+'.zip',{force:true});}
}));
router.get('/session',wrap(async(req,res)=>{
 const user=await get('SELECT id,name,email FROM users WHERE id=$1',[req.session.userId]);
 res.setHeader('Cache-Control','no-store');
 if(!user)return res.status(401).json({error:'سجّل الدخول إلى مرسال أولًا.'});
 res.json({user});
}));
router.post('/import',wrap(async(req,res)=>{
 if(req.body?.expectedUserId!==req.session.userId)return res.status(409).json({error:'الحساب تغيّر. اربط الإضافة بالحساب الحالي قبل الاستيراد.',code:'DISCOVERY_ACCOUNT_CHANGED'});
 const payload=batch(req.body);
 res.json(await require('../utils/discovery/store').importRows(req.session.userId,payload));
}));
router.get('/imports',wrap(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.json({imports:await all('SELECT id,result,source,created_at FROM discovery_imports WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20',[req.session.userId])});}));
router.get('/imports/:id',wrap(async(req,res)=>{
 const receipt=await get('SELECT id,result,source,created_at FROM discovery_imports WHERE id=$1 AND user_id=$2',[req.params.id,req.session.userId]);
 if(!receipt)return res.status(404).json({error:'إيصال الحفظ غير موجود.'});
 const companies=await all('SELECT * FROM companies WHERE user_id=$1 AND id=ANY($2::text[])',[req.session.userId,receipt.result.companyIds]);
 const jobs=await all('SELECT * FROM discovered_jobs WHERE user_id=$1 AND id=ANY($2::text[])',[req.session.userId,receipt.result.jobIds]);
 res.setHeader('Cache-Control','no-store');res.json({receipt,companies,jobs,verified:companies.length===receipt.result.companyIds.length&&jobs.length===receipt.result.jobIds.length});
}));
router.get('/summary',wrap(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.json({companies:Number((await get('SELECT COUNT(*) AS n FROM companies WHERE user_id=$1',[req.session.userId])).n),jobs:Number((await get('SELECT COUNT(*) AS n FROM discovered_jobs WHERE user_id=$1',[req.session.userId])).n)});}));
router.get('/jobs',wrap(async(req,res)=>{
 const offset=Math.max(0,Math.min(100000,parseInt(req.query.offset)||0));
 const rows=await all('SELECT * FROM discovered_jobs WHERE user_id=$1 ORDER BY created_at DESC,id LIMIT 101 OFFSET $2',[req.session.userId,offset]);
 res.setHeader('Cache-Control','no-store');res.json({jobs:rows.slice(0,100),nextOffset:rows.length>100?offset+100:null});
}));
module.exports=router;
