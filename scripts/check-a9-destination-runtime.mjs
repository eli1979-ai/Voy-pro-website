import {readFileSync} from 'node:fs';

const site=readFileSync('site/assets/site.js','utf8');
const failures=[];

function requireText(text,label){
  if(!site.includes(text))failures.push(label);
}
function forbidText(text,label){
  if(site.includes(text))failures.push(label);
}

requireText("api('/destinations/budapest'","site.js must consume the canonical Budapest destination endpoint");
requireText("const budapestPolicy=()=>destinationRuntime?.rider_policy||null;","site.js must derive rider policy from destination runtime state");
requireText("const budapestMeetingPoint=()=>destinationRuntime?.meeting_point||null;","site.js must derive meeting point from destination runtime state");
requireText("await hydrateDestinationRuntime();","destination runtime must load before operational Budapest UI is initialized");
requireText("applyDestinationRuntimeUI();","destination runtime values must hydrate Budapest form/hero UI");
requireText("const meeting=budapestMeetingPoint();","calendar/confirmation meeting-point flows must use canonical runtime meeting data");

forbidText("Városház utca 14, 1052 Budapest, Hungary","site.js must not embed the Budapest meeting-point address");
forbidText("https://maps.app.goo.gl/BNqXWux5XAnHi2W19","site.js must not embed the Budapest meeting-point Maps URL");
forbidText("const meetingPoint='Városház","calendar must not reconstruct a Budapest meeting-point fallback");
forbidText("<b>Városház utca 14, 1052 Budapest</b>","confirmation must not contain a Budapest meeting-point fallback");

if(failures.length){
  console.error('A9.2a Budapest destination runtime guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('A9.2a Budapest destination runtime guard OK.');
