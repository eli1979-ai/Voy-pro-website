// Real Chromium layout/navigation smoke test against the *built local dist*.
// This never talks to the FBM backend, external analytics, or live websites.
// Screenshots + browser assertions complement (not replace) human design QA.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile, stat} from 'node:fs/promises';
import {resolve, sep, extname, join} from 'node:path';
import {chromium} from 'playwright';

const root=resolve('dist');
const out=resolve('visual-qa-output');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.json':'application/json',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon',
  '.woff2':'font/woff2','.woff':'font/woff'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    let path=decodeURIComponent(url.pathname);
    if(path.endsWith('/'))path+='index.html';
    const full=resolve(root,'.'+path);
    if(!full.startsWith(root+sep))throw Error('Outside build directory');
    if(!(await stat(full)).isFile())throw Error('Not a file');
    const data=await readFile(full);
    res.writeHead(200,{'Content-Type':mime[extname(full)]||'application/octet-stream',
      'Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
await mkdir(out,{recursive:true});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
// GitHub's hosted Ubuntu runner already includes Google Chrome; use the
// system browser in CI instead of downloading a large Playwright Chromium.
const browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{})});
const results=[];
let failures=0;
function check(condition,label){
  if(!condition){failures++;results.push('FAIL: '+label);}
  else results.push('PASS: '+label);
}
async function visit(name,path,viewport,{fullPage=false,guide=false,tourGuide=false,booking=false,request=false,b2b=null,rtb=false,localWhatsApp=null,tourFloat=false,heroImage=false}={}){
  const page=await browser.newPage({viewport,deviceScaleFactor:1,reducedMotion:'reduce'});
  const runtimeErrors=[];
  page.on('pageerror',error=>runtimeErrors.push(error.message));
  // Avoid contact with actual vendors, FBM, Google/Meta tracking, or YouTube.
  await page.route('**/*',async route=>{
    try{
      const requested=new URL(route.request().url());
      if(requested.origin===base)return route.continue();
      // Absolute, first-party media URLs are part of the website snapshot:
      // replay only /assets from local dist for truthful screenshot QA.
      // Never fetch the public domain, payment/FBM APIs or external resources.
      if(['voy-pro.com','www.voy-pro.com'].includes(requested.hostname)&&
        requested.protocol==='https:'&&requested.pathname.startsWith('/assets/')){
        // Playwright route.continue forbids changing HTTPS to HTTP. Fulfill
        // the request with bytes read only from the local static test server.
        const local=await fetch(base+requested.pathname+requested.search);
        const body=Buffer.from(await local.arrayBuffer());
        return route.fulfill({
          status:local.status,
          body,
          contentType:local.headers.get('content-type')||'application/octet-stream'
        });
      }
    }catch{}
    return route.abort();
  });
  if(rtb)await page.addInitScript(()=>{
    // Detect even a transient legacy form: an assertion after page load alone
    // would miss it because the deferred RTB enhancer later removes it.
    window.__legacyRtbFormInsertions=0;
    new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes){
        if(node.nodeType!==1)continue;
        if(node.matches?.('[data-special-request-builder]')||
          node.querySelector?.('[data-special-request-builder]'))
          window.__legacyRtbFormInsertions++;
      }
    }).observe(document,{childList:true,subtree:true});
  });
  try{
    const response=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:20000});
    check(response?.status()===200,name+' HTTP 200');
    await page.waitForTimeout(300);
    const metrics=await page.evaluate(()=>({
      width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,
      bodyWidth:document.body.scrollWidth,
      heading:(document.querySelector('h1')?.textContent||'').trim(),
      hasNav:!!document.querySelector('.navlinks'),
      lang:document.documentElement.lang,
      direction:document.documentElement.dir||getComputedStyle(document.documentElement).direction,
      ready:document.readyState
    }));
    check(metrics.heading.length>0,name+' visible semantic H1');
    check(metrics.scrollWidth<=metrics.width+2,name+' no horizontal page overflow ('+metrics.scrollWidth+'/'+metrics.width+')');
    check(metrics.hasNav,name+' has navigation');
    check(await page.locator('footer').count()===1,name+' has exactly one footer');
    // The tour proof arrangement must work in a real browser, not just static HTML.
    if(path.includes('/budapest/tours/')||path.endsWith('/budapest/private-tours/')){
      if(path.includes('/budapest/tours/')){
        check(await page.locator('section.route-compare').count()===0,
          name+' specific tour detail does not display generic choose-your-route grid');
      }
      const compact=await page.evaluate(()=>{
        const top=document.querySelector('.trust .trust-grid');
        const bottom=document.querySelector('.tour-review-compact .review-source-grid');
        const ticker=document.querySelector('[data-vp-reviews-root]');
        const firstSection=document.querySelector('.tour-detail-page .section:not(.booking):not(.tour-review-compact)');
        const computed=top?getComputedStyle(top):null;
        return {
          top:!!top,bottom:!!bottom,ticker:!!ticker,
          columns:computed?.gridTemplateColumns.trim().split(' ').length||0,
          sourceCount:bottom?.querySelectorAll('a[href^="https://"]').length||0,
          topPadding:firstSection?parseFloat(getComputedStyle(firstSection).paddingTop):null,
          legacy:document.querySelectorAll('.review-source-grid').length
        };
      });
      check(compact.top&&compact.bottom&&compact.ticker,name+' has 2 compact ratings points + verified ticker');
      check(compact.sourceCount===3&&compact.legacy===1,name+' has precisely three verified platform links at bottom');
      if(viewport.width<=800){
        check(compact.columns===3,name+' shows all rating sources in one compact mobile row');
        check(compact.topPadding!==null&&compact.topPadding<=24,name+' mobile tour sections are tightened (<=24px top)');
      }
      const carousel=page.locator('[data-vp-reviews-root]');
      try{await carousel.waitFor({state:'visible',timeout:8000});}
      catch{/* Assert below also records failures without stopping screenshot capture. */}
      check(await carousel.isVisible(),name+' verified full-text review ticker renders from approved manifest');
      check(await page.locator('[data-vp-reviews-root] .vp-review-card').count()===60,
        name+' approved 20-review data powers three continuous carousel copies');
      // New UI is still on this PR branch; test it against the actual locally
      // built HTML/JS in Chrome. The public alias keeps serving main until merge.
      if(viewport.width===390&&path.includes('buda-castle-ezraider-tour/')){
        const original=carousel.locator('.vp-review-group').nth(1).locator('.vp-review-card').first();
        const opener=original.locator('.vp-review-expand');
        check(await opener.count()===1,name+' can open the complete approved review');
        if(await opener.count()){
          const complete=(await original.locator('.vp-review-text').innerText()).trim();
          const realHref=await original.locator('.vp-review-bottom a[href]').getAttribute('href');
          await opener.click();
          const modal=page.locator('dialog.vp-review-dialog');
          try{await modal.waitFor({state:'visible',timeout:4000});}catch{}
          check(await modal.isVisible(),name+' full-review modal opens');
          if(await modal.isVisible()){
            check((await modal.locator('.vp-review-dialog-text').innerText()).trim()===complete,
              name+' modal shows the complete unchanged translated review');
            check(await modal.locator('.vp-review-dialog-link').getAttribute('href')===realHref,
              name+' full reader preserves authentic original-review link');
            await page.keyboard.press('Escape');
            check(!(await modal.isVisible()),name+' Escape closes full review');
            await page.waitForFunction(()=>document.activeElement?.classList.contains('vp-review-expand'),
              null,{timeout:2000}).catch(()=>{});
            check(await opener.evaluate(el=>document.activeElement===el),
              name+' closing review returns focus to opener');
          }
        }
      }
    }
    if(path==='/'){
      const proof=await page.evaluate(()=>{
        const root=document.querySelector('.parent-hero-mosaic');
        const cards=[...document.querySelectorAll('.parent-hero-destination')];
        const lower=document.querySelector('.network-manage-section .proof');
        const prior=document.querySelector('.network-value-section .content-grid .content-card:last-child');
        return {isMosaic:!!root,links:cards.map(a=>a.getAttribute('href')),
          captions:cards.map(a=>a.querySelector('.parent-hero-caption')?.textContent.trim()),
          imagesLoaded:cards.every(a=>a.querySelector('img')?.naturalWidth>0),
          labelsBelow:cards.every(a=>{
            const image=a.querySelector('img')?.getBoundingClientRect();
            const label=a.querySelector('.parent-hero-caption')?.getBoundingClientRect();
            return image&&label&&label.top>=image.bottom-1&&label.width>0;
          }),
          contained:cards.every(a=>{
            const box=a.getBoundingClientRect();
            const frame=root?.getBoundingClientRect();
            return frame&&box.width>0&&box.left>=frame.left-2&&box.right<=frame.right+2;
          }),
          supportLinks:[...document.querySelectorAll('.network-support-card .network-support-action')].map(a=>({href:a.getAttribute('href'),height:Math.round(a.getBoundingClientRect().height),width:Math.round(a.getBoundingClientRect().width)})),
          supportGrid:getComputedStyle(document.querySelector('.network-support-actions')).gridTemplateColumns.split(' ').filter(Boolean).length,
          supportContained:(()=>{
            const card=document.querySelector('.network-support-card');
            return card&&[...card.querySelectorAll('.network-support-action')].every(a=>{
              const b=a.getBoundingClientRect(),p=card.getBoundingClientRect();
              return b.left>=p.left-2&&b.right<=p.right+2;
            });
          })(),
          closingGap:lower&&prior?Math.round(lower.getBoundingClientRect().top-prior.getBoundingClientRect().bottom):999
        };
      });
      check(proof.isMosaic&&proof.links.join('|')==='/budapest/|/portugal/',name+' each home mosaic photo links to the correct destination');
      check(proof.captions.join('|')==='Hungary · Budapest|Portugal · Marvão',name+' uses one label directly under each relevant photo');
      check(proof.labelsBelow&&proof.contained,name+' captions sit beneath their images without mobile overflow');
      check(proof.imagesLoaded,name+' both real destination photos decode');
      check(proof.closingGap<=(viewport.width<=800?68:110),name+' network footer booking gap is compact ('+proof.closingGap+'px)');
      check(proof.supportLinks.length===2&&proof.supportLinks[0].href?.startsWith('https://wa.me/36300993099')&&
        proof.supportLinks[1].href==='mailto:support@voy-pro.com',
        name+' direct WhatsApp and email both live inside support card');
      check(proof.supportGrid===2&&proof.supportContained&&proof.supportLinks.every(a=>a.height>=44&&a.width>=44),
        name+' support channels are two readable accessible buttons contained at '+viewport.width+'px');
      if(viewport.width<=800){
        // The cookie preferences intentionally hide all floating CTAs.
        // Explicitly choose essential-only in this isolated browser to
        // exercise the actual floating-button interaction without analytics.
        const essential=page.locator('[data-consent-essential]');
        if(await essential.isVisible())await essential.click();
        check(await page.locator('.home-whatsapp').isVisible(),
          name+' floating WhatsApp is available after essential-only consent');
        const manageButton=page.locator('.network-manage-section .btn');
        await manageButton.scrollIntoViewIfNeeded();
        await page.waitForFunction(()=>document.body.classList.contains('home-manage-visible'),null,{timeout:3500});
        const collision=await page.evaluate(()=>{
          const manage=document.querySelector('.network-manage-section .btn');
          const whatsapp=document.querySelector('.home-whatsapp');
          const button=manage.getBoundingClientRect();
          const elem=document.elementFromPoint(button.left+button.width/2,button.top+button.height/2);
          return {hidden:getComputedStyle(whatsapp).visibility==='hidden',
            clickSafe:elem===manage||manage.contains(elem)};
        });
        check(collision.hidden&&collision.clickSafe,name+' floating WhatsApp cannot obstruct visible Manage Booking CTA');
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.waitForFunction(()=>!document.body.classList.contains('home-manage-visible'),null,{timeout:3500});
        // Wait for rendering as well as observer/class state; browser can
        // evaluate CSS in a different frame from the IntersectionObserver.
        await page.waitForFunction(()=>{
          const link=document.querySelector('.home-whatsapp');
          const style=link&&getComputedStyle(link);
          return !!link&&!document.body.classList.contains('home-manage-visible')&&
            style.visibility==='visible'&&style.display!=='none'&&
            Number(style.opacity)>0;
        },null,{timeout:2500}).catch(()=>{});
        const restored=await page.evaluate(()=>{
          const whatsapp=document.querySelector('.home-whatsapp');
          const style=whatsapp&&getComputedStyle(whatsapp);
          return {ok:!!whatsapp&&!document.body.classList.contains('home-manage-visible')&&
            style.visibility==='visible'&&style.display!=='none'&&Number(style.opacity)>0,
            display:style?.display,visibility:style?.visibility,opacity:style?.opacity,
            bodyClass:document.body.className,
            hasManageClass:document.body.classList.contains('home-manage-visible')};
        });
        check(restored.ok,name+' floating WhatsApp becomes visible again after Manage Booking leaves the viewport');
        if(!restored.ok)results.push('DIAGNOSTIC '+name+' restore '+JSON.stringify(restored));
      }
      for(const slug of ['budapest','portugal']){
        try{
          await page.locator('.parent-hero-destination--'+(slug==='portugal'?'marvao':slug)+' img').click({timeout:5000});
          check(new URL(page.url()).pathname==='/'+slug+'/',name+' clicking '+slug+' photo opens local destination');
          await page.goBack({waitUntil:'domcontentloaded',timeout:10000});
        }catch(error){check(false,name+' photo navigation '+slug+': '+String(error).slice(0,170));}
      }
    }
    if(path.startsWith('/he/'))check(metrics.direction==='rtl',name+' preserves Hebrew RTL direction');
    if(booking){
      check(await page.locator('#booking #availability-form').count()===1,name+' has one Budapest booking form');
      for(const key of ['experience','date','adults','children','babies']){
        check(await page.locator('#availability-form [name="'+key+'"]').count()===1,
          name+' booking form includes '+key);
      }
    }
    if(request){
      const requestForm=page.locator('#request [data-portugal-request-form]');
      check(await requestForm.count()===1,
        name+' has local Marvão request form');
      const routeLinks=page.locator('[data-portugal-tour]');
      check(await routeLinks.count()===3,
        name+' offers three local route request links');
      const route=requestForm.locator('select[name="route"]');
      const date=requestForm.locator('input[name="date"]');
      const people=requestForm.locator('select[name="people"]');
      const language=requestForm.locator('select[name="guide_language"]');
      check((await route.inputValue())===''&&(await language.inputValue())==='',
        name+' does not silently preselect route or guide language');
      check(JSON.stringify(await people.locator('option').evaluateAll(list=>list.map(x=>x.value)))===
        JSON.stringify(['2','3','4']),name+' requests only published 2–4 person group sizes');
      check(JSON.stringify(await language.locator('option').evaluateAll(list=>list.map(x=>x.value)))===
        JSON.stringify(['','en','pt']),name+' asks explicitly for local EN/PT guiding');
      check(/^\d{4}-\d{2}-\d{2}$/.test(await date.getAttribute('min')||''),
        name+' rejects dates before local request date');
      // Each public tour CTA must prefill the corresponding local form route.
      for(const code of ['express','explorer','megalithic']){
        const cta=page.locator('[data-portugal-tour="'+code+'"]');
        check(await cta.getAttribute('href')==='#request',name+' '+code+' links to local request form');
        await cta.click();
        check(await route.inputValue()===code,name+' '+code+' preselects the correct route');
      }
      const initialStatus=await requestForm.locator('[data-portugal-request-status]').innerText();
      await route.selectOption('express');
      await date.fill('2000-01-01');
      await language.selectOption('en');
      await requestForm.locator('input[name="full_name"]').fill('Browser fixture');
      // Bypass HTML native required validation only to exercise the site's
      // explicit past-date guard. This must never open WhatsApp or submit data.
      const prevented=await requestForm.evaluate(el=>{
        const ev=new Event('submit',{bubbles:true,cancelable:true});
        return !el.dispatchEvent(ev);
      });
      const changedStatus=await requestForm.locator('[data-portugal-request-status]').innerText();
      check(prevented&&changedStatus!==initialStatus&&changedStatus.length>5,
        name+' past date gives localized validation instead of sending a request');
      check(await date.inputValue()==='2000-01-01',name+' invalid preferred date stays editable');
      // Reproduce a mobile/desktop Marvão tab left open into the next Lisbon
      // calendar day. This cannot navigate to WhatsApp or contact real APIs.
      await page.clock.setFixedTime(new Date('2026-10-26T00:01:30.000Z'));
      await date.fill('2026-10-25');
      await date.blur();
      await date.focus();
      check(await date.getAttribute('min')==='2026-10-26',
        name+' overnight Lisbon calendar advances the displayed minimum');
      check(await date.inputValue()==='2026-10-25',
        name+' overnight guard preserves guest date for explicit correction');
      const originalUrl=page.url();
      const staleRequestPrevented=await requestForm.evaluate(el=>
        !el.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
      const message=await requestForm.locator('[data-portugal-request-status]').innerText();
      const expectedPastMessage=name.includes('-pt-')?'Escolha a data de hoje':
        name.includes('-he-')?'יש לבחור את התאריך':'Choose today or a future date';
      check(staleRequestPrevented&&message.includes(expectedPastMessage),
        name+' next-day past date is rejected with a localized status');
      check(page.url()===originalUrl&&
        await date.inputValue()==='2026-10-25',
        name+' rejected overnight date does not navigate or silently change');
    }
    if(b2b){
      const planner=page.locator('[data-b2b-planner="'+b2b+'"]');
      check(await planner.count()===1,
        name+' displays dedicated '+b2b+' B2B planner');
      const language=planner.locator('select[name="guide_language"]');
      const englishRow=planner.locator('.b2b-english-check');
      const english=planner.locator('input[name="english_ok"]');
      const decline=planner.locator('[data-b2b-english-decline]');
      check(await language.count()===1,name+' B2B planner asks for guide language');
      check(await english.count()===1&&await decline.count()===1,
        name+' offers explicit yes and no fallback choices');
      check(!(await english.isChecked()),name+' English fallback starts unanswered');
      check(!(await englishRow.isVisible())&&await english.isDisabled(),
        name+' English fallback is hidden until a non-English choice');
      await language.selectOption('he');
      check(await englishRow.isVisible()&&await english.isEnabled(),
        name+' non-English primary shows optional English question');
      await english.check();
      check(await english.isChecked(),name+' customer can explicitly accept alternative');
      await language.selectOption('hu');
      check(!(await english.isChecked())&&await english.isEnabled()&&
        await decline.getAttribute('aria-pressed')==='false',
        name+' changing non-English language clears previous acceptance');
      await decline.click();
      check(await decline.getAttribute('aria-pressed')==='true'&&!(await english.isChecked()),
        name+' customer can explicitly refuse English as a guide-language alternative');
      await english.check();
      check(await decline.getAttribute('aria-pressed')==='false',
        name+' opting into English clears explicit refusal');
      await language.selectOption('en');
      check(!(await english.isChecked())&&await english.isDisabled()&&
        !(await englishRow.isVisible())&&!(await decline.isVisible())&&
        await decline.getAttribute('aria-pressed')==='false',
        name+' English primary cannot inherit or duplicate either alternative choice');
    }
    if(rtb){
      // Exercise the actual progressive enhancement of all nine request-only
      // tour pages without sending any customer data or POSTing to a backend.
      const enquiry=page.locator('main form.voy-rtb-enquiry');
      await enquiry.waitFor({state:'visible',timeout:8000});
      check(await enquiry.count()===1,name+' has exactly one enhanced Request-to-Book enquiry');
      check(await page.evaluate(()=>window.__legacyRtbFormInsertions===0)&&
        await page.locator('[data-special-request-builder]').count()===0,
        name+' never renders even a transient deprecated WhatsApp form');
      const language=enquiry.locator('select[name="requested_guide_language"]');
      const fallback=enquiry.locator('input[name="english_alternative_accepted"]');
      const row=enquiry.locator('.voy-rtb-checkbox');
      const decline=enquiry.locator('[data-rtb-english-decline]');
      check(await language.count()===1&&await fallback.count()===1&&await decline.count()===1,
        name+' has requested guiding language plus yes/no/unknown English alternative');
      check(!(await fallback.isChecked())&&!(await row.isVisible()),
        name+' English fallback is initially unanswered and hidden');
      await language.selectOption('he');
      check(await row.isVisible()&&await decline.isVisible()&&
        await decline.getAttribute('aria-pressed')==='false',
        name+' non-English primary reveals unknown, explicit yes and no');
      await decline.click();
      check(await decline.getAttribute('aria-pressed')==='true'&&!(await fallback.isChecked()),
        name+' customer can explicitly decline English');
      await fallback.check();
      check(await fallback.isChecked()&&await decline.getAttribute('aria-pressed')==='false',
        name+' accepting English clears explicit refusal');
      await language.selectOption('hu');
      check(!(await fallback.isChecked())&&await decline.getAttribute('aria-pressed')==='false'&&
        await row.isVisible(),name+' primary-language change clears consent');
      await decline.click();
      await decline.click();
      check(await decline.getAttribute('aria-pressed')==='false'&&!(await fallback.isChecked()),
        name+' guest can return to unknown without falsely declining');
      await language.selectOption('en');
      check(!(await fallback.isChecked())&&!(await row.isVisible())&&
        !(await decline.isVisible()),name+' English primary hides alternative choices');
      const required=await enquiry.locator('[name="requested_date"],[name="requested_time"],[name="party_size"],[name="contact_name"]').count();
      check(required===4,name+' includes mandatory date/time/riders/contact details');
    }
    if(localWhatsApp){
      const links=await page.locator('a[href^="https://wa.me/"]').evaluateAll(anchors=>
        anchors.map(a=>a.href));
      check(links.length>0&&links.some(url=>url.startsWith('https://wa.me/'+localWhatsApp)),
        name+' has local '+localWhatsApp+' WhatsApp link');
      if(tourFloat){
        check(await page.locator('a.tour-floating-whatsapp[href^="https://wa.me/'+localWhatsApp+'"]').count()===1,
          name+' has destination-specific floating WhatsApp for request-only tour');
      }
    }
    if(heroImage){
      const hero=page.locator('.hero-photo-frame img').first();
      check(await hero.count()===1,name+' has a dedicated tour hero photo');
      if(await hero.count()){
        const loaded=await hero.evaluate(async img=>{
          try{await img.decode();return img.naturalWidth>0&&img.naturalHeight>0;}
          catch{return false;}
        });
        check(loaded,name+' tour hero photo decodes from the local built assets');
      }
    }
    await page.screenshot({path:join(out,name+'.png'),fullPage,animations:'disabled',timeout:20000});
    results.push('SCREENSHOT: '+name+'.png | '+viewport.width+'x'+viewport.height+' | '+metrics.lang+' | '+metrics.heading.slice(0,70));
    if(viewport.width<=1180){
      const menu=page.locator('.nav-menu-toggle');
      check(await menu.isVisible(),name+' mobile navigation control visible');
      if(await menu.isVisible()){
        await menu.click();
        const sheetOpened=await page.locator('#mobile-nav-sheet').isVisible();
        const expanded=await menu.getAttribute('aria-expanded');
        check(sheetOpened,name+' mobile sheet opens');
        check(expanded==='true',name+' menu reports expanded state');
        if(sheetOpened){
          check(await page.evaluate(()=>document.activeElement===document.querySelector('.mobile-nav-close')),
            name+' modal receives initial keyboard focus');
          await page.keyboard.press('Shift+Tab');
          check(await page.evaluate(()=>{
            const root=document.querySelector('#mobile-nav-sheet');
            return document.activeElement===Array.from(root.querySelectorAll('button,a[href]')).at(-1);
          }),name+' Shift+Tab wraps focus to last mobile nav link');
          await page.keyboard.press('Tab');
          check(await page.evaluate(()=>document.activeElement===document.querySelector('.mobile-nav-close')),
            name+' Tab wraps focus to modal close control');
        }
        if(!sheetOpened||expanded!=='true'){
          const diagnostic=await page.evaluate(()=>({
            menu:document.querySelector('.nav-menu-toggle')?.outerHTML,
            sheet:document.querySelector('#mobile-nav-sheet')?.outerHTML.slice(0,320),
            cssDisplay:getComputedStyle(document.querySelector('#mobile-nav-sheet')).display,
            bodyClass:document.body.className,
            onClick:typeof document.querySelector('.nav-menu-toggle')?.onclick,
            innerWidth:window.innerWidth,
            activeElement:document.activeElement?.outerHTML.slice(0,200)
          }));
          results.push('DIAGNOSTIC '+name+': '+JSON.stringify({diagnostic,runtimeErrors}).slice(0,2200));
        }
        await page.keyboard.press('Escape');
        check(!(await page.locator('#mobile-nav-sheet').isVisible()),name+' Escape closes menu');
        check(await menu.getAttribute('aria-expanded')==='false',name+' menu resets aria-expanded');
        check(await page.evaluate(()=>document.activeElement===document.querySelector('.nav-menu-toggle')),
          name+' Escape returns focus to original menu button');
      }
    }
    if(guide){
      check(await page.locator('.ez-context-toolbar [data-ez-context="back"]').count()===1,name+' has source-aware return link');
      check(await page.locator('.ez-destination-chooser').count()===1,name+' has destination chooser');
      const chooser=page.locator('section.ez-destination-chooser');
      check(await chooser.locator('.destination-card').count()===2 &&
        await chooser.locator('[data-ez-destination-card="budapest"]').count()===1 &&
        await chooser.locator('[data-ez-destination-card="marvao"]').count()===1,
        name+' only Budapest and Marvão use the network-home destination-card format');
      check(await page.locator('.ez-outro').count()===0 &&
        await page.locator('main [data-ez-context="booking"], main [data-ez-context="family"], main [data-ez-context="contact"]').count()===0,
        name+' removes the repeated destination calls above the final chooser');
      const guideRhythm=await page.evaluate(()=>{
        const section=document.querySelector('.ez-learning');
        const m=document.querySelector('.ez-manufacturer a');
        const seats=[...document.querySelectorAll('.ez-seat-model>a')];
        const columns=getComputedStyle(document.querySelector('.ez-destination-chooser .tour-choice-grid')).gridTemplateColumns.trim().split(' ').length;
        return {sectionPadding:parseFloat(getComputedStyle(section).paddingTop),
          manufacturer:parseFloat(getComputedStyle(m).fontSize),
          seats:seats.map(e=>parseFloat(getComputedStyle(e).fontSize)),
          columns};
      });
      check(guideRhythm.manufacturer<=13&&guideRhythm.seats.length===2&&guideRhythm.seats.every(x=>x<=13),
        name+' manufacturer and child-seat links are quieter editorial links');
      check(guideRhythm.sectionPadding<=(viewport.width<=620?30:45),
        name+' guide spacing compact at '+viewport.width+'px');
      check(guideRhythm.columns===(viewport.width<=800?1:2),
        name+' final destination cards reflow correctly');
    }
    if(tourGuide){
      const link=page.locator('a[data-ez-tour-guide]');
      check(await link.count()===1&&await link.isVisible(),
        name+' has one visible contextual EZRaider guide link');
      const sourcePath=new URL(page.url()).pathname;
      const lang=metrics.lang;
      const prefix=lang==='he'?'/he/':lang==='hu'?'/hu/':'/';
      const destination=prefix+'ezraider/?from=budapest&return_to='+encodeURIComponent(sourcePath);
      check(await link.getAttribute('href')===destination,
        name+' guide link preserves exact originating tour and Budapest branch');
      // Real navigation on representative EN, HE and HU pages, no live API.
      if(['heroes-he-mobile','citadella-hu-desktop','extended-en-mobile','budapest-en-private-mobile','budapest-he-groups-mobile','budapest-hu-corporate-desktop'].includes(name)){
        await link.click();
        await page.waitForURL(url=>url.pathname===prefix+'ezraider/',{timeout:8000});
        check(await page.locator('.ez-context-toolbar [data-ez-context="back"]').getAttribute('href')===sourcePath,
          name+' guide Back action returns exactly to tour');
        check(await page.locator('.ez-destination-chooser [data-ez-destination-card="budapest"] .tour-choice-actions a').getAttribute('href')===prefix+'budapest/',
          name+' only the final destination card routes Budapest visitors locally');
        const pt=await page.locator('[data-ez-language][hreflang="pt"]').first().getAttribute('href');
        check(pt?.includes('from=budapest')&&pt.includes('return_to='+encodeURIComponent(sourcePath)),
          name+' switching guide to Portuguese retains original tour context');
      }
    }
    // Silent JS failures can leave a page visually attractive but unusable.
    // All third-party requests are blocked, so only local page script errors
    // are counted; HTTP/network failures are intentionally not treated as JS errors.
    if(runtimeErrors.length){
      check(false,name+' has no uncaught JavaScript errors: '+runtimeErrors.join(' | ').slice(0,350));
      results.push('BROWSER ERRORS '+name+': '+runtimeErrors.join(' | ').slice(0,1200));
    }else check(true,name+' has no uncaught JavaScript errors');
    return page;
  }catch(e){
    failures++;results.push('FAIL: '+name+' browser error '+(e.stack||String(e)).slice(0,600));
    await page.close();
    return null;
  }
}
try{
  const desktop={width:1365,height:900},mobile={width:390,height:844},narrow={width:320,height:700};
  const budapest='36300993099',marvao='351935695004';
  // Sample the customer-facing funnel across source/destination, locale,
  // RTL, 320px narrow screens, classic booking, RTB and B2B enquiry.
  // These are smoke checks, not real payment/availability/API integrations.
  const scenarios=[
    ['home-desktop','/',desktop,{fullPage:true}],
    ['home-mobile','/',mobile,{fullPage:true}],
    ['home-narrow','/',narrow,{fullPage:true}],
    ['budapest-en-desktop','/budapest/',desktop,{booking:true,localWhatsApp:budapest}],
    ['budapest-en-mobile','/budapest/',mobile,{booking:true,localWhatsApp:budapest}],
    ['budapest-en-tablet','/budapest/',{width:1024,height:800},{booking:true,localWhatsApp:budapest}],
    ['budapest-he-mobile','/he/budapest/',mobile,{fullPage:true,booking:true,localWhatsApp:budapest}],
    ['budapest-hu-narrow','/hu/budapest/',narrow,{booking:true,localWhatsApp:budapest}],
    ['marvao-pt-mobile','/pt/portugal/',mobile,{fullPage:true,request:true,localWhatsApp:marvao}],
    ['marvao-pt-narrow','/pt/portugal/',narrow,{request:true,localWhatsApp:marvao}],
    ['marvao-he-mobile','/he/portugal/',mobile,{request:true,localWhatsApp:marvao}],
    ['marvao-en-desktop','/portugal/',desktop,{request:true,localWhatsApp:marvao}],
    ['budapest-he-family-mobile','/he/budapest/with-kids/',mobile,{booking:true,localWhatsApp:budapest}],
    ['budapest-hu-family-narrow','/hu/budapest/with-kids/',narrow,{booking:true,localWhatsApp:budapest}],
    ['budapest-buda-en-mobile','/budapest/tours/buda-castle-ezraider-tour/',mobile,{fullPage:true,booking:true,localWhatsApp:budapest}],
    ['budapest-buda-he-narrow','/he/budapest/tours/buda-castle-ezraider-tour/',narrow,{booking:true,localWhatsApp:budapest}],
    ['budapest-margaret-hu-mobile','/hu/budapest/tours/margaret-island-ezraider-tour/',mobile,{booking:true,localWhatsApp:budapest}],
    ['budapest-en-private-mobile','/budapest/private-tours/',mobile,{booking:true,tourGuide:true,localWhatsApp:budapest}],
    ['budapest-he-private-mobile','/he/budapest/private-tours/',mobile,{booking:true,tourGuide:true,localWhatsApp:budapest}],
    ['budapest-hu-private-narrow','/hu/budapest/private-tours/',narrow,{booking:true,tourGuide:true,localWhatsApp:budapest}],
    ['budapest-en-groups-mobile','/budapest/group-tours/',mobile,{booking:true,b2b:'group',tourGuide:true,localWhatsApp:budapest}],
    ['budapest-he-groups-mobile','/he/budapest/group-tours/',mobile,{booking:true,b2b:'group',tourGuide:true,localWhatsApp:budapest}],
    ['budapest-hu-groups-narrow','/hu/budapest/group-tours/',narrow,{booking:true,b2b:'group',tourGuide:true,localWhatsApp:budapest}],
    ['budapest-en-corporate-desktop','/budapest/corporate-events/',desktop,{booking:true,b2b:'corporate',tourGuide:true,localWhatsApp:budapest}],
    ['budapest-he-corporate-mobile','/he/budapest/corporate-events/',mobile,{booking:true,b2b:'corporate',tourGuide:true,localWhatsApp:budapest}],
    ['budapest-hu-corporate-desktop','/hu/budapest/corporate-events/',desktop,{booking:true,b2b:'corporate',tourGuide:true,localWhatsApp:budapest}],
    ['heroes-en-mobile','/budapest/tours/heroes-square-city-ezraider-tour/',mobile,{rtb:true,tourGuide:true,localWhatsApp:budapest,tourFloat:true,heroImage:true}],
    ['heroes-hu-narrow','/hu/budapest/tours/heroes-square-city-ezraider-tour/',narrow,{rtb:true,tourGuide:true,localWhatsApp:budapest,tourFloat:true,heroImage:true}],
    ['heroes-he-mobile','/he/budapest/tours/heroes-square-city-ezraider-tour/',mobile,{rtb:true,tourGuide:true,localWhatsApp:budapest,tourFloat:true,heroImage:true}],
    ['citadella-en-mobile','/budapest/tours/citadella-advanced-ezraider-tour/',mobile,{rtb:true,tourGuide:true,localWhatsApp:budapest,tourFloat:true,heroImage:true}],
    ['citadella-he-narrow','/he/budapest/tours/citadella-advanced-ezraider-tour/',narrow,{rtb:true,tourGuide:true,localWhatsApp:budapest,tourFloat:true,heroImage:true}],
    ['citadella-hu-desktop','/hu/budapest/tours/citadella-advanced-ezraider-tour/',desktop,{rtb:true,tourGuide:true,localWhatsApp:budapest,tourFloat:true,heroImage:true}],
    ['extended-en-mobile','/budapest/tours/buda-margaret-extended-tour/',mobile,{rtb:true,tourGuide:true,localWhatsApp:budapest,heroImage:true}],
    ['extended-he-mobile','/he/budapest/tours/buda-margaret-extended-tour/',mobile,{rtb:true,tourGuide:true,localWhatsApp:budapest,heroImage:true}],
    ['extended-hu-desktop','/hu/budapest/tours/buda-margaret-extended-tour/',desktop,{rtb:true,tourGuide:true,localWhatsApp:budapest,heroImage:true}],
    ['guide-en-mobile','/ezraider/?from=home&return_to=%2F',mobile,{fullPage:true,guide:true}],
    ['guide-pt-mobile','/pt/ezraider/?from=marvao-pt&return_to=%2Fpt%2Fportugal%2F',mobile,{fullPage:true,guide:true}],
    ['guide-he-mobile','/he/ezraider/?from=budapest&return_to=%2Fhe%2Fbudapest%2Ftours%2Fbuda-castle-ezraider-tour%2F',mobile,{guide:true}],
    ['guide-hu-desktop','/hu/ezraider/?from=budapest',desktop,{guide:true}]
  ];
  for(const [name,path,viewport,opts] of scenarios){
    const page=await visit(name,path,viewport,opts);
    if(!page)continue;
    try{
      // Browser regression: a WhatsApp link created on load must reflect the
      // latest tour and party selections when the customer opens the menu.
      // Values are changed in local DOM only; no availability/booking/API call.
      if(name==='budapest-en-mobile'){
        const oldUrl=await page.locator('#mobile-nav-sheet [data-mobile-nav-wa]').getAttribute('href');
        await page.evaluate(()=>{
          const form=document.querySelector('#availability-form');
          const experience=form.querySelector('[name="experience"]');
          const riders=form.querySelector('[name="adults"]');
          // The blocked external catalog can leave controls disabled or without
          // their remote options. Simulate an enabled, confirmed local selector,
          // without dispatching events or contacting the provider.
          if(![...experience.options].some(opt=>opt.value==='exp_bud_margaret'))
            experience.add(new Option('Margaret Island by EZRaider','exp_bud_margaret'));
          if(![...riders.options].some(opt=>opt.value==='4'))
            riders.add(new Option('4','4'));
          experience.disabled=false;
          riders.disabled=false;
          experience.value='exp_bud_margaret';
          riders.value='4';
        });
        await page.locator('.nav-menu-toggle').click();
        const freshUrl=await page.locator('#mobile-nav-sheet [data-mobile-nav-wa]').getAttribute('href');
        const message=freshUrl?new URL(freshUrl).searchParams.get('text')||'':'';
        check(freshUrl!==oldUrl&&freshUrl?.startsWith('https://wa.me/36300993099?text='),
          name+' WhatsApp menu URL refreshes after local tour/party change');
        check(message.includes('Margaret')&&message.includes('Independent riders: 4'),
          name+' WhatsApp message includes current selected tour and four riders (actual: '+message.slice(0,230)+')');
        await page.keyboard.press('Escape');
      }
      // Previously decided guests may leave the reopened privacy drawer
      // without converting "close" into analytics acceptance or refusal.
      // Check all supported destinations/locales with real keyboard behavior.
      const consentCopies={
        'home-mobile':'Close without changes',
        'marvao-pt-mobile':'Fechar sem alterações',
        'marvao-he-mobile':'סגירה ללא שינוי',
        'budapest-hu-narrow':'Bezárás módosítás nélkül'
      };
      if(consentCopies[name]){
        const essential=page.locator('[data-consent-essential]');
        if(await essential.isVisible()){
          check(await essential.getAttribute('aria-pressed')===null&&
            await page.locator('[data-consent-analytics]').getAttribute('aria-pressed')===null,
            name+' first-time cookie choice remains unselected');
          await essential.click();
        }
        const opener=page.locator('footer [data-cookie-settings]').first();
        await opener.click();
        const bar=page.locator('.consent-banner');
        const close=bar.locator('[data-consent-dismiss]');
        check(await bar.isVisible()&&await close.isVisible()&&
          (await close.innerText()).trim()===consentCopies[name],
          name+' reopened cookie choices offer localized close without changes');
        const saved=await page.evaluate(()=>localStorage.getItem('voy_consent_v1'));
        check(Boolean(saved),name+' original explicit essential consent is recorded');
        check(await bar.locator('[data-consent-essential]').getAttribute('aria-pressed')==='true'&&
          await bar.locator('[data-consent-analytics]').getAttribute('aria-pressed')==='false',
          name+' reopened dialog marks the saved essential choice, not analytics');
        check(await bar.locator('[data-consent-essential]').evaluate(el=>
          getComputedStyle(el).boxShadow!=='none'),
          name+' saved privacy choice is visibly distinguished');
        await close.click();
        check(await bar.isHidden(),name+' close button hides reopened preferences');
        check(await page.evaluate(()=>localStorage.getItem('voy_consent_v1'))===saved,
          name+' closing does not change original analytics consent');
        check(await opener.evaluate(el=>document.activeElement===el),
          name+' close restores keyboard focus to preferences opener');
        await opener.click();
        check(await bar.isVisible(),name+' footer reopens preferences after close');
        await page.keyboard.press('Escape');
        check(await bar.isHidden(),name+' Escape closes reopened preferences');
        check(await opener.evaluate(el=>document.activeElement===el),
          name+' Escape restores focus to preferences opener');
        check(await page.evaluate(()=>localStorage.getItem('voy_consent_v1'))===saved,
          name+' Escape preserves existing consent without analytics writes');
        // In the isolated local build every third-party API is blocked. Test
        // both saved decisions without creating any real tracking requests.
        await opener.click();
        await bar.locator('[data-consent-analytics]').click();
        const analyticsRecord=await page.evaluate(()=>localStorage.getItem('voy_consent_v1'));
        check(Boolean(analyticsRecord)&&JSON.parse(analyticsRecord).analytics===true,
          name+' explicit local analytics preference is stored when chosen');
        await opener.click();
        check(await bar.locator('[data-consent-analytics]').getAttribute('aria-pressed')==='true'&&
          await bar.locator('[data-consent-essential]').getAttribute('aria-pressed')==='false',
          name+' reopened dialog correctly marks saved analytics choice');
        await bar.locator('[data-consent-dismiss]').click();
        check(await page.evaluate(()=>localStorage.getItem('voy_consent_v1'))===analyticsRecord,
          name+' close preserves explicitly saved analytics decision unchanged');
        await opener.click();
        await bar.locator('[data-consent-essential]').click();
        check(await page.evaluate(()=>JSON.parse(localStorage.getItem('voy_consent_v1')).analytics)===false,
          name+' guest can revoke analytics and return to essential only');
      }
      if(name==='guide-pt-mobile'){
        const expected='/pt/portugal/';
        check(await page.locator('.ez-context-toolbar [data-ez-context="back"]').getAttribute('href')===expected,'PT Marvão guide back returns to PT branch');
        check(await page.locator('.ez-destination-chooser [data-ez-destination-card="marvao"] .tour-choice-actions a').getAttribute('href')==='/pt/portugal/','PT Marvão destination card opens localized local route information');
        await page.locator('.nav-menu-toggle').click();
        const sheet=page.locator('#mobile-nav-sheet');
        check(await sheet.locator('[data-mobile-language-row] [data-ez-language]').count()===4,'PT guide mobile offers four language links');
        check(await sheet.locator('[data-ez-context="back"]').getAttribute('href')===expected,'PT guide mobile back returns locally');
        check((await sheet.locator('[data-mobile-nav-wa]').getAttribute('href')||'').startsWith('https://wa.me/351935695004'),'PT guide mobile WhatsApp uses Portugal');
        const heHref=await sheet.locator('[data-ez-language][hreflang="he"]').getAttribute('href');
        check(heHref?.includes('from=marvao-pt')&&heHref?.includes('return_to=%2Fpt%2Fportugal%2F'),'PT mobile language switch retains source + exact return');
        await sheet.locator('[data-ez-language][hreflang="he"]').click();
        await page.waitForURL(url=>url.pathname==='/he/ezraider/',{timeout:10000});
        check(await page.locator('.ez-context-toolbar [data-ez-context="back"]').getAttribute('href')===expected,'Switching PT to HE retains original PT return page');
      }
      if(name==='guide-he-mobile'){
        const original='/he/budapest/tours/buda-castle-ezraider-tour/';
        check(await page.locator('.ez-context-toolbar [data-ez-context="back"]').getAttribute('href')===original,'HE tour guide desktop back retains exact tour page');
        await page.locator('.nav-menu-toggle').click();
        check(await page.locator('#mobile-nav-sheet [data-ez-context="back"]').getAttribute('href')===original,'HE tour guide mobile back retains exact tour page');
        check(await page.locator('#mobile-nav-sheet [data-ez-context="booking"]').getAttribute('href')==='/he/budapest/#booking','HE mobile booking stays in Budapest');
      }
    }catch(e){failures++;results.push('FAIL: '+name+' interaction error '+(e.stack||String(e)).slice(0,900));}
    finally{await page.close();}
  }
}finally{
  await browser.close();await new Promise(done=>server.close(done));
  const report=['# VOY PRO browser visual smoke report','','Local Chromium + built static dist. External API, WhatsApp, video and analytics calls intentionally blocked.','','','- Total failed checks: '+failures,'','',...results,''].join('\n');
  await writeFile(join(out,'report.md'),report);
  process.stdout.write(report+'\n');
}
if(failures>0)process.exitCode=1;
