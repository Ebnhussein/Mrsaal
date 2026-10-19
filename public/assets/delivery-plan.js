'use strict';
(function(root){
 function valid(company,channel){if(channel==='email')return typeof company.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email.trim());const digits=String(company.phone||'').replace(/\D/g,'');return digits.length>=7&&digits.length<=15;}
 function channels(company,{channel='email',bothChannels=false,preferredChannel='email',skipSent=false}={},sent=[]){
  let selected;
  if(channel!=='available')selected=[channel];
  else{const order=preferredChannel==='whatsapp'?['whatsapp','email']:['email','whatsapp'];selected=order.filter(c=>valid(company,c));if(skipSent)selected=selected.filter(c=>!sent.some(row=>row.company_id===company.id&&row.channel===c&&row.status==='sent'));if(!bothChannels)selected=selected.slice(0,1);if(!selected.length&&!order.some(c=>valid(company,c)))selected=[order[0]];}
  return selected.filter(c=>!skipSent||!sent.some(row=>row.company_id===company.id&&row.channel===c&&row.status==='sent'));
 }
 const api={channels,valid};if(typeof module==='object'&&module.exports)module.exports=api;else root.MrsaalDeliveryPlan=api;
})(typeof window==='object'?window:globalThis);
