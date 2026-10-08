'use strict';
const router=require('express').Router();const {randomBytes,timingSafeEqual}=require('crypto');const {v4:uuidv4}=require('uuid');
const {getAuthUrl,getTokensFromCode,getUserInfo}=require('../utils/gmail');const {get,run}=require('../utils/db');const {saveAccount}=require('../utils/gmail-accounts');const wrap=require('../middleware/async-handler');const {requireAuth}=require('../middleware/auth');
const saveSession=req=>new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
async function begin(req,res,mode){const state=randomBytes(32).toString('hex');req.session.googleFlow={state,mode,userId:mode==='link'?req.session.userId:null,expires:Date.now()+600000};await saveSession(req);res.redirect(getAuthUrl(state,mode));}
router.get('/google',wrap((req,res)=>begin(req,res,'login')));
router.get('/google/link',requireAuth,wrap((req,res)=>begin(req,res,'link')));
router.get('/google/callback',wrap(async(req,res)=>{
 const flow=req.session.googleFlow;delete req.session.googleFlow;await saveSession(req);
 const state=typeof req.query.state==='string'?req.query.state:'';
 if(!flow||flow.expires<Date.now()||state.length!==flow.state.length||!timingSafeEqual(Buffer.from(state),Buffer.from(flow.state)))return res.redirect('/?error=auth_state');
 if(req.query.error||typeof req.query.code!=='string')return res.redirect('/?error=auth_denied');
 try{
 const tokens=await getTokensFromCode(req.query.code),info=await getUserInfo(tokens.access_token);
 if(!info.id||!info.email||info.verified_email===false)throw new Error('Google identity unavailable');
 if(flow.mode==='link'){
  if(!flow.userId||req.session.userId!==flow.userId)throw new Error('Session changed');
  await saveAccount(flow.userId,info,tokens);return res.redirect('/?linked=gmail');
 }
 let user=await get('SELECT * FROM users WHERE google_id=$1',[info.id]);
 if(!user){const id=uuidv4();await run('INSERT INTO users(id,google_id,email,name,access_token,refresh_token,token_expiry) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,info.id,info.email,info.name,null,null,null]);user=await get('SELECT * FROM users WHERE id=$1',[id]);}
 else await run('UPDATE users SET email=$1,name=$2,access_token=$3,refresh_token=COALESCE($4,refresh_token),token_expiry=$5 WHERE id=$6',[info.email,info.name,null,null,null,user.id]);

 await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));req.session.userId=user.id;await saveSession(req);res.redirect('/');
 }catch(err){console.error('Google connection failed:',err.code||err.name);res.redirect('/?error=auth_failed');}
}));
router.get('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/')));
router.get('/status',wrap(async(req,res)=>{if(!req.session?.userId)return res.json({loggedIn:false});const user=await get('SELECT id,email,name FROM users WHERE id=$1',[req.session.userId]);res.json(user?{loggedIn:true,email:user.email,name:user.name}:{loggedIn:false});}));
module.exports=router;
