// Canonicalize VOY PRO contact throughout built HTML (including legal contact sections).
// Only update the obsolete business Gmail address; retain all other legal wording.
import fs from 'node:fs';
import path from 'node:path';

const oldAddress='voy.pro.eu@gmail.com';
const supportAddress='support@voy-pro.com';
const verify=process.argv.includes('--verify');
const failures=[];
let pages=0,withFooter=0,changed=0,remaining=0;

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()){walk(file);continue;}
    if(!entry.isFile()||!entry.name.endsWith('.html'))continue;
    pages++;
    const source=fs.readFileSync(file,'utf8');
    if(!source.includes('<footer'))continue;
    withFooter++;
    const rewrites=source.split(oldAddress).length-1;
    if(verify){
      const footers=[...source.matchAll(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi)].map(x=>x[0]);
      if(/@gmail\.com/i.test(source)) failures.push(file+': @gmail.com is not allowed in built HTML');
      if(footers.some(x=>x.includes('mailto:')&&!x.includes('mailto:'+supportAddress)))
        failures.push(file+': footer email link does not use canonical VOY PRO support');
      remaining+=rewrites;
    }else if(rewrites){
      fs.writeFileSync(file,source.split(oldAddress).join(supportAddress),'utf8');
      changed++;
    }
  }
}

walk('dist');
if(withFooter<40)failures.push('expected footers across at least 40 built HTML pages, saw '+withFooter);
if(verify&&remaining)failures.push(remaining+' old email mentions persist in built footers');
if(failures.length){
  console.error('Footer support-email checks failed:');
  failures.forEach(f=>console.error('- '+f));
  process.exit(1);
}
console.log('Footer support email '+(verify?'verified':'normalized')+
  ': '+pages+' pages scanned, '+withFooter+' footers, '+changed+' rewritten pages.');
