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

 // Every introduced city route must be discoverable on all three Budapest
 // homepages. Heroes' Square is Request-to-Book, not a direct FBM checkout.
 for(const [language,prefix] of languages){
   const file=`site/${prefix}budapest/index.html`;
   const html=fs.readFileSync(file,'utf8');
   const href=`/${prefix}budapest/tours/heroes-square-city-ezraider-tour/`;
   const cards=[...html.matchAll(/<article class="tour-choice-card\\b[^>]*>[\\s\\S]*?<\\/article>/g)]
     .map(match=>match[0]);
   const cityCards=cards.filter(card=>card.includes(`href="${href}"`));
   if(cityCards.length!==1){
     failures.push(`${file}: exactly one discoverable Heroes' Square tour card required, got ${cityCards.length}`);
     continue;
   }
   const card=cityCards[0];
   if(!card.includes('data-tour-image="heroes"'))
     failures.push(`${file}: Heroes' Square card lost first-party image`);
   if(!card.includes('href="https://wa.me/36300993099"'))
     failures.push(`${file}: Heroes' Square must remain a contact-first availability request`);
   if(!card.includes(language==='hu'?'70 €':'€70'))
     failures.push(`${file}: Heroes' Square card missing previously approved €70 from-price`);
   if(card.includes('#booking'))
     failures.push(`${file}: Heroes' Square must not silently enter a direct checkout`);
 }

if(failures.length){
  console.error('Budapest tour language-switch continuity guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Budapest tour language-switch continuity OK (EN/HE/HU across all three new tours).');
