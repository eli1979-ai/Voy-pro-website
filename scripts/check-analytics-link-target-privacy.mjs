import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};
const forbidText=(text,label)=>{if(js.includes(text))failures.push(label);};

requireText('function analyticsLinkTarget(value)','analytics link sanitizer missing');
requireText("return u.origin===location.origin?u.pathname:u.origin+u.pathname",'tracked link target must exclude query and hash');
requireText("target:analyticsLinkTarget(el.getAttribute('href'))",'generic tracked clicks must use sanitized link target');
forbidText("href:el.getAttribute('href')",'raw href must not enter generic marketing event metadata');

if(failures.length){
  console.error('Analytics link-target privacy guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Analytics link-target privacy guard OK: tracked links exclude query strings and fragments, including WhatsApp prefilled message text.');
