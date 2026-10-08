'use strict';
const {randomUUID}=require('crypto');
const {run,get}=require('./db');
const groups=new Set(['companies','cv','email','writing','providers','whatsapp','accounts','campaigns','launch']);
const counters=new Map();let cleanupAt=0;
function quota(key,max){const now=Date.now();for(const [k,v]of counters)if(now-v.start>3600000)counters.delete(k);if(counters.size>10000&&!counters.has(key))return false;const v=counters.get(key)||{start:now,n:0};v.n++;counters.set(key,v);return v.n<=max;}
function adminEmail(email){return new Set(String(process.env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)).has(String(email||'').toLowerCase());}
async function isAdmin(id){const u=await get('SELECT email FROM users WHERE id=$1',[id]);return !!u&&adminEmail(u.email);}
async function ensureHelpdesk(){await run(`
 CREATE TABLE IF NOT EXISTS support_tickets(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),subject TEXT NOT NULL,body TEXT NOT NULL,category TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS support_messages(id TEXT PRIMARY KEY,ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),staff BOOLEAN NOT NULL DEFAULT FALSE,body TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE INDEX IF NOT EXISTS support_tickets_owner ON support_tickets(user_id,updated_at DESC);
 CREATE INDEX IF NOT EXISTS support_messages_ticket ON support_messages(ticket_id,created_at);
 CREATE TABLE IF NOT EXISTS support_events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),area TEXT NOT NULL,status INTEGER NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE INDEX IF NOT EXISTS support_events_time ON support_events(created_at DESC);
 CREATE TABLE IF NOT EXISTS support_activity(user_id TEXT PRIMARY KEY REFERENCES users(id),last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW());
 `);}
async function recordEvent(id,area,status){if(!id||!groups.has(area)||!quota('event:'+id,30))return;await run('INSERT INTO support_events(id,user_id,area,status) VALUES($1,$2,$3,$4)',[randomUUID(),id,area,status]);}
function monitor(req,res,next){
 const id=req.session?.userId;const area=req.path.split('/')[2];
 if(id&&req.path.startsWith('/api/')){
  // Database condition avoids writing a row for every WhatsApp poll.
  run(`INSERT INTO support_activity(user_id) VALUES($1) ON CONFLICT(user_id) DO UPDATE SET last_seen=NOW() WHERE support_activity.last_seen<NOW()-INTERVAL '5 minutes'`,[id]).catch(()=>{});
  if(groups.has(area))res.once('finish',()=>{if(res.statusCode>=400)recordEvent(id,area,res.statusCode).catch(()=>{});});
  if(Date.now()>cleanupAt){cleanupAt=Date.now()+3600000;run("DELETE FROM support_events WHERE created_at<NOW()-INTERVAL '30 days'").catch(()=>{});}
 }
 next();
}
module.exports={adminEmail,isAdmin,ensureHelpdesk,monitor,quota};
