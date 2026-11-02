// Runs before CSS so the initial palette does not flash.
(()=>{
  const key='decisif-shelf.theme';let preference=null;
  try{const saved=localStorage.getItem(key);if(saved==='dark'||saved==='light')preference=saved;}catch{}
  let darkQuery,lightQuery;
  try{darkQuery=window.matchMedia?.('(prefers-color-scheme: dark)');lightQuery=window.matchMedia?.('(prefers-color-scheme: light)');}catch{}
  const systemTheme=()=>darkQuery?.matches?'dark':lightQuery?.matches?'light':'dark';
  const current=()=>preference||systemTheme();
  function apply(){
    const dark=current()==='dark';document.documentElement.setAttribute('data-theme',dark?'dark':'light');
    const button=document.getElementById('theme-toggle');
    if(button){const label=dark?'Switch to light theme':'Switch to dark theme';button.setAttribute('aria-label',label);button.setAttribute('title',label);button.setAttribute('aria-pressed',String(dark));}
  }
  apply();
  const follow=()=>{if(!preference)apply();};
  for(const query of [darkQuery,lightQuery]){if(query?.addEventListener)query.addEventListener('change',follow);else query?.addListener?.(follow);}
  document.addEventListener('DOMContentLoaded',()=>{
    apply();document.getElementById('theme-toggle').onclick=()=>{
      preference=current()==='dark'?'light':'dark';try{localStorage.setItem(key,preference);}catch{}apply();
    };
  },{once:true});
})();
