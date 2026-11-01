import test from 'node:test';
import assert from 'node:assert/strict';
import {GitHubStorage,storagePath,validateFile,MAX_FILE_SIZE,fileCategory,formatSize} from '../docs/github.js';
const config = {owner:'octocat',repo:'decisif-shelf',branch:'main',token:'test-token'};
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('all content paths stay in storage; rejects traversal', () => {
  assert.equal(storagePath('作品/文件.txt'),'storage/作品/文件.txt');
  for (const path of ['../docs/app.js','a/../../docs','/docs','a\\b','./docs']) assert.throws(() => storagePath(path));
});
test('file limits and reserved names', () => {
  for (const name of ['..','.gitkeep','a/b','a\\b','a\n.txt']) assert.throws(() => validateFile({name,size:1}));
  assert.throws(() => validateFile({name:'big.zip',size:MAX_FILE_SIZE+1}));
  assert.doesNotThrow(() => validateFile({name:'中文文件.txt',size:0}));
});
test('upload encodes binary and filename; no SHA means no overwrites', async () => {
  let call;
  const client = new GitHubStorage(config,async (url,options) => {call={url,options};return json({content:{sha:'saved'}});});
  const file = new File([new Uint8Array([0,127,128,255])],'测试 #1.bin');
  await client.upload(file,'笔记');
  assert.ok(call.url.includes('/contents/storage/%E7%AC%94%E8%AE%B0/%E6%B5%8B%E8%AF%95%20%231.bin'));
  assert.equal(call.options.headers.Authorization,'Bearer test-token');
  assert.equal(call.options.method,'PUT');
  const body = JSON.parse(call.options.body);
  assert.equal(body.content,Buffer.from([0,127,128,255]).toString('base64')); assert.equal(body.branch,'main'); assert.ok(!('sha' in body));
});
test('upload without token never makes a request', async () => {
  const client = new GitHubStorage({...config,token:''},() => assert.fail('request not expected'));
  await assert.rejects(client.upload(new File(['x'],'a.txt')),/令牌/);
});
test('lists folders and files; hides placeholder and symlinks', async () => {
  const client = new GitHubStorage(config,async () => json([{name:'.gitkeep',type:'file'},{name:'file.txt',type:'file'},{name:'folder',type:'dir'},{name:'link',type:'symlink'}]));
  assert.deepEqual((await client.list()).map(x => x.name),['file.txt','folder']);
});
test('missing root checks repo and branch before returning empty', async () => {
  const paths=[]; const client=new GitHubStorage(config,async url => {paths.push(url); return paths.length === 1 ? json({},404) : json({});});
  assert.deepEqual(await client.list(),[]); assert.equal(paths.length,3); assert.ok(paths[2].endsWith('/branches/main'));
});
test('missing root does not hide revoked repository access', async () => {
  const client=new GitHubStorage(config,async () => json({},404));
  await assert.rejects(client.list(),error => error.status === 404);
});
test('missing nested folder is an error', async () => {
  let calls=0; const client=new GitHubStorage(config,async () => {calls++;return json({},404);});
  await assert.rejects(client.list('missing'),error => error.status === 404); assert.equal(calls,1);
});
test('download uses raw API for binary files, with branch and auth', async () => {
  let captured;
  const client=new GitHubStorage({...config,branch:'files/archive'},async (url,options) => {captured={url,options}; return new Response(new Uint8Array([1,0,255]));});
  const blob=await client.download('文件.zip');
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())],[1,0,255]);
  assert.ok(captured.url.endsWith('?ref=files%2Farchive')); assert.equal(captured.options.headers.Accept,'application/vnd.github.raw+json');
});
test('GitHub failures remain failures instead of success', async () => {
  for (const status of [401,403,409,422,429,500]) {
    const client=new GitHubStorage(config,async () => json({},status));
    await assert.rejects(client.upload(new File(['x'],'file.txt')),error => error.status === status);
  }
});
test('network errors provide retry guidance without exposing secrets', async () => {
  const client=new GitHubStorage(config,async () => {throw new Error('sensitive transport detail');});
  await assert.rejects(client.list(),error => error.message.includes('网络') && !error.message.includes('sensitive'));
});
test('type filters and readable sizes', () => {
  assert.equal(fileCategory('照片.JPG'),'image'); assert.equal(fileCategory('报告.pdf'),'document'); assert.equal(fileCategory('archive.zip'),'other');
  assert.equal(formatSize(0),'0 B'); assert.equal(formatSize(1024),'1.0 KiB'); assert.equal(formatSize(25*1024*1024),'25 MiB');
});
