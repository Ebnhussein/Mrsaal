'use strict';
const fs=require('fs'),path=require('path');
const LOCK=724392,NAME=/^\d{4}_[a-z0-9_-]+\.sql$/;
function files(dir){return fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>NAME.test(f)).sort():[];}
// `db` is a pg Pool (checked out for the run) or any client with query(); returns the names applied by this call.
async function migrate(db,dir=path.join(__dirname,'..','migrations')){
 const client=typeof db.connect==='function'?await db.connect():db;
 const exec=sql=>typeof client.exec==='function'?client.exec(sql):client.query(sql);
 const applied=[];
 try{
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  for(const name of files(dir)){
   await client.query('BEGIN');
   try{
    await client.query('SELECT pg_advisory_xact_lock($1)',[LOCK]);
    const done=await client.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name]);
    if(!(done.rows||[]).length){await exec(fs.readFileSync(path.join(dir,name),'utf8'));await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);applied.push(name);}
    await client.query('COMMIT');
   }catch(error){await client.query('ROLLBACK').catch(()=>{});error.message='Migration '+name+' failed: '+error.message;throw error;}
  }
 }finally{if(typeof db.connect==='function')client.release();}
 return applied;
}
module.exports={migrate,files};
