'use strict';
const PREFIX = 'MRSAAL_STYLE_V1\n';
const defaults = () => ({version:1, language:'egyptian', goal:'opportunity', role:'', cta:'مراجعة السي في والرد لو فيه فرصة مناسبة', mode:'ai', summary:'', examples:[], forbidden:'شغفي اللامحدود\nفريقكم الموقر\nأتمنى أن تصلك هذه الرسالة وأنت بخير', instructions:'', email:{tone:'professional',length:'medium',opening:'',closing:'',template:''}, whatsapp:{tone:'friendly',length:'short',opening:'',closing:'',template:''}});
function clean(v,n=2000){return typeof v==='string'?v.trim().slice(0,n):'';}
function normalize(input={}) {
 const d=defaults(), p=input&&typeof input==='object'?input:{};
 for(const k of ['language','goal','mode']) { const enums={language:['egyptian','arabic','gulf','english'],goal:['opportunity','advertised','followup'],mode:['ai','template']}; if(p[k]!==undefined&&!enums[k].includes(p[k]))throw new Error('اختيار غير صالح: '+k); d[k]=p[k]||d[k]; }
 for(const k of ['role','cta','summary','forbidden','instructions'])d[k]=clean(p[k],k==='instructions'?4000:2000);
 d.examples=(Array.isArray(p.examples)?p.examples:[]).slice(0,3).map(x=>clean(x,3000)).filter(Boolean);
 for(const channel of ['email','whatsapp']){const c=p[channel]||{};for(const k of ['opening','closing','template'])d[channel][k]=clean(c[k],k==='template'?5000:300);if(['professional','friendly','direct'].includes(c.tone))d[channel].tone=c.tone;if(['short','medium'].includes(c.length))d[channel].length=c.length;}
 return d;
}
function decode(instructions){if(typeof instructions==='string'&&instructions.startsWith(PREFIX))return normalize(JSON.parse(instructions.slice(PREFIX.length)));const d=defaults();d.instructions=clean(instructions,4000);return d;}
function encode(profile){return PREFIX+JSON.stringify(normalize(profile));}
module.exports={defaults,normalize,decode,encode};
