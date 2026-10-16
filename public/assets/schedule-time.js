'use strict';
(()=>{
 const tr=(a,b)=>document.documentElement.lang==='en'?b:a;
 const field=f=>typeof f==='string'?document.getElementById(f):f;
 function message(kind){return kind==='past'?tr('موعد الجدولة عدى. اختار تاريخ ووقت جديدين في المستقبل، وبعدها جرّب تاني.','The scheduled time has passed. Choose a new date and time in the future, then try again.'):tr('اختار تاريخ ووقت صحيحين في المستقبل للجدولة.','Choose a valid future date and time for scheduling.');}
 function read(value,{required=false,report=true}={}){
  const f=field(value),raw=f?.value||'';
  const ts=raw?Date.parse(raw):NaN;
  const valid=(!raw&&!required)||(Number.isFinite(ts)&&ts>Date.now());
  const text=message(Number.isFinite(ts)?'past':'invalid');
  if(report&&f){if(window.MrsaalValidation)window.MrsaalValidation.check([{field:f,test:()=>!f.value&&!required||Number.isFinite(Date.parse(f.value))&&Date.parse(f.value)>Date.now(),message:text}]);else if(!valid){f.setAttribute('aria-invalid','true');f.focus?.();}}
  // datetime-local is in the user's timezone. Transmit an explicit UTC instant.
  return {valid,scheduledAt:valid&&raw?new Date(ts).toISOString():null,message:text};
 }
 function reject(error,value){if(!['SCHEDULE_TIME_PAST','SCHEDULE_TIME_INVALID'].includes(error?.code))return false;const f=field(value);if(f){window.MrsaalValidation?.error(f,message(error.code==='SCHEDULE_TIME_PAST'?'past':'invalid'));window.MrsaalValidation?.focus(f);}return true;}
 window.MrsaalSchedule={read,reject};
})();
