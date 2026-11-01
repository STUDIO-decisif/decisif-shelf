import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {GitHubStorage,validateFile,fileCategory,formatSize} from '../docs/github.js';
// Execute the real app against a small DOM stand-in; never write to GitHub.
class Element {
  constructor(tag='div') { this.tagName=tag;this.children=[];this.dataset={};this.value='';this.hidden=false;this.disabled=false;this.attributes={};this.textContent='';this.classes=new Set();this.classList={toggle:(name,on)=>{const active=on ?? !this.classes.has(name);active?this.classes.add(name):this.classes.delete(name);},add:name=>this.classes.add(name),remove:name=>this.classes.delete(name),contains:name=>this.classes.has(name)}; }
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];this.textContent='';}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(){}
  querySelectorAll(tag){return this.children.filter(child=>child.tagName===tag);}
  showModal(){this.open=true;}
  close(){this.open=false;}
  focus(){}
  scrollIntoView(){}
}
function boot() {
  const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
  const ids=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  const filters=['all','document','image','other'].map(name=>{const el=new Element('button');el.dataset.filter=name;return el;});
  ids.get('sort').value='name';
  const footer=new Element();
  const document={getElementById:id=>{assert.ok(ids.has(id),`missing element #${id}`);return ids.get(id);},querySelectorAll:()=>filters,querySelector:()=>footer,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),createTextNode:text=>({textContent:text}),addEventListener(){}};
  const context=vm.createContext({document,navigator:{platform:'Win32'},window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:()=>1,clearTimeout(){},GitHubStorage,validateFile,fileCategory,formatSize,URL,console});
  const source=readFileSync(new URL('../docs/app.js',import.meta.url),'utf8').replace(/^import .*?;\r?\n/,'');
  vm.runInContext(source,context);
  return {ids,filters,run:source=>vm.runInContext(source,context)};
}
const seed=`client={config:{owner:'test',repo:'shelf',branch:'main'},token:'mock',list:async()=>[]};entries=[{name:'z.pdf',type:'file',size:2048},{name:'a.jpg',type:'file',size:100},{name:'资料',type:'dir',size:0}];updateConnection();render();`;
test('page boots; disconnected upload opens connection dialog',()=>{
  const {ids}=boot();assert.equal(ids.get('file-count').textContent,'0 个项目');
  ids.get('upload-button').onclick();assert.equal(ids.get('settings').open,true);
});
test('counts, filtering, search and clear work through application handlers',()=>{
  const {ids,filters,run}=boot();run(seed);
  assert.equal(ids.get('count-all').textContent,3);assert.equal(ids.get('count-image').textContent,1);
  assert.equal(ids.get('file-count').textContent,'3 个项目');
  filters[2].onclick();assert.equal(ids.get('file-count').textContent,'1 个项目');assert.equal(ids.get('page-title').textContent,'图片');
  ids.get('search').value='missing';ids.get('search').oninput();assert.equal(ids.get('empty-title').textContent,'没有找到匹配的文件');assert.equal(ids.get('clear-search').hidden,false);
  ids.get('clear-search').onclick();assert.equal(ids.get('file-count').textContent,'3 个项目');assert.equal(ids.get('empty-state').hidden,true);
});
test('sorting keeps folders first; grid switch exposes selected state',()=>{
  const {ids,run}=boot();run(seed);ids.get('sort').value='size-desc';ids.get('sort').onchange();
  const names=run(`Array.from(document.getElementById('file-list').children,row=>row.children[0].children[0].children[1].textContent).join(',')`);
  assert.equal(names,'资料,z.pdf,a.jpg');
  ids.get('view-grid').onclick();assert.equal(ids.get('table-wrap').classList.contains('grid-view'),true);assert.equal(ids.get('view-grid').attributes['aria-pressed'],'true');
  ids.get('view-list').onclick();assert.equal(ids.get('table-wrap').classList.contains('grid-view'),false);
});
test('upload panel reports success and duplicate rejection',async()=>{
  const {ids,run}=boot();run(seed);run(`client.upload=async()=>({});`);
  await run(`uploadFiles([{name:'z.pdf',size:100},{name:'new.txt',size:5}])`);
  assert.equal(ids.get('transfer-panel').hidden,false);assert.equal(ids.get('transfer-title').textContent,'上传完成 · 1 / 2 个成功');
  assert.equal(ids.get('queue').children[0].className,'failed');assert.equal(ids.get('queue').children[1].className,'done');
  ids.get('queue-close').onclick();assert.equal(ids.get('transfer-panel').hidden,true);
});
