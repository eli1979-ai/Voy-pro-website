import fs from 'node:fs';
const errors=[],check=(ok,why)=>{if(!ok)errors.push(why)};
const js=fs.readFileSync('site/assets/site.js','utf8'),css=fs.readFileSync('site/assets/site.css','utf8');
for(const prefix of ['','he/','hu/']){
  const dir='site/'+prefix+'budapest/tours/';
  const canonical=fs.readFileSync(dir+'buda-castle-ezraider-tour/index.html','utf8');
  const footer=canonical.slice(canonical.indexOf('<footer>'),canonical.indexOf('</footer>')+9);
  for(const slug of ['heroes-square-city-ezraider-tour','citadella-advanced-ezraider-tour']){
    const name=dir+slug+'/index.html',html=fs.readFileSync(name,'utf8');
    check((html.match(/<footer>/g)||[]).length===1,name+': missing/duplicate footer');
    check(html.includes(footer),name+': footer not shared and localized');
    check(html.includes('data-cookie-settings'),name+': legal/footer controls missing');
    const float=html.match(/<a class="whatsapp tour-floating-whatsapp"[^>]*href="(https:\/\/wa\.me\/36300993099[^"]+)"/);
    check(Boolean(float),name+': missing route-specific Budapest WhatsApp');
    check(Boolean(float&&decodeURIComponent(float[1]).toLowerCase().includes(slug.includes('citadella')?'citadella':'square')),name+': wrong WhatsApp tour context');
    check(html.includes('<svg aria-hidden="true"'),name+': missing WhatsApp icon');
    check(html.indexOf('</footer>')>html.indexOf('</main>'),name+': footer must follow main');
  }
}
for(const prefix of ['','pt/','he/']){
 const file='site/'+prefix+'portugal/index.html',html=fs.readFileSync(file,'utf8');
 const wa=html.match(/<a class="whatsapp"[^>]*href="(https:\/\/wa\.me\/\d+)"/);
 check(Boolean(wa&&wa[1]==='https://wa.me/351935695004'),file+': wrong or missing Portugal floating phone');
 check(html.includes('class="mobilebook portugal-mobile"'),file+': Portugal mobile request CTA removed');
}
check(js.includes("if(!(isBudapestPage||isPortugalPage)||!document.querySelector('.mobilebook'))return;"),'Portugal/Budapest float runtime missing');
check(js.includes("return 'https://wa.me/'+(isPortugalPage?'351935695004':'36300993099')"),'Destination WhatsApp routing regressed');
check(css.includes('bottom:calc(126px + env(safe-area-inset-bottom,0px))'),'Budapest float not moved closer to CTA');
check(css.includes('bottom:calc(18px + env(safe-area-inset-bottom,0px))'),'New tours float not near bottom');
check(css.includes('.rtl .tour-floating-whatsapp'),'Tour RTL positioning missing');
if(errors.length){console.error('Destination WA/footer check failed:\n'+errors.join('\n'));process.exit(1)}
console.log('PASS: 6 localized tour footers, 6 tour-specific WA CTAs, 3 Portuguese WA CTAs at +351935695004, sticky float/RTL.');
