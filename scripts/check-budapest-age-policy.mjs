import fs from 'node:fs';
import path from 'node:path';

const roots=['site/budapest','site/he/budapest','site/hu/budapest'];
const failures=[];
let checked=0;

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{
    const p=path.join(dir,ent.name);
    return ent.isDirectory()?walk(p):(ent.isFile()&&ent.name.endsWith('.html')?[p]:[]);
  });
}

for(const file of roots.flatMap(walk)){
  const html=fs.readFileSync(file,'utf8');
  if(!html.includes('data-faq="age"')) continue;
  checked++;
  const block=html.match(/<details data-faq="age">[\s\S]*?<\/details>/)?.[0]||'';
  const expected=file.startsWith('site/he/')
    ? ['רכיבה עצמאית מותרת מגיל 16.','בני 15 יכולים לקבל אישור חריג','מגיל שנה ועד גיל 15 כולל']
    : file.startsWith('site/hu/')
      ? ['Önállóan 16 éves kortól lehet vezetni.','A 15 éves résztvevő kivételesen','Az 1–15 éves gyermekek utasként']
      : ['Independent riding is from age 16.','Riders aged 15 may be approved as an exception','Children from age 1 through 15 can join as passengers'];
  for(const marker of expected){
    if(!block.includes(marker)) failures.push(file+': age FAQ missing policy marker: '+marker);
  }
  if(/confirmed live during booking|מאושרת בזמן אמת במהלך ההזמנה|foglalás során élőben kerül megerősítésre/.test(block)){
    failures.push(file+': stale ambiguous age-policy copy remains');
  }
}

if(!checked) failures.push('No Budapest age FAQ blocks found');
if(failures.length){
  console.error('Budapest age policy guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Budapest age policy guard OK: '+checked+' FAQ blocks publish 16+ independent riding, possible age-15 exception, and passenger ages 1–15.');
