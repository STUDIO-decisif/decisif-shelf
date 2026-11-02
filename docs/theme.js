// Runs before CSS to apply the preferred palette without a light first frame.
(()=>{
  const key='decisif-shelf.theme';
  let preference=null;
  try{const saved=localStorage.getItem(key);if(saved==='dark'||saved==='light')preference=saved;}catch{}
  const system=window.matchMedia('(prefers-color-scheme: dark)');
  const current=()=>preference||(system.matches?'dark':'light');
  function apply(){
    const dark=current()==='dark';document.documentElement.setAttribute('data-theme',dark?'dark':'light');
    const button=document.getElementById('theme-toggle');
    if(button){const label=dark?'Switch to light theme':'Switch to dark theme';button.setAttribute('aria-label',label);button.setAttribute('title',label);button.setAttribute('aria-pressed',String(dark));}
  }
  apply();
  system.addEventListener('change',()=>{if(!preference)apply();});
  document.addEventListener('DOMContentLoaded',()=>{
    apply();document.getElementById('theme-toggle').onclick=()=>{
      preference=current()==='dark'?'light':'dark';try{localStorage.setItem(key,preference);}catch{}apply();
    };
  },{once:true});
})();
