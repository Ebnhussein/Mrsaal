'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),Module=require('module');
function checkProject(root=path.resolve(__dirname,'..')){
 const errors=[];let count=0;
 function visit(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git'].includes(item.name))continue;const file=path.join(dir,item.name);if(item.isDirectory())visit(file);else if(/\.(?:js|cjs)$/.test(item.name)){
  count++;const source=fs.readFileSync(file,'utf8').replace(/^#!.*\n/,'');
  try{new vm.Script(Module.wrap(source),{filename:file});}catch(e){errors.push(path.relative(root,file)+': '+e.message);}
  if(path.relative(root,file).startsWith('tests'+path.sep))continue;
  for(const match of source.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)){
   const name=path.resolve(path.dirname(file),match[1]);
   if(![name,name+'.js',name+'.cjs',path.join(name,'index.js')].some(p=>fs.existsSync(p)))errors.push(path.relative(root,file)+': missing '+match[1]);
  }
 }} }
 visit(root);
 const index=path.join(root,'public/index.html');
 if(!fs.existsSync(index))errors.push('public/index.html is missing');
 else{
  const html=fs.readFileSync(index,'utf8');
  for(const match of html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g))if(!fs.existsSync(path.join(root,'public',match[1].split(/[?#]/)[0])))errors.push('Missing public asset: '+match[1]);
  for(const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))try{new vm.Script(match[1]);}catch(e){errors.push('Inline script: '+e.message);}
  if(html.includes('window.fetch='))errors.push('Production HTML contains mocked fetch');
 }
 return {errors,count};
}
if(require.main===module){const result=checkProject();if(result.errors.length){result.errors.forEach(e=>console.error(e));process.exitCode=1;}else console.log(`Project check passed: ${result.count} JavaScript files and public assets.`);}
module.exports={checkProject};
