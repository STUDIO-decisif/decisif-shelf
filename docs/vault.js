const enc = new TextEncoder();
export const ITERATIONS = 600000;
export function toBase64(buffer) { let s=''; const bytes=new Uint8Array(buffer); for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s); }
const fromBase64 = value => Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const aad = c => enc.encode(JSON.stringify([c.version,c.owner,c.repo,c.branch,c.mode,c.iterations]));
async function derive(password,salt) { const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']); return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',iterations:ITERATIONS,salt},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']); }
export async function seal(token,password,config) {
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const result={version:2,owner:config.owner,repo:config.repo,branch:config.branch,mode:config.mode||'github',iterations:ITERATIONS,salt:toBase64(salt),iv:toBase64(iv)};
  const key=await derive(password,salt);result.ciphertext=toBase64(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(result),tagLength:128},key,enc.encode(token)));return result;
}
export async function unseal(config,password) {
  if(config.version!==2 || config.iterations!==ITERATIONS || !['github','demo'].includes(config.mode))throw Error('error');
  const salt=fromBase64(config.salt),iv=fromBase64(config.iv),cipher=fromBase64(config.ciphertext);
  if(salt.length!==16 || iv.length!==12 || cipher.length<17 || cipher.length>4096)throw Error('error');
  const key=await derive(password,salt);
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(config),tagLength:128},key,cipher));
}
