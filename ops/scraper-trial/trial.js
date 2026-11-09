'use strict';
async function refresh(){
 const status=document.getElementById('status');status.textContent='جارٍ تحميل النتائج…';
 try{
  const [companies,jobs]=await Promise.all(['/api/companies','/api/discovery/jobs'].map(async url=>{const response=await fetch(url);if(!response.ok)throw new Error('أعد فتح صفحة التجربة.');return response.json();}));
  const tbody=document.getElementById('companies');tbody.replaceChildren();
  for(const company of companies.companies){const tr=document.createElement('tr');for(const value of [company.name,[company.email,company.phone].filter(Boolean).join(' · '),company.location,company.discovery_meta?.sourceUrl||'']){const td=document.createElement('td');td.textContent=value;tr.append(td);}tbody.append(tr);}
  const target=document.getElementById('jobs');target.replaceChildren();for(const job of jobs.jobs){const p=document.createElement('p');p.textContent=job.title+' — '+(job.company_name||'شركة غير محددة');target.append(p);}
  status.textContent=`${companies.companies.length} شركة · ${jobs.jobs.length} وظيفة محفوظة`;
 }catch(error){status.textContent=error.message;}
}
document.getElementById('refresh').addEventListener('click',refresh);refresh();
