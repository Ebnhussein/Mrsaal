/* global api,openSettings */
(()=>{'use strict';
 const root=document.getElementById('cv-ats-panel');if(!root)return;root.dataset.userContent='';
 let active=null,selected=null,result=null,job='',busy=false,error='',revision=0,pending=Promise.resolve(),revisionDraft='',editing=false,saveError='',aiReview=null,aiBusy=false,aiError='';
 const t=(ar,en)=>document.documentElement.lang==='en'?en:ar;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 function cleanATSFormatting(text){
  const lines=String(text||'').replace(/\r\n?/g,'\n').split('\n');
  const headings=new Map([
   ['professional profile','Professional Summary'],['profile summary','Professional Summary'],['about me','Professional Summary'],
   ['work history','Experience'],['employment history','Experience'],['professional experience','Experience'],
   ['key skills','Skills'],['technical skills','Skills'],['core competencies','Skills'],['academic background','Education'],
   ['النبذة المهنية','الملخص المهني'],['نبذة عني','الملخص المهني'],['الخبرات المهنية','الخبرات العملية'],
   ['المهارات التقنية','المهارات'],['المؤهلات العلمية','التعليم']
  ]);
  return lines.map(line=>{
   const trimmed=line.trim(),key=trimmed.replace(/[:：]$/,'').toLowerCase();
   return headings.has(key)?headings.get(key):line.replace(/[ \t]+$/g,'');
  }).join('\n').replace(/\n{4,}/g,'\n\n\n').trim();
 }
 const names={text:['قراءة النص من الملف','File text extraction'],contact:['البريد ورقم الهاتف','Email and phone'],summary:['ملخص مهني','Professional summary'],skills:['قسم المهارات','Skills section'],evidence:['الخبرات أو المشروعات','Experience or projects'],education:['التعليم','Education'],dates:['تواريخ الخبرة والتعليم','Experience and education dates'],layout:['بنية المستند','Document structure'],achievements:['الإنجازات والنتائج','Measurable achievements'],length:['طول السيرة','Resume length']};
 const advice={text:['لو الملف مصوّر أو فيه صفحات بدون نص، استخرج النص بـ OCR ثم صدّره من جديد.','For image-only files or pages without text, run OCR and export again.'],contact:['راجع وجود بريد إلكتروني ورقم هاتف مكتوبين كنص، مش صورة.','Check that email and phone are present as real text, not an image.'],summary:['استخدم عنوانًا واضحًا زي «الملخص المهني» أو Professional Summary.','Use a clear heading such as Professional Summary.'],skills:['استخدم عنوانًا واضحًا لقسم المهارات واكتب مهاراتك الحقيقية.','Use a clear Skills heading and list your actual skills.'],evidence:['استخدم عنوان خبرات أو مشروعات، ووضح دورك الحقيقي.','Use Experience or Projects headings and describe your actual contribution.'],education:['ضيف تعليمك لو مناسب، بعنوان واضح. الملاحظة لا تمنع التقديم.','Add relevant education under a clear heading. This warning does not block applying.'],dates:['راجع التواريخ وترتيبها بنفسك. قراءة النص لا تؤكد صحة الفترة أو اكتمالها.','Review dates and their order. Text extraction does not prove dates are correct or complete.'],layout:['راجع الملف بصريًا: خلي القراءة بترتيب واضح، وتجنب وضع بيانات التواصل في الهيدر أو مربعات النص.','Check reading order, avoid contact details in headers or text boxes.'],achievements:['لو عندك إنجازات قابلة للقياس، اكتب النتيجة الحقيقية من غير اختراع أرقام.','Add verified measurable outcomes where possible; never invent figures.'],length:['راجع التكرار والتفاصيل غير المرتبطة بالوظيفة، من غير حذف خبرة مهمة.','Trim redundant or irrelevant details without removing important experience.']};
 function button(ar,en,fn){const b=node('button',t(ar,en),'btn btn-primary');b.type='button';b.disabled=busy;b.onclick=fn;return b;}
 async function run(){if(!selected||busy)return;const token=++revision,id=selected.id;busy=true;error='';result=null;draw();try{const description=job;const work=pending.then(()=>token===revision?api('/api/cv/ats','POST',{cvId:id,jobDescription:description}):null);pending=work.then(()=>{},()=>{});const response=await work;if(token!==revision)return;selected=response.cv;result=response.report;}catch(e){if(token!==revision)return;error=e.message;}finally{if(token===revision){busy=false;draw();}}}
 function draw(){
  root.replaceChildren();root.hidden=!selected;if(!selected)return;root.setAttribute('aria-busy',String(busy));
  const head=node('div',null,'ats-heading');head.append(node('h3',t('فحص جاهزية الـ ATS','ATS readiness check')),node('span',t('محلي · بدون إرسال ملفك لخدمة خارجية','Local · no external file sharing'),'ats-local'));root.append(head,node('p',t('للسيرة المنشأة هنا أو المرفوعة. بنفحص الملف اللي هيتبعت؛ الفحص إرشادي ومش ضمان قبول في كل أنظمة ATS.','For CVs built here or uploaded. We inspect the file that will be sent; checks are advisory, not a guarantee of acceptance by every ATS.'),'hint'));
  const target=node('p',t('النسخة المفحوصة: ','Checking version: ')+(selected.name||selected.filename||'CV'),'ats-version');target.dir='auto';root.append(target);if(active&&selected.id!==active.id)root.append(node('p',t('دي نسخة أخرى محفوظة. الفحص لا يغيّر نسخة التقديم المستخدمة.','This is another saved version. Checking it does not change your active application profile.'),'ats-note'));
  const details=node('details',null,'ats-job');details.open=!!job;details.append(node('summary',t('مقارنة بوصف وظيفة (اختياري)','Compare with a job description (optional)')));const label=node('label',t('وصف الوظيفة','Job description'));label.htmlFor='ats-job-description';const input=node('textarea',null,'textarea');input.id='ats-job-description';input.maxLength=12000;input.rows=4;input.value=job;input.dir='auto';input.disabled=busy;input.oninput=()=>{job=input.value;result=null;const report=root.querySelector('.ats-results');if(report)report.replaceChildren(node('p',t('الوصف اتغير. اضغط إعادة الفحص لتحديث النتيجة.','Description changed. Run the check again to update the result.'),'ats-note'));};details.append(label,input,node('small',t('مطابقة كلمات فقط؛ لا نضيف مهارات ولا نعدّل سيرتك تلقائيًا.','Word overlap only; no skills are added and your CV is not rewritten.')));root.append(details);
  const actions=node('div',null,'ats-actions');actions.append(button(busy?'جاري فحص الملف…':'إعادة فحص ATS',busy?'Checking file…':'Run ATS check again',run));const status=node('span',busy?t('جاري قراءة النسخة المحددة…','Reading the selected version…'):result?t('اكتمل الفحص المحلي','Local check complete'):'');status.setAttribute('role','status');actions.append(status);root.append(actions);
  if(error){const alert=node('p',error,'ats-error');alert.setAttribute('role','alert');root.append(alert);}if(!result)return;
  const report=node('div',null,'ats-results'),source=result.source;
  const downloadable=['builder','tailored','ats-revised'].includes(selected.kind);
  if(downloadable){
   const exportRow=node('div',null,'ats-actions ats-export-actions');
   const wordLink=node('a',t('تحميل Word','Download Word'),'btn btn-secondary');wordLink.href='/api/cv/export/docx?cvId='+encodeURIComponent(selected.id);
   const pdfLink=node('a',t('حفظ PDF','Save PDF'),'btn btn-secondary');pdfLink.href='/api/cv/print?cvId='+encodeURIComponent(selected.id);pdfLink.target='_blank';pdfLink.rel='noopener noreferrer';
   exportRow.append(wordLink,pdfLink);
   if(selected.kind==='builder'&&window.MrsaalProfileBuilder?.edit){
    const editButton=button('تعديل CV الأصلي','Edit original CV',()=>window.MrsaalProfileBuilder.edit(selected.id));
    editButton.className='btn btn-secondary';exportRow.append(editButton);
   }
   report.append(exportRow);
   report.append(node('p',t('التحميل خاص بالنسخة اللي أنشأها مرسال أو اللي راجعتها وحفظتها هنا. PDF يفتح صفحة جاهزة للطباعة والحفظ.','Downloads use the CV built by Mrsaal or the reviewed version saved here. PDF opens a print-ready page.'),'ats-export-note'));
  }else{
   report.append(node('p',t('دي النسخة الأصلية المرفوعة. علشان تحمّل Word أو PDF محسّن، راجع النص واحفظ نسخة ATS جديدة الأول. الملف الأصلي مش هيتغير.','This is the uploaded original. Review and save a new ATS version before downloading Word or PDF. Your original is unchanged.'),'ats-note'));
  }
  report.append(node('p',(source.attachment?t('مصدر الفحص: المرفق الأصلي','Checked source: original attachment'):t('مصدر الفحص: النص المحفوظ، بدون مرفق','Checked source: saved text, no attachment'))+' · '+source.format.toUpperCase()+(source.pages?' · '+source.scannedPages+'/'+source.pages+' '+t('صفحة','pages'):''),'ats-source'));
  if(source.textDiffersFromSaved)report.append(node('p',t('النص المحفوظ مختلف عن المرفق. النتيجة هنا تخص الملف الأصلي اللي هيتبعت، مش النص المعدّل. لو عايز تغيّر الملف، عدّله وارفع نسخة جديدة.','Saved text differs from the attachment. This result checks the original file that will be sent, not edited text. To change the file, edit it and upload a new version.'),'ats-note'));
  if(source.partial||source.pagesWithNoText)report.append(node('p',t('الفحص غير مكتمل أو فيه صفحات بدون نص. راجع النص المقروء أدناه؛ لا تعتمد على النتيجة كفحص شامل.','The scan is partial or includes pages with no text. Review extracted text below; this is not a complete file check.'),'ats-note'));
  if(source.bytes>2.5*1024*1024)report.append(node('p',t('حجم الملف كبير. راجع حد الملفات المسموح في موقع التقديم.','This is a large file. Check the receiving site’s file-size limit.'),'ats-note'));
  // A human-readable overview, not a simulated employer ATS score.
  const checks=result.checks||[];
  const passed=checks.filter(c=>c.status==='pass').length;
  const review=checks.filter(c=>c.status==='warning').length;
  const manual=checks.filter(c=>c.status==='unknown').length;
  const overview=node('section',null,'ats-overview');
  overview.setAttribute('aria-label',t('ملخص الفحص','Check overview'));
  const summaryHead=node('div',null,'ats-overview-heading');
  summaryHead.append(node('div',null,'ats-overview-icon'));
  summaryHead.firstChild.textContent=review?'!':'✓';
  const summaryText=node('div',null,'ats-overview-copy');
  summaryText.append(node('strong',review?t('فيه نقاط محتاجة تحسين','Some items need attention'):t('الفحوص المتاحة مكتملة','Available checks look good')),
   node('span',t('النتيجة إرشادية وبتعتمد على النص المستخرج من الملف.','Advisory results based on extracted document text.')));
  summaryHead.append(summaryText);overview.append(summaryHead);
  const metrics=node('div',null,'ats-overview-metrics');
  for(const [number,ar,en,kind] of [[passed,'متوافق','Passed','pass'],[review,'يحتاج تحسين','Needs attention','warn'],[manual,'مراجعة يدوية','Manual review','manual']]){
   const metric=node('div',null,'ats-overview-metric ats-metric-'+kind);
   metric.append(node('strong',String(number)),node('span',t(ar,en)));metrics.append(metric);
  }
  overview.append(metrics);
  if(result.keywords){
   const match=node('div',null,'ats-overview-match');
   const label=node('div',null,'ats-overview-match-label');
   label.append(node('strong',t('تغطية كلمات الوظيفة','Job description keyword coverage')),node('span',result.keywords.matchPercent+'%'));
   const track=node('div',null,'ats-overview-track'),fill=node('div',null,'ats-overview-fill');
   fill.style.width=Math.max(0,Math.min(100,result.keywords.matchPercent||0))+'%';
   track.append(fill);match.append(label,track,node('small',t('دي مطابقة كلمات فقط، مش نسبة قبول من الشركة.','Keyword overlap only, not an employer acceptance score.')));
   overview.append(match);
  }
  report.append(overview);
  report.append(node('h4',t('تفاصيل فحص الملف','Detailed document checks'),'ats-section-title'));
  const adviceIntro=node('p',t('الأولويات: أصلح مشاكل القراءة والتواصل الأول، وبعدها حسّن الأقسام والمحتوى. علامة المراجعة اليدوية مش معناها إن القسم ناقص.','Priorities: fix parsing and contact details first, then refine sections and content. Manual review does not mean the content is absent.'),'ats-note');
  report.append(adviceIntro);
  for(const group of [
   {name:t('قراءة الملف والتوافق التقني','Parsing and technical compatibility'),ids:['text','layout','contact']},
   {name:t('الأقسام والمحتوى','Sections and content quality'),ids:['summary','skills','evidence','education','dates','achievements','length']}
  ]){
   const groupChecks=result.checks.filter(c=>group.ids.includes(c.id));
   if(!groupChecks.length)continue;
   const section=node('section',null,'ats-check-group');
   const groupTitle=node('h4',group.name,'ats-check-group-title');
   section.append(groupTitle);
   const list=node('ul',null,'ats-checks');
   for(const c of groupChecks){
    const item=node('li',null,'ats-check ats-'+c.status),title=node('strong',t(...(names[c.id]||[c.id,c.id])));
    const label=node('span',c.status==='pass'?t('✓ متحقق','✓ Checked'):c.status==='unknown'?t('○ مراجعة يدوية','○ Manual review'):t('△ يحتاج مراجعة','△ Review needed'),'ats-check-state');
    item.append(title,label);
    if(c.status!=='pass')item.append(node('p',t(...(advice[c.id]||['راجع البيانات المستخرجة من السيرة.','Review extracted CV data.']))));
    list.append(item);
   }
   section.append(list);report.append(section);
  }
  if(result.keywords){report.append(node('h4',t('نسبة تغطية كلمات الوظيفة: ','Job keyword coverage: ')+result.keywords.matchPercent+'%'),node('p',t('النسبة بتقيس الكلمات الفريدة المشتركة بين الملف والوصف، مش فرصة القبول أو نتيجة ATS فعلية.','Unique-term overlap only; not an acceptance probability or a real employer ATS score.'),'ats-note'));report.append(node('h4',t('تفاصيل الكلمات المتطابقة والناقصة','Matched and missing terms')));for(const [key,ar,en]of [['matched','موجودة في النسخة','Present in this version'],['missing','غير موجودة — أضفها فقط لو حقيقية','Missing — add only if true']]){const block=node('section');block.append(node('h5',t(ar,en)));const chips=node('div',null,'ats-keywords');for(const term of result.keywords[key])chips.append(node('span',term,'ats-chip'));if(!result.keywords[key].length)chips.append(node('span','—'));block.append(chips);report.append(block);}}
  const aiBox=node('section',null,'ats-ai-review');
  const aiTitle=node('div',null,'ats-ai-review-title');
  aiTitle.append(node('strong',t('مساعد تحسين الـCV بالذكاء الاصطناعي','AI resume improvement assistant')),
    node('small',t('بيستخدم موديلات AI اللي ربطتها في إعدادات مرسال','Uses the AI models connected in your Mrsaal settings')));
  aiBox.append(aiTitle);
  const aiBtn=button(aiBusy?'جاري تحليل الـCV…':'تحليل واقتراح تحسينات بالـAI',aiBusy?'Analyzing resume…':'Analyze and suggest AI improvements',async()=>{
   if(aiBusy||busy)return;
   aiBusy=true;aiError='';aiReview=null;const forId=selected.id,description=job;draw();
   try{
    const response=await api('/api/cv/ats/ai-review','POST',{cvId:forId,jobDescription:description});
    if(selected?.id!==forId)return;
    aiReview=response.review;
   }catch(e){aiError=e.message;}finally{aiBusy=false;draw();}
  },true);
  aiBtn.disabled=busy||aiBusy;aiBox.append(aiBtn);
  aiBox.append(node('p',t('الاقتراحات مش بتتطبق ولا بتتحفظ تلقائيًا. راجع كل تغيير قبل اعتماد نسخة جديدة.','Suggestions are never automatically applied or saved. Review all changes before approving a new version.'),'ats-export-note'));
  if(aiError){const e=node('p',aiError,'ats-error');e.setAttribute('role','alert');aiBox.append(e);}
  if(aiReview){
   const hdr=node('h4',t('التحسينات المقترحة','Suggested improvements'));aiBox.append(hdr);
   const suggestions=node('div',null,'ats-ai-suggestions');
   for(const item of aiReview.suggestions){
    const row=node('article',null,'ats-ai-suggestion');
    row.append(node('strong',item.suggestion));
    if(item.reason)row.append(node('p',item.reason));
    if(item.original)row.append(node('small',t('الأصل: ','Original: ')+item.original));
    suggestions.append(row);
   }
   if(!aiReview.suggestions.length)suggestions.append(node('p',t('مفيش تعديلات آمنة إضافية اقترحها الموديل.','The model proposed no additional safe edits.')));
   aiBox.append(suggestions);
   if(aiReview.factWarnings?.requiresReview){
    aiBox.append(node('p',t('تحذير: الموديل أضاف أرقام أو بيانات تواصل مش موجودة بالنص الأصلي. راجعها واحذف أي معلومة غير صحيحة.','Warning: the model introduced new numbers or contact details. Verify them and remove any unsupported information.'),'ats-error'));
   }
   const preview=node('details',null,'ats-ai-preview');
   preview.append(node('summary',t('معاينة النص المقترح كاملًا','Preview proposed full resume')));
   const pre=node('pre',aiReview.revisedText);pre.dir='auto';preview.append(pre);aiBox.append(preview);
   if(['cv','docx','ats-revised'].includes(selected.kind)){
    const apply=button('نقل الاقتراح للمحرر للمراجعة','Move draft to editor for review',()=>{
     revisionDraft=aiReview.revisedText;editing=true;draw();
     root.querySelector('#ats-revision-text')?.scrollIntoView({behavior:'smooth',block:'center'});
    });aiBox.append(apply);
   }else{
    aiBox.append(node('p',t('ده CV معمول على مرسال. علشان تحافظ على البيانات المنظمة، افتح المحرر وعدّل الحقول بمراجعتك بدل استبدال الملف بنص AI.','This resume was built in Mrsaal. Edit its structured fields after reviewing suggestions instead of replacing the file with AI text.'),'ats-note'));
    const edit=button('فتح محرر الـCV','Open CV editor',()=>window.MrsaalProfileBuilder?.edit(selected.id));aiBox.append(edit);
   }
  }
  report.append(aiBox);
  if(['cv','docx','ats-revised'].includes(selected.kind)){
   const editor=node('section',null,'ats-revision'),header=node('div',null,'ats-revision-header');
   header.append(node('h4',t('جهّز نسخة ATS قابلة للتحميل','Prepare an ATS-ready downloadable copy')));
   editor.append(header,node('p',t('النص المستخرج من ملفك قابل للتعديل. صحّح التنسيق والعناوين فقط وأضف معلومات حقيقية. الحفظ ينشئ نسخة مستقلة Word قابلة للتحويل لـPDF؛ مش هيغيّر الأصل.','Edit the extracted CV text. Correct formatting and headings, and only add true facts. Saving creates a separate Word/PDF-exportable copy without changing the uploaded original.'),'ats-export-note'));
   const toggle=button('مراجعة وتعديل النسخة','Review and edit copy',async()=>{
    if(editing){editing=false;draw();return;}
    try{const response=await api('/api/cv/ats/text?cvId='+encodeURIComponent(selected.id));revisionDraft=response.content;editing=true;saveError='';draw();}
    catch(e){saveError=e.message;draw();}
   });toggle.className='btn btn-secondary';editor.append(toggle);
   if(editing){
    const label=node('label',t('نص النسخة الجديدة','Text of new version'),'ats-revision-label');label.htmlFor='ats-revision-text';
    const textarea=node('textarea',null,'textarea ats-revision-input');textarea.id='ats-revision-text';textarea.rows=16;textarea.dir='auto';textarea.maxLength=180000;textarea.value=revisionDraft;textarea.disabled=busy;textarea.addEventListener('input',()=>{revisionDraft=textarea.value;});
    const confirm=node('label',null,'ats-revision-confirm'),checkbox=node('input');checkbox.type='checkbox';checkbox.disabled=busy;
    confirm.append(checkbox,node('span',t('راجعت كل البيانات والتعديلات، ومفيش مهارات أو خبرات غير حقيقية.','I verified the details and changes; no fabricated experience or skills.')));
    const saveBtn=button('حفظ نسخة جديدة وتحميلها','Save new copy for download',async()=>{
     if(!checkbox.checked||busy){saveError=t('لازم تراجع وتوافق على صحة النسخة أولًا.','Review and confirm the copy first.');draw();return;}
     busy=true;saveError='';saveBtn.disabled=true;
     try{
      const saved=await api('/api/cv/ats/revision','POST',{cvId:selected.id,content:revisionDraft,confirmed:true});
      selected={id:saved.id,name:saved.name,kind:saved.kind};active=selected;revisionDraft='';editing=false;result=null;busy=false;
      if(typeof window.loadCV==='function')await window.loadCV();
      await run();
     }catch(e){busy=false;saveError=e.message;draw();}
    },true);
    const formatBtn=button('ترتيب عناوين ومسافات الـCV','Normalize headings and spacing',()=>{
     revisionDraft=cleanATSFormatting(textarea.value);textarea.value=revisionDraft;
    });formatBtn.className='btn btn-secondary';
    editor.append(label,textarea,formatBtn,confirm,saveBtn);
   }
   if(saveError)editor.append(node('p',saveError,'ats-error'));
   report.append(editor);
  }
  const extracted=node('details',null,'ats-extracted');extracted.append(node('summary',t('راجع النص اللي قدرنا نقرأه','Review the text we could extract')));const pre=node('pre',result.textPreview||t('لم نتمكن من استخراج نص مقروء.','No readable text could be extracted.'));pre.dir='auto';extracted.append(pre);if(result.previewTruncated)extracted.append(node('p',t('المعاينة مختصرة؛ فحص النص شمل النص المقروء كاملًا ضمن حدود القراءة.','Preview is shortened; checks used all text extracted within the reading limits.')));report.append(extracted);root.append(report);
 }
 window.MrsaalATS={render(cv){++revision;active=cv;selected=cv?.kind==='portfolio'?null:cv;result=null;error='';busy=false;revisionDraft='';editing=false;saveError='';aiReview=null;aiError='';aiBusy=false;draw();if(selected)void run();},open(id,name){++revision;busy=false;selected={id,name};result=null;error='';revisionDraft='';editing=false;saveError='';aiReview=null;aiError='';aiBusy=false;openSettings('cv');draw();root.scrollIntoView({behavior:'smooth',block:'start'});void run();}};
 document.addEventListener('mrsaal:language',draw);
})();
