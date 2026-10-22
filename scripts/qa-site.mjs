import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const root=process.cwd();
const site=path.join(root,'site');
const read=p=>fs.readFileSync(p,'utf8');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  const p=path.join(dir,e.name);
  return e.isDirectory()?walk(p):[p];
});
const rel=p=>path.relative(site,p).replaceAll('\\','/');
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([:\w-]+)\s*=\s*"([^"]*)"/g)].map(m=>[m[1].toLowerCase(),m[2]]));
const htmlFiles=walk(site).filter(p=>p.endsWith('.html'));
const htmlMap=new Map(htmlFiles.map(p=>[rel(p),read(p)]));
const errors=[], warnings=[];
const fail=(file,msg)=>errors.push(file+': '+msg);
const warn=(file,msg)=>warnings.push(file+': '+msg);

const release=JSON.parse(read(path.join(site,'release.json')));
const sitemap=read(path.join(site,'sitemap.xml'));
const sitemapUrls=[...sitemap.matchAll(/<loc>(https:\/\/voy-pro\.com\/[^<]*)<\/loc>/g)].map(m=>m[1]);
if(sitemapUrls.length!==release.sitemap_urls) errors.push('sitemap.xml: expected '+release.sitemap_urls+' URLs, found '+sitemapUrls.length);

function urlToFile(urlOrPath){
  const u=new URL(urlOrPath,'https://voy-pro.com');
  if(u.origin!=='https://voy-pro.com') return null;
  if(u.pathname==='/') return 'index.html';
  const pathname=decodeURIComponent(u.pathname).replace(/^\//,'');
  if(pathname.endsWith('/')) return pathname+'index.html';
  if(path.extname(pathname)) return pathname;
  return pathname+'/index.html';
}
function idSet(html){return new Set([...html.matchAll(/\bid="([^"]+)"/gi)].map(m=>m[1]));}
function linkTags(html){return [...html.matchAll(/<link\b[^>]*>/gi)].map(m=>({tag:m[0],a:attrs(m[0])}));}

const titles=new Map();
for(const url of sitemapUrls){
  const file=urlToFile(url);
  if(!file||file==='__root_redirect__'||!htmlMap.has(file)){errors.push('sitemap.xml: missing target '+url+' -> '+file);continue;}
  const html=htmlMap.get(file);
  const title=(html.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]?.trim()||'';
  const metaTags=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>attrs(m[0]));
  const desc=metaTags.find(a=>a.name==='description')?.content||'';
  const robots=metaTags.find(a=>a.name==='robots')?.content||'';
  const canonical=linkTags(html).find(x=>x.a.rel==='canonical')?.a.href||'';
  const h1Count=(html.match(/<h1\b/gi)||[]).length;
  const htmlTag=(html.match(/<html\b[^>]*>/i)||[])[0]||'';
  const htmlAttrs=attrs(htmlTag);

  if(!title) fail(file,'missing title');
  if(!desc) fail(file,'missing meta description');
  if(desc.length>180) warn(file,'long meta description ('+desc.length+' chars)');
  if(!canonical) fail(file,'missing canonical');
  if(canonical!==url) fail(file,'canonical mismatch: '+canonical+' != '+url);
  if(h1Count!==1) fail(file,'expected exactly one H1, found '+h1Count);
  if(!htmlAttrs.lang) fail(file,'missing html lang');
  if(file.startsWith('he/')&&htmlAttrs.dir!=='rtl') fail(file,'Hebrew page must use dir="rtl"');
  if(!file.startsWith('he/')&&htmlAttrs.dir==='rtl') fail(file,'non-Hebrew page unexpectedly RTL');
  if(robots&&robots.toLowerCase().includes('noindex')) fail(file,'sitemap page is noindex');

  const titleKey=title.replace(/&amp;/g,'&').replace(/\s+/g,' ');
  if(titles.has(titleKey)) fail(file,'duplicate title with '+titles.get(titleKey));
  else titles.set(titleKey,file);

  const links=linkTags(html);
  const alts=links.filter(x=>x.a.rel==='alternate'&&x.a.hreflang);
  const altLangs=new Set(alts.map(x=>x.a.hreflang));
  const expected=new URL(url).pathname==='/'?[]:url.includes('/portugal/')?['en','he','pt','x-default']:['en','he','hu','x-default'];
  for(const lang of expected) if(!altLangs.has(lang)) fail(file,'missing hreflang '+lang);
  for(const alt of alts){
    const target=urlToFile(alt.a.href);
    if(!htmlMap.has(target)) fail(file,'hreflang target missing: '+alt.a.href);
  }
}

for(const [file,html] of htmlMap){
  const is404=file==='404.html';
  const ids=[...html.matchAll(/\bid="([^"]+)"/gi)].map(m=>m[1]);
  const dup=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
  if(dup.length) fail(file,'duplicate IDs: '+dup.join(', '));

  const images=[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>({tag:m[0],a:attrs(m[0])}));
  for(const img of images) if(!('alt' in img.a)) fail(file,'image missing alt: '+img.tag.slice(0,120));

  const anchors=[...html.matchAll(/<a\b[^>]*>/gi)].map(m=>({tag:m[0],a:attrs(m[0])}));
  for(const a of anchors){
    const href=a.a.href;
    if(href==null) fail(file,'anchor missing href');
    else if(href===''||href==='#') fail(file,'empty/hash-only anchor: '+a.tag.slice(0,160));
    else if(/^javascript:/i.test(href)) fail(file,'javascript: href');
    if(a.a.target==='_blank'&&!/\bnoopener\b/i.test(a.a.rel||'')) fail(file,'target=_blank missing rel=noopener');
    if(href&&/^https?:\/\/(?:www\.)?pombais\.pt/i.test(href)) fail(file,'direct Pombais booking/link is not allowed');
    if(href&&/^https?:\/\/(?:www\.)?ezraidereu\.com/i.test(href)) fail(file,'legacy EZRaiderEU anchor remains');

    if(href&&(/^(?:https:\/\/voy-pro\.com)?\//.test(href))){
      const u=new URL(href,'https://voy-pro.com');
      if(u.origin!=='https://voy-pro.com') continue;
      const target=urlToFile(u.href);
            if(!target||!htmlMap.has(target)){
        if(!u.pathname.startsWith('/assets/')) fail(file,'internal link target missing: '+href);
        continue;
      }
      if(u.hash&&u.hash!=='#'){
        const id=decodeURIComponent(u.hash.slice(1));
        if(!idSet(htmlMap.get(target)).has(id)) fail(file,'fragment target missing: '+href);
      }
    }
  }

  if(!is404){
    if(!/<meta[^>]+name="viewport"/i.test(html)&&!/<meta[^>]+content="width=device-width[^"]*"[^>]+name="viewport"/i.test(html)) fail(file,'missing viewport meta');
    if(!/class="skip-link"/i.test(html)) warn(file,'skip link missing');
    if(!/<main\b[^>]*id="main-content"/i.test(html)) warn(file,'main landmark id missing');
  }

  if(/\b(?:EZRaider OS|\bFBM\b|sample times|team check)\b/i.test(html)) fail(file,'internal implementation copy leaked');
}

const notFound=htmlMap.get('404.html')||'';
const nfMeta=[...notFound.matchAll(/<meta\b[^>]*>/gi)].map(m=>attrs(m[0]));
if(!nfMeta.find(a=>a.name==='robots')?.content?.toLowerCase().includes('noindex')) errors.push('404.html: must be noindex');

const robots=read(path.join(site,'robots.txt'));
if(!/Disallow:\s*\//i.test(robots)) errors.push('robots.txt: staging crawl block unexpectedly removed');

const js=read(path.join(site,'assets','site.js'));
const rtb=read(path.join(site,'assets','rtb-request.js'));
if(!js.includes("loader.src='/assets/rtb-request.js'"))fail('assets/site.js','special-tour request module not wired');
for(const slug of ['heroes-square-city-ezraider-tour','citadella-advanced-ezraider-tour','buda-margaret-extended-tour']){
  if(!rtb.includes(slug))fail('assets/rtb-request.js','missing request route '+slug);
}
for(const marker of ['requestedGuideLanguage','englishAlternativeAccepted','Europe/Budapest','location.assign(whatsappUrl)','const strings={','en:{','he:{','hu:{',"fetch('/api/request-to-book'",'credentials:\'omit\'','pendingFingerprint']){
  if(!rtb.includes(marker))fail('assets/rtb-request.js','missing explicit request contract / localized handoff: '+marker);
}
for(const marker of ["languageField.addEventListener('change',updateEnglishAlternative)",
  "englishChoice.checked=false",
  "englishChoiceRow.hidden=!languageField.value||languageField.value==='en'",
  "data.get('requested_guide_language')!=='en'"]){
  if(!rtb.includes(marker))fail('assets/rtb-request.js',
    'English fallback opt-in must be reset when requested guiding language changes: '+marker);
}
if(!read(path.join(site,'assets','site.css')).includes('.voy-rtb-checkbox[hidden]{display:none!important}'))
  fail('assets/site.css','hidden English alternative must remain invisible despite flex layout');
if(/x-fbm-intake-secret|FBM_REQUEST_TO_BOOK_INTAKE_SECRET|ezraider-os-staging\.vercel\.app|https:\/\/.*\/api\/request-to-book/.test(rtb))
  fail('assets/rtb-request.js','client must never expose private FBM credentials or call an upstream host');
if(/fetch\((?!['"]\/api\/request-to-book['"])/.test(rtb))
  fail('assets/rtb-request.js','request browser may only fetch same-origin relay');

if(/data-mobile-nav-wa href="#"/.test(js)) errors.push('assets/site.js: mobile WhatsApp hash fallback remains');
if(!/function enhanceFormLabels\(/.test(js)) errors.push('assets/site.js: form-label accessibility enhancement missing');
if(!/<option value="pay_now_card" disabled>/.test(js)) errors.push('assets/site.js: visible online-card payment option missing');
if(!/const onlineReady=Boolean\(caps\?\.online_card\)/.test(js)) errors.push('assets/site.js: online-card capability gating missing');
if(!/payNow\.disabled=!onlineReady/.test(js)) errors.push('assets/site.js: online-card disabled state is not tied to capability');
if(!/location\.assign\(payment\.checkout_url\)/.test(js)) errors.push('assets/site.js: secure checkout redirect missing');
if(!/const PAYMENT_RETRY_KEY='voy_payment_retry_v1'/.test(js)) errors.push('assets/site.js: Stripe checkout retry session key missing');
if(!/sessionStorage\.setItem\(PAYMENT_RETRY_KEY/.test(js)) errors.push('assets/site.js: Stripe checkout retry state is not stored per-tab');
if(!/u\.hostname==='checkout\.stripe\.com'/.test(js)) errors.push('assets/site.js: Stripe retry URL host validation missing');
if(!/rememberPaymentRetry\(payment\);patchSession\(\{stage:'payment_redirect'/.test(js)) errors.push('assets/site.js: active Stripe checkout is not remembered before redirect');
if(!/data-payment-retry/.test(js)||!/payment_retry_clicked/.test(js)) errors.push('assets/site.js: cancelled-payment retry action missing');
if(!/qs\.get\('payment'\)==='success'\)\{clearPaymentRetry\(\);(?:resetBookingStarted\(\);)?return;\}/.test(js)) errors.push('assets/site.js: stale Stripe retry state is not cleared after success');

// Check gallery, social, structured-data and runtime image references offline.
const imageSources=walk(site).filter(p=>/\.(?:html|css|js)$/.test(p));
for(const source of imageSources){
  const file=rel(source), content=read(source);
  if(/https?:\/\/(?:www\.)?(?:ezraidereu\.com\/budapest|pombais\.pt\/turismo)\/wp-content\//i.test(content)){
    fail(file,'external EZRaiderEU/Pombais media dependency remains');
  }
  const images=new Set([...content.matchAll(/\/assets\/images\/[^\s"'<>`)]+/g)].map(m=>m[0]));
  for(const image of images){
    const pathname=decodeURIComponent(new URL(image,'https://voy-pro.com').pathname);
    const asset=path.join(site,pathname);
    if(!fs.existsSync(asset)||!fs.statSync(asset).isFile()||fs.statSync(asset).size===0){
      fail(file,'local image missing or empty: '+image);
    }
  }
}

// Verify the approved source-linked review roster and translations.
try{
  const result=execFileSync(process.execPath,['scripts/check-budapest-review-translation-drafts.mjs'],{
    encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000,
  });
  console.log(result.trim());
}catch(error){
  fail('assets/budapest-approved-reviews.json',
    'Review translation draft/provenance guard: '+String(error.stderr||error.message||error).slice(0,1100));
}

// Scan every locally rendered page and runtime Hungarian labels for language leaks.
try{
  const result=execFileSync(process.execPath,['scripts/check-site-language-consistency.mjs'],{
    encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000,
  });
  console.log(result.trim());
}catch(error){
  fail('assets/site.js',
    'Website locale consistency regression: '+String(error.stderr||error.message||error).slice(0,1100));
}

// The request-only server relay remains disabled until owner release approval,
// but its input, secret boundary, DST and idempotency forwarding are tested.
try{
  const result=execFileSync(process.execPath,['scripts/check-request-to-book-relay.mjs'],{
    encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,
  });
  console.log(result.trim());
}catch(error){
  fail('api/request-to-book.js',
    'RTB server relay safety regression: '+String(error.stderr||error.message||error).slice(0,1200));
}

// The partner booking flow is executed with mocked FBM routes during every
// site build / launch QA, not only scanned for static file presence.
try{
  const result=execFileSync(process.execPath,['scripts/check-affiliate-booking-widget.mjs'],{
    encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000,
  });
  console.log(result.trim());
}catch(error){
  fail('assets/affiliate-booking-widget.js',
    'Affiliate widget checkout behavior regression: '+String(error.stderr||error.message||error).slice(0,1100));
}

// Budapest guest-language request behavior: exercise the browser module in
// a fake DOM with mocked same-origin relay outcomes, never real leads.
try{
  const result=execFileSync(process.execPath,['scripts/check-budapest-rtb-submission.mjs'],{
    encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,
  });
  console.log(result.trim());
}catch(error){
  fail('assets/rtb-request.js',
    'Budapest request UI idempotent relay test: '+String(error.stderr||error.message||error).slice(0,1100));
}

console.log('QA scanned',htmlFiles.length,'HTML files and',sitemapUrls.length,'sitemap URLs.');
for(const w of warnings) console.log('WARNING:',w);
if(errors.length){
  console.error('\nQA FAILURES ('+errors.length+')');
  for(const e of errors) console.error('-',e);
  process.exit(1);
}
console.log('Site-wide static QA passed with',warnings.length,'warning(s).');
