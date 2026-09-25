import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const file='site/manage/index.html';
const html=await readFile(file,'utf8');
const failures=[];

for(const token of [
  'function waiverHandoffUrl()',
  "root.pathname=root.pathname.replace(/\\/api\\/v1\\/?$/,'')+'/go/waiver/'+encodeURIComponent(token)",
  "root.searchParams.set('lang',lang)",
  "String(r.waiver_signing_method||'')==='same_device'",
  "id=\"waiver-start-signing\"",
  "Start signing waivers",
  "התחלת חתימה על כתבי הוויתור",
  "Nyilatkozatok aláírásának indítása",
  "render();",
  "Rider details saved. You can now start signing.",
]){
  if(!html.includes(token))failures.push('missing '+token);
}

if(/waiver_token/.test(html)){
  failures.push('Manage Booking website must not read or embed waiver_token');
}
if(/\/waiver\/\$\{|\/waiver\/'\+/.test(html)){
  failures.push('Website must not construct the final waiver URL directly');
}
if(/returnUrl|redirect_uri|next_url|destination_url/i.test(html)){
  failures.push('Website handoff must not introduce a caller-controlled redirect target');
}

const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(m=>m[1])
  .filter(Boolean);
for(let i=0;i<scripts.length;i++){
  try{new vm.Script(scripts[i],{filename:file+':inline-'+(i+1)});}
  catch(error){failures.push('inline script '+(i+1)+' syntax error: '+error.message);}
}

if(failures.length){
  console.error('Manage waiver handoff guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log(
  'Manage waiver handoff guard passed: same-device riders can start signing only through the FBM manage-token handoff, without exposing waiver_token in website code.'
);
