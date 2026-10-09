import fs from 'node:fs';

const file='dist/manage/index.html';
let html=fs.readFileSync(file,'utf8');

if(!html.includes('function bind(){')){
  console.error('Manage availability lifecycle renderer: bind() anchor not found.');
  process.exit(1);
}
html=html.replace('function bind(){',`let manageAvailabilityGeneration=0;
 function validManageFutureDate(value,today){
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)||value<today)return false;
  const date=new Date(value+'T00:00:00.000Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
 }
 function bind(){`);

const startMarker="const search=document.getElementById('manage-search');";
const endMarker="\n }\n async function changeDeparture";
const start=html.indexOf(startMarker);
const end=start>=0?html.indexOf(endMarker,start):-1;
if(start<0||end<0){
  console.error('Manage availability lifecycle renderer: expected search block not found.');
  process.exit(1);
}
const replacement=`const search=document.getElementById('manage-search');
  const manageDate=document.getElementById('manage-date');
  const syncManageDateMinimum=()=>{
   const today=manageBudapestDate(0);
   if(manageDate)manageDate.min=today;
   return today;
  };
  if(manageDate){
   manageDate.addEventListener('focus',syncManageDateMinimum);
   manageDate.addEventListener('pointerdown',syncManageDateMinimum);
  }
  if(manageDate)manageDate.addEventListener('change',()=>{
   manageAvailabilityGeneration++;
   const slots=document.getElementById('manage-slots');
   const st=document.getElementById('manage-change-status');
   if(slots)slots.innerHTML='';
   if(search){delete search.dataset.busy;search.disabled=false;}
   if(st){st.hidden=false;st.textContent=T('Date changed. Find times again.','התאריך השתנה. חפשו שוב שעות זמינות.','A dátum megváltozott. Keress újra elérhető időpontokat.');}
  });
  if(search)search.onclick=async()=>{
   if(search.dataset.busy==='true')return;
   const date=manageDate?.value||'',slots=document.getElementById('manage-slots'),st=document.getElementById('manage-change-status');
   const today=syncManageDateMinimum();
   if(!validManageFutureDate(date,today)){
    manageAvailabilityGeneration++;
    slots.innerHTML='';
    st.hidden=false;
    st.textContent=T('Choose today or a future date.','בחרו תאריך מהיום והלאה.','Válassz mai vagy későbbi dátumot.');
    if(manageDate&&date<today)manageDate.value='';
    manageDate?.focus();
    return;
   }
   const generation=++manageAvailabilityGeneration;
   search.dataset.busy='true';search.disabled=true;
   slots.innerHTML='';st.hidden=false;st.textContent=T('Checking availability…','בודקים זמינות…');
   try{
    const out=await api('/manage/'+encodeURIComponent(token)+'/availability?date='+encodeURIComponent(date));
    if(generation!==manageAvailabilityGeneration)return;
    if(!validManageFutureDate(date,syncManageDateMinimum())){
     st.textContent=T('Choose today or a future date.','בחרו תאריך מהיום והלאה.','Válassz mai vagy későbbi dátumot.');
     return;
    }
    const avail=(out.slots||[]).filter(s=>s.sellable&&!s.current&&(!s.starts_at||new Date(s.starts_at).getTime()>Date.now()));
    if(!avail.length){st.textContent=T('No changeable departures found for this date.','לא נמצאו יציאות זמינות לשינוי בתאריך זה.');return}
    st.textContent=T('Choose a new time:','בחרו שעה חדשה:');
    avail.forEach(s=>{const b=document.createElement('button');b.type='button';b.className='slot';b.textContent=s.time+(s.status==='low'?T(' · limited',' · זמינות מוגבלת'):'');b.onclick=()=>changeDeparture(s.id,s.time,date);slots.appendChild(b)});
   }catch(err){
    if(generation!==manageAvailabilityGeneration)return;
    st.textContent=T('Availability could not be loaded.','לא ניתן לטעון זמינות.');
   }finally{
    if(generation===manageAvailabilityGeneration){delete search.dataset.busy;search.disabled=false;}
   }
  };`;
html=html.slice(0,start)+replacement+html.slice(end);
fs.writeFileSync(file,html);
console.log('Rendered generation-safe, date-invalidating, single-flight Manage availability search.');
