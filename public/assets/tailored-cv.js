'use strict';
(()=>{
 const mounts=new WeakMap();
 let active=0;const waiting=[];async function limited(fn){if(active<2)active++;else await new Promise(resolve=>waiting.push(resolve));try{return await fn();}finally{const next=waiting.shift();if(next)next();else active--;}}
 const en=()=>document.documentElement.lang==='en',t=(ar,eng)=>en()?eng:ar;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 async function request(path,body){const response=await fetch(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw new Error(data.error||t('تعذر تجهيز السيرة','Could not prepare the CV'));return data;}
 async function mount(host,{companyId,cvId,onReady=()=>{},autoJob=true,beforeChange=async()=>true}){
  const generation={};mounts.set(host,generation);const alive=()=>host.isConnected&&mounts.get(host)===generation;
  host.replaceChildren();host.dataset.userContent='';host.classList.add('tailored-cv');
  let current=null,revision=0,busy=false;
  const heading=el('strong',t('CV مخصص للشركة والوظيفة','CV tailored to this company and role')),status=el('p');status.setAttribute('role','status');
  const settings=el('details'),summary=el('summary',t('تخصيص الوظيفة ووصفها (اختياري)','Choose a role and job description (optional)'));settings.append(summary);
  const label=(text,node)=>{const l=el('label',text);l.append(node);settings.append(l);};
  const jobs=el('select');jobs.className='input';jobs.append(new Option(t('تقديم عام — أو اكتب الوصف أدناه','General application — or enter the description below'),''));label(t('إعلان محفوظ للشركة','Saved job at this company'),jobs);
  const role=el('input');role.className='input';role.maxLength=160;role.dir='auto';label(t('الدور المستهدف','Target role'),role);
  const jd=el('textarea');jd.className='textarea';jd.maxLength=12000;jd.rows=4;jd.dir='auto';label(t('وصف الوظيفة','Job description'),jd);
  const update=el('button',t('تجهيز النسخة المخصصة','Prepare tailored CV'));update.type='button';update.className='btn btn-secondary';settings.append(update);
  const result=el('div');host.append(heading,status,settings,result);
  function invalid(){host.dispatchEvent(new CustomEvent('tailored-cv-change'));current=null;onReady(null);result.replaceChildren();status.textContent=t('اضغط تجهيز النسخة بعد تعديل الاختيارات، وراجع الملف قبل الإرسال.','Prepare again after changing the options, then review the file before sending.');}
  function draw(v){result.replaceChildren();if(v.portfolio){host.replaceChildren(el('p',t('تقديم بالبرتفوليو — روابط الأعمال في الرسالة، بدون مرفق CV.','Portfolio application — project links in the message, no CV attachment.')));return;}
   status.textContent=t('نسخة محفوظة مستقلة: ','Independent saved copy: ')+v.companyName+(v.role?' · '+v.role:'');
   const note=el('p',t('بنرتب الأقسام الموجودة حسب ملاءمتها، من غير إضافة مهارات أو تغيير خبرات. النسخة دي Word وبتختلف عن تنسيق الملف الأصلي.','Existing sections are prioritised for relevance, without adding skills or changing experience. This Word copy uses a new layout.'));note.className='hint';
   const a=el('a',t('تحميل ومراجعة الـCV اللي هيتبعت','Download and review the CV to be sent'));a.className='btn btn-secondary';a.href=v.url;a.target='_blank';a.rel='noopener';
   const source=el('p',t('المصدر: ','Source: ')+(v.sourceFilename||'CV')+' · '+v.filename);source.dir='auto';source.className='hint';
   const checks=v.report?.checks||[],warnings=checks.filter(c=>c.status!=='pass').length;
   const ats=el('p',t('فحص ATS للنسخة: ','ATS check for this copy: ')+t(`${warnings} بند محتاج مراجعة. الفحص إرشادي، مش ضمان قبول.`,`${warnings} items need review. Advisory checks do not guarantee acceptance.`));
   const details=el('details');details.append(el('summary',t('النص المقروء وكلمات من بيانات السيرة','Extracted text and source-fact keywords')));const pre=el('pre',v.content);pre.dir='auto';
   const keywords=v.report?.keywords;details.append(el('p',keywords?t('موجودة: ','Matched: ')+keywords.matched.join(', ')+' · '+t('غير موجودة (لم تُضف): ','Missing (not added): ')+keywords.missing.join(', '):t('لم يتم إدخال وصف وظيفة؛ التخصيص للشركة والدور فقط.','No job description supplied; tailoring uses the company and role only.')),pre);
   result.append(note,a,source,ats,details);
  }
  async function prepare(options,initial=false){if(busy||!alive())return;if(options&&!initial&&!await beforeChange())return;if(!alive())return;busy=true;const token=++revision;current=null;onReady(null);update.disabled=true;jobs.disabled=role.disabled=jd.disabled=true;status.textContent=t('بنجهز ونفحص المرفق المخصص…','Preparing and checking the tailored attachment…');
   try{const v=await limited(()=>alive()?request('/api/cv/tailor',{companyId,cvId,...(options?{options}:{})}):Promise.reject(new Error('Preview closed')));if(token!==revision||!alive())return;current=v;cvId=v.id;role.value=v.role||'';jd.value=v.jobDescription||'';jobs.value=v.jobId||'';draw(v);onReady(v);}
   catch(e){status.textContent=e.message;settings.open=true;result.replaceChildren();}
   finally{if(token===revision){busy=false;update.disabled=false;jobs.disabled=role.disabled=jd.disabled=false;}}
  }
  role.addEventListener('input',()=>{jobs.value='';invalid();});jd.addEventListener('input',()=>{jobs.value='';invalid();});jobs.addEventListener('change',()=>{const option=jobs.selectedOptions[0];role.value=option.dataset.role||'';jd.value=option.dataset.description||'';invalid();});
  update.onclick=()=>prepare({role:role.value,jobDescription:jd.value,jobId:jobs.value});
  let savedJobs=[];try{savedJobs=await request('/api/cv/tailor/jobs?companyId='+encodeURIComponent(companyId));for(const job of savedJobs){const o=new Option(job.title,job.id);o.dataset.role=job.title;o.dataset.description=job.description;jobs.append(o);}}catch{/* Manual targeting remains available. */}
  await prepare(autoJob&&savedJobs.length===1?{jobId:savedJobs[0].id}:undefined,true);return {get value(){return current;}};
 }
 window.MrsaalTailoredCV={mount};
})();
