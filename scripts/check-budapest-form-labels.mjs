import fs from 'node:fs';

const pages=[
  'site/budapest/index.html',
  'site/he/budapest/index.html',
  'site/hu/budapest/index.html'
];
const fields={
  experience:'budapest-booking-experience',
  date:'budapest-booking-date',
  adults:'budapest-booking-adults',
  children:'budapest-booking-children',
  babies:'budapest-booking-babies'
};
const failures=[];
for(const page of pages){
  const html=fs.readFileSync(page,'utf8');
  const form=(html.match(/<form[^>]*id="availability-form"[^>]*>[\s\S]*?<\/form>/)||[''])[0];
  if(!form){ failures.push(page+': availability form missing'); continue; }
  for(const [name,id] of Object.entries(fields)){
    if(!form.includes(`for="${id}"`)) failures.push(`${page}: label missing for ${name}`);
    const controlPattern=new RegExp(`<(?:input|select)[^>]*id="${id}"[^>]*name="${name}"|<(?:input|select)[^>]*name="${name}"[^>]*id="${id}"`);
    if(!controlPattern.test(form)) failures.push(`${page}: control ${name} missing matching id ${id}`);
  }
}
if(failures.length){
  console.error('Budapest booking form label guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Budapest booking form label guard OK: 15 visible labels are programmatically associated across EN/HE/HU.');
