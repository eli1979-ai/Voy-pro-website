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
    const originalTourWhatsApp=[...html.matchAll(/href="(https:\/\/wa\.me\/36300993099[^"]+)"/g)].map(match=>match[1]);
    check(Boolean(float&&originalTourWhatsApp.length>=2&&originalTourWhatsApp[0]===float[1]),name+': floating WhatsApp must retain the original localized tour message');
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
// The mobile nav is created at load, but booking/date/party choices may change.
// Recompute the WhatsApp URL when opening and activating the navigation link.
const mobileNav=js.slice(js.indexOf('function enhanceMobileNavigation()'),js.indexOf("document.querySelectorAll('a.brand')"));
check(mobileNav.includes("const mobileWa=sheet.querySelector('[data-mobile-nav-wa]');"),'Mobile navigation WhatsApp link missing');
check(mobileNav.includes("const refreshMobileWhatsApp=()=>{mobileWa.href=whatsAppUrl();};"),'Mobile nav must derive fresh WhatsApp URL from current form selections');
check(mobileNav.includes("mobileWa.addEventListener('pointerdown',refreshMobileWhatsApp);"),'Mobile nav pointer activation uses stale tour context');
check(/mobileWa\.addEventListener\('click',\(\)=>\{\s*refreshMobileWhatsApp\(\);\s*track\('whatsapp_clicked'/.test(mobileNav),'Mobile nav click must refresh WhatsApp before tracking');
check(mobileNav.includes("btn.onclick=()=>{if(mobileWa)mobileWa.href=whatsAppUrl();"),'Mobile nav must refresh WhatsApp on opening, including keyboard use');

check(js.includes("const whatsappPortugal=isPortugalPage||vehicleGuideSource==='marvao'||vehicleGuideSource==='marvao-pt'")&&
  js.includes("const whatsappBudapest=isBudapestPage||vehicleGuideSource==='budapest'")&&
  js.includes("return 'https://wa.me/'+(whatsappPortugal?'351935695004':'36300993099')"),
  'Destination WhatsApp routing regressed: Budapest +36 and Marvão +351 must follow explicit page/source context');
const portugalSubmit=js.slice(js.indexOf('function bindPortugalRequestFlow()'),js.indexOf('  bindPortugalRequestFlow();'));
check(portugalSubmit.includes("location.href='https://wa.me/351935695004?text='"),'Marvão request form must submit to local +351 number');
check(!portugalSubmit.includes("location.href='https://wa.me/36300993099"),'Marvão request form incorrectly submits to Budapest');

check(css.includes('bottom:var(--booking-whatsapp-bottom,calc(104px + env(safe-area-inset-bottom,0px)))'),'Floating WhatsApp CSS anchor absent');
check(css.includes('bottom:calc(18px + env(safe-area-inset-bottom,0px))'),'New tours float not near bottom');
check(css.includes('.rtl .tour-floating-whatsapp'),'Tour RTL positioning missing');
if(errors.length){console.error('Destination WA/footer check failed:\n'+errors.join('\n'));process.exit(1)}
console.log('PASS: 6 localized tour footers, 6 tour-specific WA CTAs, 3 Portuguese WA CTAs at +351935695004, sticky float/RTL.');
