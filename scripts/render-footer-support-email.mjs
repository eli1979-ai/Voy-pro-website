// Canonicalize only visible site-footer support contact in built HTML.
// Do not rewrite the underlying legal notices, their body text or source files.
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
    let rewrites=0;
    const target=source.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi,footer=>{
      const n=footer.split(oldAddress).length-1;
      if(n){rewrites+=n;return footer.split(oldAddress).join(supportAddress);}
      return footer;
    });
    if(verify){
      const footers=[...source.matchAll(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi)].map(x=>x[0]);
      if(footers.some(x=>x.includes(oldAddress)))
        failures.push(file+': obsolete footer email');
      if(footers.some(x=>x.includes('mailto:')&&!x.includes('mailto:'+supportAddress)))
        failures.push(file+': footer email link does not use canonical VOY PRO support');
      remaining+=rewrites;
    }else if(rewrites){
      fs.writeFileSync(file,target,'utf8');
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
