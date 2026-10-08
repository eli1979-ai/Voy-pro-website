import fs from 'node:fs';

const slugs=[
  'buda-margaret-extended-tour',
  'heroes-square-city-ezraider-tour',
  'citadella-advanced-ezraider-tour'
];
const languages=[
  ['en',''],
  ['he','he/'],
  ['hu','hu/']
];
const failures=[];
for(const slug of slugs){
  for(const [language,prefix] of languages){
    const file=`site/${prefix}budapest/tours/${slug}/index.html`;
    const html=fs.readFileSync(file,'utf8');
    const picker=html.match(/<span[^>]*class="language-picker"[^>]*>([\s\S]*?)<\/span>/)?.[1];
    if(!picker){failures.push(`${file}: missing language picker`);continue;}
    for(const [targetLang,targetPrefix] of languages){
      const target=`/${targetPrefix}budapest/tours/${slug}/`;
      const link=picker.match(new RegExp('<a\\b[^>]*href="'+target.replaceAll('/','\\/')+'"[^>]*>','g'));
      if(!link || link.length!==1)failures.push(`${file}: language ${targetLang} must link to ${target}`);
    }
  }
}
if(failures.length){
  console.error('Budapest tour language-switch continuity guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Budapest tour language-switch continuity OK (EN/HE/HU across all three new tours).');
