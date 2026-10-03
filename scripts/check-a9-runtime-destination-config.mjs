import {readFile} from 'node:fs/promises';

const failures=[];
const site=await readFile('site/assets/site.js','utf8');
const pages={
  en:await readFile('site/budapest/index.html','utf8'),
  he:await readFile('site/he/budapest/index.html','utf8'),
  hu:await readFile('site/hu/budapest/index.html','utf8'),
};
const manifest=JSON.parse(await readFile('contracts/fbm-consumer-contract.json','utf8'));

function requireText(source,text,label){
  if(!source.includes(text))failures.push(label+' missing: '+text);
}
function forbidText(source,text,label){
  if(source.includes(text))failures.push(label+' must not contain runtime business literal: '+text);
}

requireText(site,"api('/destinations/budapest'","site.js");
requireText(site,'destinationRuntime','site.js');
requireText(site,'budapestMeetingPoint()','site.js');
requireText(site,"partyAgeLabel('riders')",'site.js');
requireText(site,"partyAgeLabel('children')",'site.js');
requireText(site,"partyAgeLabel('babies')",'site.js');

forbidText(site,'Városház utca 14, 1052 Budapest','site.js');
forbidText(site,'https://maps.app.goo.gl/BNqXWux5XAnHi2W19','site.js');
forbidText(site,'Riders 16+','site.js');
forbidText(site,'Children 3–15','site.js');
forbidText(site,'Babies 1–2','site.js');
forbidText(site,"budapestAddress:'",'site.js');

for(const [locale,html] of Object.entries(pages)){
  requireText(html,'data-party-label="riders"','Budapest '+locale);
  requireText(html,'data-party-label="children"','Budapest '+locale);
  requireText(html,'data-party-label="babies"','Budapest '+locale);
  forbidText(html,'<label>Independent riders 16+</label>','Budapest '+locale);
  forbidText(html,'<label>רוכבים 16+</label>','Budapest '+locale);
  forbidText(html,'<label>Önálló vezetők 16+</label>','Budapest '+locale);
  forbidText(html,'<label>Children 3–15</label>','Budapest '+locale);
  forbidText(html,'<label>ילדים 3–15</label>','Budapest '+locale);
  forbidText(html,'<label>Gyermekek 3–15</label>','Budapest '+locale);
  forbidText(html,'<label>Babies 1–2</label>','Budapest '+locale);
  forbidText(html,'<label>תינוקות 1–2</label>','Budapest '+locale);
  forbidText(html,'<label>Kisgyermekek 1–2</label>','Budapest '+locale);
}

requireText(pages.en,'data-runtime-rider-age="summary"','Budapest en');
requireText(pages.en,'data-runtime-rider-age="minimum"','Budapest en');
requireText(pages.hu,'data-runtime-rider-age="summary"','Budapest hu');

const destination=manifest.contracts?.find(item=>item.id==='destination.budapest');
if(!destination)failures.push('consumer manifest must include destination.budapest');
else{
  if(destination.path!=='/api/v1/destinations/budapest')failures.push('destination.budapest path drift');
  if(!destination.methods?.includes('GET'))failures.push('destination.budapest must consume GET');
  const sample=destination.response_cases?.[0]?.sample;
  if(!sample?.rider_policy||!sample?.meeting_point)failures.push('destination.budapest sample must include rider_policy and meeting_point');
  const required=new Set(destination.response_cases?.[0]?.required_fields||[]);
  for(const field of [
    'timezone',
    'rider_policy.standard_min_age',
    'rider_policy.child_passenger_min_age',
    'rider_policy.child_passenger_max_age',
    'rider_policy.baby_passenger_min_age',
    'rider_policy.baby_passenger_max_age',
    'meeting_point.address',
    'meeting_point.maps_url',
  ]){
    if(!required.has(field))failures.push('destination.budapest consumer requirement missing: '+field);
  }
}

if(failures.length){
  console.error('A9 runtime destination config guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('A9 runtime destination config guard passed: Budapest booking UI reads age policy and meeting point from FBM.');
