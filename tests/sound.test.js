import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('success WAV is audible PCM, short and not clipped',()=>{
 const wav=readFileSync(new URL('../docs/assets/audio/upload-success.wav',import.meta.url));
 assert.equal(wav.toString('ascii',0,4),'RIFF');let pcm,rate;
 for(let i=12;i+8<=wav.length;){const size=wav.readUInt32LE(i+4),tag=wav.toString('ascii',i,i+4);if(tag==='fmt '){assert.equal(wav.readUInt16LE(i+8),1);assert.equal(wav.readUInt16LE(i+22),16);rate=wav.readUInt32LE(i+16);}if(tag==='data')pcm=wav.subarray(i+8,i+8+size);i+=8+size+(size%2);}
 assert.ok(pcm);let peak=0,energy=0;for(let i=0;i<pcm.length;i+=2){const v=pcm.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(v));energy+=v*v;}
 assert.ok(peak>0.1 && peak<0.99,`peak ${peak}`);assert.ok(Math.sqrt(energy/(pcm.length/2))>0.01);assert.ok(pcm.length/rate<1);
});
