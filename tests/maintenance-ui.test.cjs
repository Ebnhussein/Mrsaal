'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('maintenance language and appearance controls preserve preferences and use matching text direction',()=>{
 const html=fs.readFileSync(require.resolve('../public/maintenance.html'),'utf8');const nodes=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.events[k]=fn;}}]));
 const saved=new Map([['mrsaal-workspace-language','en'],['mrsaal-theme','dark']]);const document={documentElement:{dataset:{}},getElementById:id=>nodes[id]};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/assets/maintenance.js'),'utf8'),{document,navigator:{language:'ar'},location:{search:''},URLSearchParams,localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},matchMedia:()=>({matches:false})});
 assert.equal(document.documentElement.dir,'ltr');assert.equal(document.documentElement.dataset.theme,'dark');assert.match(nodes['maintenance-description'].textContent,/sorry/);
 nodes['maintenance-language'].events.click();assert.equal(document.documentElement.dir,'rtl');assert.match(nodes['maintenance-description'].textContent,/نعتذر/);assert.equal(saved.get('mrsaal-workspace-language'),'ar');assert.equal(nodes['maintenance-home'].href,'/ar/');
 nodes['maintenance-theme'].events.click();assert.equal(document.documentElement.dataset.theme,'light');assert.equal(saved.get('mrsaal-theme'),'light');assert(!html.includes('http'));assert.match(html,/prefers-color-scheme:dark/);
});
test('standalone emergency installer embeds the exact page assets and never stops WhatsApp or rebuilds images',()=>{
 const script=fs.readFileSync(require.resolve('../ops/mrsaal-maintenance.sh'),'utf8');const matches=[...script.matchAll(/base64\.b64decode\('([^']+)'\)/g)];assert.equal(matches.length,2);
 for(const [i,file]of ['../public/maintenance.html','../public/assets/maintenance.js'].entries())assert.equal(Buffer.from(matches[i][1],'base64').toString(),fs.readFileSync(require.resolve(file),'utf8').replace(/\r\n/g,'\n'));
 assert(!script.includes('docker stop'));assert(!script.includes('docker build'));assert(!script.includes('docker compose down'));assert(script.includes('site.js.original'));assert(script.includes("UPDATE website_settings SET tool_paused=$1"));
});
