import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
if(!js.includes("${escapeHTML(req.reference)}</b></p>"))failures.push('capacity request reference must be HTML-escaped');
if(js.includes("${req.reference}</b></p>"))failures.push('raw capacity request reference interpolation remains');

if(failures.length){
  console.error('Capacity request output-encoding guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Capacity request output-encoding guard OK: FBM reference is escaped before dynamic HTML rendering.');
