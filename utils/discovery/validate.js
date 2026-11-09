'use strict';
const COUNTRIES=new Set(['','EG','SA','AE','KW','QA','BH','OM']);
const MODES=new Set(['','remote','hybrid','onsite']);
function fail(message){throw Object.assign(new Error(message),{status:400,code:'DISCOVERY_INPUT'});}
function text(value,max=200){if(value==null)return '';if(typeof value!=='string'||value.length>max)fail('راجع نوع البيانات وطول الحقول المستوردة.');return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim();}
function url(value){const input=text(value,2048);if(!input)return '';try{const u=new URL(input);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new Error();u.hash='';return u.href;}catch{fail('رابط المصدر غير صحيح.');}}
function jobUrl(value){const result=url(value);if(!result)return '';const u=new URL(result);for(const key of [...u.searchParams.keys()])if(/^utm_/i.test(key)||key==='gh_src')u.searchParams.delete(key);return u.href;}
function batch(body){
 if(!body||!Array.isArray(body.rows)||body.rows.length<1||body.rows.length>250)fail('اختار من 1 إلى 250 نتيجة في الدفعة.');
 const source={url:url(body.source?.url),adapter:text(body.source?.adapter,30),query:text(body.source?.query,300),country:text(body.source?.country,2)};
 if(!source.url||!['maps','jsonld','table','custom'].includes(source.adapter)||!COUNTRIES.has(source.country))fail('راجع مصدر البيانات ودولة البحث.');
 const rows=body.rows.map(row=>{
  if(!row||!['company','job'].includes(row.kind))fail('نوع النتيجة غير صحيح.');
  const out={kind:row.kind,name:text(row.name),companyName:text(row.companyName),email:text(row.email,254).toLowerCase(),phone:text(row.phone,40).replace(/[\s()-]/g,''),field:text(row.field),location:text(row.location),website:url(row.website),sourceUrl:url(row.sourceUrl)||source.url,jobUrl:jobUrl(row.jobUrl),title:text(row.title),description:text(row.description,16000),country:text(row.country,2),workMode:text(row.workMode,10),employmentType:text(row.employmentType,100)};
  if((out.country&&!/^[A-Z]{2}$/.test(out.country))||!MODES.has(out.workMode)||(out.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))||(out.phone&&!/^\+?[\d٠-٩۰-۹]{6,20}$/.test(out.phone)))fail('راجع الدولة وبيانات التواصل في النتائج.');
  if(out.kind==='company'&&!out.name)fail('اسم الشركة مطلوب.');
  if(out.kind==='job'&&(!out.title||!out.jobUrl))fail('عنوان الوظيفة ورابط الإعلان مطلوبان.');
  return out;
 });
 return {source,rows};
}
module.exports={batch,url};
