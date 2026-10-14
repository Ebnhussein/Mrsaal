'use strict';
const router=require('express').Router(),wrap=require('../middleware/async-handler');
router.use(require('../middleware/auth').requireAuth);router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
function scope(){return require('../utils/ai-local').settings().scope;}
router.get('/',wrap(async(req,res)=>res.json(process.env.LOCAL_AI_BASE_URL?await require('../utils/local-ai-queue').status(req.session.userId,scope()):{state:'idle'})));
router.post('/cancel',wrap(async(req,res)=>{if(typeof req.body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(req.body.id))return res.status(400).json({error:'حدّث حالة الطلب قبل إلغائه.'});res.json(process.env.LOCAL_AI_BASE_URL?await require('../utils/local-ai-queue').cancel(req.session.userId,scope(),req.body.id):{ok:true,cancelled:false});}));
module.exports=router;
