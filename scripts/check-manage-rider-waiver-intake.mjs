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
