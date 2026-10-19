'use strict';
(()=>{
 const fields=['name','email','phone','field','location'];
 const labels={name:['اسم الشركة','Company name'],email:['الإيميل','Email'],phone:['رقم واتساب بكود الدولة','WhatsApp number with country code'],field:['المجال','Industry'],location:['الموقع','Location']};
 const tr=(ar,en)=>document.documentElement.lang==='en'?en:ar;
 let dialog=null;
 function open(){
  if(dialog?.open){dialog.focus();return;}
  const ids=companies.filter(c=>c.selected).map(c=>c.id);if(!ids.length)return;
  const previous=document.activeElement,overflowBefore=document.body.style.overflow;let index=0,saving=false,baseline={};const controls={};
  const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
  const d=node('dialog',undefined,'company-editor');dialog=d;d.dataset.userContent='';d.setAttribute('aria-labelledby','company-editor-title');d.dir=document.documentElement.dir||'rtl';
  const header=node('header'),title=node('h2',tr('تعديل الشركات المحددة','Edit selected companies'));title.id='company-editor-title';const close=node('button','×','company-editor-close');close.type='button';close.setAttribute('aria-label',tr('إغلاق','Close'));header.append(title,close);
  const form=node('form');form.noValidate=true;
  const pickerLabel=node('label',tr('اختار الشركة اللي هتعدلها','Choose a company to edit'),'company-editor-picker');const picker=node('select');picker.id='company-editor-picker';pickerLabel.htmlFor=picker.id;
  for(const id of ids){const co=companies.find(c=>c.id===id);const option=node('option',co?.name||'—');option.value=id;picker.append(option);}pickerLabel.append(picker);
  const help=node('p',tr('عدّل كل شركة واحفظها بشكل منفصل. الرسائل المحفوظة لا تتغير؛ راجعها قبل الإرسال.','Edit and save each company separately. Saved messages stay unchanged; review them before sending.'),'company-editor-note');
  const grid=node('div',undefined,'company-editor-fields');
  for(const key of fields){const label=node('label',tr(...labels[key]));const input=node('input');input.id='company-edit-'+key;input.name=key;input.type=key==='email'?'email':key==='phone'?'tel':'text';input.maxLength=key==='email'?254:key==='phone'?40:200;input.required=key==='name';if(['email','phone'].includes(key))input.dir='ltr';label.htmlFor=input.id;const hint=node('small');hint.id=input.id+'-error';hint.className='company-editor-field-error';input.setAttribute('aria-describedby',hint.id);label.append(input,hint);controls[key]={input,hint};grid.append(label);}
  const phoneHelp=node('p',tr('مثال: +201012345678 بدل 01012345678. يكفي إيميل أو رقم واحد صالح.','Example: +201012345678 instead of 01012345678. Provide at least one valid email or phone number.'),'company-editor-note');
  const status=node('p',undefined,'company-editor-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const footer=node('footer'),back=node('button',tr('السابق','Previous'),'btn btn-secondary'),next=node('button',tr('التالي','Next'),'btn btn-secondary'),count=node('span'),reset=node('button',tr('تراجع عن التعديلات','Reset changes'),'btn btn-secondary'),save=node('button',tr('حفظ التعديلات','Save changes'),'btn btn-primary');
  for(const b of [back,next,reset])b.type='button';save.type='submit';const navigation=node('div',undefined,'company-editor-navigation');navigation.append(back,count,next);footer.append(navigation,reset,save);form.append(pickerLabel,help,grid,phoneHelp,status,footer);d.append(header,form);document.body.append(d);
  const values=()=>Object.fromEntries(fields.map(key=>[key,controls[key].input.value]));
  const dirty=()=>fields.some(key=>values()[key]!==baseline[key]);
  function clear(){for(const {input,hint}of Object.values(controls)){input.removeAttribute('aria-invalid');hint.textContent='';}}
  function load(){const co=companies.find(c=>c.id===ids[index]);if(!co){status.textContent=tr('الشركة لم تعد متاحة. حدّث القائمة.','This company is no longer available. Refresh the list.');save.disabled=true;return;}baseline=Object.fromEntries(fields.map(k=>[k,String(co[k]||'')]));for(const k of fields)controls[k].input.value=baseline[k];picker.value=co.id;count.textContent=(index+1)+' / '+ids.length;back.disabled=index===0;next.disabled=index===ids.length-1;navigation.hidden=ids.length===1;reset.disabled=true;clear();status.textContent='';}
  function move(target){if(saving)return;if(dirty()){picker.value=ids[index];status.textContent=tr('احفظ التعديلات أو اضغط تراجع قبل الانتقال لشركة تانية.','Save or reset your changes before switching companies.');return;}index=target;load();controls.name.input.focus();}
  function invalid(key,message){const {input,hint}=controls[key];input.setAttribute('aria-invalid','true');hint.textContent=message;}
  function validate(){clear();const v=values();if(!v.name.trim())invalid('name',tr('اكتب اسم الشركة.','Enter the company name.'));if(v.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()))invalid('email',tr('اكتب إيميل صحيح.','Enter a valid email address.'));if(v.phone.trim()&&(!/^[+\d\s().-]+$/.test(v.phone.trim())||!/^[1-9]\d{7,14}$/.test(v.phone.replace(/\D/g,'').replace(/^00/,''))))invalid('phone',tr('ضيف كود الدولة، مثل +201012345678.','Include the country code, for example +201012345678.'));if(!v.email.trim()&&!v.phone.trim()){const message=tr('ضيف إيميل أو رقم تليفون صالح.','Add a valid email address or phone number.');invalid('email',message);invalid('phone',message);}const first=fields.find(key=>controls[key].input.getAttribute('aria-invalid')==='true');if(first){controls[first].input.focus();return false;}return true;}
  async function dismiss(){if(saving)return;if(dirty()&&!await window.MrsaalDialog.confirm(tr('تقفل من غير حفظ تعديلات الشركة؟','Close without saving your company changes?')))return;d.close();}
  close.onclick=dismiss;d.addEventListener('cancel',event=>{event.preventDefault();dismiss();});d.addEventListener('close',()=>{d.remove();document.body.style.overflow=overflowBefore;if(dialog===d)dialog=null;previous?.focus();},{once:true});
  picker.onchange=()=>move(ids.indexOf(picker.value));back.onclick=()=>move(Math.max(0,index-1));next.onclick=()=>move(Math.min(ids.length-1,index+1));reset.onclick=()=>{if(!saving)load();};
  form.addEventListener('input',()=>{reset.disabled=!dirty();status.textContent='';});
  form.onsubmit=async event=>{event.preventDefault();if(saving||!validate())return;saving=true;save.disabled=true;picker.disabled=true;close.disabled=true;const oldText=save.textContent;save.textContent=tr('جاري الحفظ…','Saving…');for(const key of fields)controls[key].input.disabled=true;
   try{const result=await api('/api/companies/'+encodeURIComponent(ids[index])+'/details','PATCH',{...values(),expected:baseline});const co=companies.find(c=>c.id===ids[index]);Object.assign(co,result.company);picker.options[index].textContent=co.name;load();renderCompanies();updateChannelSummary();writingCompanies();status.textContent=tr('تم حفظ بيانات الشركة.','Company details saved.');}
   catch(error){status.textContent=error.message;const key={COMPANY_NAME_REQUIRED:'name',COMPANY_EMAIL_INVALID:'email',WA_RECIPIENT_FORMAT:'phone',COMPANY_CONTACT_REQUIRED:'email'}[error.code];if(key)invalid(key,error.message);}
   finally{saving=false;save.disabled=false;picker.disabled=false;close.disabled=false;save.textContent=oldText;for(const key of fields)controls[key].input.disabled=false;reset.disabled=!dirty();}
  };
  load();d.showModal();document.body.style.overflow='hidden';controls.name.input.focus();
 }
 window.MrsaalCompanyEditor={open};
})();
