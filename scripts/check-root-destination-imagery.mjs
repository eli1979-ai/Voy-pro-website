import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('site/index.html','utf8');
const css=fs.readFileSync('site/assets/site.css','utf8');
const fail=[];
const check=(ok,message)=>{if(!ok)fail.push(message);};
for(const place of ['budapest','marvao','prague']){
  check(html.includes('destination-card--'+place),place+': root card class missing');
  check(new RegExp('\\.destination-card--'+place+'\\s*\\{[\\s\\S]*?--destination-photo:url\\("https://(?:thumb|upload)\\.wikimedia\\.org/').test(css),place+': iconic photo URL missing');
}
check(css.includes('.tour-picker#destinations .destination-card::before'), 'image styles must remain homepage-scoped');
check(css.includes('var(--destination-photo)'), 'image and gradient fallback missing');
check(css.includes('.destination-card--coming-soon::before'),'Prague must remain muted');
check(css.includes('@media(max-width:800px)'),'mobile-specific overlay missing');
check(css.includes('prefers-reduced-motion:reduce'),'reduced motion support missing');
check(html.includes('aria-label="Czechia, Prague coming soon"'),'Prague status missing');
check(html.includes('Marvão castle — António Amen (CC BY-SA 3.0, cropped)'),'Marvão image attribution missing');
check(html.includes('https://creativecommons.org/licenses/by-sa/3.0/'),'Marvão license link missing');
check(css.includes('960px-Castelo_de_Marv%C3%A3o_-_Panor%C3%A2mica_geral.jpg'),'Marvão castle reverse-angle image missing');
check(!css.includes('Marv%C3%A3o_27.jpg'),'Previous Marvão photo still used');
check(css.includes('rgba(9,24,38,.30)'),'Mobile destination overlay not lightened');
check(html.includes('class="whatsapp home-whatsapp"') && html.includes('aria-label="WhatsApp VOY PRO support"'),'Root mobile WhatsApp button not accessible');
check(css.includes('.home-whatsapp .home-whatsapp-label{display:none}'),'Mobile WhatsApp label not compacted');
for(const [src,width,height] of [
  ['/assets/images/budapest/img12.jpg','800','1200'],
  ['/assets/images/portugal/marvao-01.jpg','605','605']
]){
  const tag=[...html.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]).find(item=>item.includes('src="'+src+'"'));
  check(!!tag&&tag.includes('width="'+width+'"')&&tag.includes('height="'+height+'"'),
    'Homepage destination hero must preserve real source dimensions: '+src);
}
for(const href of ['/budapest/','/portugal/'])check(html.includes('href="'+href+'"'),'Destination navigation missing: '+href);
// Background/card-copy clicks must open the correct destination, while links
// and buttons still handle their own clicks; Prague remains non-clickable.
check(html.includes('<script src="/assets/home-destination-cards.js"></script>'),
  'Homepage card navigation script is not loaded');
const cardScript=fs.readFileSync('site/assets/home-destination-cards.js','utf8');
let navigations=0;
const mockCard=()=>{
  let onClick;
  return {
    querySelector:selector=>{
      check(selector==='h3 .tour-detail-link[href]','Destination link selector changed');
      return {click:()=>{navigations++;}};
    },
    addEventListener:(type,handler)=>{if(type==='click')onClick=handler;},
    fire:overrides=>onClick({
      button:0,defaultPrevented:false,ctrlKey:false,metaKey:false,
      altKey:false,shiftKey:false,target:{closest:()=>null},...overrides
    })
  };
};
const activeCards=[mockCard(),mockCard()];
vm.runInNewContext(cardScript,{document:{querySelectorAll:selector=>{
  check(selector.includes(':not(.destination-card--coming-soon)'),
    'Prague coming-soon card must not be clickable');
  return activeCards;
}}},{filename:'home-destination-cards.js'});
activeCards[0].fire({});
activeCards[1].fire({});
activeCards[0].fire({target:{closest:()=>({})}});
activeCards[0].fire({ctrlKey:true});
activeCards[0].fire({button:1});
activeCards[1].fire({defaultPrevented:true});
check(navigations===2,'Only unmodified background clicks may navigate');
if(fail.length){console.error('Root destination card test FAIL:\n'+fail.join('\n'));process.exit(1)}
console.log('Root destination card photography, links, credits, overlay, responsive and coming-soon checks OK.');
