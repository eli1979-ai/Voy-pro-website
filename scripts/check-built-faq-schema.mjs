import fs from 'node:fs';
import path from 'node:path';

const failures=[];
let faqPages=0;
let faqDetails=0;

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(entry.isFile()&&entry.name.endsWith('.html')){
      const html=fs.readFileSync(full,'utf8');
      const details=(html.match(/<details\b[^>]*data-faq=/gi)||[]).length;
      if(!details)continue;
      faqDetails+=details;
      faqPages++;
      if(!/"@type"\s*:\s*"FAQPage"/i.test(html))failures.push(full+': visible data-faq content has no FAQPage schema');
      if(!/"@type"\s*:\s*"Question"/i.test(html))failures.push(full+': FAQPage schema has no Question entities');
      if(!/"@type"\s*:\s*"Answer"/i.test(html))failures.push(full+': FAQPage schema has no Answer entities');
    }
  }
}
walk('dist');

if(failures.length){
  console.error('Built FAQ schema guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Built FAQ schema guard OK: '+faqPages+' pages with '+faqDetails+' visible FAQ entries expose FAQPage/Question/Answer structured data.');
