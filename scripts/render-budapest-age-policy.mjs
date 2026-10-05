import fs from 'node:fs';
import path from 'node:path';

const contract=JSON.parse(fs.readFileSync('contracts/fbm-consumer-contract.json','utf8'));
const endpoint=contract.contracts?.find(item=>item.id==='destination.budapest');
const sample=endpoint?.response_cases?.find(item=>item.name==='Budapest public destination config')?.sample;
const policy=sample?.rider_policy;
if(!policy)throw new Error('Budapest rider policy sample missing from FBM consumer contract');

const standard=Number(policy.standard_min_age);
const assessment=Number(policy.assessment_min_age);
const passengerMin=Number(policy.baby_passenger_min_age);
const passengerMax=Number(policy.child_passenger_max_age);
if(![standard,assessment,passengerMin,passengerMax].every(Number.isFinite)){
  throw new Error('Budapest rider policy contains invalid age values');
}

const text={
  en:`Independent riding is from age ${standard}. Riders aged ${assessment} may be approved as an exception by our team. Children from age ${passengerMin} through ${passengerMax} can join as passengers using the appropriate child/passenger seat setup.`,
  he:`רכיבה עצמאית מותרת מגיל ${standard}. בני ${assessment} יכולים לקבל אישור חריג מהצוות. ילדים מגיל ${passengerMin} ועד גיל ${passengerMax} כולל יכולים להצטרף כנוסעים באמצעות כיסא או מערך נוסע מתאים.`,
  hu:`Önállóan ${standard} éves kortól lehet vezetni. A ${assessment} éves résztvevő kivételesen, a csapat jóváhagyásával vezethet. Az ${passengerMin}–${passengerMax} éves gyermekek utasként csatlakozhatnak, a megfelelő gyermek- vagy utasülés használatával.`,
};

const roots=[
  ['dist/budapest','en'],
  ['dist/he/budapest','he'],
  ['dist/hu/budapest','hu'],
];

function walk(dir){
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{
    const full=path.join(dir,ent.name);
    return ent.isDirectory()?walk(full):(ent.isFile()&&ent.name.endsWith('.html')?[full]:[]);
  });
}

let rendered=0;
for(const [root,locale] of roots){
  for(const file of walk(root)){
    let html=fs.readFileSync(file,'utf8');
    if(!html.includes('data-runtime-age-policy'))continue;
    const next=html.replace(
      /<p data-runtime-age-policy>[\s\S]*?<\/p>/g,
      `<p data-runtime-age-policy>${text[locale]}</p>`
    );
    if(next===html)throw new Error('Age policy marker could not be rendered: '+file);
    fs.writeFileSync(file,next);
    const renderedBlock=next.match(/<details data-faq="age">[\s\S]*?<\/details>/)?.[0]||'';
    if(!renderedBlock.includes(text[locale]))throw new Error('Rendered age policy verification failed: '+file);
    rendered++;
  }
}

if(rendered<30)throw new Error('Rendered Budapest age FAQ coverage unexpectedly low: '+rendered);
console.log(`Rendered Budapest age policy from FBM consumer contract into ${rendered} built FAQ blocks (${standard}+ standard, age-${assessment} exception, passengers ${passengerMin}–${passengerMax}).`);
