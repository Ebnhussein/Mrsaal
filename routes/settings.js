const express=require('express');
const router=express.Router();
const {get,run}=require('../utils/db');
const {requireAuth}=require('../middleware/auth');
const asyncHandler=require('../middleware/async-handler');
router.use(requireAuth);
router.get('/',asyncHandler(async(req,res)=>{
 const row=await get('SELECT gemini_key,gemini_model FROM users WHERE id=$1',[req.session.userId]);res.json({gemini_key:row?.gemini_key?'saved':null,gemini_model:row?.gemini_model||null});
}));
router.post('/',(req,res)=>res.status(409).json({error:'استخدم كارت منصات الذكاء الاصطناعي لحفظ المفاتيح مشفّرة. حدّث الصفحة.'}));
module.exports=router;
