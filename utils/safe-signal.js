'use strict';
let installed=false;
function install(){
 if(installed)return;
 const signalRequire=require('module').createRequire(require.resolve('@whiskeysockets/baileys'));
 const Record=signalRequire('libsignal/src/session_record');
 // libsignal 6.x logs complete ratchet sessions via console, bypassing Baileys' logger.
 // Preserve its state transitions and 40-session pruning, without logging key material.
 Record.prototype.closeSession=function(session){if(this.isClosed(session))return;session.indexInfo.closed=Date.now();};
 Record.prototype.openSession=function(session){session.indexInfo.closed=-1;};
 Record.prototype.removeOldSessions=function(){while(Object.keys(this.sessions).length>40){let oldestKey,oldest;for(const [key,session]of Object.entries(this.sessions)){if(session.indexInfo.closed!==-1&&(!oldest||session.indexInfo.closed<oldest.indexInfo.closed)){oldestKey=key;oldest=session;}}if(!oldestKey)throw new Error('Corrupt sessions object');delete this.sessions[oldestKey];}};
 installed=true;
}
module.exports={install};
