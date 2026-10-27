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
    if(slug==='heroes-square-city-ezraider-tour'){
      // The Opera is a genuine itinerary stop; it must also be visible in the
      // opening copy in every locale, not buried in structured SEO metadata.
      const opera={
        en:'Hungarian State Opera',
        he:'בית האופרה ההונגרי',
        hu:'Magyar Állami Operaháznál'
      }[language];
      const hero=html.match(/<section class="hero">([\s\S]*?)<\/section>/)?.[1]||'';
      if(!hero.includes(opera))
        failures.push(`${file}: Opera stop missing from visible hero copy (${language})`);
      if(!html.includes('route-itinerary')||
         !html.includes(language==='he'?'בית האופרה ההונגרי':language==='hu'?'Magyar Állami Operaház':'Hungarian State Opera'))
        failures.push(`${file}: original Opera itinerary stop may be missing`);
    }
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
