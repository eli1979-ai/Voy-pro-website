import fs from 'node:fs';
const html=fs.readFileSync('site/index.html','utf8');
const css=fs.readFileSync('site/assets/site.css','utf8');
const fail=[];
const check=(ok,message)=>{if(!ok)fail.push(message);};
for(const place of ['budapest','marvao','prague']){
  check(html.includes('destination-card--'+place),place+': root card class missing');
  check(new RegExp('\\.destination-card--'+place+'\\s*\\{[\\s\\S]*?--destination-photo:url\\("https://thumb\\.wikimedia\\.org/').test(css),place+': iconic photo URL missing');
}
check(css.includes('.tour-picker#destinations .destination-card::before'), 'image styles must remain homepage-scoped');
check(css.includes('var(--destination-photo)'), 'image and gradient fallback missing');
check(css.includes('.destination-card--coming-soon::before'),'Prague must remain muted');
check(css.includes('@media(max-width:800px)'),'mobile-specific overlay missing');
check(css.includes('prefers-reduced-motion:reduce'),'reduced motion support missing');
check(html.includes('aria-label="Czechia, Prague coming soon"'),'Prague status missing');
check(html.includes('Marvão — Krzysztof Żwirski / Gautamma (CC BY 2.5, cropped)'),'Marvão image attribution missing');
check(html.includes('https://creativecommons.org/licenses/by/2.5/'),'Marvão license link missing');
for(const href of ['/budapest/','/portugal/'])check(html.includes('href="'+href+'"'),'Destination navigation missing: '+href);
if(fail.length){console.error('Root destination card test FAIL:\n'+fail.join('\n'));process.exit(1)}
console.log('Root destination card photography, links, credits, overlay, responsive and coming-soon checks OK.');
