import fs from 'node:fs';
import path from 'node:path';

const root=path.join(process.cwd(),'dist');
const failures=[];
let anchors=0;

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    return entry.isDirectory()?walk(full):[full];
  });
}

for(const file of walk(root).filter(file=>file.endsWith('.html'))){
  const html=fs.readFileSync(file,'utf8');
  for(const match of html.matchAll(/<a\b[^>]*class="[^"]*\bbrand\b[^"]*"[^>]*>/gi)){
    anchors++;
    const tag=match[0];
    if(!/\bhref="\/"/i.test(tag)){
      failures.push(path.relative(root,file)+': brand anchor does not point to /: '+tag.slice(0,180));
    }
  }
}

if(anchors<20)failures.push('unexpectedly low brand-anchor coverage: '+anchors);
if(failures.length){
  console.error('Built parent-brand link guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Built parent-brand link guard OK:',anchors,'brand anchors point to the VOY PRO parent homepage.');
