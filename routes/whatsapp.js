const router=require('express').Router();
const { requireAuth }=require('../middleware/auth');
const wa=require('../utils/whatsapp');
router.use(requireAuth);
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/status',(req,res)=>res.json(wa.status(req.session.userId)));
router.post('/connect',async(req,res)=>{
  try {res.json(await wa.connect(req.session.userId));}
  catch(err){res.status(503).json({error:err.message});}
});
router.post('/disconnect',async(req,res)=>{
  try {await wa.disconnect(req.session.userId);res.json({ok:true});}
  catch{res.status(500).json({error:'تعذر فصل واتساب'});}
});
module.exports=router;
