import {mkdir,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline/promises';
import {emitKeypressEvents} from 'node:readline';
import {seal} from '../docs/vault.js';
function secret(prompt){
  if(!process.stdin.isTTY)throw Error('Use an interactive terminal.');
  process.stdout.write(prompt);emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();
  return new Promise((resolve,reject)=>{let value='';const finish=()=>{process.stdin.off('keypress',handler);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};const handler=(str,key)=>{if(key?.ctrl&&key.name==='c'){finish();reject(Error('Cancelled'));}else if(key?.name==='return'){finish();resolve(value);}else if(key?.name==='backspace'){value=value.slice(0,-1);}else if(str&&!key?.ctrl&&!/[\x00-\x1f\x7f]/.test(str))value+=str;};process.stdin.on('keypress',handler);});
}
const demo=process.argv.includes('--demo');
let config={owner:'STUDIO-decisif',repo:'decisif-shelf-storage',branch:'main',mode:demo?'demo':'github'};
let password,token;
try{
  if(demo){password='ShelfDemo123';token='local-demo-only';}
  else{
    const rl=createInterface({input:process.stdin,output:process.stdout});
    config.owner=(await rl.question(`Owner [${config.owner}]: `)).trim()||config.owner;
    config.repo=(await rl.question(`Repository [${config.repo}]: `)).trim()||config.repo;
    config.branch=(await rl.question('Branch [main]: ')).trim()||'main';rl.close();
    token=await secret('GitHub Token (hidden): ');password=await secret('Key, at least 12 characters (hidden): ');
    if(password.length<12||password!==await secret('Repeat key (hidden): ')||!token.trim())throw Error('Invalid input or keys do not match.');
    if(config.repo==='decisif-shelf')throw Error('Use the separate private storage repository.');
    const response=await fetch(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'}});
    if(!response.ok||!(await response.json()).private)throw Error('Private repository access check failed.');
  }
  const envelope=await seal(token,password,config);token='';password='';
  const dir=new URL('../docs/config/',import.meta.url);await mkdir(dir,{recursive:true});await writeFile(new URL('vault.json',dir),JSON.stringify(envelope,null,2)+'\n');
  console.log(demo?'Demo ready. Key: ShelfDemo123 (local memory only).':'Saved encrypted config: docs/config/vault.json');
}catch(error){console.error(error.message);process.exitCode=1;}finally{token='';password='';}
