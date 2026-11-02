import test from 'node:test';
import assert from 'node:assert/strict';
import {pbkdf2Sync,createDecipheriv} from 'node:crypto';
import {seal,unseal} from '../docs/vault.js';
test('WebCrypto envelope interoperates with independent Node AES-GCM and rejects tampering',async()=>{
 const config={owner:'test',repo:'data',branch:'main',mode:'github'},password='testRandom12x',token='fake-test-token';
 const c=await seal(token,password,config);assert.equal(await unseal(c,password),token);assert.ok(!JSON.stringify(c).includes(token));
 const key=pbkdf2Sync(password,Buffer.from(c.salt,'base64'),600000,32,'sha256'),data=Buffer.from(c.ciphertext,'base64');
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(c.iv,'base64'));decipher.setAAD(Buffer.from(JSON.stringify([c.version,c.owner,c.repo,c.branch,c.mode,c.iterations])));decipher.setAuthTag(data.subarray(-16));
 assert.equal(Buffer.concat([decipher.update(data.subarray(0,-16)),decipher.final()]).toString(),token);
 await assert.rejects(unseal(c,'wrong'));await assert.rejects(unseal({...c,repo:'other'},password));await assert.rejects(unseal({...c,iterations:1},password));
 const d=await seal(token,password,config);assert.notEqual(c.salt,d.salt);assert.notEqual(c.iv,d.iv);
});
