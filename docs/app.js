import {LoginMotion,InvitationMotion,KeyMorph} from './login-motion.js';
import {SuccessSound} from './sound.js';
import {unseal} from './vault.js';
import {FileStorage,DemoStorage,validateBatch} from './storage.js';
import {formatSize} from './github.js';
const $=id=>document.getElementById(id);
let client=null,entries=[],selected=null,busy=false,generation=0,restoring=false;
const urls=new Set();
const successSound=new SuccessSound();
const welcomeSound=new SuccessSound('./assets/audio/welcome.wav');
const loginMotion=new LoginMotion({dialog:$('login'),form:$('login-form'),glass:$('login-glass'),word:$('welcome-word'),files:$('files'),sound:welcomeSound});
const invitationMotion=new InvitationMotion($('invitation'),$('invitation-words'));
const keyMorph=new KeyMorph($('key-open'));
let overInvitation=false,overKey=false;
const defaultInvitation='Bro if U’ve got a key, U won’t be issued a nice-guy card.';
function syncKeyHover(){keyMorph.setExpanded(overInvitation||overKey);}
$('invitation-words').onmouseenter=()=>{overInvitation=true;invitationMotion.setText("Who's key can't find a keyhole?");syncKeyHover();};
$('invitation-words').onmouseleave=()=>{overInvitation=false;invitationMotion.setText(defaultInvitation);syncKeyHover();};
$('key-slot').onmouseenter=()=>{overKey=true;syncKeyHover();};
$('key-slot').onmouseleave=()=>{overKey=false;syncKeyHover();};
let keyAccepted=false;
const uploadStates=new Map(),rows=new Map();
let uploadSequence=0;
const SESSION='decisif-shelf.session.v2';
function newestFirst(a,b){
  const time=e=>Date.parse(e.created)||0;
  return time(b)-time(a)||a.name.localeCompare(b.name,'en',{numeric:true});
}
async function fade(element,from,to,duration=140){
  if(!element.animate)return;
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const animation=element.animate([{opacity:from},{opacity:to}],{duration:reduced?1:duration,easing:'cubic-bezier(.42,0,.18,1)',fill:'forwards'});
  try{await animation.finished;}catch{}
}
function resetLoginVisuals(){
  $('login').removeAttribute('data-state');$('key').disabled=false;
  for(const id of ['login','login-form','key','key-field','login-error','login-check'])for(const animation of $(id).getAnimations?.()||[])animation.cancel();
}
async function finishLogin(version){
  await fade($('key'),1,0,120);if(version!==generation)return;
  $('key').value='';$('login').setAttribute('data-state','success');
  await fade($('login-check'),0,1,220);if(version!==generation)return;
  await fade($('login-check'),1,1,300);
}
function clearSession(){try{sessionStorage.removeItem(SESSION);}catch{}}
function saveSession(config,token){try{sessionStorage.setItem(SESSION,JSON.stringify({config,token,entries}));}catch{/* Storage disabled: retain memory-only login. */}}
async function restoreSession(){
  let saved;try{saved=JSON.parse(sessionStorage.getItem(SESSION));}catch{clearSession();return;}
  if(!saved)return;
  entries=Array.isArray(saved.entries)?saved.entries.filter(e=>e && typeof e.name==='string' && Number.isFinite(e.size)):[];
  const version=generation;let candidate;busy=true;restoring=true;render();
  const invalid=()=>Object.assign(Error('error'),{sessionInvalid:true});
  try{
    if(!saved.config||!['github','demo'].includes(saved.config.mode)||typeof saved.token!=='string'||!saved.token)throw invalid();
    try{candidate=saved.config.mode==='demo'?new DemoStorage():new FileStorage({...saved.config,token:saved.token});}catch{throw invalid();}
    // Restore the local session independently of the availability of GitHub.
    client=candidate;keyAccepted=true;
    const response=await fetch('./config/vault.json',{cache:'no-store'});if(!response.ok)throw Error('error');
    const config=await response.json();if(version!==generation)return;
    if(JSON.stringify(config)!==JSON.stringify(saved.config))throw invalid();
    saved=null;
    if(config.mode!=='demo'){const info=await candidate.connect();if(!info.private)throw invalid();}
    const data=await candidate.listFiles();if(version!==generation)return;
    entries=data.sort(newestFirst);saveSession(config,candidate.token||'demo');
  }catch(error){if(version===generation){
    if(error.sessionInvalid||error.status===401){candidate?.close();client=null;keyAccepted=false;clearSession();entries=[];}
    // Network failures, rate limits and service errors do not revoke a session.
    $('error').textContent='error';
  }}
  finally{saved=null;if(version===generation){busy=false;restoring=false;render();}}
}
function render(){
  entries.sort(newestFirst);
  invitationMotion.setVisible(!client&&!restoring&&!keyAccepted);
  const visibleRows=[];
  for(const entry of entries){
    let cached=rows.get(entry.name);
    if(!cached){const row=document.createElement('tr'),name=document.createElement('td'),date=document.createElement('td'),size=document.createElement('td'),button=document.createElement('button'),status=document.createElement('span');
      status.className='upload-status';status.setAttribute('aria-hidden','true');
      status.innerHTML='<svg class="upload-spinner" viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5"/></svg><svg class="upload-check" viewBox="0 0 20 20"><path pathLength="1" d="m4.5 10 3.6 3.6 7.4-7.4"/></svg>';
      name.className='filename-cell';name.append(button,status);row.append(name,date,size);cached={row,name,date,size,button,status,phase:'',reveal:!uploadStates.has(entry.name)};rows.set(entry.name,cached);
    }
    const {row,date,size,button,status}=cached,phase=uploadStates.get(entry.name)?.phase||'';
    button.textContent=entry.name;button.title=entry.name;button.disabled=busy;button.setAttribute('aria-pressed',String(selected===entry.name));
    // Row handles pointer actions; the filename remains a keyboard-focusable button.
    const select=()=>{if(busy||!client)return;selected=entry.name;render();};
    row.onpointerdown=event=>{cached.pointerType=event.pointerType;};
    row.onclick=select;
    row.ondblclick=event=>{
      const touch=cached.pointerType==='touch'||cached.pointerType==='pen'||event?.sourceCapabilities?.firesTouchEvents||globalThis.matchMedia?.('(hover: none), (pointer: coarse)').matches;
      if(touch||busy||!client)return;selected=entry.name;render();download();
    };
    button.onclick=event=>{event?.stopPropagation?.();select();};
    row.className=(selected===entry.name?'selected ':'')+(phase?'upload-'+phase:'')+(cached.reveal?' file-reveal':'');
    if(cached.phase!==phase){status.setAttribute('data-phase',phase);cached.phase=phase;}
    date.textContent=entry.created?new Date(entry.created).toLocaleString('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
    size.textContent=formatSize(entry.size);visibleRows.push(row);
  }
  for(const key of rows.keys())if(!entries.some(e=>e.name===key))rows.delete(key);
  // Preserve existing nodes so unrelated updates do not restart their animations.
  for(let i=0;i<visibleRows.length;i++)if($('files').children[i]!==visibleRows[i])$('files').insertBefore(visibleRows[i],$('files').children[i]||null);
  while($('files').children.length>visibleRows.length)$('files').lastElementChild.remove();
  $('upload').disabled=!client||busy;$('download').disabled=!client||!selected||busy;
  $('key-open').disabled=busy;
  $('key-open').setAttribute('aria-busy',String(restoring));
  $('key-open').setAttribute('aria-pressed',String(Boolean(client)||restoring));
}
function lock(preserveSession=false){if(!preserveSession)clearSession();generation++;keyAccepted=false;loginMotion.reset();uploadStates.clear();successSound.stop();restoring=false;client?.close();client=null;entries=[];selected=null;busy=false;for(const url of urls)URL.revokeObjectURL(url);urls.clear();$('key').value='';$('login-error').textContent='';$('error').textContent='';$('confirm').disabled=false;if($('login').open)$('login').close();render();}
$('key-open').onclick=()=>{if(busy)return;resetLoginVisuals();$('key').value='';$('login-error').textContent='';overInvitation=false;overKey=false;syncKeyHover();welcomeSound.prepare();loginMotion.open();$('key-open').setAttribute('aria-expanded','true');$('key').focus();};
$('login').addEventListener('close',()=>{$('key').value='';$('key-open').setAttribute('aria-expanded','false');});
$('login').addEventListener('cancel',event=>{event?.preventDefault();if(!busy)loginMotion.cancel();});
$('login').addEventListener('click',event=>{if(event.target!==$('login')||busy)return;const r=$('login').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)loginMotion.cancel();});
$('key').oninput=()=>{if($('login-error').textContent)fade($('login-error'),1,0);};
$('login-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;busy=true;$('confirm').disabled=true;$('key').disabled=true;
  let password=$('key').value;const version=generation;let candidate,localAccepted=false;
  try{
    if($('login-error').textContent){await fade($('login-error'),1,0);$('login-error').textContent='';}
    if(version!==generation)return;
    const response=await fetch('./config/vault.json',{cache:'no-store'});if(!response.ok)throw Error('error');const config=await response.json();
    let token=await unseal(config,password);password='';if(version!==generation)return;
    candidate=config.mode==='demo'?new DemoStorage():new FileStorage({...config,token});token='';
    localAccepted=true;keyAccepted=true;invitationMotion.setVisible(false);
    // The check confirms local decryption, independently of GitHub/network latency.
    await finishLogin(version);if(version!==generation){candidate.close();return;}
    const dataTask=(async()=>{
      if(config.mode!=='demo'){const info=await candidate.connect();if(!info.private)throw Error('error');}
      return candidate.listFiles();
    })();
    await loginMotion.welcome(dataTask,data=>{
      client?.close();client=candidate;entries=data.sort(newestFirst);saveSession(config,candidate.token||'demo');render();
    },()=>version===generation);
  }catch{candidate?.close();if(version===generation){
    if(localAccepted){$('error').textContent='error';return;}
    await fade($('key-field'),1,0,160);if(version!==generation)return;
    $('key').value='';$('key').disabled=false;$('key').focus();
    await fade($('key-field'),0,1,180);if(version!==generation)return;
    $('login-error').textContent='error';await fade($('login-error'),0,1,140);
  }}
  finally{password='';if(version===generation){busy=false;$('confirm').disabled=false;render();}}
};
$('upload').onclick=()=>{if(client&&!busy){successSound.prepare();$('file-input').click();}};
$('file-input').onchange=async event=>{
  const files=Array.from(event.target.files);event.target.value='';if(!client||busy||!files.length)return;
  try{validateBatch(files);if(files.some(f=>entries.some(e=>e.name===f.name)))throw Error('duplicate');}catch{$('error').textContent='error';return;}
  successSound.prepare();
  const active=client,version=generation,id=++uploadSequence,created=new Date().toISOString();
  busy=true;$('error').textContent='';
  for(const file of files){entries.push({name:file.name,size:file.size,created});uploadStates.set(file.name,{phase:'pending',id});}
  entries.sort(newestFirst);render();
  let committed=false;
  try{
    await active.uploadFiles(files);if(version!==generation)return;committed=true;
    for(const file of files){uploadStates.set(file.name,{phase:'success',id});const entry=entries.find(e=>e.name===file.name);if(entry)entry.created=created;}
    render();
    // WAV onset is ~25 ms; start 195 ms into the 220 ms check stroke.
    setTimeout(()=>{if(version===generation)successSound.play();},195);
    setTimeout(()=>{if(version!==generation)return;for(const file of files)if(uploadStates.get(file.name)?.id===id)uploadStates.delete(file.name);render();},850);
    try{const saved=JSON.parse(sessionStorage.getItem(SESSION));if(saved)saveSession(saved.config,active.token||'demo');}catch{}
    const data=await active.listFiles();if(version===generation){entries=data.sort(newestFirst);try{const saved=JSON.parse(sessionStorage.getItem(SESSION));if(saved)saveSession(saved.config,active.token||'demo');}catch{}}
  }catch{if(version===generation){if(!committed){await Promise.all(files.map(f=>rows.get(f.name)).filter(Boolean).map(r=>fade(r.row,1,0,180)));if(version!==generation)return;const names=new Set(files.map(f=>f.name));entries=entries.filter(e=>!names.has(e.name));for(const name of names)uploadStates.delete(name);} $('error').textContent='error';}}
  finally{if(version===generation){busy=false;render();}}
};
async function download(){
  if(!client||!selected||busy)return;const active=client,name=selected,version=generation;busy=true;$('error').textContent='';render();
  try{const blob=await active.download(name);if(version!==generation)return;const url=URL.createObjectURL(blob);urls.add(url);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},60000);}
  catch{if(version===generation)$('error').textContent='error';}
  finally{if(version===generation){busy=false;render();}}
}
$('download').onclick=download;
window.addEventListener('pagehide',()=>lock(true));
window.addEventListener('pageshow',event=>{if(event.persisted){lock(true);restoreSession();}});
render();
restoreSession();
