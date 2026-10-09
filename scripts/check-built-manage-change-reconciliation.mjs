import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('dist/manage/index.html','utf8');
const failures=[];
const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};

requireText("const ambiguous=err.code==='REQUEST_TIMEOUT'||err.code==='BOOKING_RELOAD_FAILED'||err.code==='CHANGE_NOT_CONFIRMED';",'ambiguous Manage change outcomes are not classified');
requireText("const refreshed=await api('/manage/'+encodeURIComponent(token),{timeoutMs:2500});",'ambiguous Manage changes are not reconciled against a fresh booking snapshot');
requireText("String(refreshed.selected_date||'')===String(date||'')&&manageTimeLabel(refreshed.slot_time)===manageTimeLabel(time)",'Manage reconciliation does not verify the exact requested date/time');
requireText("booking=refreshed;",'confirmed reconciliation does not adopt the authoritative refreshed booking');
requireText("reload.onclick=()=>location.reload();",'unresolved ambiguous changes do not provide a read-only refresh recovery');
requireText("st.appendChild(document.createTextNode(' '));st.appendChild(reload);\n  return;",'unresolved ambiguous changes can fall through and unlock a second mutation');
requireText("delete st.dataset.busy;changeButtons.forEach(b=>b.disabled=false);",'definitive non-ambiguous failures no longer restore normal controls');


requireText("function validManageChangeResponse(value,date,time,reference,requiresConfirmation)",'Manage change verifier missing');
requireText("if(!validManageChangeResponse(changed,date,time,booking?.reference,true))",'Manage change ignores server confirmed flag');
requireText("if(!validManageChangeResponse(fresh,date,time,booking?.reference,false))",'Manage change fails to re-read confirmed date and time');
requireText("const changed=await api('/manage/'+encodeURIComponent(token)+'/change',{method:'POST'",'Manage change response capture missing');
requireText("const targetMatches=String(refreshed.selected_date||'')===String(date||'')&&manageTimeLabel(refreshed.slot_time)===manageTimeLabel(time)&&String(refreshed.reference||'')===String(booking?.reference||'')",'Ambiguous change reconciling wrong booking');
requireText("if(targetMatches&&err.code!=='CHANGE_NOT_CONFIRMED'){",'Unconfirmed server response cannot be turned into success by retry loop');

const validatorStart=html.indexOf('function validManageChangeResponse(');
const validatorEnd=html.indexOf(' async function changeDeparture(',validatorStart);
if(validatorStart<0||validatorEnd<validatorStart)failures.push('Unable to extract Manage change confirmation verifier');
else{
  const context={manageTimeLabel:time=>String(time||'').slice(0,5),String};
  try{
    vm.runInNewContext(html.slice(validatorStart,validatorEnd)+'; testVerify=validManageChangeResponse;',context,{timeout:1000});
    const verify=context.testVerify;
    const valid={reference:'VOY-1234',status:'confirmed',selected_date:'2026-10-19',slot_time:'10:00',change:{confirmed:true,selected_date:'2026-10-19',slot_time:'10:00'}};
    const verifyApi=value=>verify(value,'2026-10-19','10:00','VOY-1234',true);
    const verifyFresh=value=>verify(value,'2026-10-19','10:00','VOY-1234',false);
    if(!verifyApi(valid)||!verifyFresh({...valid,change:undefined}))failures.push('Confirmed matching API and fresh snapshot were rejected');
    for(const bad of [
      {...valid,change:{...valid.change,confirmed:false}},
      {...valid,change:undefined},
      {...valid,change:{...valid.change,slot_time:'11:00'}},
      {...valid,selected_date:'2026-10-20'},
      {...valid,slot_time:'11:00'},
      {...valid,reference:'VOY-OTHER'},
      {...valid,status:'hold'}
    ])if(verifyApi(bad))failures.push('Invalid change response accepted: '+JSON.stringify(bad));
    for(const bad of [
      {...valid,selected_date:'2026-10-20'},
      {...valid,slot_time:'11:00'},
      {...valid,reference:'VOY-OTHER'},
      {...valid,status:'cancelled'}
    ])if(verifyFresh(bad))failures.push('Invalid re-read accepted: '+JSON.stringify(bad));
  }catch(error){failures.push('Change verification VM test failed: '+error.message)}
}

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
