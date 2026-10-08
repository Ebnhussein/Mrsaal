'use strict';
// Push-only worker: does not cache pages, API data or authentication responses.
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 const url='/app?notifications=1';
 event.waitUntil(self.registration.showNotification(data.title||'Mrsaal',{body:data.body||'New notifications are available.',icon:'/assets/favicon.svg',badge:'/assets/favicon.svg',tag:'mrsaal-updates',renotify:false,silent:data.silent!==false,data:{url}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=new URL('/app?notifications=1',self.location.origin).href;
 event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const existing=windows.find(w=>new URL(w.url).origin===self.location.origin&&new URL(w.url).pathname==='/app');if(existing){await existing.focus();existing.postMessage({type:'mrsaal:open-notifications'});return;}await self.clients.openWindow(url);})());
});
