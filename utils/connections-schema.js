'use strict';
const {run,all}=require('./db');
const {seal}=require('./connection-secrets');
const {randomUUID}=require('crypto');
async function ensureConnectionsSchema(){
 await run(`CREATE TABLE IF NOT EXISTS gmail_accounts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),google_id TEXT NOT NULL,email TEXT NOT NULL,name TEXT,credentials TEXT,connected BOOLEAN NOT NULL DEFAULT true,UNIQUE(user_id,google_id));
 ALTER TABLE users ADD COLUMN IF NOT EXISTS active_gmail_id TEXT;
 ALTER TABLE email_log ADD COLUMN IF NOT EXISTS sender_account_id TEXT;
 ALTER TABLE email_log ADD COLUMN IF NOT EXISTS sender_email TEXT;
 ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS sender_account_id TEXT;
 CREATE TABLE IF NOT EXISTS ai_connections(user_id TEXT NOT NULL REFERENCES users(id),provider TEXT NOT NULL,credentials TEXT NOT NULL,models JSONB NOT NULL DEFAULT '[]',selected_models JSONB NOT NULL DEFAULT '[]',enabled BOOLEAN NOT NULL DEFAULT false,priority INTEGER NOT NULL DEFAULT 10,free_only BOOLEAN NOT NULL DEFAULT true,PRIMARY KEY(user_id,provider));`);
 const users=await all(`SELECT u.* FROM users u WHERE u.access_token IS NOT NULL AND NOT EXISTS(SELECT 1 FROM gmail_accounts a WHERE a.user_id=u.id AND a.google_id=u.google_id)`);
 for(const u of users){const id=randomUUID();await run(`INSERT INTO gmail_accounts(id,user_id,google_id,email,name,credentials) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,google_id) DO NOTHING`,[id,u.id,u.google_id,u.email,u.name,seal({access_token:u.access_token,refresh_token:u.refresh_token,expiry_date:Number(u.token_expiry)||null})]);}
 // Legacy history belongs to the original Google identity, never the newly selected sender.
 await run(`UPDATE email_log l SET sender_account_id=a.id,sender_email=a.email FROM users u JOIN gmail_accounts a ON a.user_id=u.id AND a.google_id=u.google_id WHERE l.user_id=u.id AND l.channel='email' AND l.sender_account_id IS NULL;
 UPDATE scheduled_jobs j SET sender_account_id=a.id FROM users u JOIN gmail_accounts a ON a.user_id=u.id AND a.google_id=u.google_id, companies c WHERE j.user_id=u.id AND c.id=j.company_id AND c.user_id=j.user_id AND c.email LIKE '%@%' AND j.sender_account_id IS NULL AND j.status='pending';`);
}
module.exports={ensureConnectionsSchema};
