import fs from 'node:fs';

const file='dist/manage/index.html';
let html=fs.readFileSync(file,'utf8');

const before=`}catch(err){delete st.dataset.busy;changeButtons.forEach(b=>b.disabled=false);if(changeCancel)changeCancel.disabled=false;if(changeDate)changeDate.disabled=false;if(changeSearch)changeSearch.disabled=false;st.textContent=err.code==='STAFF_CONFIRMATION_REQUIRED'?T('This change needs additional confirmation. Contact support.','לשינוי נדרש אישור נוסף. פנו לתמיכה.'):T('The change could not be completed. Contact support.','לא ניתן להשלים את השינוי. פנו לתמיכה.')}`;
const after=`}catch(err){
 const ambiguous=err.code==='REQUEST_TIMEOUT'||err.code==='BOOKING_RELOAD_FAILED'||err.code==='CHANGE_NOT_CONFIRMED';
 if(ambiguous){
  st.textContent=T('Verifying whether the change completed…','בודקים אם השינוי הושלם…','Ellenőrizzük, hogy a módosítás befejeződött-e…');
  for(let attempt=0;attempt<2;attempt++){
   if(attempt)await new Promise(resolve=>setTimeout(resolve,800));
   try{
    const refreshed=await api('/manage/'+encodeURIComponent(token),{timeoutMs:2500});
    const targetMatches=String(refreshed.selected_date||'')===String(date||'')&&manageTimeLabel(refreshed.slot_time)===manageTimeLabel(time)&&String(refreshed.reference||'')===String(booking?.reference||'')&&String(refreshed.status||'')==='confirmed';
    if(targetMatches&&err.code!=='CHANGE_NOT_CONFIRMED'){
     booking=refreshed;
     st.textContent=T('Booking changed successfully.','ההזמנה שונתה בהצלחה.','A foglalás sikeresen módosítva.');
     setTimeout(load,500);
     return;
    }
   }catch(reconcileErr){}
  }
  st.textContent=T('We could not confirm whether the change completed. Refresh this booking before choosing another departure.','לא הצלחנו לאמת אם השינוי הושלם. רעננו את ההזמנה לפני בחירת יציאה אחרת.','Nem tudtuk megerősíteni, hogy a módosítás befejeződött. Frissítsd a foglalást, mielőtt másik indulást választasz.');
  const reload=document.createElement('button');
  reload.type='button';reload.className='btn secondary';
  reload.textContent=T('Refresh booking','רענון ההזמנה','Foglalás frissítése');
  reload.onclick=()=>location.reload();
  st.appendChild(document.createTextNode(' '));st.appendChild(reload);
  return;
 }
 delete st.dataset.busy;changeButtons.forEach(b=>b.disabled=false);if(changeCancel)changeCancel.disabled=false;if(changeDate)changeDate.disabled=false;if(changeSearch)changeSearch.disabled=false;
 st.textContent=err.code==='STAFF_CONFIRMATION_REQUIRED'?T('This change needs additional confirmation. Contact support.','לשינוי נדרש אישור נוסף. פנו לתמיכה.'):T('The change could not be completed. Contact support.','לא ניתן להשלים את השינוי. פנו לתמיכה.');
}`;

if(!html.includes(before)){
  console.error('Manage change-reconciliation renderer: expected change failure block not found.');
  process.exit(1);
}
html=html.replace(before,after);

const beforeSuccess="try{booking=await api('/manage/'+encodeURIComponent(token)+'/change',{method:'POST',body:JSON.stringify({new_departure_id:id})});st.textContent=T('Booking changed successfully.','ההזמנה שונתה בהצלחה.');setTimeout(load,500)}catch(err){";
const verifiedHelper=` function validManageChangeResponse(value,date,time,reference,requiresConfirmation){
  if(!value||value.status!=='confirmed'||String(value.reference||'')!==String(reference||'')
     ||String(value.selected_date||'')!==String(date||'')
     ||manageTimeLabel(value.slot_time)!==manageTimeLabel(time))return false;
  if(!requiresConfirmation)return true;
  return value.change?.confirmed===true
    &&String(value.change?.selected_date||'')===String(date||'')
    &&manageTimeLabel(value.change?.slot_time)===manageTimeLabel(time);
 }
 `;
const afterSuccess=`try{
  const changed=await api('/manage/'+encodeURIComponent(token)+'/change',{method:'POST',body:JSON.stringify({new_departure_id:id})});
  if(!validManageChangeResponse(changed,date,time,booking?.reference,true)){
   throw Object.assign(new Error('Change not yet confirmed'),{code:'CHANGE_NOT_CONFIRMED'});
  }
  let fresh;
  try{fresh=await api('/manage/'+encodeURIComponent(token),{timeoutMs:2500});}
  catch(reloadError){throw Object.assign(new Error('Booking reload could not be verified'),{code:'BOOKING_RELOAD_FAILED'});}
  if(!validManageChangeResponse(fresh,date,time,booking?.reference,false)){
   throw Object.assign(new Error('Booking snapshot not yet confirmed'),{code:'BOOKING_RELOAD_FAILED'});
  }
  booking=fresh;
  st.textContent=T('Booking changed successfully.','ההזמנה שונתה בהצלחה.','A foglalás sikeresen módosítva.');
  setTimeout(load,500);
 }catch(err){`;
if(!html.includes(beforeSuccess)||!html.includes(' async function changeDeparture(id,time,date)')){
 console.error('Manage change-reconciliation renderer: expected verified-success insertion anchors missing.');
 process.exit(1);
}
html=html.replace(' async function changeDeparture(id,time,date)',verifiedHelper+' async function changeDeparture(id,time,date)');
html=html.replace(beforeSuccess,afterSuccess);

fs.writeFileSync(file,html);
console.log('Rendered authoritative Manage departure confirmation checks and safe ambiguous-outcome reconciliation.');
