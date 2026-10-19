'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup({selected=true,fail=false,lang='ar'}={}){
 const nodes=[],requests=[],companies=[{id:'one',name:'One',email:'jobs@example.test',phone:'201012345678',field:'Software',location:'Cairo',selected},{id:'two',name:'Two',email:'work@example.test',phone:'',field:'',location:'',selected}];
 const document={documentElement:{lang,dir:lang==='en'?'ltr':'rtl'},activeElement:{focus(){}},createElement:tag=>{
  const el={tag,style:{},dataset:{},children:[],attrs:{},value:'',textContent:'',disabled:false,events:{},append(...items){this.children.push(...items);},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]||null;},removeAttribute(k){delete this.attrs[k];},addEventListener(k,f){this.events[k]=f;},focus(){document.activeElement=this;},showModal(){this.open=true;},close(){this.open=false;this.events.close?.();},remove(){this.removed=true;}};
  Object.defineProperty(el,'options',{get(){return this.children;}});nodes.push(el);return el;
 }};document.body={style:{overflow:'auto'},append:n=>nodes.push(n)};
 const context={document,companies,window:{MrsaalDialog:{confirm:async()=>true}},api:async(path,method,data)=>{requests.push({path,method,data});if(fail)throw Error('Save failed');return {company:{...companies.find(c=>path.includes(c.id)),...data,expected:undefined}};},renderCompanies(){},updateChannelSummary(){},writingCompanies(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/assets/company-editor.js'),'utf8'),context);
 return {context,companies,nodes,requests,find:id=>nodes.find(n=>n.id===id),form:()=>nodes.find(n=>n.tag==='form'),modal:()=>nodes.find(n=>n.tag==='dialog'),status:()=>nodes.find(n=>n.className==='company-editor-status')};
}
test('editor ignores empty selection, saves the selected company and preserves edits on failure',async()=>{
 const empty=setup({selected:false});empty.context.window.MrsaalCompanyEditor.open();assert.equal(empty.nodes.length,0);
 const h=setup({lang:'en'});h.context.window.MrsaalCompanyEditor.open();assert.equal(h.modal().dir,'ltr');assert.equal(h.find('company-edit-name').value,'One');
 h.find('company-edit-name').value='Updated';await h.form().onsubmit({preventDefault(){}});assert.equal(h.requests[0].path,'/api/companies/one/details');assert.equal(h.requests[0].data.expected.name,'One');assert.equal(h.companies[0].name,'Updated');assert.equal(h.companies[1].name,'Two');
 const bad=setup({fail:true});bad.context.window.MrsaalCompanyEditor.open();bad.find('company-edit-name').value='Keep my edit';await bad.form().onsubmit({preventDefault(){}});assert.equal(bad.find('company-edit-name').value,'Keep my edit');assert.equal(bad.companies[0].name,'One');assert.equal(bad.status().textContent,'Save failed');assert.equal(bad.modal().open,true);
});
test('switching selected companies cannot discard unsaved changes and invalid contacts never reach the API',async()=>{
 const h=setup();h.context.window.MrsaalCompanyEditor.open();const picker=h.find('company-editor-picker');h.find('company-edit-name').value='Unsaved';picker.value='two';picker.onchange();assert.equal(picker.value,'one');assert.equal(h.find('company-edit-name').value,'Unsaved');
 h.find('company-edit-phone').value='01012345678';await h.form().onsubmit({preventDefault(){}});assert.equal(h.requests.length,0);assert.equal(h.find('company-edit-phone').getAttribute('aria-invalid'),'true');
 h.find('company-edit-phone').value='+201012345678';await h.form().onsubmit({preventDefault(){}});picker.value='two';picker.onchange();assert.equal(h.find('company-edit-name').value,'Two');
 h.modal().close();assert.equal(h.context.document.body.style.overflow,'auto');
});
