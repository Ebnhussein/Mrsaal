'use strict';
const router=require('express').Router();
const wrap=require('../middleware/async-handler');
const {get,all}=require('../utils/db');
const {batch}=require('../utils/discovery/validate');
router.use(require('../middleware/auth').requireAuth);
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
router.get('/jobs',wrap(async(req,res)=>{
 const offset=Math.max(0,Math.min(100000,parseInt(req.query.offset)||0));
 const rows=await all('SELECT * FROM discovered_jobs WHERE user_id=$1 ORDER BY created_at DESC,id LIMIT 101 OFFSET $2',[req.session.userId,offset]);
 res.setHeader('Cache-Control','no-store');res.json({jobs:rows.slice(0,100),nextOffset:rows.length>100?offset+100:null});
}));
module.exports=router;
