import fs from 'node:fs';
import path from 'node:path';

const failures=[];
const bad='EZRaider Budapest by Voy PRO';
const good='EZRaider Budapest by VOY PRO';
let goodCount=0;

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(entry.isFile()&&entry.name.endsWith('.html')){
      const html=fs.readFileSync(full,'utf8');
      if(html.includes(bad))failures.push(full+': legacy brand casing remains');
      if(html.includes(good))goodCount++;
    }
  }
}
walk('dist');
if(!goodCount)failures.push('no normalized Budapest LocalBusiness brand name found in built HTML');
if(failures.length){
  console.error('Built VOY PRO brand-name consistency guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Built VOY PRO brand-name consistency guard OK: '+goodCount+' HTML files use the canonical Budapest brand casing.');
