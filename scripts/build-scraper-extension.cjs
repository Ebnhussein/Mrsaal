'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
function origin(value){const u=new URL(value);if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(u.protocol==='https:'||u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw new Error('Use an HTTPS origin or http://localhost:PORT, without a path or credentials.');return u.origin;}
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function zip(entries){const files=[],directory=[];let offset=0;
 for(const [name,data] of entries){const filename=Buffer.from(name),bytes=Buffer.from(data),compressed=zlib.deflateRawSync(bytes),crc=crc32(bytes),header=Buffer.alloc(30),central=Buffer.alloc(46);
  header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(filename.length,26);
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt16LE(33,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);
  files.push(header,filename,compressed);directory.push(central,filename);offset+=header.length+filename.length+compressed.length;
 }
 const size=directory.reduce((n,b)=>n+b.length,0),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(size,12);end.writeUInt32LE(offset,16);return Buffer.concat([...files,...directory,end]);
}
function build({appOrigin='http://localhost:4174',out=path.resolve('.mrsaal-trial/extension')}={}){
 const app=origin(appOrigin),source=path.resolve(__dirname,'../extensions/mrsaal-scraper');
 const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));manifest.name='Mrsaal Scraper';manifest.host_permissions=[app+'/*'];
 const entries=[];fs.mkdirSync(out,{recursive:true});
 for(const name of fs.readdirSync(source)){
  if(name==='README.md')continue;
  let data=fs.readFileSync(path.join(source,name));
  if(name==='manifest.json')data=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
  if(name==='background.js')data=Buffer.from(data.toString().replace(/const APP='https:\/\/mrsaal\.ebnhussein\.co';/,'const APP='+JSON.stringify(app)+';'));
  if(name==='panel.html')data=Buffer.from(data.toString().replace('<body>','<body><p class="notice" style="margin:12px">'+(app==='https://mrsaal.ebnhussein.co'?'OFFICIAL PILOT · تجربة على حسابك الفعلي':'LOCAL TRIAL · بيئة تجربة مستقلة')+' — '+app+'</p>'));
  fs.writeFileSync(path.join(out,name),data);entries.push([name,data]);
 }
 const zipPath=out+'.zip';fs.writeFileSync(zipPath,zip(entries));return {origin:app,directory:out,zip:zipPath};
}
if(require.main===module){const args=process.argv.slice(2),get=key=>args[args.indexOf(key)+1];console.log(JSON.stringify(build({appOrigin:args.includes('--origin')?get('--origin'):undefined,out:args.includes('--out')?path.resolve(get('--out')):undefined}),null,2));}
module.exports={build,origin,zip};
