import fs from 'node:fs';
import path from 'node:path';

const from='EZRaider Budapest by Voy PRO';
const to='EZRaider Budapest by VOY PRO';
let changed=0;

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(entry.isFile()&&entry.name.endsWith('.html')){
      let html=fs.readFileSync(full,'utf8');
      if(!html.includes(from))continue;
      html=html.split(from).join(to);
      fs.writeFileSync(full,html);
      changed++;
    }
  }
}
walk('dist');
console.log('Normalized VOY PRO brand casing in '+changed+' built HTML files.');
