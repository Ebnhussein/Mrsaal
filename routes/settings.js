const express=require('express');
const router=express.Router();
const {get,run}=require('../utils/db');
const {requireAuth}=require('../middleware/auth');
const asyncHandler=require('../middleware/async-handler');
router.use(requireAuth);
router.get('/',asyncHandler(async(req,res)=>{
 res.json(await get('SELECT gemini_key,gemini_model FROM users WHERE id=$1',[req.session.userId])||{gemini_key:null,gemini_model:null});
}));
router.post('/',asyncHandler(async(req,res)=>{
 const {gemini_key,gemini_model}=req.body;
 if((gemini_key!=null&&typeof gemini_key!=='string')||(gemini_model!=null&&typeof gemini_model!=='string'))return res.status(400).json({error:'إعدادات Gemini غير صحيحة'});
 await run('UPDATE users SET gemini_key=$1,gemini_model=$2 WHERE id=$3',[gemini_key?.trim()||null,gemini_model?.trim()||null,req.session.userId]);
 res.json({ok:true});
}));
module.exports=router;
