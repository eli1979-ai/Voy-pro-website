import fs from 'node:fs';
import path from 'node:path';

const dist=path.join(process.cwd(),'dist');

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}

for(const file of walk(dist).filter(f=>f.endsWith('.html'))){
  const rel=path.relative(dist,file).replaceAll('\\','/');
  if(!/^(?:he\/|hu\/)?budapest\//.test(rel)) continue;

  let labels={buda:'Buda Highlights by EZRaider',margaret:'Margaret Island by EZRaider'};
  if(rel.startsWith('he/')) labels={buda:'סיור בודה על EZRaider',margaret:'סיור אי מרגיט על EZRaider'};
  if(rel.startsWith('hu/')) labels={buda:'Budai városnézés EZRaiderrel',margaret:'Margitsziget EZRaiderrel'};

  let html=fs.readFileSync(file,'utf8');
  html=html.replace(
    /<select name="experience"><option value="">[^<]*<\/option><\/select>/g,
    `<select name="experience"><option value="exp_bud_buda">${labels.buda}</option><option value="exp_bud_margaret">${labels.margaret}</option></select>`
  );
  fs.writeFileSync(file,html);
}

const releasePath=path.join(dist,'release.json');
const release=JSON.parse(fs.readFileSync(releasePath,'utf8'));
release.version='1.32.6';
fs.writeFileSync(releasePath,JSON.stringify(release,null,2)+'\n');

console.log('Applied VOY PRO v1.32.6 multilingual static booking selector fix.');
