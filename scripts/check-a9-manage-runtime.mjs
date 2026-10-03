import {readFileSync} from 'node:fs';

const manage=readFileSync('site/manage/index.html','utf8');
const failures=[];

function requireText(text,label){
  if(!manage.includes(text))failures.push(label);
}
function forbidText(text,label){
  if(manage.includes(text))failures.push(label);
}

requireText("api('/destinations/budapest')","Manage must consume the canonical Budapest destination contract");
requireText("destinationRuntime?.rider_policy","Manage rider labels must come from FBM rider policy");
requireText("destinationRuntime?.meeting_point","Manage meeting point must come from FBM destination config");
requireText("managePartyLabels()","Manage detail strip must use runtime policy labels");
requireText("manageMeetingPoint()","Manage detail/actions must use runtime meeting point");

forbidText('Riders 16+','Manage must not hardcode rider age');
forbidText('Children 3–15','Manage must not hardcode child age range');
forbidText('Babies 1–2','Manage must not hardcode baby age range');
forbidText('Vezetők 16+','Manage must not hardcode Hungarian rider age');
forbidText('רוכבים 16+','Manage must not hardcode Hebrew rider age');
forbidText('Városház utca 14, 1052 Budapest','Manage must not embed Budapest meeting-point address');
forbidText('https://maps.app.goo.gl/BNqXWux5XAnHi2W19','Manage must not embed Budapest Maps URL');

if(failures.length){
  console.error('A9.2d Manage runtime business-config guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('A9.2d Manage runtime business-config guard OK.');
