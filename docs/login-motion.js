const ease='cubic-bezier(.42,0,.18,1)';
export async function opacity(element,from,to,duration=240){
  if(!element.animate)return;
  const reduce=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const a=element.animate([{opacity:from},{opacity:to}],{duration:reduce?1:duration,easing:ease,fill:'forwards'});
  try{await a.finished;}catch{}
}
export class LoginMotion {
  constructor({dialog,form,glass,word,files,sound}){Object.assign(this,{dialog,form,glass,word,files,sound});this.version=0;}
  reset(stopSound=true){
    this.version++;if(stopSound)this.sound.stop();
    for(const e of [this.dialog,this.form,this.glass,this.word,this.files])for(const a of e.getAnimations?.()||[])a.cancel();
    this.glass.hidden=true;this.word.hidden=true;this.form.hidden=false;this.dialog.removeAttribute('data-welcome');
  }
  open(){this.reset();this.glass.hidden=false;this.dialog.showModal();opacity(this.glass,0,1,320);opacity(this.dialog,0,1,260);}
  async cancel(){const v=++this.version;this.sound.stop();await Promise.all([opacity(this.glass,1,0,280),opacity(this.dialog,1,0,220)]);if(v!==this.version)return;this.dialog.close();this.reset();}
  async prepareWelcome(){
    await opacity(this.form,1,0,160);this.form.hidden=true;this.dialog.setAttribute('data-welcome','true');this.word.hidden=false;
  }
  async cycle(text='decisif shelf',isCurrent=()=>true){
    if(!this.word.animate)return;
    const reduce=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.word.replaceChildren();
    const letters=Array.from(text);
    const animations=letters.map((letter,index)=>{
      if(letter==='\n'){this.word.append(document.createElement('br'));return Promise.resolve();}
      const span=document.createElement('span');span.textContent=letter===' '?'\u00a0':letter;this.word.append(span);
      if(!span.animate)return Promise.resolve();
      const a=span.animate([{opacity:0,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:reduce?1:550,delay:reduce?0:index*95,easing:ease,fill:'both'});return a.finished.catch(()=>{});
    });
    // No per-frame JS or changing blur radii; only text opacity/transform.
    await opacity(this.word,1,1,1);await Promise.all(animations);if(!isCurrent())return;
    if(this.word.animate){const hold=this.word.animate([{opacity:1},{opacity:1}],{duration:reduce?900:1050});try{await hold.finished;}catch{}}
    if(isCurrent())await opacity(this.word,1,0,650);
  }
  async welcome(task,onData,isCurrent){
    const v=this.version;let ready=false,failure,reveal;
    const loading=task.then(data=>{if(v!==this.version||!isCurrent())return;onData(data);ready=true;reveal=Promise.all([opacity(this.files,0,1,360),opacity(this.glass,1,0,360)]);},error=>{failure=error;ready=true;});
    await this.prepareWelcome();if(v!==this.version||!isCurrent())return;
    // Only the first cycle starts audio. Later cycles are silent.
    if(this.sound.loading)await this.sound.loading;
    if(v!==this.version||!isCurrent())return;this.sound.play();
    do{await this.cycle();if(!this.word.animate)await loading;}while(!ready&&v===this.version&&isCurrent());
    await loading;await reveal;if(v!==this.version||!isCurrent())return;
    if(failure)await opacity(this.glass,1,0,280);
    this.dialog.close();this.reset(false);if(failure)throw failure;
  }
}
export class InvitationMotion {
  constructor(root,line){this.root=root;this.line=line;this.visible=null;this.version=0;this.text=line.getAttribute?.('aria-label')||'';}
  async setText(text){
    if(text===this.text)return;
    if(!this.visible){this.text=text;this.line.setAttribute('aria-label',text);return;}
    this.text=text;const v=++this.version;
    for(const a of this.line.getAnimations?.()||[])a.cancel();
    await opacity(this.line,1,0,140);if(v!==this.version)return;
    for(const child of this.line.children||[])for(const a of child.getAnimations?.()||[])a.cancel();
    this.line.setAttribute('aria-label',text);this.line.textContent=text;
    if(this.visible)this.run(v);
  }
  run(v){
    if(!this.line.animate||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){opacity(this.line,0,1,140);return;}
    const loop=async()=>{while(v===this.version&&this.visible&&!this.root.hidden){await LoginMotion.prototype.cycle.call({word:this.line},this.text,()=>v===this.version);}};loop();
  }
  setVisible(visible){
    if(this.visible===visible)return;
    this.visible=visible;const v=++this.version;
    if(!visible){
      opacity(this.root,1,0,280).then(()=>{if(v===this.version)this.root.hidden=true;});return;
    }
    this.root.hidden=false;opacity(this.root,0,1,220);
    this.run(v);
  }
}
export class KeyMorph {
  constructor(button){this.button=button;this.count=0;this.target=0;this.running=false;}
  setExpanded(expanded){this.target=expanded?4:0;if(!this.running)this.step();}
  step(){
    if(this.count===this.target){this.running=false;return;}
    this.running=true;this.count+=Math.sign(this.target-this.count);this.button.setAttribute('data-tail',String(this.count));
    this.button.setAttribute('aria-label',this.count===4?'keyhole':'key');
    setTimeout(()=>this.step(),75);
  }
}
