import fs from 'node:fs';

const file='dist/manage/index.html';
let html=fs.readFileSync(file,'utf8');

const confirmAnchor="if(!confirm(T('Cancel this booking?','לבטל את ההזמנה?','Biztosan lemondod ezt a foglalást?')))return;";
const lockInsert="if(cancel.dataset.busy==='true')return;cancel.dataset.busy='true';cancel.disabled=true;";
const beforeCatch="catch(err){if(st){const msg=err.code==='CANCELLATION_POLICY_NOT_CONFIGURED'?";
const afterCatch="catch(err){delete cancel.dataset.busy;cancel.disabled=false;if(st){const msg=err.code==='CANCELLATION_POLICY_NOT_CONFIGURED'?";

if(!html.includes(confirmAnchor)||!html.includes(beforeCatch)){
  console.error('Manage cancel-lock renderer: expected cancellation flow not found.');
  process.exit(1);
}
html=html.replace(confirmAnchor,confirmAnchor+lockInsert).replace(beforeCatch,afterCatch);

// The cancellation POST has no documented success payload; only a fresh canonical
// Manage Booking read can confirm that this exact booking was cancelled.
const successAnchor="try{await api('/manage/'+encodeURIComponent(token)+'/cancel',{method:'POST'});if(st)st.textContent=T('Booking cancelled.','ההזמנה בוטלה.','A foglalás lemondva.');setTimeout(load,400)}";
const successReplacement=`try{
    await api('/manage/'+encodeURIComponent(token)+'/cancel',{method:'POST'});
    let snapshot;
    try{snapshot=await api('/manage/'+encodeURIComponent(token),{timeoutMs:2500});}
    catch(reloadError){throw Object.assign(new Error('Cancellation could not be verified'),{code:'CANCELLATION_UNVERIFIED'});}
    if(!verifiedManageCancellation(snapshot,booking?.reference)){
      throw Object.assign(new Error('Cancellation not yet confirmed'),{code:'CANCELLATION_UNVERIFIED'});
    }
    booking=snapshot;
    if(st)st.textContent=T('Booking cancelled.','ההזמנה בוטלה.','A foglalás lemondva.');
    setTimeout(load,400);
   }`;
const catchAnchor="catch(err){delete cancel.dataset.busy;cancel.disabled=false;";
const catchReplacement=`catch(err){
    if(err.code==='REQUEST_TIMEOUT'||err.code==='CANCELLATION_UNVERIFIED'){
      if(st)st.textContent=T('Checking whether the cancellation completed…','בודקים אם הביטול הושלם…','Ellenőrizzük, hogy a lemondás megtörtént-e…');
      for(let attempt=0;attempt<2;attempt++){
        if(attempt)await new Promise(resolve=>setTimeout(resolve,800));
        try{
          const refreshed=await api('/manage/'+encodeURIComponent(token),{timeoutMs:2500});
          if(verifiedManageCancellation(refreshed,booking?.reference)){
            booking=refreshed;
            if(st)st.textContent=T('Booking cancelled.','ההזמנה בוטלה.','A foglalás lemondva.');
            setTimeout(load,400);
            return;
          }
        }catch(reconcileError){}
      }
      // Leave the cancellation lock in place. Reloading is read-only;
      // another cancellation POST must not be offered on an uncertain result.
      if(st){
        st.textContent=T('We could not confirm whether this booking was cancelled. Refresh the booking or contact support before trying again.','לא הצלחנו לאמת אם ההזמנה בוטלה. רעננו את ההזמנה או פנו לתמיכה לפני ניסיון נוסף.','Nem tudtuk megerősíteni a lemondást. Frissítsd a foglalást, vagy keresd az ügyfélszolgálatot az újabb próbálkozás előtt.');
        const reload=document.createElement('button');reload.type='button';reload.className='btn secondary';
        reload.textContent=T('Refresh booking','רענון ההזמנה','Foglalás frissítése');
        reload.onclick=()=>location.reload();
        st.appendChild(document.createTextNode(' '));st.appendChild(reload);
      }
      return;
    }
    delete cancel.dataset.busy;cancel.disabled=false;`;
const helper="function verifiedManageCancellation(value,reference){return !!value&&String(reference||'')!==''&&String(value.reference||'')===String(reference)&&String(value.status||'')==='cancelled';}\n ";
if(!html.includes(successAnchor)||!html.includes(catchAnchor)||!html.includes('function bind(){')){
  console.error('Manage cancellation confirmation renderer: source anchors missing.');
  process.exit(1);
}
html=html.replace(successAnchor,successReplacement)
         .replace(catchAnchor,catchReplacement)
         .replace('function bind(){',helper+'function bind(){');

fs.writeFileSync(file,html);
console.log('Rendered verified cancellation state, ambiguous-outcome recovery and single-flight lock for Manage Booking.');
