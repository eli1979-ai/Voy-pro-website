import fs from 'node:fs';
import vm from 'node:vm';

const file='dist/manage/index.html';
const html=fs.readFileSync(file,'utf8');
const failures=[];
const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};

requireText("if(cancel.dataset.busy==='true'||document.getElementById('manage-change-status')?.dataset.busy==='true')return;",'cancellation mutation lacks single-flight/cross-mutation lock');
requireText("delete cancel.dataset.busy;cancel.disabled=false;if(cancelDate)cancelDate.disabled=false;if(cancelSearch)cancelSearch.disabled=false;",'failed cancellation does not release the mutation/cross-control lock');
requireText("'/cancel',{method:'POST'",'cancellation POST missing');

requireText("function verifiedManageCancellation(value,reference)",'canonical cancellation status verification helper missing');
requireText("verifiedManageCancellation(snapshot,booking?.reference)",'successful cancellation does not verify a fresh booking snapshot');
requireText("if(err.code==='REQUEST_TIMEOUT'||err.code==='CANCELLATION_UNVERIFIED')",'unknown cancellation outcome is not reconciled');
requireText("verifiedManageCancellation(refreshed,booking?.reference)",'ambiguous cancellation does not reconcile with a fresh read');
requireText("reload.onclick=()=>location.reload();",'unknown cancellation does not provide read-only refresh');
requireText("st.appendChild(document.createTextNode(' '));st.appendChild(reload);",'unknown cancellation does not offer a safe recovery action');
requireText("return;\n    }\n    delete cancel.dataset.busy;",'unknown cancellation can unlock an unsafe duplicate POST');
if(html.includes("try{await api('/manage/'+encodeURIComponent(token)+'/cancel',{method:'POST'});if(st)st.textContent=T('Booking cancelled.'"))failures.push('HTTP 200 cancellation still asserts success without verification');

const start=html.indexOf('function verifiedManageCancellation(');
const end=html.indexOf('function bind(){',start);
if(start<0||end<=start)failures.push('Unable to extract cancellation verification function');
else{
  const context={};
  try{
    vm.runInNewContext(html.slice(start,end)+'; verify=verifiedManageCancellation;',context,{timeout:1000});
    const verify=context.verify;
    if(!verify({reference:'VOY-123',status:'cancelled'},'VOY-123'))failures.push('Verified cancellation rejected');
    for(const [snapshot,expected] of [
      [null,'VOY-123'], [{status:'cancelled'},'VOY-123'],
      [{reference:'VOY-999',status:'cancelled'},'VOY-123'],
      [{reference:'VOY-123',status:'confirmed'},'VOY-123'],
      [{reference:'VOY-123',status:'hold'},'VOY-123'],
      [{reference:'VOY-123',status:'cancelled'},'']
    ])if(verify(snapshot,expected))failures.push('Unverified cancellation accepted: '+JSON.stringify(snapshot));
  }catch(error){failures.push('Cancellation verification VM test failed: '+error.message);}
}

let inlineScripts=0;
for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
  const code=match[1].trim();
  if(!code)continue;
  inlineScripts++;
  try{new vm.Script(code,{filename:'manage-cancel-inline-'+inlineScripts+'.js'});}
  catch(error){failures.push('inline Manage script '+inlineScripts+' failed to compile: '+error.message);}
}

if(failures.length){
  console.error('Manage cancellation lock guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Manage cancellation lock guard OK: destructive cancellation is single-flight and retryable after failure.');
