'use strict';
const {pool}=require('../db');
const {randomUUID,createHash}=require('node:crypto');
const {limits,exceeded}=require('../usage/resources');
async function importRows(userId,{rows,source,requestKey=''}){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const user=(await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];
  if(!user)exceeded('الحساب غير موجود.');
  const hash=createHash('sha256').update(JSON.stringify({rows,source})).digest('hex');
  const key=requestKey||randomUUID();
  const prior=(await client.query('SELECT * FROM discovery_imports WHERE user_id=$1 AND request_key=$2',[userId,key])).rows[0];
  if(prior){if(prior.payload_hash!==hash)throw Object.assign(new Error('الدفعة تغيرت بنفس مفتاح الحفظ.'),{status:409});await client.query('COMMIT');return {...prior.result,replayed:true};}
  const cap=limits(user).companies;
  let companyCount=Number((await client.query('SELECT COUNT(*) AS n FROM companies WHERE user_id=$1',[userId])).rows[0].n);
  let jobCount=Number((await client.query('SELECT COUNT(*) AS n FROM discovered_jobs WHERE user_id=$1',[userId])).rows[0].n);
  const result={companiesAdded:0,jobsAdded:0,jobsUpdated:0,duplicates:0,companyIds:[],jobIds:[]};
  for(const row of rows){
   // An unknown employer is not fabricated from the job title.
   const name=row.kind==='company'?row.name:row.companyName;
   const mapsId=source.adapter==='maps'&&row.sourceUrl.includes('/maps/place/')?row.sourceUrl.match(/!1s([^!/?]+)/)?.[1]:'';
   const sourceKey=mapsId?'maps:'+mapsId:'';
   let company=null,existingJob=null;
   if(row.kind==='job'){
    existingJob=(await client.query('SELECT * FROM discovered_jobs WHERE user_id=$1 AND job_url=$2',[userId,row.jobUrl])).rows[0];
    if(existingJob&&!(existingJob.source_meta?.entryType==='link_only'&&row.entryType!=='link_only')){result.duplicates++;result.jobIds.push(existingJob.id);if(existingJob.company_id)result.companyIds.push(existingJob.company_id);continue;}
    if(!existingJob&&jobCount>=Math.min(cap,5000))exceeded('وصلت للحد المتاح للفرص المحفوظة. لم يُحفظ هذا الاستيراد.');
   }
   if(name){
    company=(await client.query(`SELECT id FROM companies WHERE user_id=$1 AND (
     ($6<>'' AND discovery_meta->>'sourceKey'=$6) OR ($2<>'' AND email=$2) OR ($3<>'' AND regexp_replace(phone,'[^0-9+]','','g')=$3) OR
     (lower(trim(name))=lower(trim($4)) AND lower(trim(COALESCE(location,'')))=lower(trim($5)))
     ) ORDER BY created_at,id LIMIT 1`,[userId,row.email,row.phone,name,row.location,sourceKey])).rows[0];
    if(!company){
     if(companyCount>=cap)exceeded('وصلت للحد المتاح للشركات. لم يُحفظ هذا الاستيراد.');
     company={id:randomUUID()};
     const meta={sourceKey,sourceUrl:row.sourceUrl,website:row.website,adapter:source.adapter,searchCountry:source.country,query:source.query,discoveredAt:new Date().toISOString()};
     await client.query(`INSERT INTO companies(id,user_id,name,email,phone,field,location,selected,list_name,discovery_meta)
      VALUES($1,$2,$3,$4,$5,$6,$7,0,$8,$9::jsonb)`,[company.id,userId,name,row.email,row.phone,row.field,row.location,'Mrsaal Scraper',JSON.stringify(meta)]);
     companyCount++;result.companiesAdded++;result.companyIds.push(company.id);
    }else{result.companyIds.push(company.id);if(row.kind==='company')result.duplicates++;}
   }
   if(row.kind==='job'){
    const id=existingJob?.id||randomUUID();
    await client.query(`INSERT INTO discovered_jobs(id,user_id,company_id,company_name,title,description,job_url,source_url,location,country,work_mode,employment_type,source_meta,status)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14) ON CONFLICT(id) DO UPDATE SET company_id=EXCLUDED.company_id,company_name=EXCLUDED.company_name,title=EXCLUDED.title,description=EXCLUDED.description,location=EXCLUDED.location,country=EXCLUDED.country,work_mode=EXCLUDED.work_mode,source_url=EXCLUDED.source_url,source_meta=EXCLUDED.source_meta,status=EXCLUDED.status`,[id,userId,company?.id||null,name,row.title,row.description,row.jobUrl,row.sourceUrl,row.location,row.country,row.workMode,row.employmentType,JSON.stringify({...source,entryType:row.entryType}),row.entryType==='link_only'?'needs_review':'saved']);
    if(existingJob)result.jobsUpdated++;else{jobCount++;result.jobsAdded++;}result.jobIds.push(id);
   }
  }
  result.companyIds=[...new Set(result.companyIds)];result.jobIds=[...new Set(result.jobIds)];
  result.receiptId=randomUUID();result.confirmed=true;
  await client.query('INSERT INTO discovery_imports(id,user_id,request_key,payload_hash,result,source) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',[result.receiptId,userId,key,hash,JSON.stringify(result),JSON.stringify(source)]);
  await client.query('COMMIT');return result;
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
module.exports={importRows};
