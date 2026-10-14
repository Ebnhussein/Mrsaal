'use strict';
const {get}=require('../utils/db');
module.exports=async function mutationRate(req,res,next){
 if(!req.session?.userId||!req.path.startsWith('/api/')||['GET','HEAD','OPTIONS'].includes(req.method))return next();
 try{const row=await get(`INSERT INTO api_mutation_limits(user_id,minute,amount) VALUES($1,date_trunc('minute',NOW()),1) ON CONFLICT(user_id) DO UPDATE SET minute=EXCLUDED.minute,amount=CASE WHEN api_mutation_limits.minute<>EXCLUDED.minute THEN 1 ELSE api_mutation_limits.amount+1 END WHERE api_mutation_limits.minute<>EXCLUDED.minute OR api_mutation_limits.amount<120 RETURNING amount`,[req.session.userId]);if(!row){res.setHeader('Retry-After','60');return res.status(429).json({error:'طلبات كثيرة. انتظر دقيقة قبل المحاولة.',code:'REQUEST_RATE_LIMIT'});}next();}catch(error){next(error);}
};
