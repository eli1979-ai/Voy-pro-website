import fs from 'node:fs';
import vm from 'node:vm';

const file='site/manage/index.html';
const html=fs.readFileSync(file,'utf8');
const failures=[];
const requireText=(needle,label=needle)=>{if(!html.includes(needle))failures.push('missing '+label)};

for(const token of [
  "/manage/'+encodeURIComponent(token)+'/riders",
  'Riders & waivers',
  'רוכבים וכתבי ויתור',
  'Résztvevők és nyilatkozatok',
  'same_device',
  'individual_link',
  'business_device',
  'paper',
  'booking-rider-choice',
  'data-rider-name',
  'data-rider-dob',
  'data-rider-method',
  'data-rider-contact',
  'is_booking_customer',
  'waiver_signing_method',
  'waiver_contact_preference',
  'RIDER_TOO_YOUNG',
  'SIGNED_RIDER_LOCKED',
  'Apply signing method to all unsigned riders',
]){
  requireText(token);
}

if(!/api\('\/manage\/'\+encodeURIComponent\(token\)\+'\/riders',\{method:'PATCH'/.test(html)){
  failures.push('rider intake must persist through PATCH /manage/[token]/riders');
}

if(/fetch\([^\n]+supabase|\.from\(['"]booking_riders['"]\)/.test(html)){
  failures.push('Manage Booking must not access booking_riders directly');
}

// A successful HTTP response alone must never create an imaginary rider record.
for(const required of [
 "confirmedRiderSnapshot(out,expectedReference,riders,signedIds)",
 "confirmedRiderSnapshot(fresh,expectedReference,riders,signedIds)",
 "riderIntake=fresh;",
 "riderForm.dataset.riderSaveUnverified='true'",
 "reload.onclick=()=>location.reload()",
 "status.appendChild(document.createTextNode(' '));status.appendChild(reload)"
])if(!html.includes(required))failures.push('missing authoritative rider verification: '+required);
if(html.includes('riders:Array.isArray(out.riders)?out.riders:riders'))failures.push('Rider saving still invents local fallback records');
const helperStart=html.indexOf('function confirmedRiderSnapshot('),helperEnd=html.indexOf(' function refreshRiderContact(',helperStart);
if(helperStart<0||helperEnd<=helperStart)failures.push('Cannot isolate rider verification helper');
else{
 try{
  const context={};
  vm.runInNewContext(html.slice(helperStart,helperEnd)+'; verify=confirmedRiderSnapshot;',context,{timeout:1000});
  const expected=[{id:'rider-1',full_name:'Example Rider',date_of_birth:'1991-08-12',email:'Rider@EXAMPLE.com',phone:'+36 30 123 4567',is_booking_customer:true,waiver_signing_method:'individual_link',waiver_contact_preference:'email'}];
  const confirmed={booking_reference:'VOY-TEST',riders:[{...expected[0],email:'rider@example.com',phone:'+36301234567',status:'pending'}]};
  const accept=value=>context.verify(value,'VOY-TEST',expected,new Set());
  if(!accept(confirmed))failures.push('Valid rider save rejected');
  for(const invalid of [
   null,{}, {...confirmed,booking_reference:'OTHER'},
   {...confirmed,riders:[]}, {...confirmed,riders:[{...confirmed.riders[0],full_name:'Other'}]},
   {...confirmed,riders:[{...confirmed.riders[0],date_of_birth:'2001-01-01'}]},
   {...confirmed,riders:[{...confirmed.riders[0],is_booking_customer:false}]},
   {...confirmed,riders:[{...confirmed.riders[0],waiver_signing_method:'paper'}]},
   {...confirmed,riders:[{...confirmed.riders[0],waiver_contact_preference:'whatsapp'}]},
   {...confirmed,riders:[{...confirmed.riders[0],email:'other@example.com'}]},
   {...confirmed,riders:[{...confirmed.riders[0],phone:'+36306666666'}]}
  ])if(accept(invalid))failures.push('Invalid rider state accepted: '+JSON.stringify(invalid));
  if(context.verify(confirmed,'VOY-TEST',[],new Set()))failures.push('Empty expected rider list accepted');
  const signedExpectation=[{...expected[0],id:'signed-rider',full_name:'',date_of_birth:''}];
  const signedSnapshot={booking_reference:'VOY-TEST',riders:[{id:'signed-rider',status:'signed',full_name:'Persisted'}]};
  if(!context.verify(signedSnapshot,'VOY-TEST',signedExpectation,new Set(['signed-rider'])))failures.push('Previously signed rider cannot remain immutable');
  if(context.verify({...signedSnapshot,riders:[{id:'signed-rider',status:'pending'}]},'VOY-TEST',signedExpectation,new Set(['signed-rider'])))failures.push('Signed rider unexpectedly reverted to pending');
 }catch(error){failures.push('Rider confirmation VM test error: '+error.message)}
}

const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(m=>m[1])
  .filter(Boolean);

for(let i=0;i<scripts.length;i++){
  try{new vm.Script(scripts[i],{filename:file+':inline-script-'+(i+1)});}
  catch(error){failures.push('inline script '+(i+1)+' syntax error: '+error.message);}
}

if(failures.length){
  console.error('Manage rider waiver intake guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log('Manage rider waiver intake guard passed: rider details and signing plan use the canonical FBM manage-riders API, with EN/HE/HU UI and valid inline JavaScript.');
