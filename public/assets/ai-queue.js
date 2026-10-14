'use strict';
window.MrsaalAIQueue=(()=>{
 const active=new Map(),local=()=>document.documentElement.lang!=='en';
 function start(host){
  if(!host)return ()=>{};const box=document.createElement('div');box.className='ai-queue-status';box.setAttribute('role','status');const text=document.createElement('span'),cancel=document.createElement('button');cancel.type='button';cancel.className='btn btn-secondary';cancel.textContent=local()?'إلغاء الطلب':'Cancel request';box.append(text,cancel);host.append(box);let stopped=false,polling=false,requestId=null;cancel.hidden=true;const id=Symbol();active.set(id,box);
  cancel.onclick=async()=>{if(!requestId)return;cancel.disabled=true;text.textContent=local()?'جاري إلغاء الطلب…':'Cancelling…';try{const r=await fetch('/api/ai-queue/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:requestId})});if(!r.ok)throw Error();const result=await r.json();if(!result.cancelled){cancel.disabled=false;text.textContent=local()?'حالة الطلب اتغيرت؛ حدّثناها، جرّب الإلغاء تاني.':'Request state changed. Try cancelling again.';}}catch{cancel.disabled=false;text.textContent=local()?'تعذر الإلغاء؛ حاول تاني.':'Could not cancel. Try again.';}};
  async function poll(){if(stopped||polling)return;polling=true;try{const r=await fetch('/api/ai-queue');if(!r.ok)return;const data=await r.json();if(stopped)return;requestId=data.id||null;cancel.hidden=!requestId;if(data.state==='waiting')text.textContent=local()?'طلبك في انتظار دوره · ترتيبك '+data.position:'Waiting for your turn · position '+data.position;else if(data.state==='cancelling')text.textContent=local()?'جاري إلغاء الطلب…':'Cancelling…';else text.textContent=local()?'الذكاء الاصطناعي بيجهز ردك…':'AI is preparing your response…';}catch{}finally{polling=false;}}
  text.textContent=local()?'جاري تجهيز الطلب…':'Preparing request…';poll();const timer=setInterval(poll,1500);
  return ()=>{if(stopped)return;stopped=true;clearInterval(timer);box.remove();active.delete(id);};
 }
 return {start};
})();
