import fs from 'node:fs';
const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message);};
const js=fs.readFileSync('site/assets/site.js','utf8');
const css=fs.readFileSync('site/assets/site.css','utf8');
for(const [file,label] of [
  ['site/budapest/index.html','From'],
  ['site/he/budapest/index.html','החל מ־'],
  ['site/hu/budapest/index.html','Induló ár']
]){
  const html=fs.readFileSync(file,'utf8');
  const bar=(html.match(/<div class="mobilebook"><div class="mobile-price-copy">[\s\S]*?<a class="btn"/)||[])[0]||'';
  check(bar.includes('<small>'+label+'</small>'),file+': mobile starting price label missing');
  check(bar.includes('<b data-runtime-price="">'),file+': FBM live amount binding missing');
  check(bar.includes('★★★★★ 5.0 · Google'),file+': trust content changed');
}
check(js.includes("node.closest('.mobilebook')?amount:t('From ','החל מ־')+amount"),'Mobile-only price formatting guard missing');
check(js.includes('money(p.priceFrom,p.currency||\'EUR\')'),'FBM-provided price/currency formatter missing');
check(js.includes("if(!isBudapestPage||!document.querySelector('.mobilebook'))return"),'WhatsApp treatment scope missing');
check(js.includes("link.classList.add('compact-booking-whatsapp')"),'Compact WhatsApp runtime missing');
check(js.includes("link.setAttribute('aria-label'"),'Accessible WhatsApp name missing');
check(css.includes('.compact-booking-whatsapp .compact-booking-whatsapp-label{display:none}'),'Mobile-only label reduction missing');
check(css.includes('bottom:calc(142px + env(safe-area-inset-bottom,0px))'),'WhatsApp sticky-bar clearance missing');
check(css.includes('.rtl .compact-booking-whatsapp'),'RTL placement missing');
check(css.includes('@media(max-width:800px)'),'Mobile breakpoint missing');
if(failures.length){console.error('Mobile sticky CTA checks FAIL:\n'+failures.join('\n'));process.exit(1)}
console.log('Mobile sticky bar pricing and accessible compact WhatsApp checks OK (EN/HE/HU).');
