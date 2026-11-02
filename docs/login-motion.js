const ease='cubic-bezier(.42,0,.18,1)';
export async function opacity(element,from,to,duration=240){
  if(!element.animate)return;
  if(from===null)from=globalThis.getComputedStyle?globalThis.getComputedStyle(element).opacity:1;
  const reduce=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const a=element.animate([{opacity:from},{opacity:to}],{duration:reduce?1:duration,easing:ease,fill:'forwards'});
  try{await a.finished;}catch{}
}
export class LoginMotion {
  constructor({dialog,form,glass,word,files,sound}){Object.assign(this,{dialog,form,glass,word,files,sound});this.version=0;}
  async blurGlass(target,duration){
    if(!this.glass.animate)return;
    const style=globalThis.getComputedStyle?.(this.glass);
    const from=style?.backdropFilter||style?.webkitBackdropFilter||'blur(0px)';
    const radius=target||style?.getPropertyValue('--glass-radius').trim()||'6px';
    const ms=duration??(style?.getPropertyValue('--glass-duration').trim().replace('ms','')*1||700);
    const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Sample the live radius before cancelling, so reversals never jump to full blur.
    this.glassAnimation?.cancel?.();
    const a=this.glass.animate([
      {backdropFilter:from==='none'?'blur(0px)':from,webkitBackdropFilter:from==='none'?'blur(0px)':from},
      {backdropFilter:`blur(${radius})`,webkitBackdropFilter:`blur(${radius})`}
    ],{duration:reduced?1:ms,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'});
    this.glassAnimation=a;try{await a.finished;}catch{}
  }
  reset(stopSound=true){
    this.version++;if(stopSound)this.sound.stop();
    for(const e of [this.dialog,this.form,this.glass,this.word,this.files])for(const a of e.getAnimations?.()||[])a.cancel();
    this.glass.hidden=true;this.word.hidden=true;this.form.hidden=false;this.dialog.removeAttribute('data-welcome');
    this.dialog.removeAttribute('data-opening');this.glass.removeAttribute('data-opening');
  }
  open(){
    this.reset();const v=this.version;
    // Establish a transparent first frame before entering the browser's top layer.
    this.dialog.setAttribute('data-opening','true');this.glass.setAttribute('data-opening','true');
    this.glass.hidden=false;this.dialog.showModal();
    this.blurGlass().then(()=>{if(v===this.version)this.glass.removeAttribute('data-opening');});
    if(!this.dialog.animate){this.dialog.removeAttribute('data-opening');return;}
    const reduce=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const enter=this.dialog.animate([
      {opacity:0,filter:reduce?'blur(0px)':'blur(4px)'},
      {opacity:1,filter:'blur(0px)'}
    ],{duration:reduce?1:500,easing:'cubic-bezier(.55,0,.2,1)',fill:'forwards'});
    enter.finished.catch(()=>{}).then(()=>{if(v===this.version)this.dialog.removeAttribute('data-opening');});
  }
  async cancel(){const v=++this.version;this.sound.stop();await Promise.all([this.blurGlass('0px',450),opacity(this.dialog,null,0,220)]);if(v!==this.version)return;this.dialog.close();this.reset();}
  async prepareWelcome(){
    const v=this.version;
    await opacity(this.form,1,0,160);if(v!==this.version)return;
    // Fade the complete panel, including its surface and border, before resizing.
    await opacity(this.dialog,1,0,180);if(v!==this.version)return;
    this.form.hidden=true;this.word.replaceChildren();this.dialog.setAttribute('data-welcome','true');this.word.hidden=false;
    await opacity(this.dialog,0,1,1);
  }
  async cycle(text='decisif shelf',isCurrent=()=>true,speed=1){
    if(!this.word.animate)return;
    const reduce=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.word.replaceChildren();
    const letters=Array.from(text);
    const animations=letters.map((letter,index)=>{
      if(letter==='\n'){this.word.append(document.createElement('br'));return Promise.resolve();}
      const span=document.createElement('span');span.textContent=letter===' '?'\u00a0':letter;this.word.append(span);
      if(!span.animate)return Promise.resolve();
      const a=span.animate([{opacity:0,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:reduce?1:550/speed,delay:reduce?0:index*95/speed,easing:ease,fill:'both'});return a.finished.catch(()=>{});
    });
    // No per-frame JS or changing blur radii; only text opacity/transform.
    await opacity(this.word,1,1,1);await Promise.all(animations);if(!isCurrent())return;
    if(this.word.animate){const hold=this.word.animate([{opacity:1},{opacity:1}],{duration:reduce?900:1050});try{await hold.finished;}catch{}}
    if(isCurrent())await opacity(this.word,1,0,650);
  }
  async welcome(task,onData,isCurrent){
    const v=this.version;let ready=false,failure,reveal;
    const loading=task.then(data=>{if(v!==this.version||!isCurrent())return;onData(data);ready=true;reveal=Promise.all([opacity(this.files,0,1,450),this.blurGlass('0px',450)]);},error=>{failure=error;ready=true;});
    await this.prepareWelcome();if(v!==this.version||!isCurrent())return;
    // Only the first cycle starts audio. Later cycles are silent.
    if(this.sound.loading)await this.sound.loading;
    if(v!==this.version||!isCurrent())return;this.sound.play();
    do{await this.cycle();if(!this.word.animate)await loading;}while(!ready&&v===this.version&&isCurrent());
    await loading;await reveal;if(v!==this.version||!isCurrent())return;
    if(failure)await this.blurGlass('0px',450);
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
    const loop=async()=>{while(v===this.version&&this.visible&&!this.root.hidden){await LoginMotion.prototype.cycle.call({word:this.line},this.text,()=>v===this.version,2);}};loop();
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
