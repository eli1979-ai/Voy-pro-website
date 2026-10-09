import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('dist/manage/index.html','utf8');
const failures=[];
const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};

requireText('let manageAvailabilityGeneration=0;','Manage change availability generation state is missing');
requireText("if(manageDate)manageDate.addEventListener('change',()=>{",'date changes do not invalidate old results');
requireText("if(slots)slots.innerHTML='';",'date changes do not clear old departure buttons');
requireText("if(search.dataset.busy==='true')return;",'Manage availability search is not single-flight');
requireText("search.dataset.busy='true';search.disabled=true;",'Manage availability search button is not locked while pending');
if((html.match(/if\(generation!==manageAvailabilityGeneration\)return;/g)||[]).length<2)failures.push('Manage availability success/error paths do not both reject stale responses');
requireText("if(generation===manageAvailabilityGeneration){delete search.dataset.busy;search.disabled=false;}",'current Manage availability search does not release its lock');
requireText("b.onclick=()=>changeDeparture(s.id,s.time,date);",'departure buttons do not preserve searched date/time context');

requireText("function validManageFutureDate(value,today){",'Manage date validity helper missing');
requireText("manageDate.addEventListener('focus',syncManageDateMinimum)",'Manage date does not refresh minimum on focus');
requireText("manageDate.addEventListener('pointerdown',syncManageDateMinimum)",'Manage date does not refresh minimum when opening picker');
requireText("manageDate.min=today;",'Manage input minimum is not refreshed from Budapest clock');
requireText("if(!validManageFutureDate(date,today)){",'Manage search does not reject dates expired while tab is open');
requireText("if(!validManageFutureDate(date,syncManageDateMinimum())){",'Stale availability response can repopulate expired-date buttons');
requireText("slots.innerHTML='';\n    st.hidden=false;\n    st.textContent=T('Choose today or a future date.'",'Expired-date warning does not clear stale slots');

const guardStart=html.indexOf('function validManageFutureDate(');
const guardEnd=guardStart<0?-1:html.indexOf(' function bind(){',guardStart);
if(guardEnd<=guardStart)failures.push('Could not isolate Manage date guard for runtime tests');
else{
 try{
  const context={Date,Number};
  vm.runInNewContext(html.slice(guardStart,guardEnd)+';testDate=validManageFutureDate;',context,{timeout:1000});
  const test=context.testDate;
  const cases=[
   ['2026-10-09','2026-10-10',false],
   ['2026-10-10','2026-10-10',true],
   ['2026-10-11','2026-10-10',true],
   ['2028-02-29','2028-02-28',true],
   ['2026-02-29','2026-02-28',false],
   ['2026-13-01','2026-01-01',false],
   ['2026-10-1','2026-10-01',false],
   ['', '2026-10-10',false]
  ];
  for(const [value,today,valid] of cases)if(test(value,today)!==valid)
   failures.push('Date guard gave wrong result for '+JSON.stringify({value,today,valid}));
 }catch(error){failures.push('Manage date guard runtime tests failed: '+error.message);}
}

let inlineScripts=0;
for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
  const code=match[1].trim();
  if(!code)continue;
  inlineScripts++;
  try{new vm.Script(code,{filename:'manage-availability-inline-'+inlineScripts+'.js'});}
  catch(error){failures.push('inline Manage script '+inlineScripts+' failed to compile: '+error.message);}
}
if(failures.length){
  console.error('Manage availability lifecycle guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Manage availability lifecycle guard OK: stale results are rejected, date changes clear old slots and search is single-flight.');
