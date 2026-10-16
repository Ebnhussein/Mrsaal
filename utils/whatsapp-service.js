'use strict';
// A selected transport never silently falls back to another WhatsApp account.
const legacy=require('./whatsapp');
const beta=()=>require('./mrsaalwa');
async function selected(id){return (await beta().profile(id)).provider==='mrsaalwa';}
module.exports={
 async status(id){return await selected(id)?beta().status(id):{...legacy.status(id),...legacy.capacity(),provider:'baileys'};},
 async connect(id,options){return await selected(id)?beta().connect(id,options):legacy.connect(id);},
 async disconnect(id,forget=true){if(await selected(id))return beta().disconnect(id,forget);return legacy.disconnect(id,forget);},
 async requireConnected(id){return await selected(id)?beta().requireConnected(id):{...await legacy.requireConnected(id),provider:'baileys'};},
 async sendWhatsAppMessage(id,phone,body,attachment,expectedProvider=null){return beta().locked(id,async()=>{const useBeta=await selected(id);if(expectedProvider&&expectedProvider!==(useBeta?'mrsaalwa':'baileys'))throw require('./whatsapp-policy').error('WA_CONNECTION_CHANGED',409);return useBeta?beta().send(id,phone,body,attachment):legacy.sendWhatsAppMessage(id,phone,body,attachment);});},
 async forgetAll(id){await beta().disconnect(id,true);await legacy.disconnect(id,true);},
 legacy
};
