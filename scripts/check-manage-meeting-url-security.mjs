import fs from 'node:fs';

const html=fs.readFileSync('site/manage/index.html','utf8');
const failures=[];
const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};

requireText("function safeHttpsUrl(value)",'Manage HTTPS URL sanitizer missing');
requireText("return u.protocol==='https:'?u.toString():''",'Manage external URL sanitizer must allow HTTPS only');
requireText("maps_url:safeHttpsUrl(meeting.maps_url)",'FBM meeting-point maps URL is not sanitized');
requireText("meeting?.maps_url?",'meeting-point link must be conditional on a sanitized URL');
requireText('href="${esc(meeting.maps_url)}"','meeting-point href must use the sanitized maps URL');

if(failures.length){
  console.error('Manage meeting-point URL security guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Manage meeting-point URL security guard OK: FBM maps links must use HTTPS before entering dynamic href markup.');
