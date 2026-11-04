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
check(js.includes("if(!(isBudapestPage||isPortugalPage)||!document.querySelector('.mobilebook'))return"),'WhatsApp treatment scope missing');
check(js.includes("link.classList.add('compact-booking-whatsapp')"),'Compact WhatsApp runtime missing');
check(js.includes("link.setAttribute('aria-label'"),'Accessible WhatsApp name missing');
check(css.includes('.compact-booking-whatsapp .compact-booking-whatsapp-label{display:none}'),'Mobile-only label reduction missing');
check(css.includes('bottom:var(--booking-whatsapp-bottom,calc(104px + env(safe-area-inset-bottom,0px)))'),'WhatsApp sticky-bar clearance missing');
check(css.includes('.rtl .compact-booking-whatsapp'),'RTL placement missing');

for(const marker of [
  '@media(min-width:801px)',
  'body[data-page$="/budapest/"] .compact-booking-whatsapp{',
  'box-sizing:border-box;width:52px;height:52px;min-width:52px;min-height:52px;',
  'body[data-page$="/budapest/"] .compact-booking-whatsapp .compact-booking-whatsapp-label{display:none}'
]){
  check(css.includes(marker),'Desktop Budapest hub WhatsApp collision protection missing: '+marker);
}
// The runtime must retain the original destination-specific WhatsApp link and
// programmatic label even when the visual desktop label becomes icon-only.
check(js.includes("link.setAttribute('aria-label'"),'Compact WhatsApp accessible name missing');

check(js.includes("const rect=bar.getBoundingClientRect();"),'Floating WhatsApp should measure actual bar top');
check(js.includes("window.innerHeight-rect.top+12"),'WhatsApp must maintain 12px clearance to bar');
check(js.includes("link.style.setProperty('--booking-whatsapp-bottom',clearance+'px')"),'Floating WhatsApp CSS var not updated');
check(js.includes("new ResizeObserver(syncFloatingGap).observe(bar)"),'WhatsApp should adapt to bar height changes');
check(js.includes("window.addEventListener('resize',syncFloatingGap"),'WhatsApp should adapt on viewport resize');
check(css.includes('@media(max-width:800px)'),'Mobile breakpoint missing');

// The WhatsApp action must be visually docked INSIDE a reserved slot in the
// sticky mobile booking bar, rather than floating over tour copy or form fields.
const dockMarker='/* 2026-11-01 mobile sticky WhatsApp docking';
const dockedCss=css.slice(css.indexOf(dockMarker));
check(css.includes(dockMarker),'Mobile sticky WhatsApp docking CSS missing');
check(dockedCss.includes('@media(max-width:800px)'), 'Docking must be mobile-only');
for(const locale of ['[data-page^="/budapest/"]','[data-page^="/he/budapest/"]','[data-page^="/hu/budapest/"]',
'[data-page^="/portugal/"]','[data-page^="/he/portugal/"]','[data-page^="/pt/portugal/"]']){
  check(dockedCss.includes(locale),'Mobile docking missing branch/locale: '+locale);
}
check(dockedCss.includes(':has(.compact-booking-whatsapp) .mobilebook{'),
 'Reserve sticky-bar space ONLY when the runtime compact WA control exists');
check(dockedCss.includes('padding-inline-end:60px'),'Sticky CTA must reserve space for 44px WhatsApp');
check(dockedCss.includes('.mobilebook>.btn{')&&dockedCss.includes('white-space:normal;'),
 'Long localized sticky primary CTA must be allowed to wrap, not overflow');
check(dockedCss.includes('min-height:44px;')&&dockedCss.includes('width:44px;height:44px;'),
 'WhatsApp touch target must remain at least 44x44px');
check(dockedCss.includes('bottom:calc(16px + env(safe-area-inset-bottom,0px))'),
 'Docked action must sit inside the booking bar, not 100px over copy');
check(dockedCss.includes('.rtl .compact-booking-whatsapp{')&&dockedCss.includes('env(safe-area-inset-left,0px)'),
 'Docked WhatsApp must mirror in RTL and respect safe-area insets');
check(js.includes("link.setAttribute('aria-label'"),'Keep WhatsApp screen-reader labeling');
check(js.includes("const clearance=Math.ceil(window.innerHeight-rect.top+12);"),
 'Keep existing resize/WA routing runtime; CSS takes visual precedence at mobile widths');

if(failures.length){console.error('Mobile sticky CTA checks FAIL:\n'+failures.join('\n'));process.exit(1)}
console.log('Mobile sticky bar pricing and accessible compact WhatsApp checks OK (EN/HE/HU).');
