import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('dist/manage/index.html','utf8');
const failures=[];
const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};

requireText("if(cf.dataset.busy==='true')return;cf.dataset.busy='true'",'contact update lacks single-flight lock');
requireText("delete cf.dataset.busy;if(submit)submit.disabled=false",'contact update does not release its lock');
requireText("if(riderForm.dataset.busy==='true')return;riderForm.dataset.busy='true'",'rider/waiver save lacks single-flight lock');
requireText("delete riderForm.dataset.busy;if(submit)submit.disabled=false",'rider/waiver save does not release its lock');
requireText("if(riderForm.dataset.riderSaveUnverified!=='true'){delete riderForm.dataset.busy;if(submit)submit.disabled=false}",'unverified rider save releases single-flight lock');
requireText("'/riders',{method:'PATCH'",'rider/waiver PATCH missing');

requireText("if(!verifiedManageContact(patched,reference,expected))",'contact PATCH response is not checked');
requireText("if(!verifiedManageContact(fresh,reference,expected))",'contact success does not require a fresh canonical Manage snapshot');
requireText("if(err.code!=='CONTACT_RESPONSE_UNVERIFIED'&&verifiedManageContact(refreshed,reference,expected))",'mismatched PATCH response can be incorrectly reconciled into success');
requireText("cf.dataset.contactUnverified='true';",'unverified contact update does not lock further writes');
requireText("if(cf.dataset.contactUnverified!=='true'){delete cf.dataset.busy;",'ambiguous contact update unlocks the submit button');
requireText("contactFields.forEach(field=>field.readOnly=true)",'contact fields are not frozen while saving');
requireText("contactFields.forEach(field=>field.readOnly=false)",'contact fields are not restored after a verified/definitive result');
requireText("reload.onclick=()=>location.reload();",'unverified update lacks read-only reload recovery');
requireText("support.href=supportWhatsApp();",'contact uncertainty lacks WhatsApp fallback');
if(html.includes("booking=await api('/manage/'+encodeURIComponent(token),{method:'PATCH'"))failures.push('contact PATCH still reports success without verification');

const verifierStart=html.indexOf('function verifiedManageContact(');
const verifierEnd=html.indexOf("const cf=document.getElementById('manage-contact')",verifierStart);
if(verifierStart<0||verifierEnd<=verifierStart)failures.push('Cannot extract canonical contact verifier');
else{
  const context={};
  try{
    vm.runInNewContext(html.slice(verifierStart,verifierEnd)+'; verifyContact=verifiedManageContact;',context,{timeout:1000});
    const verify=context.verifyContact;
    const wanted={email:'GUEST@example.com ',phone:'+36 30 123 4567',preferred_language:'en'};
    const correct={reference:'VOY-123',customer:{email:'guest@example.com',phone:'+36301234567',preferred_language:'en'}};
    if(!verify(correct,'VOY-123',wanted))failures.push('Equivalent validated contact data was rejected');
    for(const invalid of [
      null,{}, {reference:'VOY-OTHER',customer:correct.customer},
      {reference:'VOY-123',customer:null},
      {reference:'VOY-123',customer:{...correct.customer,email:'other@example.com'}},
      {reference:'VOY-123',customer:{...correct.customer,phone:'+36305557777'}},
      {reference:'VOY-123',customer:{...correct.customer,preferred_language:'hu'}},
      {reference:'VOY-123',customer:{email:'guest@example.com',preferred_language:'en'}}
    ])if(verify(invalid,'VOY-123',wanted))failures.push('Unverified contact snapshot accepted: '+JSON.stringify(invalid));
    if(verify(correct,'',wanted))failures.push('Missing booking reference accepted');
  }catch(error){failures.push('Contact verifier VM test failed: '+error.message)}
}

let inlineScripts=0;
for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
  const code=match[1].trim();
  if(!code)continue;
  inlineScripts++;
  try{new vm.Script(code,{filename:'manage-form-lock-inline-'+inlineScripts+'.js'});}
  catch(error){failures.push('inline Manage script '+inlineScripts+' failed to compile: '+error.message);}
}

if(failures.length){
  console.error('Manage form mutation lock guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Manage form mutation lock guard OK: contact and rider/waiver saves are single-flight and final inline scripts compile.');
