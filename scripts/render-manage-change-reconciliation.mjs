import fs from 'node:fs';

const file='dist/manage/index.html';
let html=fs.readFileSync(file,'utf8');

const before=`}catch(err){delete st.dataset.busy;changeButtons.forEach(b=>b.disabled=false);if(changeCancel)changeCancel.disabled=false;if(changeDate)changeDate.disabled=false;if(changeSearch)changeSearch.disabled=false;st.textContent=err.code==='STAFF_CONFIRMATION_REQUIRED'?T('This change needs additional confirmation. Contact support.','לשינוי נדרש אישור נוסף. פנו לתמיכה.'):T('The change could not be completed. Contact support.','לא ניתן להשלים את השינוי. פנו לתמיכה.')}`;
const after=`}catch(err){
 const ambiguous=err.code==='REQUEST_TIMEOUT'||err.code==='BOOKING_RELOAD_FAILED';
 if(ambiguous){
  st.textContent=T('Verifying whether the change completed…','בודקים אם השינוי הושלם…','Ellenőrizzük, hogy a módosítás befejeződött-e…');
  for(let attempt=0;attempt<2;attempt++){
   if(attempt)await new Promise(resolve=>setTimeout(resolve,800));
   try{
    const refreshed=await api('/manage/'+encodeURIComponent(token),{timeoutMs:2500});
    const targetMatches=String(refreshed.selected_date||'')===String(date||'')&&manageTimeLabel(refreshed.slot_time)===manageTimeLabel(time);
    if(targetMatches){
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
fs.writeFileSync(file,html);
console.log('Rendered safe reconciliation for ambiguous Manage departure-change outcomes.');
