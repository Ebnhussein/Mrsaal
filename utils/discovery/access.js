'use strict';
// Official pilot stays limited to explicitly configured testers and existing admins.
function allowed(user,env=process.env){
 const emails=new Set([env.ADMIN_EMAILS,env.SCRAPER_TRIAL_EMAILS].filter(Boolean).join(',').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
 return !!user?.email&&emails.has(user.email.trim().toLowerCase());
}
module.exports={allowed};
