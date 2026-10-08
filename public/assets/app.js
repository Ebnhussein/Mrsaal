
let companies = [], log = [], prevCompanyId = null, sendQueue = [], stopFlag = false, excelFile = null;



// Auth starts after all state declarations below.


async function checkAuth() {
  try {
    const r = await api('/auth/status');
    document.getElementById('app-loading').style.display = 'none';
    if (!r.loggedIn) {
      window.location.replace('/'+(window.MrsaalLocale?.lang||document.documentElement.lang||'ar')+'/login');
      setGmail(false, 'غير متصل', 'سجّل دخولك أولاً');
    } else {
      document.getElementById('login-screen').style.display='none'; document.querySelector('.app').classList.add('active');
      setGmail(true, r.name || 'Gmail متصل', r.email);
      dataLoaded=false;cvReady=false;templateReady=false;waState='unknown';currentUser=r;
      window.MrsaalTickets?.refreshAccess();
      document.getElementById('public-site-link')?.remove();
      await loadAll();
      await loadWhatsAppStatus();
      dataLoaded=true;
      hydrateAccount();
      decideFirstPage();
    }
  } catch {
    document.getElementById('app-loading').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  }
}

async function loadAll() {
  await gmailLoad().catch(e=>toast(e.message,'error'));
  const results=await Promise.allSettled([loadCompanies(), loadCV(), loadLog(), loadTemplate(), loadSettings()]);
  refreshWorkspace();
}

async function api(path, method='GET', body=null) {
  if(body&&method==='POST'&&['/api/email/send','/api/email/send-bulk'].includes(path)){if(body.channel!=='whatsapp'&&gmailChanging)throw new Error('استنى تغيير حساب الإرسال يخلص');body={...body,senderAccountId:gmailActiveId};}
  const opts = { method, headers: {'Content-Type':'application/json'} };
  if (body) opts.body = JSON.stringify(body);
  let r;
  const aiRequest=path==='/api/writing/generate'||path==='/api/writing/analyze'||path==='/api/email/generate';
  const controller=aiRequest?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),105000):null;
  if(controller)opts.signal=controller.signal;
  try { r=await fetch(path,opts); }
  catch(error){throw new Error(error.name==='AbortError'?'انتهت مهلة الكتابة. جرّب موديل أسرع من إعدادات الذكاء الاصطناعي.':'الاتصال اتقطع. خلي الصفحة مفتوحة وتأكد من الإنترنت ثم حاول تاني.');}
  finally {if(timer)clearTimeout(timer);}

  if (!r.ok) {
    const e = await r.json().catch(()=>({error:r.statusText}));
    if (r.status===401) { document.getElementById('login-screen').style.display='flex'; throw new Error('انتهت الجلسة'); }
    throw new Error(e.error||r.statusText);
  }
  return r.json();
}

async function apiForm(path, formData) {
  const r = await fetch(path, {method:'POST', body:formData});
  if (!r.ok) {
    const e = await r.json().catch(()=>({error:r.statusText}));
    if (r.status===401) { document.getElementById('login-screen').style.display='flex'; throw new Error('انتهت الجلسة'); }
    throw new Error(e.error||r.statusText);
  }
  return r.json();
}

function nav(page) {
  if(page==='setup')page='onboarding';
  if(!document.getElementById('page-'+page))return;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>{const active=n.dataset.page===page;n.classList.toggle('active',active);if(active)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');});
  document.getElementById('page-'+page).classList.add('active');
  document.getElementById('workspace-current').textContent={home:'الرئيسية',onboarding:'الإعداد السريع',companies:'الشركات',send:'الإرسال',report:'التقارير',settings:'الإعدادات'}[page];
  if(page==='report')loadLog();
  if(page==='companies')renderCompanies();
  if(page==='settings')selectSettings(activeSetting);
  document.getElementById('setup-return').hidden=!onboardingEditing;
  refreshWorkspace();
  window.scrollTo({top:0,behavior:'instant'});
  window.MrsaalTour?.contextChanged();
}

function setGmail(on, label, sub) {
  const dot = document.getElementById('gdot');
  dot.className = 'gdot'+(on?'':' off');
  document.getElementById('gmail-label').textContent = label;
  document.getElementById('gmail-sub').textContent = sub||'—';
}

function pill(name, size) {
  return `<div class="file-pill"><div class="fname">📄 ${esc(name)}</div><div class="fsize">${size}</div></div>`;
}

function chooseUploadFile(id){const input=document.getElementById(id);const accept=input.accept;input.accept='';input.click();setTimeout(()=>input.accept=accept,1500);}

async function uploadCV(e) {
  const file = e.target.files[0]; if(!file) return;
  e.target.value='';
  if(file.size>20*1024*1024){toast('حجم الـCV أكبر من 20 MB','error');return;}
  document.getElementById('cv-status').innerHTML = '<div style="margin-top:10px;font-size:13px;color:var(--text2)"><div class="spin" style="width:14px;height:14px;border-width:2px;border-top-color:var(--accent);display:inline-block;vertical-align:middle;margin-left:8px"></div> جاري التحليل...</div>';
  const fd = new FormData(); fd.append('cv', file);
  try {
    const r = await apiForm('/api/cv/upload', fd);
    document.getElementById('cv-text').value = r.content;
    document.getElementById('cv-status').innerHTML = pill(file.name, (file.size/1024).toFixed(0)+' KB');
    cvReady=!!r.content?.trim();refreshWorkspace();toast('تم رفع السيرة وحفظها','success');
  } catch(err) {
    document.getElementById('cv-status').innerHTML = `<div style="margin-top:10px;font-size:13px;color:var(--red)">❌ ${esc(err.message)}</div>`;
    toast('خطأ: '+err.message,'error');
  }
}

async function saveCV() {
  const content = document.getElementById('cv-text').value.trim();
  if(!content) { toast('السيرة فارغة','error'); return; }
  try {
    await api('/api/cv/text','POST',{content});
    await loadCV();
    document.getElementById('cv-saved-note').style.display='';
    setTimeout(()=>document.getElementById('cv-saved-note').style.display='none',3000);
    cvReady=true;refreshWorkspace();toast('تم حفظ السيرة','success');
  } catch(err) { toast(err.message,'error'); }
}

async function loadCV() {
  try {
    const cv = await api('/api/cv');
    if(cv)document.getElementById('cv-status').innerHTML=pill(cv.filename||'نص السيرة',cv.has_attachment?'PDF محفوظ ويُرفق تلقائيًا بالإيميل':'نص فقط — ارفع PDF لإرفاقه بالإيميل');
    cvReady=!!cv?.content?.trim(); if(cvReady) document.getElementById('cv-text').value=cv.content; refreshWorkspace();
  } catch {}
}

async function saveTemplate(){return writingSave();}

async function loadTemplate(){return writingLoad();}

async function uploadExcel(e) {
  const file = e.target.files[0]; if(!file) return;
  e.target.value='';
  if(file.size>10*1024*1024){toast('حجم ملف الشركات أكبر من 10 MB','error');return;}
  document.getElementById('xl-status').innerHTML = '<div style="margin-top:10px;font-size:13px;color:var(--text2)">جاري القراءة...</div>';
  excelFile = null;
  document.getElementById('xl-map').style.display = 'none';
  document.getElementById('import-result').textContent = '';
  document.getElementById('btn-import-companies').disabled = true;
  const fd = new FormData(); fd.append('file', file);
  try {
    const r = await apiForm('/api/companies/import', fd);
    document.getElementById('xl-status').innerHTML = pill(file.name, r.totalRows+' صف');
    ['mc-name','mc-email','mc-phone','mc-field','mc-loc'].forEach(id => {
      const sel = document.getElementById(id);
      const isOpt = id !== 'mc-name';
      sel.innerHTML = isOpt ? '<option value="">— لا يوجد —</option>' : '';
      r.headers.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.index; opt.textContent = h.name;
        sel.appendChild(opt);
      });
    });
    r.headers.forEach(h => {
      const hl = h.name.toLowerCase();
      if(hl.includes('name')||hl.includes('اسم')||hl.includes('شركة')) document.getElementById('mc-name').value=h.index;
      if(hl.includes('email')||hl.includes('بريد')||hl.includes('إيميل')) document.getElementById('mc-email').value=h.index;
      if(hl.includes('phone')||hl.includes('mobile')||hl.includes('تليفون')||hl.includes('هاتف')||hl.includes('موبايل')) document.getElementById('mc-phone').value=h.index;
      if(hl === 'xxvwce') document.getElementById('mc-name').value=h.index;
      if(hl === 'usdlk') document.getElementById('mc-phone').value=h.index;
      if(hl === 'w4efsd') document.getElementById('mc-field').value=h.index;
      if(hl.includes('field')||hl.includes('مجال')||hl.includes('قطاع')) document.getElementById('mc-field').value=h.index;
      if(hl.includes('location')||hl.includes('city')||hl.includes('موقع')) document.getElementById('mc-loc').value=h.index;
    });
    excelFile = file;
    document.getElementById('btn-import-companies').disabled = false;
    document.getElementById('xl-map').style.display = 'block';
  } catch(err) {
    document.getElementById('xl-status').textContent = 'تعذر قراءة الملف: ' + err.message;
    toast('خطأ: '+err.message,'error');
  }
}

async function commitImport() {
  const btn = document.getElementById('btn-import-companies');
  const result = document.getElementById('import-result');
  if(btn.disabled) return;
  if(!excelFile) { toast('ارفع ملف الشركات أولاً','error'); return; }
  const nameCol = document.getElementById('mc-name').value;
  const emailCol = document.getElementById('mc-email').value;
  const phoneCol = document.getElementById('mc-phone').value;
  if(nameCol === '' || (emailCol === '' && phoneCol === '')) {
    result.style.color = 'var(--yellow)';
    result.textContent = 'اختار عمود اسم الشركة وعمود الإيميل أو التليفون قبل الاستيراد.';
    toast(result.textContent, 'error'); return;
  }
  if((emailCol !== '' && emailCol === nameCol) || (phoneCol !== '' && phoneCol === nameCol) ||
     (emailCol !== '' && phoneCol !== '' && emailCol === phoneCol)) {
    toast('اسم الشركة والإيميل والتليفون لازم يكونوا أعمدة مختلفة.', 'error'); return;
  }
  const fd = new FormData();
  fd.append('file', excelFile);
  fd.append('nameCol', nameCol);
  fd.append('emailCol', emailCol);
  fd.append('phoneCol', phoneCol);
  fd.append('fieldCol', document.getElementById('mc-field').value);
  fd.append('locationCol', document.getElementById('mc-loc').value);
  btn.disabled = true;
  btn.textContent = 'جاري الاستيراد...';
  result.textContent = '';
  try {
    const r = await apiForm('/api/companies/import/commit', fd);
    result.style.color = r.added > 0 ? 'var(--green)' : 'var(--yellow)';
    result.textContent = `تم استيراد ${r.added} شركة، وتم تخطي ${r.skipped || 0} صف.
` +
      (r.skipped ? 'التخطي قد يكون بسبب تكرار البيانات، أو غياب الاسم ووسيلة التواصل، أو إيميل غير صالح.' : '');
    const loaded = await loadCompanies();
    if(!loaded) {
      result.textContent += '\nنتيجة الاستيراد وصلت من السيرفر، لكن تعذر تحميل قائمة الشركات. جرّب تحديث الصفحة.';
      return;
    }
    toast(r.added > 0 ? `تم استيراد ${r.added} شركة ✅` : 'لم تتم إضافة شركات. راجع الأعمدة والصفوف المتخطاة.', r.added > 0 ? 'success' : 'info');
    if(r.added > 0) {
      document.getElementById('filter-status').value = 'all';
      renderCompanies();
      nav('companies');
    }
  } catch(err) {
    result.style.color = 'var(--red)';
    result.textContent = 'تعذر تأكيد اكتمال الاستيراد: ' + err.message + '\nراجع قائمة الشركات قبل إعادة المحاولة، فقد تكون بعض الصفوف اتسجلت.';
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ استيراد الشركات';
  }
}

async function loadCompanies() {
  try {
    const data = await api('/api/companies');
    if(!Array.isArray(data)) throw new Error('السيرفر لم يُرجع قائمة شركات صحيحة');
    companies = data; writingCompanies();
    renderCompanies();
    updateSendStats();refreshWorkspace();
    return true;
  } catch(err) {
    console.error('تحميل الشركات:', err);
    toast('تعذر تحميل الشركات: ' + err.message, 'error');
    return false;
  }
}

function filterCompanies() { renderCompanies(); }

function filteredCompanyRows(){
 const filter=document.getElementById('filter-status')?.value||'all',contact=document.getElementById('filter-contact')?.value||'all',term=document.getElementById('company-search').value.trim().toLowerCase();
 return companies.filter(c=>(filter==='all'||c.status===filter)&&(contact==='all'||contact==='email'&&!!c.email||contact==='whatsapp'&&!!c.phone||contact==='none'&&!c.email&&!c.phone)&&[c.name,c.email,c.phone,c.field,c.location].some(v=>String(v||'').toLowerCase().includes(term)));
}
function renderCompanies() {
  const filter=document.getElementById('filter-status')?.value||'all';
  const filtered=filteredCompanyRows();
  document.getElementById('selection-count').textContent=companies.filter(c=>c.selected).length+' شركة محددة';
  document.getElementById('nb-companies').textContent = companies.length;
  document.getElementById('companies-count').textContent = filtered.length+' شركة';
  if(!filtered.length) {
    document.getElementById('companies-container').innerHTML = `<div class="empty"><div class="empty-ico">🏢</div><div class="empty-t">${filter!=='all'?'لا يوجد نتائج':'لا توجد شركات بعد'}</div><div class="empty-s">${filter!=='all'?'جرب تغيير الفلتر':'استورد ملف الشركات من الزر اللي فوق'}</div></div>`;
    return;
  }
  const rows = filtered.map(c=>`
    <tr>
      <td><input type="checkbox" class="chk" ${c.selected?'checked':''} onchange="toggleChk('${c.id}',this.checked).catch(connectionError)"></td>
      <td data-user-content><strong>${esc(c.name)}</strong></td>
      <td class="mono">${c.email?esc(c.email):'<span style="color:var(--text3)">—</span>'}</td>
      <td class="mono">${c.phone?esc(c.phone):'—'}</td>
      <td data-user-content>${esc(c.field)||'<span style="color:var(--text3)">—</span>'}</td>
      <td data-user-content>${esc(c.location)||'<span style="color:var(--text3)">—</span>'}</td>
      <td><span class="tag ${c.status}">${stLabel(c.status)}</span></td>
      <td><button class="btn btn-secondary" style="padding:5px 10px;font-size:13px" onclick="previewOne('${c.id}')">👁️ معاينة</button></td>
    </tr>`).join('');
  document.getElementById('companies-container').innerHTML = `
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th><input type="checkbox" class="chk" data-select-visible aria-label="تحديد النتائج الظاهرة" onchange="selectVisibleCompanies(this.checked).catch(connectionError)"/></th><th>الشركة</th><th>الإيميل</th><th>التليفون</th><th>المجال</th><th>الموقع</th><th>الحالة</th><th>إجراء</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function stLabel(s){return{pending:'انتظار',sent:'أُرسل',failed:'فشل',scheduled:'مجدول',skipped:'تخطي'}[s]||s}
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

async function toggleChk(id,val) {
 const c=companies.find(x=>x.id===id);if(!c)return;const previous=c.selected;
 try{await api('/api/companies/'+id,'PATCH',{selected:val});c.selected=val;}catch(error){c.selected=previous;throw error;}finally{renderCompanies();updateChannelSummary();}
}
async function bulkSelect(val) {
 const rows=[...companies];await api('/api/companies','PATCH',{ids:rows.map(c=>c.id),selected:val});rows.forEach(c=>c.selected=val);renderCompanies();updateChannelSummary();
}
async function selectVisibleCompanies(val){
 const rows=filteredCompanyRows();if(!rows.length)return;
 try{await api('/api/companies','PATCH',{ids:rows.map(c=>c.id),selected:val});rows.forEach(c=>c.selected=val);}finally{renderCompanies();updateChannelSummary();}
}

async function deleteSelected() {
  const ids=companies.filter(c=>c.selected).map(c=>c.id);
  if(!ids.length){toast('حدد شركات أولاً','info');return;}
  if(!confirm(`حذف ${ids.length} شركة؟`)) return;
  await api('/api/companies','DELETE',{ids});
  await loadCompanies();
  toast(`تم حذف ${ids.length}`,'info');
}

function updateSendStats() {
  updateChannelSummary();
  const t=companies.length,s=companies.filter(c=>c.status==='sent').length,
        f=companies.filter(c=>c.status==='failed').length,p=companies.filter(c=>c.status==='pending').length;
  document.getElementById('s-total').textContent=t;
  document.getElementById('s-sent').textContent=s;
  document.getElementById('s-failed').textContent=f;
  document.getElementById('s-pending').textContent=p;refreshWorkspace();
}

function toggleSched() {
  const v=document.getElementById('sched-type').value;
  document.getElementById('sched-dt').style.display=v==='scheduled'?'block':'none';
}

let previewChannel='email',batchChannel='email';
function companyChannelReason(c,channel){
 if(channel==='email')return typeof c.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())?null:'لا يوجد إيميل صالح';
 const digits=String(c.phone||'').replace(/\D/g,'');return digits.length>=7&&digits.length<=15?null:'لا يوجد رقم صالح';
}
function selectedDeliveryChannel(){return document.getElementById('send-channel')?.value||'email';}
function deliveryQueue(channel){
 const filter=document.getElementById('send-filter').value,skip=document.getElementById('opt-skip-sent').checked;
 return companies.filter(c=>!(filter==='selected'&&!c.selected)&&!(filter==='pending'&&c.status!=='pending')&&
  !(skip&&log.some(l=>l.company_id===c.id&&l.channel===channel&&l.status==='sent')));
}
function updateChannelSummary(){
 const channel=selectedDeliveryChannel(),queue=deliveryQueue(channel),missing=queue.filter(c=>companyChannelReason(c,channel)).length;
 document.getElementById('channel-summary').textContent=`${queue.length-missing} شركة جاهزة ${channel==='email'?'للإيميل':'للواتساب'} · ${missing} شركة هتتخطى لنقص بيانات القناة. مفيش تحويل تلقائي.`;
 const sender=document.getElementById('send-sender')?.closest('.sender-box');if(sender)sender.hidden=channel==='whatsapp';
}
async function refreshPreviewAttachment(channel,id){
  const el=document.getElementById('prev-attachment');el.hidden=false;
  if(el.hidden)return;el.textContent='جاري التحقق من مرفق السيرة…';
  try{const cv=await api('/api/cv');if(previewChannel!==channel||prevCompanyId!==id)return;
    el.replaceChildren();
    if(cv?.has_attachment){el.append(document.createTextNode('سيُرفق PDF: '+(cv.filename||'CV.pdf')+' · '));const a=document.createElement('a');a.href='/api/cv/pdf';a.textContent='راجع الملف';a.target='_blank';a.rel='noopener';el.append(a);}
    else el.textContent='بدون مرفق CV — السيرة محفوظة كنص فقط. ارفع PDF من الإعدادات لإرفاقه بالرسالة.';
  }catch{if(previewChannel===channel&&prevCompanyId===id)el.textContent='تعذر التحقق من المرفق. راجع ملف السيرة في الإعدادات.';}
}
async function previewChangeChannel(channel){await previewOne(prevCompanyId,channel);}
async function previewOne(id,channel=selectedDeliveryChannel()) {
  if(!ensureCV())return;
  prevCompanyId=id;previewChannel=channel;previewSendKey=crypto.randomUUID();
  const co=companies.find(c=>c.id===id); if(!co) return;
  document.getElementById('preview-channel').value=channel;
  document.getElementById('prev-company').textContent=co.name;
  const isWhatsApp=channel==='whatsapp',recipient=isWhatsApp?co.phone:co.email;
  document.getElementById('prev-to').textContent=(isWhatsApp?'واتساب: ':'إيميل: ')+(recipient||'غير متوفر');
  document.querySelector('#prev-form .sender-box').hidden=isWhatsApp;
  document.getElementById('prev-subject-field').style.display=isWhatsApp?'none':'';
  document.getElementById('prev-body-label').textContent=isWhatsApp?'رسالة واتساب':'نص الإيميل';
  document.querySelector('#preview-overlay .modal').dataset.channel=channel;
  document.getElementById('prev-email').value=recipient||'';
  document.getElementById('prev-subject').value='';document.getElementById('prev-body').value='';
  const overlay=document.getElementById('preview-overlay');
  if(!overlay.classList.contains('open')){previewFocus=document.activeElement;previewOverflow=document.body.style.overflow;}
  overlay.classList.add('open');document.body.style.overflow='hidden';overlay.querySelector('.modal').focus({preventScroll:true});
  document.getElementById('prev-send-status').textContent='';
  const reason=companyChannelReason(co,channel);
  if(reason){
    previewRequest++;document.getElementById('btn-confirm').disabled=true;
    document.getElementById('prev-loading').style.display='none';document.getElementById('prev-form').style.opacity='1';writingBusy(false);
    document.getElementById('writing-review').textContent='تخطي: '+reason+' للقناة المختارة. اختار القناة التانية لو حابب.';
    if(sendQueue.length||previewBatchActive){
      try{await api('/api/email/send','POST',{companyId:id,channel});await loadLog();toast(co.name+' — تخطي: '+reason,'info');closePrev(false);processNextInQueue();}
      catch(e){document.getElementById('prev-send-status').textContent=e.message;}
    }
    return;
  }
  const requestId=++previewRequest;
  document.getElementById('prev-loading').style.display='none';document.getElementById('prev-form').style.opacity='1';writingBusy(false);
  document.getElementById('btn-confirm').disabled=true;
  document.getElementById('writing-review').textContent='اكتب بنفسك أو اضغط اكتب بالذكاء الاصطناعي. المعاينة لا تولّد رسالة تلقائيًا.';
  void refreshPreviewAttachment(channel,id);
  try{const draft=await api('/api/writing/draft?companyId='+encodeURIComponent(id)+'&channel='+channel);
    if(requestId!==previewRequest||id!==prevCompanyId)return;
    if(draft){document.getElementById('prev-subject').value=draft.subject||'';document.getElementById('prev-body').value=draft.body||'';document.getElementById('writing-review').textContent='المسودة المحفوظة — تقدر تعدّلها قبل الإرسال.';}
  }catch(e){document.getElementById('prev-send-status').textContent='تعذر تحميل المسودة. '+e.message;}
  previewEdited(false);
}
let previewBatchActive=false, previewFocus=null, previewOverflow='';

let previewRequest = 0;
async function genPreview(id) {
  const requestId = ++previewRequest;
  document.getElementById('preview-channel').disabled=true;
  document.getElementById('btn-confirm').disabled=true;
  writingBusy(true);
  document.getElementById('prev-send-status').textContent='';
  try {
    const r=await api('/api/writing/generate','POST',{companyId:id,channel:previewChannel});
    if(requestId!==previewRequest || id!==prevCompanyId) return;
    if(r.skipped){document.getElementById('writing-review').textContent=r.reason;return;}
    document.getElementById('prev-subject').value=r.subject||'';
    document.getElementById('prev-body').value=r.body||''; writingReview(r);
    document.querySelector('#prev-form .sender-box').hidden=r.channel==='whatsapp';
    document.getElementById('prev-subject-field').style.display=r.channel==='whatsapp'?'none':'';
    document.getElementById('prev-body-label').textContent=r.channel==='whatsapp'?'رسالة واتساب':'نص الإيميل';
  document.querySelector('#preview-overlay .modal').dataset.channel=r.channel;
    document.getElementById('btn-confirm').disabled=!r.body?.trim();
  } catch(err) {
    if(requestId!==previewRequest || id!==prevCompanyId) return;
    document.getElementById('prev-send-status').textContent='تعذر توليد الرسالة: '+err.message;
  } finally {
    if(requestId===previewRequest && id===prevCompanyId){
      document.getElementById('prev-loading').style.display='none';
      document.getElementById('prev-form').style.opacity='1'; writingBusy(false);document.getElementById('preview-channel').disabled=false;previewEdited(false);
    }
  }
}

function closePrev(cancel=true){previewRequest++;if(cancel){sendQueue=[];previewBatchActive=false;}document.getElementById('preview-overlay').classList.remove('open');document.body.style.overflow=previewOverflow;if(previewFocus?.isConnected)previewFocus.focus({preventScroll:true});}

async function regenerate() {
  document.getElementById('prev-loading').style.display='block';
  document.getElementById('prev-form').style.opacity='.4';
  await genPreview(prevCompanyId);
}

async function confirmSend() {
  let didSend=false;
  const btn=document.getElementById('btn-confirm');
  if(btn.disabled)return;
  if(!document.getElementById('prev-body').value.trim()){toast('اكتب نص الرسالة أولاً','error');return;}
  const status=document.getElementById('prev-send-status');
  btn.disabled=true;document.getElementById('preview-channel').disabled=true; btn.innerHTML='<div class="spin"></div> جاري الإرسال...';
  const schedType=document.getElementById('sched-type').value;
  const scheduledAt=schedType==='scheduled'?document.getElementById('send-dt').value:null;
  try {
    const result=await api('/api/email/send','POST',{
      companyId:prevCompanyId,channel:previewChannel,
      subject:document.getElementById('prev-subject').value,
      body:document.getElementById('prev-body').value,
      scheduledAt,idempotencyKey:previewSendKey
    });
    const co=companies.find(c=>c.id===prevCompanyId);
    if(co&&!result.skipped) co.status=scheduledAt?'scheduled':'sent';
    renderCompanies(); updateSendStats(); closePrev(false);
    didSend=true; await loadLog(); toast(result.skipped?result.reason:(scheduledAt?'تم الجدولة':'تم الإرسال'),result.skipped?'info':'success');
  } catch(err) {
    const co=companies.find(c=>c.id===prevCompanyId);
    if(co) co.status='failed';
    renderCompanies(); updateSendStats();
    status.textContent='❌ '+err.message; status.style.color='var(--red)';
    toast('فشل: '+err.message,'error');
  } finally {
    btn.disabled=false;document.getElementById('preview-channel').disabled=false; btn.innerHTML='إرسال'; if(didSend&&previewBatchActive)processNextInQueue();
  }
}

async function skipCo() {
  if(prevCompanyId){const co=companies.find(c=>c.id===prevCompanyId);if(co)co.status='skipped';renderCompanies();updateSendStats();}
  closePrev(false);
  if(previewBatchActive) processNextInQueue();
}

async function startSend() {
  if(selectedDeliveryChannel()==='email'&&gmailChanging){toast('استنى تغيير حساب الإرسال يخلص','info');return;}
  if(!ensureCV())return;
  const channel=selectedDeliveryChannel();batchChannel=channel;
  const previewMode=document.getElementById('opt-preview').checked;
  const queue=deliveryQueue(channel);
  if(!queue.length){toast('مفيش شركات مناسبة للاختيارات الحالية','info');return;}
  if(channel==='whatsapp'&&queue.some(c=>!companyChannelReason(c,channel))&&waState!=='connected'){toast('اربط واتساب قبل إرسال هذه الدفعة.','error');openSettings('channels');return;}
  try{await MrsaalLaunch.create(queue.map(c=>c.id),channel);}catch(e){toast(e.message,'error');}
}

function stopSend(){stopFlag=true;toast('تم طلب الإيقاف...','info');}

function processNextInQueue(){
  if(!sendQueue.length){previewBatchActive=false;toast('تمت مراجعة الدفعة','success');return;}
  const id=sendQueue.shift(); prevCompanyId=id; previewOne(id,batchChannel);
}

async function loadLog(){
  try{log=await api('/api/email/log');renderLog();updateChannelSummary();refreshWorkspace();if(activeLogId){const item=log.find(x=>x.id===activeLogId);if(item)fillLogDetail(item);else closeLogDetail();}}catch{}
}

function renderLog(){
  const container=document.getElementById('log-container');
  const total=log.length,sent=log.filter(l=>l.status==='sent').length,
        failed=log.filter(l=>l.status==='failed').length,opens=log.filter(l=>l.open_count>0).length;
  document.getElementById('r-total').textContent=total;
  document.getElementById('r-sent').textContent=sent;
  document.getElementById('r-failed').textContent=failed;
  document.getElementById('r-opens').textContent=opens;
  document.getElementById('nb-report').textContent=total;
  if(!log.length){container.innerHTML=`<div class="empty"><div class="empty-ico">📭</div><div class="empty-t">السجل فارغ</div><div class="empty-s">ستظهر هنا نتائج الإرسال</div></div>`;return;}
  const rows=log.map(l=>{
    const statusClass=l.replied?'replied':(l.open_count>0?'opened':l.status);
    const statusText=l.replied?'تم الرد 💬':(l.channel==='whatsapp'?(l.whatsapp_read_at?'اتقرت ✓✓':l.whatsapp_delivered_at?'وصلت ✓✓':stLabel(l.status)):(l.open_count>0?'تم رصد فتح البريد':stLabel(l.status)));
    return `<tr class="${l.replied?'row-replied':''}">
      <td><div data-user-content style="font-weight:700">${esc(l.company_name)}</div><div style="font-size:12px;color:var(--text3)">${new Date(l.sent_at*1000).toLocaleString(window.MrsaalLocale?.lang==='en'?'en-GB':'ar-EG')}</div></td>
      <td style="font-size:13px"><span class="mono" data-user-content>${esc(l.company_email||'غير متوفر')}</span><div class="hint">${l.channel==='whatsapp'?'واتساب':'إيميل'}</div></td>
      <td><span class="log-status ${statusClass}">${statusText}</span>${l.status==='skipped'&&l.reason?`<div class="hint">${esc(l.reason)}</div>`:''}${l.replied&&l.reply_text?`<div data-user-content class="reply-preview" dir="auto">${esc(l.reply_text)}</div>`:''}</td>
      <td><button class="btn btn-secondary" style="padding:4px 8px;font-size:12px" onclick="viewLogDetail('${l.id}')">تفاصيل</button></td>
    </tr>`;
  }).join('');
  container.innerHTML=`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الشركة</th><th>وسيلة التواصل</th><th>الحالة</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

let activeLogId=null, logDetailFocus=null, logDetailOverflow='';
function reportDate(value){
  if(!Number(value))return '';
  const date=new Date(Number(value)*1000);
  return Number.isNaN(date.getTime())?'':date.toLocaleString(window.MrsaalLocale?.lang==='en'?'en-GB':'ar-EG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}
function fillLogDetail(l){
  document.getElementById('rd-sender').textContent=l.sender_email?'From: '+l.sender_email:'';
  const el=id=>document.getElementById(id);
  const text=(id,value)=>el(id).textContent=value||'';
  const wa=l.channel==='whatsapp';
  const read=wa?!!l.whatsapp_read_at:Number(l.open_count)>0;
  const replied=Number(l.replied)>0;
  text('rd-company',l.company_name||'شركة بدون اسم');
  text('rd-description',reportDate(l.sent_at)?'وقت تسجيل الرسالة · '+reportDate(l.sent_at):'سجل الرسالة');
  text('rd-icon',wa?'📱':'✉');
  text('rd-channel',wa?'واتساب':'إيميل');
  text('rd-recipient',l.company_email||'غير محدد');
  text('rd-status',replied?'تم الرد':read?(wa?'اتقرت':'تم رصد فتح البريد'):stLabel(l.status));
  el('rd-status').className='report-chip'+(l.status==='failed'?' bad':l.status==='sent'?' good':'');
  const step=(id,label,time,done)=>{
    text('rd-'+id+'-label',label);text('rd-'+id+'-time',time);
    el('rd-'+id+'-step').classList.toggle('done',done);
  };
  step('sent',l.status==='sent'?'تم الإرسال':stLabel(l.status),reportDate(l.sent_at),l.status==='sent');
  step('read',read?(wa?'اتقرت':'تم رصد فتح البريد'):(wa?'بانتظار تأكيد القراءة':'لم يُرصد فتح البريد بعد'),read?reportDate(wa?l.whatsapp_read_at:l.last_opened_at)||'وصل تأكيد القراءة':'عدم وصول تأكيد لا يعني إن الرسالة لم تُقرأ',read);
  step('reply',replied?'تم الرد':'لم يُرصد رد بعد',replied?reportDate(wa?l.whatsapp_reply_at:l.reply_received_at)||'تم تسجيل رد':'يظهر هنا عند رصد رد جديد',replied);
  el('rd-delivery').hidden=!wa;
  text('rd-delivery',l.whatsapp_delivered_at?'✓✓ وصلت للمستلم · '+reportDate(l.whatsapp_delivered_at):'لم يصل تأكيد تسليم من واتساب حتى الآن.');
  el('rd-subject').hidden=!l.subject;
  text('rd-subject',l.subject?'الموضوع: '+l.subject:'');
  el('rd-message-section').hidden=!l.body;
  text('rd-body',l.body);
  el('rd-reply-section').hidden=!replied;
  text('rd-reply',l.reply_text||'تم رصد رد بدون نص محفوظ.');
  el('rd-error').hidden=!l.reason;text('rd-error',l.reason);
  el('rd-note').hidden=wa&&!!l.message_id;
  text('rd-note',wa?'هذه رسالة قديمة بدون معرّف؛ لا يمكن تتبع قراءتها.':'فتح البريد مؤشر تقريبي؛ بعض تطبيقات البريد تحجب التتبع أو تسجّل الفتح تلقائيًا. عدم رصد الفتح لا يعني أن الرسالة لم تُقرأ. الردود تُراجع كل دقيقة، وأثناء فتح التقارير كل ٣٠ ثانية؛ آخر ٣٠ يومًا.');
}
function viewLogDetail(id){
  const l=log.find(x=>x.id===id);if(!l)return;
  const overlay=document.getElementById('report-detail-overlay');
  if(!overlay.classList.contains('open')){
    logDetailFocus=document.activeElement;logDetailOverflow=document.body.style.overflow;
  }
  activeLogId=id;fillLogDetail(l);
  overlay.classList.add('open');document.body.style.overflow='hidden';
  document.getElementById('rd-close').focus();
}
function closeLogDetail(){
  document.getElementById('report-detail-overlay').classList.remove('open');
  activeLogId=null;document.body.style.overflow=logDetailOverflow;
  if(logDetailFocus?.isConnected)logDetailFocus.focus();
}
async function copyLogMessage(){
  const l=log.find(x=>x.id===activeLogId);if(!l?.body)return;
  try{await navigator.clipboard.writeText((l.subject?l.subject+'\n\n':'')+l.body);toast('تم نسخ الرسالة','success');}
  catch{toast('تعذر النسخ. تقدر تحدد النص وتنسخه يدويًا.','error');}
}
const reportOverlay=document.getElementById('report-detail-overlay');
reportOverlay.addEventListener('click',event=>{if(event.target===reportOverlay)closeLogDetail();});
reportOverlay.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeLogDetail();return;}
  if(event.key!=='Tab')return;
  const buttons=[...reportOverlay.querySelectorAll('button:not([disabled])')].filter(button=>button.getClientRects().length);
  const first=buttons[0],last=buttons.at(-1);if(!first)return;
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});

async function clearLog(){
  if(!confirm('مسح كل السجل؟')) return;
  await api('/api/email/log','DELETE');
  await loadLog(); toast('تم مسح السجل','info');
}

function exportCSV(){
  const rows=[['الشركة','البريد','الحالة','الموضوع','مرات الفتح','السبب','الوقت'],
    ...log.map(l=>[l.company_name,l.company_email,stLabel(l.status),l.subject||'',l.open_count||0,l.reason||'',new Date(l.sent_at*1000).toLocaleString(window.MrsaalLocale?.lang==='en'?'en-GB':'ar-EG')])];
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`مرسال_تقرير_${new Date().toLocaleDateString('ar')}.csv`; a.click();
  toast('✅ تم التصدير','success');
}

async function loadSettings(){try{await providersLoad();}catch(e){toast(e.message,'error');}}
async function syncNow(){
  try{const result=await api('/api/email/sync-replies');await loadLog();toast(result.failed?'تعذر فحص بعض الرسائل. راجع ربط Gmail.':result.checked?`تم فحص ${result.checked} محادثة · ردود جديدة: ${result.updated||0}`:'لا توجد رسائل تحتاج فحصًا الآن. المراجعة الأخيرة كانت منذ أقل من ٣٠ ثانية أو لا توجد رسائل خلال آخر ٣٠ يومًا.',result.failed?'error':'success');}
  catch(err){toast(err.message,'error');}
}

function toast(msg,type='info'){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className=`toast ${type} show`;
  setTimeout(()=>t.classList.remove('show'),3000);
}

let waTimer = null;
let waChecking = false;
async function loadWhatsAppStatus() {
  if(waChecking || !document.querySelector('.app.active'))return;
  waChecking=true;
  try {
    const state=await api('/api/whatsapp/status');waState=state.status;refreshWorkspace();
    const labels={connected:'🟢 متصل',connecting:'🟡 جاري الاتصال...',qr:'امسح رمز QR من تطبيق واتساب',disconnected:'⚪ غير متصل'};
    document.getElementById('wa-status').textContent=(labels[state.status]||state.status)+(state.phone?' — '+state.phone:'')+(state.error?' — '+state.error:'');
    const image=document.getElementById('wa-qr');
    image.style.display=state.qr?'block':'none';
    if(state.qr)image.src=state.qr;else image.removeAttribute('src');
  }catch(err){document.getElementById('wa-status').textContent='تعذر قراءة حالة واتساب: '+err.message;}
  finally{waChecking=false;}
}
async function connectWhatsApp(){
  const button=document.getElementById('wa-connect');if(button.disabled)return;
  button.disabled=true;
  try{await api('/api/whatsapp/connect','POST',{});await loadWhatsAppStatus();}
  catch(err){toast(err.message,'error');}
  finally{button.disabled=false;}
}
async function disconnectWhatsApp(){
  if(!confirm('فصل واتساب؟ هتحتاج تمسح QR من جديد عشان تربطه.'))return;
  try{await api('/api/whatsapp/disconnect','POST',{});await loadWhatsAppStatus();}
  catch(err){toast(err.message,'error');}
}
waTimer=setInterval(loadWhatsAppStatus,4000);
loadWhatsAppStatus();

let refreshingReports=false, lastReplySync=0;
setInterval(async()=>{
  if(document.hidden || refreshingReports || !document.querySelector('.app.active') || !document.querySelector('#page-report.active'))return;
  refreshingReports=true;
  try{if(Date.now()-lastReplySync>30000){lastReplySync=Date.now();await api('/api/email/sync-replies').catch(()=>{});}await loadLog();}finally{refreshingReports=false;}
},5000);

const composeOverlay=document.getElementById('preview-overlay');
composeOverlay.addEventListener('click',event=>{if(event.target===composeOverlay)closePrev();});
composeOverlay.addEventListener('keydown',event=>{
 if(event.key==='Escape'){event.preventDefault();closePrev();return;}
 if(event.key!=='Tab')return;
 const controls=[...composeOverlay.querySelectorAll('button,input,textarea,select,a[href],summary')].filter(el=>!el.disabled&&el.getClientRects().length);
 const first=controls[0],last=controls.at(-1);if(!first)return;
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===composeOverlay.querySelector('.modal'))){event.preventDefault();first.focus();}
});

let previewDraftTimer,previewSendKey=crypto.randomUUID();
function previewEdited(save=true){
 const subject=document.getElementById('prev-subject'),body=document.getElementById('prev-body');
 if(!body)return;document.getElementById('btn-confirm').disabled=!body.value.trim();
 const write=document.getElementById('btn-write');if(write)write.textContent=body.value.trim()?'إعادة الكتابة':'اكتب بالذكاء الاصطناعي';
 if(!save)return;previewSendKey=crypto.randomUUID();clearTimeout(previewDraftTimer);
 const companyId=prevCompanyId,channel=previewChannel,values={companyId,channel,subject:subject.value,body:body.value};
 previewDraftTimer=setTimeout(()=>api('/api/writing/draft','POST',values).catch(e=>{if(prevCompanyId===companyId)document.getElementById('prev-send-status').textContent='لم يتم حفظ التعديل: '+e.message;}),500);
}
for(const id of ['prev-body','prev-subject'])document.getElementById(id)?.addEventListener('input',()=>previewEdited());
