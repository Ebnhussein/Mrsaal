'use strict';
(()=>{
 const tr=(ar,en)=>document.documentElement.lang==='en'?en:ar;
 const state=new WeakMap();let counter=0,scheduled=false;
 const get=value=>typeof value==='string'?document.getElementById(value):value;
 const visible=f=>!!f&&!f.disabled&&f.type!=='hidden'&&!f.closest?.('[hidden]');
 function focus(value){const f=get(value);if(!f)return;f.dispatchEvent?.(new CustomEvent('mrsaal:validation-focus',{bubbles:true}));if(!f.matches?.('input,select,textarea,button,a'))f.setAttribute('tabindex','-1');for(let parent=f.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;const anchor=f.type==='file'&&f.getClientRects?.().length===0?f.closest('label')||f.parentElement:f;anchor.scrollIntoView?.({block:'center',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});f.focus?.({preventScroll:true});}
 function error(value,message){const f=get(value);if(!f)return;let data=state.get(f);if(!data){data={oldInvalid:f.getAttribute('aria-invalid')};state.set(f,data);}if(message){if(!data.hint){const hint=document.createElement('p');hint.id='mrsaal-field-error-'+(++counter);hint.className='mrsaal-field-error';hint.dataset.userContent='';hint.setAttribute('role','alert');data.hint=hint;const anchor=['checkbox','radio'].includes(f.type)?f.closest('label')||f:f;anchor.insertAdjacentElement('afterend',hint);const ids=new Set((f.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(hint.id);f.setAttribute('aria-describedby',[...ids].join(' '));}data.hint.textContent=message;data.hint.hidden=false;f.setAttribute('aria-invalid','true');f.dataset.validationInvalid='true';if(['checkbox','radio'].includes(f.type)){const label=f.closest('label');if(label)label.dataset.validationInvalid='true';}}else{if(data.hint)data.hint.hidden=true;if(data.oldInvalid===null)f.removeAttribute('aria-invalid');else f.setAttribute('aria-invalid',data.oldInvalid);delete f.dataset.validationInvalid;const label=f.closest('label');if(label)delete label.dataset.validationInvalid;}}
 function message(f){
  if(!visible(f))return '';const v=String(f.value||''),trim=v.trim(),validity=f.validity||{},type=f.type;
  if(f.required&&((type==='checkbox'&&!f.checked)||(type==='radio'&&validity.valueMissing)||(type==='file'&&!f.files?.length)||(!['checkbox','radio','file'].includes(type)&&!trim)))return type==='checkbox'?tr('علّم على مربع الموافقة عشان تكمّل.','Tick this checkbox to continue.'):type==='file'?tr('اختار الملف المطلوب.','Choose the required file.'):type==='select-one'?tr('اختار قيمة من القائمة.','Choose an option from the list.'):tr('الخانة دي مطلوبة.','This field is required.');
  if(!trim)return '';
  if(type==='email'&&(validity.typeMismatch||!/^[^\s@]+@[^\s@]+$/.test(trim)))return tr('اكتب بريد إلكتروني صحيح، مثل name@example.com.','Enter a valid email address, for example name@example.com.');
  if(f.minLength>0&&v.length<f.minLength)return tr('اكتب '+f.minLength+' حروف على الأقل.','Use at least '+f.minLength+' characters.');
  if(f.maxLength>0&&v.length>f.maxLength)return tr('الحد الأقصى '+f.maxLength+' حرف.','Use no more than '+f.maxLength+' characters.');
  if(type==='number'){if(!Number.isFinite(Number(v))||validity.badInput)return tr('اكتب رقم صحيح.','Enter a valid number.');if(f.min!==''&&f.min!=null&&Number(v)<Number(f.min))return tr('أقل قيمة مسموحة هي '+f.min+'.','The minimum value is '+f.min+'.');if(f.max!==''&&f.max!=null&&Number(v)>Number(f.max))return tr('أكبر قيمة مسموحة هي '+f.max+'.','The maximum value is '+f.max+'.');}
  if(type==='url'&&validity.typeMismatch)return tr('اكتب رابط صحيح يبدأ بـ https://.','Enter a valid URL starting with https://.');
  if(validity.badInput)return tr('راجع صيغة الرقم أو التاريخ.','Check the number or date format.');
  if(validity.patternMismatch)return tr('راجع صيغة البيانات المطلوبة في الخانة.','Check the format required for this field.');
  if(validity.stepMismatch)return tr('اختار قيمة تناسب الزيادة المحددة.','Choose a value that matches the allowed increment.');
  if(f.id==='account-phone'&&!/^\+?[1-9]\d{7,14}$/.test(trim.replace(/[\s()-]/g,'')))return tr('اكتب رقم الموبايل بكود الدولة، مثل +201012345678.','Include your country code, for example +201012345678.');
  if(f.id==='account-confirm-password'&&v!==get('account-password')?.value)return tr('كلمتا المرور مش متطابقتين.','Passwords do not match.');
  if(f.id==='contact-message'&&trim.length<10)return tr('اكتب تفاصيل أكتر عن طلبك، 10 حروف على الأقل.','Describe your request in at least 10 characters.');
  if(f.id==='delete-account-confirmation'&&trim!=='DELETE')return tr('اكتب DELETE بالضبط لتأكيد الحذف.','Type DELETE exactly to confirm deletion.');
  return '';
 }
 function check(rules,{focusFirst=true}={}){let first=null;for(const rule of rules){const f=get(rule.field);if(!f)continue;const bad=!rule.test(f);let data=state.get(f);if(!data){data={oldInvalid:f.getAttribute('aria-invalid')};state.set(f,data);}data.rule=rule;error(f,bad?rule.message:'');if(bad&&!first)first=f;}if(first&&focusFirst)focus(first);return !first;}
 function validate(container){const root=get(container);if(!root)return true;let first=null;for(const f of root.querySelectorAll('input,select,textarea')){if(!visible(f))continue;const msg=message(f);error(f,msg);if(msg&&!first)first=f;}if(first)focus(first);return !first;}
 function refresh(f){if(!state.has(f))return;const data=state.get(f);if(data.rule){check([data.rule],{focusFirst:false});}else error(f,message(f));for(const related of document.querySelectorAll?.('[data-validation-invalid]')||[]){const info=state.get(related);if(related!==f&&info?.rule)check([info.rule],{focusFirst:false});}if(f.id==='account-password'){const confirm=get('account-confirm-password');if(confirm&&state.has(confirm))error(confirm,message(confirm));}}
 document.addEventListener('input',e=>refresh(e.target),true);document.addEventListener('change',e=>refresh(e.target),true);
 document.addEventListener('invalid',e=>{if(!visible(e.target))return;e.preventDefault();error(e.target,message(e.target)||tr('راجع البيانات في الخانة دي.','Check this field.'));if(!scheduled){scheduled=true;const first=e.target;queueMicrotask(()=>{scheduled=false;focus(first);});}},true);
 document.addEventListener('submit',e=>{if(e.target.tagName!=='FORM'||e.target.dataset.validation==='off')return;if(!validate(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
 document.addEventListener('mrsaal:language',()=>{for(const field of document.querySelectorAll('[data-validation-invalid]')){const data=state.get(field);if(data){data.rule=null;error(field,'');}}});
 window.MrsaalValidation={check,validate,error,clear:f=>error(f,''),focus,message};
})();
