'use strict';
let revision=0,lastView='';
async function json(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('تعذر قراءة النتائج؛ افتح صفحة التجربة مجددًا.');return response.json();}
function sourceLink(url){const a=document.createElement('a');a.textContent='فتح المصدر';if(/^https?:\/\//.test(url||'')){a.href=url;a.target='_blank';a.rel='noopener noreferrer';}return a;}
async function refresh(){
 const ticket=++revision,status=document.getElementById('status');
 try{
  const [summary,imports]=await Promise.all([json('/api/discovery/summary'),json('/api/discovery/imports')]);
  const latest=imports.imports[0],all=document.getElementById('all-results').checked;
  const records=!all&&latest?await json('/api/discovery/imports/'+encodeURIComponent(latest.id)):{companies:(await json('/api/companies')).companies,jobs:(await json('/api/discovery/jobs')).jobs};
  if(ticket!==revision)return;
  status.className='success';status.textContent=`الإجمالي: ${summary.companies} شركة · ${summary.jobs} وظيفة — آخر تحديث ${new Date().toLocaleTimeString('ar-EG')}`;
  const receipt=document.getElementById('receipt');receipt.textContent=latest?`آخر دفعة: ${latest.id} · ${latest.result.companiesAdded} شركة جديدة · ${latest.result.jobsAdded} وظيفة جديدة · ${latest.result.jobsUpdated||0} إعلان محدّث · ${latest.result.duplicates} مكررة`:'لا يوجد إيصال حفظ للدفعات القديمة؛ ستظهر إيصالات العمليات الجديدة هنا.';
  if(!all&&latest&&records.verified!==true){status.className='error';status.textContent='بعض سجلات الدفعة غير موجودة. راجع الإضافة قبل إعادة الجمع.';}
  const signature=JSON.stringify({all,records});if(signature===lastView)return;lastView=signature;
  const tbody=document.getElementById('companies');tbody.replaceChildren();
  for(const company of records.companies){const tr=document.createElement('tr');for(const value of [company.name,[company.email,company.phone].filter(Boolean).join(' · '),company.location]){const td=document.createElement('td');td.textContent=value||'—';td.title=value||'';tr.append(td);}const td=document.createElement('td');td.append(sourceLink(company.discovery_meta?.sourceUrl));tr.append(td);tbody.append(tr);}
  const target=document.getElementById('jobs');target.replaceChildren();for(const job of records.jobs){const article=document.createElement('article'),title=document.createElement('strong'),p=document.createElement('p');title.textContent=job.title;p.textContent=(job.company_name||'شركة غير محددة')+' · '+(job.status==='needs_review'?'رابط من نتائج البحث — يحتاج مراجعة الإعلان':'تفاصيل مستخرجة من صفحة الوظيفة');article.append(title,p,sourceLink(job.job_url));target.append(article);}
 }catch(error){if(ticket===revision){status.className='error';status.textContent=error.message;}}
}
document.getElementById('refresh').addEventListener('click',refresh);document.getElementById('all-results').addEventListener('change',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(()=>{if(!document.hidden)refresh();},3000);refresh();
