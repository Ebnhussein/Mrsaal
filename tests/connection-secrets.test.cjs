const test=require('node:test'),assert=require('node:assert/strict');
const {seal,unseal}=require('../utils/connection-secrets');
const keys=['SESSION_SECRET','CONNECTIONS_SECRET','CONNECTIONS_SECRET_PREVIOUS'];
function withEnv(env,run){const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));for(const k of keys)delete process.env[k];Object.assign(process.env,env);try{return run();}finally{for(const k of keys)saved[k]===undefined?delete process.env[k]:process.env[k]=saved[k];}}
test('data sealed with SESSION_SECRET still opens after CONNECTIONS_SECRET is introduced',()=>{
 const old=withEnv({SESSION_SECRET:'session-a'},()=>seal({key:'abc'}));
 withEnv({SESSION_SECRET:'session-a',CONNECTIONS_SECRET:'conn-b'},()=>{assert.deepEqual(unseal(old),{key:'abc'});assert.notEqual(seal({key:'abc'}),old);});
});
test('rotation: previous secret opens old data, new data needs the new secret',()=>{
 const old=withEnv({CONNECTIONS_SECRET:'conn-1',SESSION_SECRET:'s'},()=>seal({n:1}));
 withEnv({CONNECTIONS_SECRET:'conn-2',SESSION_SECRET:'s2',CONNECTIONS_SECRET_PREVIOUS:'conn-1, other'},()=>assert.deepEqual(unseal(old),{n:1}));
 const fresh=withEnv({CONNECTIONS_SECRET:'conn-2',SESSION_SECRET:'s2'},()=>seal({n:2}));
 withEnv({CONNECTIONS_SECRET:'conn-1',SESSION_SECRET:'s'},()=>assert.throws(()=>unseal(fresh)));
});
test('tampered data and a missing secret are rejected',()=>{
 const sealed=withEnv({SESSION_SECRET:'s'},()=>seal({k:1}));
 withEnv({SESSION_SECRET:'s'},()=>{const [iv,tag,data]=sealed.split('.');assert.throws(()=>unseal([iv,tag,Buffer.from('x'+data).toString('base64')].join('.')));});
 withEnv({},()=>assert.throws(()=>seal({k:1}),/SESSION_SECRET is required/));
});
