import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText("function safeHttpsUrl(value)",'shared Budapest HTTPS URL sanitizer missing');
requireText("return u.protocol==='https:'?u.toString():''",'Budapest maps URL sanitizer must allow HTTPS only');
requireText("maps_url:safeHttpsUrl(meeting.maps_url)",'FBM Budapest maps URL is not sanitized');
requireText("meeting.maps_url?",'booking confirmation map link must depend on sanitized URL');
requireText("escapeHTML(meeting.maps_url)",'booking confirmation map link must HTML-escape the sanitized URL');
requireText("if(budapest&&(!meeting?.address||!meeting?.maps_url))return;",'destination meeting-point section must fail closed when maps URL is invalid');

if(failures.length){
  console.error('Budapest meeting-point URL security guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Budapest meeting-point URL security guard OK: FBM map links require HTTPS before confirmation or destination UI rendering.');
