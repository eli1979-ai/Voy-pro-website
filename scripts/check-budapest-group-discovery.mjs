import fs from 'node:fs';

const pages=[
  ['site/budapest/index.html','/budapest/group-tours/','/budapest/corporate-events/'],
  ['site/he/budapest/index.html','/he/budapest/group-tours/','/he/budapest/corporate-events/'],
  ['site/hu/budapest/index.html','/hu/budapest/group-tours/','/hu/budapest/corporate-events/'],
];
const failures=[];
for(const [file,groupHref,corporateHref] of pages){
  const html=fs.readFileSync(file,'utf8');
  const hub=(html.match(/<section class="section intent-hub"[\s\S]*?<\/section>/)||[])[0]||'';
  const cards=(hub.match(/class="intent-hub-card"/g)||[]).length;
  if(cards!==6) failures.push(`${file}: expected 6 intent-hub cards, found ${cards}`);
  if(!hub.includes(`href="${groupHref}"`)) failures.push(`${file}: missing group-tour discovery link`);
  if(!hub.includes(`href="${corporateHref}"`)) failures.push(`${file}: missing corporate-event discovery link`);
}
if(failures.length){
  console.error('Budapest group/corporate discovery guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Budapest group/corporate discovery guard OK: EN/HE/HU home intent hubs expose both high-value paths.');
