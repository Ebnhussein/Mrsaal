#!/usr/bin/env node
'use strict';
// Run from extracted update: node install-writing.cjs /path/to/Mrsaal
const fs=require('fs'),path=require('path'),cp=require('child_process');
const target=path.resolve(process.argv[2]||'.'),source=__dirname;
if(target===source)throw new Error('حدد مسار نسخة مشروعك الأصلية كوسيط للأمر.');
const serverPath=path.join(target,'server.js'),aiPath=path.join(target,'utils/ai.js');
let server=fs.readFileSync(serverPath,'utf8');const oldAI=fs.readFileSync(aiPath,'utf8');
const route="app.use('/api/writing', require('./routes/writing'));";
const pattern=/app\.use\(\s*['"]\/api\/email['"]\s*,\s*require\(\s*['"]\.\/routes\/email['"]\s*\)\s*\)\s*;/;
if(!server.includes("require('./routes/writing')")&&!pattern.test(server))throw new Error('مكان تركيب routes غير معروف؛ لم يتم تعديل أي ملف. اتبع دليل التركيب اليدوي.');
if(!fs.existsSync(path.join(target,'utils/ai-legacy.js'))&&!/callGemini/.test(oldAI))throw new Error('ملف AI الحالي غير متوافق؛ لم يتم تعديل الملفات.');
if(!server.includes("require('./routes/writing')"))server=server.replace(pattern, m=>route+'\n    '+m);
const rels=['utils/ai.js','utils/writing-profile.js','routes/writing.js','public/index.html','public/assets/writing.js','public/assets/writing.css','public/assets/tour.js','public/assets/tour.css'];
for(const rel of rels){if(!fs.existsSync(path.join(source,rel)))throw new Error('ملف التحديث ناقص: '+rel);if(rel.endsWith('.js'))cp.execFileSync(process.execPath,['--check',path.join(source,rel)]);}
const backup=path.join(target,'writing-backup-'+Date.now());fs.mkdirSync(backup);
for(const rel of [...rels,'server.js'])if(fs.existsSync(path.join(target,rel))){fs.mkdirSync(path.dirname(path.join(backup,rel)),{recursive:true});fs.copyFileSync(path.join(target,rel),path.join(backup,rel));}
if(!fs.existsSync(path.join(target,'utils/ai-legacy.js')))fs.copyFileSync(aiPath,path.join(target,'utils/ai-legacy.js'));
for(const rel of rels){fs.mkdirSync(path.dirname(path.join(target,rel)),{recursive:true});fs.copyFileSync(path.join(source,rel),path.join(target,rel));}
fs.writeFileSync(serverPath,server);console.log('Installed. Backup:',backup,'\nReview and commit these changes, then redeploy.');
