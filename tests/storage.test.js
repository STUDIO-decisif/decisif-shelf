import test from 'node:test';import assert from 'node:assert/strict';
import {FileStorage,DemoStorage,validateBatch} from '../docs/storage.js';
const file=name=>({name,size:3,arrayBuffer:async()=>new TextEncoder().encode('abc').buffer});
test('duplicate names and oversized batches fail before upload',()=>{assert.throws(()=>validateBatch([file('a'),file('a')]));assert.throws(()=>validateBatch([file('../a')]));assert.throws(()=>validateBatch(Array(201).fill(file('x'))));});
test('demo uploads downloadable bytes and discards them on lock',async()=>{const d=new DemoStorage();const f=new Blob(['real bytes']);f.name='test.txt';await d.uploadFiles([f]);assert.equal(await (await d.download(f.name)).text(),'real bytes');await assert.rejects(d.uploadFiles([f]));d.close();assert.equal((await d.listFiles()).length,0);});
test('upload retries non-force conflict and preserves concurrent metadata',async()=>{
 const client=new FileStorage({owner:'test',repo:'data',branch:'main',token:'mock'});let snapshots=0,patches=0;const trees=[];
 client.snapshot=async()=>({head:`head${++snapshots}`,tree:'base',entries:[],metadata:snapshots>1?{'storage/other.txt':{created:'old'}}:{}});
 client.request=async(path,options)=>{if(path==='/git/blobs')return {sha:'blob'};if(path==='/git/trees'){trees.push(options.body);return {sha:'tree'};}if(path==='/git/commits')return {sha:'commit'};if(path.startsWith('/git/refs/')){assert.equal(options.body.force,false);if(++patches===1)throw Object.assign(Error('conflict'),{status:422});return {};}throw Error(path);};
 await client.uploadFiles([file('new.txt')]);assert.equal(patches,2);const data=JSON.parse(trees[1].tree.at(-1).content);assert.equal(data['storage/other.txt'].created,'old');assert.ok(data['storage/new.txt'].created);assert.equal(trees[1].base_tree,'base');
});
test('blob failure never publishes a reference',async()=>{const c=new FileStorage({owner:'test',repo:'data',branch:'main'});c.snapshot=async()=>({entries:[]});const paths=[];c.request=async path=>{paths.push(path);throw Error('offline');};await assert.rejects(c.uploadFiles([file('a')]));assert.deepEqual(paths,['/git/blobs']);});
