import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('dist/manage/index.html','utf8');
const failures=[];
const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};

requireText("const ambiguous=err.code==='REQUEST_TIMEOUT'||err.code==='BOOKING_RELOAD_FAILED';",'ambiguous Manage change outcomes are not classified');
requireText("const refreshed=await api('/manage/'+encodeURIComponent(token),{timeoutMs:2500});",'ambiguous Manage changes are not reconciled against a fresh booking snapshot');
requireText("String(refreshed.selected_date||'')===String(date||'')&&manageTimeLabel(refreshed.slot_time)===manageTimeLabel(time)",'Manage reconciliation does not verify the exact requested date/time');
requireText("booking=refreshed;",'confirmed reconciliation does not adopt the authoritative refreshed booking');
requireText("reload.onclick=()=>location.reload();",'unresolved ambiguous changes do not provide a read-only refresh recovery');
requireText("st.appendChild(document.createTextNode(' '));st.appendChild(reload);\n  return;",'unresolved ambiguous changes can fall through and unlock a second mutation');
requireText("delete st.dataset.busy;changeButtons.forEach(b=>b.disabled=false);",'definitive non-ambiguous failures no longer restore normal controls');

let inlineScripts=0;
for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
  const code=match[1].trim();
  if(!code)continue;
  inlineScripts++;
  try{new vm.Script(code,{filename:'manage-reconcile-inline-'+inlineScripts+'.js'});}
  catch(error){failures.push('inline Manage script '+inlineScripts+' failed to compile: '+error.message);}
}
if(failures.length){
  console.error('Manage ambiguous change reconciliation guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Manage ambiguous change reconciliation guard OK: timeout/reload-failure outcomes are verified before another departure mutation can be attempted.');
