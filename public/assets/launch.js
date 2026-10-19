'use strict';
(()=>{const translations=new Map();const en=()=>document.documentElement.lang==='en',tr=(a,b)=>{translations.set(a,[a,b]);translations.set(b,[a,b]);return en()?b:a;},el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined){n.textContent=text;const pair=translations.get(text);if(pair){n.dataset.launchAr=pair[0];n.dataset.launchEn=pair[1];}}return n;};
 async function request(path,method='GET',data){if(path==='/api/companies'&&method==='GET'){const rows=[];let offset=0;do{const page=await request('/api/companies?offset='+offset+'&limit=250');rows.push(...page.companies);offset=page.nextOffset;}while(offset!==null);return rows;}const endQueue=method==='POST'&&path.endsWith('/generate')?window.MrsaalAIQueue?.start(document.querySelector('dialog[open] .launch-status')):null;let r;try{r=await fetch(path,{method,headers:{'Content-Type':'application/json','X-Mrsaal-Launch':'1'},...(data?{body:JSON.stringify(data)}:{})});}catch(e){throw new Error(window.MrsaalErrors?.network(false)||(en()?'Connection interrupted. Try later.':'الاتصال اتقطع. حاول لاحقًا.'));}finally{endQueue?.();}const d=await r.json();if(!r.ok)throw window.MrsaalErrors?window.MrsaalErrors.from(d,r.status):Object.assign(new Error(d.error||(en()?'Request failed':'تعذر تنفيذ الطلب')),{code:d.code,httpStatus:r.status});return d;}
 function stateLabel(value){const labels={draft:['مسودة','Draft'],ready:['معتمدة','Approved'],generating:['يكتب المسودة','Writing'],processing:['جاري الإرسال','Sending'],running:['نشطة','Running'],paused:['متوقفة مؤقتًا','Paused'],completed:['اكتملت','Completed'],sent:['تم الإرسال','Sent'],failed:['فشلت','Failed'],uncertain:['نتيجة غير مؤكدة','Uncertain'],skipped:['تم التخطي','Skipped'],cancelled:['ملغاة','Cancelled']};return labels[value]?tr(...labels[value]):value;}
 function button(text,fn){const b=el('button',text);b.className='btn btn-secondary';b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){window.toast?.(e.message,'error');const status=b.closest('dialog')?.querySelector('.launch-status');if(status)status.textContent=e.message;}finally{b.disabled=false;}};return b;}
 function popup(title){const d=el('dialog');d.className='launch-dialog';d.dir=en()?'ltr':'rtl';d.dataset.userContent='';const head=el('div');head.className='launch-dialog-head';const close=button('×',()=>d.close());close.className='launch-close';close.setAttribute('aria-label',tr('إغلاق','Close'));head.append(el('h2',title),close);const status=el('p');status.className='launch-status';status.setAttribute('role','status');d.append(head,status);document.body.append(d);d.onclose=()=>d.remove();d.showModal();return d;}
 function field(container,label,value='',type='text'){const l=el('label',label),input=el(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.className=type==='textarea'?'textarea':'input';input.value=value;l.append(input);container.append(l);return input;}
 async function cvs(){const d=popup(tr('نسخ السيرة الذاتية','Your CV versions'));const rows=await request('/api/cv/list');for(const cv of rows){const card=el('section');card.className='launch-card';card.append(el('h3',(cv.name||cv.filename)+(cv.active?tr(' · مستخدمة حاليًا',' · Active'):'')),el('p',cv.has_attachment?'PDF':tr('نص فقط','Text only')),button(tr('استخدم النسخة','Use this version'),async()=>{await request('/api/cv/select','POST',{id:cv.id});d.close();await loadCV();await cvs();}),button(tr('حذف النسخة','Delete version'),async()=>{if(!await confirmCVDeletion(cv,cv.active))return;await request('/api/cv/'+encodeURIComponent(cv.id),'DELETE');d.close();await loadCV();await cvs();}));d.append(card);}if(!rows.length)d.append(el('p',tr('ارفع أول سيرة من الإعدادات.','Upload your first CV from Settings.')));}
 async function followup(){
  const d=popup(tr('قوائم الشركات والمتابعة','Company lists and follow-up'));d.classList.add('followup-smart');
  const rows=await request('/api/companies');if(!d.isConnected)return;
  const filter=field(d,tr('فلترة باسم القائمة أو الشركة','Filter by list or company'));filter.parentElement.classList.add('followup-filter');
  const content=el('div');content.className='followup-content';d.append(content);
  const cache=new Map();let navigator;
  function cardFor(co){
   if(cache.has(co.id))return cache.get(co.id);
   const card=el('section');card.className='launch-card';card.append(el('h3',co.name));
   const list=field(card,tr('القائمة','List'),co.list_name||''),notes=field(card,tr('ملاحظات خاصة','Private notes'),co.notes||'','textarea'),status=el('select');
   for(const [v,a,b]of [['not_started','لم تبدأ','Not started'],['applied','تم التقديم','Applied'],['follow_up','متابعة','Follow up'],['interview','مقابلة','Interview'],['offer','عرض','Offer'],['rejected','رفض','Rejected'],['closed','مغلقة','Closed']]){const opt=el('option',tr(a,b));opt.value=v;status.append(opt);}
   status.value=co.followup_status||'not_started';const label=el('label',tr('مرحلة التقديم','Application stage'));label.append(status);card.append(label);
   const reminder=field(card,tr('تذكير اختياري','Optional reminder'),'','datetime-local');
   card.append(button(tr('حفظ المتابعة','Save follow-up'),async()=>{const values={listName:list.value,notes:notes.value,status:status.value,remindAt:reminder.value||null};await request('/api/launch/companies/'+encodeURIComponent(co.id),'PATCH',values);co.list_name=values.listName;d.querySelector('.launch-status').textContent=tr('اتحفظت المتابعة','Follow-up saved');}));cache.set(co.id,card);return card;
  }
  const render=()=>{content.replaceChildren();const matches=rows.filter(c=>(c.name+' '+(cache.get(c.id)?.querySelector('input')?.value??c.list_name??'')).toLowerCase().includes(filter.value.toLowerCase()));
   for(const co of matches.slice(0,100))content.append(cardFor(co));
   if(!matches.length)content.append(el('p',tr('مفيش شركات مطابقة للبحث.','No matching companies.')));
   if(matches.length>100)content.append(el('p',tr('ظاهر أول ١٠٠ شركة؛ استخدم البحث لتضييق النتائج.','Showing the first 100 companies; narrow your search.')));
   content.scrollTop=0;navigator?.refresh();
  };filter.oninput=render;render();
  navigator=window.MrsaalSmartScroll?.attach({root:d,scroller:content,host:d,items:()=>[...content.querySelectorAll('.launch-card')],label:item=>item.querySelector('h3').textContent});
  // Keep the navigation after the scrolling body, while header and search stay fixed.
  const bar=d.querySelector('.smart-scroll-bar');if(bar)d.append(bar);
  d.addEventListener('close',()=>navigator?.destroy(),{once:true});
 }

 async function campaigns(){
  const d=popup(tr('حملات الإرسال','Sending campaigns'));d.classList.add('followup-smart','campaigns-smart');
  const intro=el('p',tr('راجع حملاتك، واعرف حالة الرسائل، وكمّل من آخر خطوة.','Review your campaigns, check message status and pick up where you left off.'));intro.className='campaigns-intro';d.append(intro);
  const content=el('div');content.className='followup-content campaign-list';d.append(content);
  const footer=el('div');footer.className='campaigns-footer';d.append(footer);
  let navigator,loading=false;
  const refresh=button(tr('تحديث الحملات','Refresh campaigns'),async()=>{const before=refresh.textContent;refresh.textContent=tr('جاري التحديث…','Refreshing…');try{await load();}finally{refresh.textContent=before;}});refresh.classList.add('campaign-refresh');footer.append(refresh);
  function icon(name){const span=el('span',name);span.className='material-symbols-outlined';span.setAttribute('aria-hidden','true');return span;}
  function campaignCard(c,index){
   const card=el('section');card.className='launch-card campaign-card';
   const heading=el('div');heading.className='campaign-card-heading';const channel=el('div');channel.className='campaign-channel';
   const mark=el('span');mark.className='campaign-channel-icon';mark.append(icon(c.channel==='whatsapp'?'chat':'mail'));
   const copy=el('div'),title=el('h3',(c.channel==='whatsapp'?tr('حملة واتساب','WhatsApp campaign'):tr('حملة إيميل','Email campaign'))+' · '+(index+1));copy.append(title);
   const created=new Date(c.created_at);if(c.created_at&&Number.isFinite(created.getTime())){const time=el('time',created.toLocaleString(en()?'en-GB':'ar-EG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}));time.dateTime=created.toISOString();copy.append(time);}
   channel.append(mark,copy);const badge=el('span',stateLabel(c.status));badge.className='campaign-state';badge.dataset.state=c.status;heading.append(channel,badge);card.append(heading);
   const counts=el('div');counts.className='campaign-counts';
   for(const [state,count]of Object.entries(c.counts||{})){const value=Number(count);if(!Number.isFinite(value)||value<=0)continue;const chip=el('span'),number=el('strong',String(value));chip.append(number,el('span',stateLabel(state)));counts.append(chip);}
   if(!counts.children.length)counts.append(el('span',tr('لا توجد رسائل في الحملة.','No messages in this campaign.')));card.append(counts);
   const actions=el('div');actions.className='campaign-card-actions';const open=button(tr('فتح ومراجعة','Open and review'),async()=>{d.close();await review(c.id);});open.classList.add('campaign-open');actions.append(open);
   async function apply(action){
    if(action==='cancel'&&!await window.MrsaalDialog.confirm(tr('إلغاء الرسائل المتبقية؟ الرسالة الجاري إرسالها قد تصل.','Cancel remaining messages? An in-flight message may still arrive.')))return;
    await request('/api/campaigns/'+c.id+'/'+action,'POST',{});await load();
   }
   if(c.status==='running')actions.append(button(tr('إيقاف مؤقت','Pause'),()=>apply('pause')));
   if(c.status==='paused'){
    const resume=button(tr('استكمال','Resume'),()=>apply('resume'));
    const needsReview=['draft','generating'].some(key=>Number(c.counts?.[key])>0);resume.disabled=needsReview;actions.append(resume);
    if(needsReview){const hint=el('p',tr('راجع واعتمد المسودات المتبقية قبل الاستكمال.','Review and approve the remaining drafts before resuming.'));hint.className='campaign-action-hint';card.append(hint);}
   }
   if(['draft','paused','running'].includes(c.status)){const cancel=button(tr('إلغاء الحملة','Cancel campaign'),()=>apply('cancel'));cancel.classList.add('campaign-cancel');actions.append(cancel);}
   card.append(actions);return card;
  }
  async function load(){
   if(loading)return;loading=true;refresh.disabled=true;content.setAttribute('aria-busy','true');
   const status=d.querySelector('.launch-status');status.textContent=tr('جاري تحميل الحملات…','Loading campaigns…');
   try{
    const rows=await request('/api/campaigns');if(!d.isConnected)return;
    const top=content.scrollTop;content.replaceChildren();
    if(!rows.length){const empty=el('div');empty.className='campaigns-empty';empty.append(icon('outgoing_mail'),el('h3',tr('لسه مفيش حملات','No campaigns yet')),el('p',tr('حدّد الشركات وجهّز رسائلك عشان تبدأ أول حملة.','Select companies and prepare your messages to create your first campaign.')));content.append(empty);}
    else rows.forEach((c,index)=>content.append(campaignCard(c,index)));
    const note=el('details');note.className='campaigns-note';note.append(el('summary',tr('عن تشغيل وإيقاف الحملات','About running and pausing campaigns')),el('p',tr('راجع واعتمد كل مسودة قبل بدء الحملة. تقدر تقفل الصفحة؛ السيرفر يكمل. الإيقاف يؤثر على الرسائل التالية، والرسالة الجاري إرسالها قد تصل.','Review and approve every draft before starting. The server continues after you close the page. Pausing affects upcoming messages; an in-flight message may still arrive.')));content.append(note);
    content.scrollTop=top;navigator?.refresh();status.textContent='';
   }catch(error){status.textContent=error.message||tr('تعذر تحميل الحملات. جرّب التحديث.','Could not load campaigns. Try refreshing.');}
   finally{loading=false;refresh.disabled=false;content.setAttribute('aria-busy','false');}
  }
  navigator=window.MrsaalSmartScroll?.attach({root:d,scroller:content,host:footer,items:()=>[...content.querySelectorAll('.campaign-card')],label:card=>card.querySelector('h3').textContent});
  d.addEventListener('close',()=>navigator?.destroy(),{once:true});await load();
 }

 async function writeDraft(card,subject,body,write,approve,generate){
  if(card.getAttribute('aria-busy')==='true')return;
  let status=card.querySelector('.draft-generation-status');
  if(!status){status=el('p');status.className='draft-generation-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');card.append(status);}
  const spinner=el('span');spinner.className='draft-spinner';spinner.setAttribute('aria-hidden','true');
  status.replaceChildren(spinner,el('span',tr('بيكتب المسودة… ممكن ينتقل لموديل بديل.','Writing this draft… another model may be tried.')));
  status.classList.remove('is-error');card.setAttribute('aria-busy','true');
  subject.disabled=true;body.disabled=true;write.disabled=true;approve.disabled=true;
  try{
   const result=await generate();
   subject.value=result.subject||'';body.value=result.body||'';
   card.querySelector('p').textContent=tr('مسودة جديدة تحتاج الاعتماد','New draft needs approval');
   status.replaceChildren(el('span',tr('المسودة جاهزة. راجعها وعدّلها قبل الاعتماد.','Draft ready. Review and edit before approving.')));
  }catch(error){
   status.classList.add('is-error');status.replaceChildren(el('span',error.message||tr('تعذر كتابة المسودة. النص السابق محفوظ.','Could not write the draft. Your previous text is preserved.')));
  }finally{
   card.setAttribute('aria-busy','false');subject.disabled=false;body.disabled=false;write.disabled=false;approve.disabled=false;
   const pair=body.value?['إعادة الكتابة','Rewrite with AI']:['اكتب بالذكاء الاصطناعي','Write with AI'];
   write.textContent=tr(...pair);write.dataset.launchAr=pair[0];write.dataset.launchEn=pair[1];
  }
 }
 async function review(id,proposedTime='',siblings=[]){const d=popup(tr('راجع الحملة قبل إرسالها','Review the campaign'));d.classList.add('followup-smart','review-smart');let data;try{data=await request('/api/campaigns/'+id);}catch(error){d.querySelector('.launch-status').textContent=error.message;return;}if(!d.isConnected)return;let {campaign,items}=data;d.querySelector('h2').textContent=campaign.channel==='email'?tr('راجع رسائل الإيميل','Review email messages'):tr('راجع رسائل واتساب','Review WhatsApp messages');const content=el('div');content.className='followup-content review-content';const footer=el('div');footer.className='review-footer';const summary=el('p',stateLabel(campaign.status));summary.className='review-campaign-status';d.append(summary,content,footer);for(const item of items){const card=el('section');card.className='launch-card review-card';card.append(el('h3',item.company_name),el('p',(item.recipient||'')+' · '+stateLabel(item.status)));if(item.reason)card.append(el('p',item.reason==='SCHEDULE_CANCELLED_EDIT'?tr('اتلغت الجدولة بسبب التعديل. راجع الرسالة وبعدها حدد موعد جديد أو ابعت الآن.','Schedule cancelled because of editing. Review the message, then set a new time or send now.'):item.reason));const actions=el('div');actions.className='review-card-actions';if(['draft','ready'].includes(item.status)&&['draft','paused','running'].includes(campaign.status)){const subject=field(card,tr('العنوان','Subject'),item.subject),body=field(card,tr('الرسالة — تقدر تعدّلها','Message — you can edit it'),item.body,'textarea');if(campaign.channel==='whatsapp')subject.parentElement.hidden=true;subject.readOnly=body.readOnly=true;let editable=false,editPending=null;const editHint=el('p',tr('للتعديل، افتح المسودة أولًا؛ أي موعد محفوظ لها هيتلغي.','Open the draft to edit; any saved sending schedule will be cancelled.'));editHint.setAttribute('role','status');const ensureEdit=async()=>{if(editable)return true;if(editPending)return editPending;editPending=(async()=>{try{const result=await request('/api/writing/edit','POST',{companyId:item.company_id,channel:campaign.channel});editable=true;subject.readOnly=body.readOnly=false;approve.disabled=false;editHint.textContent=result.cancelledCampaigns||result.cancelledJobs?tr('اتلغت الجدولة. عدّل وراجع الرسالة، وبعدها حدد موعد جديد أو ابعت الآن.','Schedule cancelled. Edit and review, then choose a new time or send now.'):tr('المسودة جاهزة للتعديل.','Draft ready to edit.');if(result.cancelledCampaigns){campaign.status='paused';summary.textContent=stateLabel('paused');}return true;}catch(e){editHint.textContent=e.message;return false;}finally{editPending=null;}})();return editPending;};card.append(editHint);actions.append(button(tr('تعديل الرسالة','Edit message'),ensureEdit));const write=button(tr(body.value?'إعادة الكتابة':'اكتب بالذكاء الاصطناعي',body.value?'Rewrite with AI':'Write with AI'),async()=>{if(!await ensureEdit())return;return writeDraft(card,subject,body,write,approve,()=>request('/api/campaigns/'+id+'/items/'+item.id+'/generate','POST',{}));});const approve=button(tr('اعتماد هذه المسودة','Approve this draft'),async()=>{if(!await ensureEdit())return;if(window.MrsaalValidation&&!window.MrsaalValidation.check([{field:body,test:f=>!!f.value.trim(),message:tr('اكتب نص الرسالة قبل اعتمادها.','Enter a message before approving it.')},...(campaign.channel==='email'?[{field:subject,test:f=>!!f.value.trim(),message:tr('اكتب موضوع الإيميل.','Enter an email subject.')}]:[])]))return;await request('/api/campaigns/'+id+'/items/'+item.id,'PATCH',{subject:subject.value,body:body.value});card.querySelector('p').textContent=tr('تم الاعتماد','Approved');});approve.disabled=campaign.status==='running';approve.classList.add('review-approve');card.append(actions);actions.append(write,approve);}content.append(card);}const when=field(content,tr('موعد اختياري؛ فارغ يعني الآن','Optional start time; empty means now'),proposedTime,'datetime-local');when.parentElement.classList.add('review-schedule');footer.append(button(tr('ابدأ بعد اعتماد المسودات','Start after approving drafts'),async()=>{if(!window.MrsaalSchedule.read(when).valid)return;await window.flushPreviewDraft?.();const schedule=window.MrsaalSchedule.read(when);if(!schedule.valid)return;try{await request('/api/campaigns/'+id+'/start','POST',{scheduledAt:schedule.scheduledAt});}catch(error){if(window.MrsaalSchedule.reject(error,when))return;throw error;}summary.textContent=tr('الحملة بدأت. تقدر تقفل الصفحة وتتابعها من الحملات.','Campaign started. You can close this page and follow it from Campaigns.');}),button(tr('تحديث النتائج','Refresh results'),async()=>{d.close();await review(id,proposedTime,siblings);}));if(siblings.length>1)footer.append(button(tr('مراجعة الوسيلة التانية','Review the other channel'),async()=>{d.close();await channelBatches(siblings,proposedTime);}));const navigator=window.MrsaalSmartScroll?.attach({root:d,scroller:content,host:footer,items:()=>[...content.querySelectorAll('.review-card,.review-schedule')],label:item=>item.querySelector('h3')?.textContent||tr('موعد الإرسال','Sending time')});d.addEventListener('close',()=>navigator?.destroy(),{once:true});}
 async function channelBatches(batches,proposedTime=''){
  const d=popup(tr('رسائلك حسب وسيلة الإرسال','Messages by sending channel'));
  d.append(el('p',tr('جهزنا حملة مستقلة لكل وسيلة. راجع واعتمد الرسائل، وابدأ كل حملة بنفسك. الإرسال على الوسيلة التانية مش تلقائي لو الأولى فشلت.','A separate campaign is prepared for each channel. Review, approve and start each campaign yourself. A delivery failure does not automatically switch channels.')));
  for(const batch of batches){const card=el('section');card.className='launch-card';const name=batch.channel==='email'?tr('الإيميل','Email'):tr('واتساب','WhatsApp');card.append(el('h3',name),el('p',String(batch.count)+' '+tr('رسالة للمراجعة','messages to review')),button(tr('فتح ومراجعة','Open and review'),async()=>{d.close();await review(batch.id,proposedTime,batches);}));d.append(card);}
 }
 async function create(companyIds,channel){await window.flushPreviewDraft?.();const options=typeof deliveryOptions==='function'?deliveryOptions(channel):{};const result=await request('/api/campaigns','POST',{...options,companyIds,channel,senderAccountId:typeof gmailActiveId==='undefined'?null:gmailActiveId,delaySeconds:document.getElementById('delay-s')?.value||5});const proposedTime=document.getElementById('sched-type')?.value==='scheduled'?document.getElementById('send-dt')?.value||'':'';if(result.campaigns?.length>1)await channelBatches(result.campaigns,proposedTime);else await review(result.id,proposedTime);}

 async function usage(){const d=popup(tr('استخدامك اليومي','Daily usage')),data=await request('/api/launch/usage');for(const kind of ['send','ai'])d.append(el('p',(kind==='send'?tr('الإرسال','Sending'):tr('الذكاء الاصطناعي','AI'))+': '+(data.today.find(x=>x.kind===kind)?.amount||0)+' / '+data.limits[kind+'_limit']));}
 function deleteAccountDialog(){
  if(document.getElementById('delete-account-dialog'))return;
  const opener=document.activeElement;
  const d=popup(tr('حذف حساب مرسال','Delete your Mrsaal account'));d.id='delete-account-dialog';d.classList.add('account-delete-dialog');
  const title=d.querySelector('h2');title.id='delete-account-title';d.setAttribute('aria-labelledby',title.id);
  const status=d.querySelector('.launch-status');status.setAttribute('role','alert');status.setAttribute('aria-live','polite');
  const intro=el('p',tr('الحذف نهائي ومش هتقدر ترجع بيانات حسابك من داخل مرسال.','Deletion is permanent. You will not be able to recover your account data in Mrsaal.'));intro.id='delete-account-description';d.setAttribute('aria-describedby',intro.id);
  const warning=el('div');warning.className='account-delete-warning';warning.append(el('strong',tr('إيه اللي هيتحذف؟','What will be deleted?')),el('p',tr('بيانات مرسال، الشركات، السير الذاتية والمسودات والتقارير الخاصة بحسابك، مع فصل الحسابات المتصلة. حساب Google وبريدك نفسهم مش هيتحذفوا.','Your Mrsaal data, companies, CVs, drafts and reports will be removed, and connected accounts will be disconnected. Your Google account and mailbox will not be deleted.')));
  const exportLink=el('a',tr('نزّل نسخة من بياناتك الأول','Download a copy of your data first'));exportLink.href='/api/launch/export';exportLink.className='account-delete-export';
  const form=el('form');form.noValidate=true;
  const label=el('label',tr('اكتب DELETE لتأكيد الحذف','Type DELETE to confirm deletion'));label.htmlFor='delete-account-confirmation';
  const input=el('input');input.id='delete-account-confirmation';input.className='input';input.type='text';input.dir='ltr';input.autocomplete='off';input.autocapitalize='characters';input.spellcheck=false;input.maxLength=12;input.setAttribute('aria-describedby',intro.id);
  const actions=el('div');actions.className='account-delete-actions';
  const cancel=button(tr('احتفظ بحسابي','Keep my account'),()=>d.close());
  const submit=el('button',tr('احذف حسابي نهائيًا','Permanently delete my account'));submit.type='submit';submit.className='btn btn-danger';submit.disabled=true;
  const reauth=el('a',tr('سجّل الدخول من جديد لتأكيد هويتك','Sign in again to confirm your identity'));reauth.href='/'+(en()?'en':'ar')+'/login?reauth=1';reauth.hidden=true;reauth.className='account-delete-reauth';
  let busy=false;
  function update(){submit.disabled=busy||input.value.trim()!=='DELETE';}
  input.addEventListener('input',update);
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(busy||input.value.trim()!=='DELETE')return;
   busy=true;update();cancel.disabled=true;input.disabled=true;d.querySelector('.launch-close').disabled=true;d.setAttribute('aria-busy','true');reauth.hidden=true;
   submit.textContent=tr('جاري حذف الحساب…','Deleting account…');status.textContent=tr('بننفّذ طلب الحذف. استنى لحد ما يخلص.','Deleting your account. Please wait until the request finishes.');
   try{await request('/api/launch/delete','POST',{confirm:'DELETE'});location.href='/';}
   catch(error){busy=false;input.disabled=false;cancel.disabled=false;d.querySelector('.launch-close').disabled=false;d.removeAttribute('aria-busy');status.textContent=error.message;submit.textContent=tr('احذف حسابي نهائيًا','Permanently delete my account');if(error.httpStatus===401){reauth.hidden=false;submit.disabled=true;input.disabled=true;}else update();}
  });
  d.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  d.addEventListener('close',()=>{if(opener?.isConnected)opener.focus();});
  actions.append(cancel,submit);form.append(label,input,actions);d.append(intro,warning,exportLink,form,reauth);cancel.focus();
 }
 function init(){const cv=document.getElementById('settings-cv'),account=document.getElementById('settings-account'),companies=document.getElementById('page-companies');if(!cv||document.getElementById('launch-cv'))return;const cvButton=button(tr('نسخ السيرة الذاتية','CV versions'),cvs);cvButton.id='launch-cv';cv.prepend(cvButton);if(companies){const actions=el('div');actions.className='launch-actions';actions.append(button(tr('حملات الإرسال','Sending campaigns'),campaigns),button(tr('القوائم والمتابعة','Lists and follow-up'),followup));companies.querySelector('.ph')?.after(actions);}if(account){const card=document.getElementById('account-data')||account;function action(title,description,control){const row=el('div');row.className='account-action';const copy=el('div');copy.append(el('h4',title),el('p',description));row.append(copy,control);card.append(row);}action(tr('استخدام الحساب','Account usage'),tr('تابع حدود الذكاء الاصطناعي والإرسال اليومية.','Review your daily AI and sending limits.'),button(tr('عرض الاستخدام','View usage'),usage));action(tr('نسخة من بياناتك','A copy of your data'),tr('تحميل نسخة احتياطية بصيغة JSON، بدون مفاتيح API أو رموز الدخول.','Download a JSON backup without API keys or login tokens.'),button(tr('تصدير بياناتي','Export my data'),()=>{location.href='/api/launch/export';}));const link=el('a',tr('ربط البريد','Link email login'));link.href='/auth/account?mode=link';link.className='btn btn-secondary';action(tr('تسجيل الدخول بالبريد','Email sign-in'),tr('اربط دخول البريد بنفس حسابك الحالي.','Link email sign-in to your existing account.'),link);const danger=document.getElementById('account-danger')||card;danger.append(button(tr('حذف حسابي وبياناتي','Delete my account and data'),deleteAccountDialog));}const preview=document.querySelector('.compose-actions');if(preview)preview.append(button(tr('تقييم المسودة','Rate this draft'),async()=>{const d=popup(tr('رأيك يحسّن المسودات','Your feedback improves drafts')),rating={value:4};d.classList.add('launch-feedback');d.append(el('p',tr('قيّم جودة المسودة وساعدنا نفهم إيه اللي محتاج يتحسن.','Rate the draft and tell us what could be better.')));const choices=el('div');choices.className='launch-rating';choices.setAttribute('role','group');choices.setAttribute('aria-label',tr('التقييم من 1 إلى 5','Rating from 1 to 5'));for(let i=1;i<=5;i++){const b=button(String(i),()=>{rating.value=i;for(const child of choices.children)child.setAttribute('aria-pressed',String(Number(child.textContent)===i));});b.setAttribute('aria-pressed',String(i===4));choices.append(b);}d.append(choices);const note=field(d,tr('إيه اللي محتاج يتحسن؟ (اختياري)','What needs improvement? (optional)'),'','textarea');note.maxLength=2000;note.placeholder=tr('مثلاً: الرسالة طويلة، أو أسلوبها رسمي زيادة…','For example: too long or too formal…');d.append(button(tr('حفظ التقييم','Save feedback'),async()=>{await request('/api/writing/feedback','POST',{companyId:prevCompanyId,channel:previewChannel,rating:Number(rating.value),note:note.value});d.close();}));}));}
 document.addEventListener('mrsaal:language',()=>{for(const n of document.querySelectorAll('[data-launch-ar]')){const value=en()?n.dataset.launchEn:n.dataset.launchAr;if(n.firstChild?.nodeType===3)n.firstChild.nodeValue=value;}});
 window.MrsaalLaunch={create,campaigns,followup};init();})();
