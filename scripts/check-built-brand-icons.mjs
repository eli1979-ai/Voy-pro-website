import fs from 'node:fs';
import path from 'node:path';

const root='dist';
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const full=path.join(dir,entry.name);
  return entry.isDirectory()?walk(full):[full];
});
const files=walk(root).filter(file=>file.endsWith('.html'));
const failures=[];

for(const file of files){
  const html=fs.readFileSync(file,'utf8');
  const favicon=(html.match(/data-voy-brand-icon="favicon"/g)||[]).length;
  const apple=(html.match(/data-voy-brand-icon="apple-touch"/g)||[]).length;
  if(favicon!==1)failures.push(file+': expected exactly one static favicon marker, found '+favicon);
  if(apple!==1)failures.push(file+': expected exactly one static apple-touch marker, found '+apple);
  if(!html.includes('href="/assets/brand/voy-pro-symbol.png"'))failures.push(file+': official VOY PRO symbol link missing');
}
if(failures.length){
  console.error('Built brand-icon guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Built brand-icon guard OK: '+files.length+' HTML files expose static VOY PRO favicon + apple-touch metadata.');
