'use strict';
const fs=require('fs'),path=require('path');
const cache=new Map();
function applyFooter(html,lang){
 if(!cache.has(lang)){
  const home=fs.readFileSync(path.join(__dirname,'stitch-pages',...(lang==='en'?['en']:[]),'home.html'),'utf8');
  const footer=home.match(/<footer\b[\s\S]*?<\/footer>/)?.[0];
  if(!footer)throw new Error('Homepage footer missing');
  cache.set(lang,footer.replace('<footer class="','<footer class="sx-public-footer '));
 }
 // The blog's imported footer can sit inside main; remove it as well.
 html=html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/g,tag=>/class="hs-faq-footer"/.test(tag)?tag:'');
 return html.replace('</body>',cache.get(lang)+'</body>');
}
module.exports={applyFooter};
