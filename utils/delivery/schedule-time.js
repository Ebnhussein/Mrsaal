'use strict';
// Validate on submission, rather than trusting a date checked before editing.
function parse(value){
 if(value===undefined||value===null||value==='')return null;
 const timestamp=typeof value==='string'?Date.parse(value):NaN;
 if(!Number.isFinite(timestamp))throw Object.assign(new Error('اختار تاريخ ووقت صحيحين للجدولة.'),{status:400,code:'SCHEDULE_TIME_INVALID'});
 if(timestamp<=Date.now())throw Object.assign(new Error('موعد الجدولة عدى. اختار تاريخ ووقت جديدين في المستقبل، وبعدها جرّب تاني.'),{status:400,code:'SCHEDULE_TIME_PAST'});
 return new Date(timestamp).toISOString();
}
module.exports={parse};
