(function(){let t='light';try{t=localStorage.getItem('mrsaal-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}catch{}document.documentElement.dataset.theme=t==='dark'?'dark':'light';})();
// Every same-origin API request carries the selected UI language, including multipart uploads.
(()=>{
 const nativeFetch=window.fetch.bind(window);
 function lang(){const q=new URLSearchParams(location.search).get('lang');if(q==='ar'||q==='en')return q;const value=document.documentElement.lang;if(value==='ar'||value==='en')return value;try{return localStorage.getItem('mrsaal-workspace-language')==='en'?'en':'ar';}catch{return 'ar';}}
 window.MrsaalErrors={
  language:lang,
  network:timeout=>lang()==='en'?(timeout?'AI writing timed out. Approve a shorter CV summary in Settings or choose a faster provider.':'The connection was interrupted. Check your internet; if sending, check Sent and Reports before retrying.'):(timeout?'انتهت مهلة الكتابة. اعتمد ملخص سيرة مختصرًا من الإعدادات أو اختار منصة أسرع.':'الاتصال اتقطع. تأكد من الإنترنت؛ لو كنت بتبعت راجع المرسَل والتقارير قبل المحاولة.'),
  from(data,status){const message=data?.error||(lang()==='en'?'The request failed. Try again or contact support.':'تعذر تنفيذ الطلب. حاول مرة تانية أو تواصل مع الدعم.');const ref=data?.requestId;return Object.assign(new Error(message+(ref?' '+(lang()==='en'?'Reference: ':'المرجع: ')+ref:'')),{code:data?.code,httpStatus:status,requestId:ref,deliveryStatus:data?.status,logId:data?.logId});}
 };
 window.fetch=function(input,options){
  try{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);
   if(url.origin===location.origin&&/^\/(?:api|auth)(?:\/|$)/.test(url.pathname)){
    const headers=new Headers(input instanceof Request?input.headers:undefined);new Headers(options?.headers).forEach((v,k)=>headers.set(k,v));headers.set('X-Mrsaal-Language',lang());
    return nativeFetch(input,{...options,headers});
   }
  }catch{}return nativeFetch(input,options);
 };
})();
