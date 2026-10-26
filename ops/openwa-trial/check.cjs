'use strict';
// Run inside the Mrsaal container. Never prints keys, QR codes, recipients or message content.
(async()=>{try{const p=require('../../utils/whatsapp/openwa-client'),config=p.config(),s=await p.createClient(config).status();console.log(JSON.stringify({configured:true,reachable:true,status:s.status,engineLoaded:s.engineLoaded}));}catch(e){console.log(JSON.stringify({reachable:false,code:e.code||'CHECK_FAILED'}));process.exitCode=1;}})();
