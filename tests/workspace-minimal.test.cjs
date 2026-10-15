'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(stored=null){
 class Node{
  constructor(tag='div',id='',className=''){this.tagName=tag.toUpperCase();this.id=id;this.className=className;this.children=[];this.dataset={};this.events={};this.attrs={};this.open=false;this.value='';this.hidden=false;}
  get classList(){return {contains:s=>this.className.split(' ').includes(s),add:s=>{this.className+=' '+s;}};}
  append(...nodes){for(const n of nodes){if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(x=>x!==n);n.parentElement=this;this.children.push(n);}}
  prepend(node){this.append(node);this.children=[node,...this.children.filter(x=>x!==node)];}
  before(node){const p=this.parentElement;if(!p)throw Error('Missing parent');if(node.parentElement)node.parentElement.children=node.parentElement.children.filter(x=>x!==node);p.children.splice(p.children.indexOf(this),0,node);node.parentElement=p;}
  get nextElementSibling(){const a=this.parentElement?.children||[];return a[a.indexOf(this)+1]||null;}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,v){this.events[k]=v;}
  querySelector(s){const match=n=>s==='summary'?n.tagName==='SUMMARY':s.startsWith('.')?n.classList.contains(s.slice(1)):n.id===s.slice(1);const walk=n=>{for(const c of n.children){if(match(c))return c;const r=walk(c);if(r)return r;}return null;};return walk(this);}
 }
 const ids={},root=new Node('body'),make=(id,parent=root,cls='',tag='div')=>{const n=new Node(tag,id,cls);ids[id]=n;parent.append(n);return n;};
 const toolbar=make('toolbar',root,'workspace-actions');const home=make('home-readiness');make('home-setup-cards',home);const workflow=make('home-workflow');make('home-workflow-steps',workflow);
 const companies=make('page-companies'),download=make('download',companies,'template-download'),importer=make('import-panel',companies),importCard=make('import-card',importer,'card'),filters=make('company-toolbar',companies);
 const status=make('filter-status',filters,'select','select'),contact=make('filter-contact',filters,'select','select');status.value='pending';contact.value='all';
 const actions=make('company-actions',companies,'launch-actions');make('campaigns-button',actions,'btn','button');
 const editor=make('writing-editor');for(let i=0;i<4;i++){const c=make('writing-card-'+i,editor,'card');const input=make('writing-input-'+i,c,'','textarea');input.value='My unchanged writing '+i;}
 const cv=make('cv-card'),textBox=make('text-box',cv),text=make('cv-text',textBox,'textarea','textarea');text.value='Original CV text';make('save-row',cv);
 const account=make('settings-account');make('prefs',account,'account-preferences');make('account-data',account,'card');const send=make('page-send'),options=make('send-options',send,'g2');make('sched-type',options,'select','select').value='now';
 const selectors={'.workspace-actions':toolbar,'#page-companies .template-download':download,'#import-panel > .card':importCard,'#page-companies > .launch-actions':actions,'#page-send > .g2':options};
 const events={},document={documentElement:{dataset:{},lang:'ar'},getElementById:id=>ids[id]||null,createElement:tag=>new Node(tag),querySelector:s=>selectors[s]||null,addEventListener:(k,fn)=>events[k]=fn};
 const saved=new Map(stored?[['mrsaal-workspace-view',stored]]:[]),window={},context={document,window,URLSearchParams,localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},location:{search:''}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/assets/workspace-minimal.js'),'utf8'),context);
 return {ids,root,document,window,saved,events,toolbar};
}
test('minimal view is the default, preserves original inputs and exposes optional controls on demand',()=>{const x=setup();assert.equal(x.window.MrsaalMinimal.view,'minimal');assert.equal(x.document.documentElement.dataset.workspaceView,'minimal');assert.equal(x.ids['writing-input-1'].value,'My unchanged writing 1');assert.equal(x.ids['cv-text'].value,'Original CV text');assert.equal(x.ids['filter-status'].value,'pending');assert.equal(x.ids['filter-status'].parentElement.parentElement.open,false);assert.equal(x.ids['download'].parentElement,x.ids['import-card']);assert.equal(x.ids['home-setup-cards'].parentElement.parentElement.open,false);x.window.MrsaalMinimal.reveal(x.ids['writing-input-1']);assert.equal(x.ids['writing-input-1'].parentElement.parentElement.parentElement.open,true);});
test('detailed view opens the same controls and switching views never resets data or requires network access',()=>{const x=setup('detailed'),input=x.ids['writing-input-2'];assert.equal(x.window.MrsaalMinimal.view,'detailed');assert.equal(input.parentElement.parentElement.parentElement.open,true);input.value='Unsaved edit';x.window.MrsaalMinimal.setView('minimal');assert.equal(input.value,'Unsaved edit');assert.equal(x.saved.get('mrsaal-workspace-view'),'minimal');assert.equal(input.parentElement.parentElement.parentElement.open,false);x.window.MrsaalMinimal.setView('detailed');assert.equal(input.value,'Unsaved edit');assert.equal(input.parentElement.parentElement.parentElement.open,true);});
test('view controls follow Arabic/English and validation reveals a collapsed field',()=>{const x=setup();const button=x.toolbar.children[0];assert.equal(button.attrs['aria-label'],'عرض مفصّل');x.document.documentElement.lang='en';x.events['mrsaal:language']();assert.equal(button.attrs['aria-label'],'Detailed view');const input=x.ids['cv-text'];x.events.invalid({target:input});assert.equal(input.parentElement.parentElement.parentElement.open,true);});
