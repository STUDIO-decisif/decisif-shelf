import {GitHubStorage,validateFile} from './github.js';
import {toBase64} from './vault.js';
const INDEX='.shelf/files.json';
export function validateBatch(files) {
  if(!files.length || files.length>200 || files.reduce((n,f)=>n+f.size,0)>100*1024*1024)throw Error('error');
  const names=new Set();for(const f of files){validateFile(f);if(names.has(f.name))throw Error('error');names.add(f.name);}
}
export class FileStorage extends GitHubStorage {
  constructor(config,fetcher){super(config,fetcher);this.abort=new AbortController();}
  async request(path,options={}) {
    if(this.abort.signal.aborted)throw Error('error');
    // Keep the inherited error mapping while cancelling all requests on lock.
    const original=this.fetcher;
    const fetcher=(url,init)=>original(url,{...init,signal:AbortSignal.any([init.signal,this.abort.signal])});
    const proxy=Object.create(this);proxy.fetcher=fetcher;
    return GitHubStorage.prototype.request.call(proxy,path,options);
  }
  close(){this.abort.abort();this.token='';}
  async snapshot(){
    const ref=await this.request(`/git/ref/heads/${encodeURIComponent(this.config.branch)}`);
    const commit=await this.request(`/git/commits/${ref.object.sha}`);
    const tree=await this.request(`/git/trees/${commit.tree.sha}?recursive=1`);
    if(tree.truncated)throw Error('error');
    const record=tree.tree.find(e=>e.path===INDEX);let metadata={};
    if(record){const blob=await this.request(`/git/blobs/${record.sha}`);metadata=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(blob.content.replace(/\s/g,'')),c=>c.charCodeAt(0))));}
    const entries=tree.tree.filter(e=>e.type==='blob' && e.mode==='100644' && e.path.startsWith('storage/') && !e.path.slice(8).includes('/') && e.path!=='storage/.gitkeep').map(e=>({name:e.path.slice(8),size:e.size,created:metadata[e.path]?.created||null,sha:e.sha}));
    return {head:ref.object.sha,tree:commit.tree.sha,metadata,entries};
  }
  async listFiles(){return (await this.snapshot()).entries;}
  async uploadFiles(files,onProgress=()=>{}){
    validateBatch(files);let state=await this.snapshot();
    const check=()=>{if(files.some(f=>state.entries.some(e=>e.name===f.name)))throw Error('error');};check();
    const blobs=[];const created=new Date().toISOString();
    for(const file of files){const blob=await this.request('/git/blobs',{method:'POST',body:{encoding:'base64',content:toBase64(await file.arrayBuffer())}});blobs.push({path:`storage/${file.name}`,mode:'100644',type:'blob',sha:blob.sha});onProgress(blobs.length,files.length+1);}
    for(let attempt=0;attempt<3;attempt++){
      check();const metadata={...state.metadata};for(const blob of blobs)metadata[blob.path]={created};
      const tree=await this.request('/git/trees',{method:'POST',body:{base_tree:state.tree,tree:[...blobs,{path:INDEX,mode:'100644',type:'blob',content:JSON.stringify(metadata)}]}});
      const commit=await this.request('/git/commits',{method:'POST',body:{message:`Shelf: add ${files.length} file(s)`,tree:tree.sha,parents:[state.head]}});
      try{await this.request(`/git/refs/heads/${encodeURIComponent(this.config.branch)}`,{method:'PATCH',body:{sha:commit.sha,force:false}});onProgress(files.length+1,files.length+1);return;}
      catch(error){state=await this.snapshot();if(blobs.every(b=>state.entries.some(e=>`storage/${e.name}`===b.path && e.sha===b.sha)))return;if(![409,422].includes(error.status)||attempt===2)throw error;}
    }
  }
}
export class DemoStorage {
  constructor(){this.files=new Map();for(const [name,text] of [['Example.txt','Decisif Shelf — local demo.'],['File list.csv','name,size\nexample.txt,24\n']]){const blob=new Blob([text]);this.files.set(name,{blob,created:'2026-11-01T08:00:00Z'});}}
  async listFiles(){return [...this.files].map(([name,f])=>({name,size:f.blob.size,created:f.created}));}
  async uploadFiles(files,onProgress=()=>{}){validateBatch(files);if(files.some(f=>this.files.has(f.name)))throw Error('error');for(const f of files)this.files.set(f.name,{blob:f,created:new Date().toISOString()});onProgress(files.length,files.length);}
  async download(name){if(!this.files.has(name))throw Error('error');return this.files.get(name).blob;}
  close(){this.files.clear();}
}
