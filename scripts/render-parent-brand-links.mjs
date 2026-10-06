import fs from 'node:fs';
import path from 'node:path';

const root=path.join(process.cwd(),'dist');
let changed=0;

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    return entry.isDirectory()?walk(full):[full];
  });
}

for(const file of walk(root).filter(file=>file.endsWith('.html'))){
  const original=fs.readFileSync(file,'utf8');
  const next=original.replace(/<a\b[^>]*class="[^"]*\bbrand\b[^"]*"[^>]*>/gi,tag=>{
    if(/\bhref="\/"/i.test(tag))return tag;
    if(/\bhref="[^"]*"/i.test(tag))return tag.replace(/\bhref="[^"]*"/i,'href="/"');
    return tag.replace(/>$/,' href="/">');
  });
  if(next!==original){
    fs.writeFileSync(file,next);
    changed++;
  }
}
console.log('Rendered parent-brand links in',changed,'built HTML files.');
