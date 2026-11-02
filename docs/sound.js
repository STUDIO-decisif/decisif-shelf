// Resume inside the upload gesture; playback itself happens only after commit.
export class SuccessSound {
  constructor(url='./assets/audio/upload-success.wav?v=2'){this.url=url;this.context=null;this.buffer=null;this.loading=null;this.sources=new Set();}
  prepare(){
    try{
      const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(!Context)return;
      this.context??=new Context();
      this.context.resume().catch(()=>{});
      if(!this.loading)this.loading=fetch(new URL(this.url,import.meta.url))
        .then(r=>{if(!r.ok)throw Error('audio');return r.arrayBuffer();})
        .then(bytes=>this.context.decodeAudioData(bytes))
        .then(buffer=>{this.buffer=buffer;})
        .catch(()=>{this.loading=null;});
    }catch{/* Audio availability must never block upload. */}
  }
  play(){
    if(!this.buffer||this.context?.state!=='running')return;
    try{const source=this.context.createBufferSource();source.buffer=this.buffer;source.connect(this.context.destination);this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();};source.start();}catch{}
  }
  stop(){for(const source of this.sources){try{source.stop();}catch{}}this.sources.clear();}
}
