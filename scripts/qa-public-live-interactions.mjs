// Browser behavior checks on public Staging HTML, with outbound writes blocked.
// Uses real Chrome and local browser-only destination fixtures; no FBM requests.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright';

const ORIGIN='https://voy-pro.com';
const API='https://ezraider-os-staging.vercel.app';
const OUT=resolve('visual-qa-output/public-live-interactions');
const EXPECTED_MAP='https://maps.app.goo.gl/F4DHtcpbWZrVjpqz5?g_st=ac';
const EXPECTED_PORTUGAL_MAP='https://maps.app.goo.gl/tfkNvDZNgaq3vN9LA?g_st=ac';
const REVIEW_HOSTS=['google.com','tripadvisor.com','tripadvisor.co.uk',
  'tripadvisor.co.il','tripadvisor.ie','getyourguide.com'];
const sitemap=await readFile('site/sitemap.xml','utf8');
const canonical=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]));
assert.ok(canonical.length>=40&&canonical.length<=80,'Unexpected canonical sitemap count');
assert.ok(canonical.every(u=>u.origin===ORIGIN&&
  /^\/(?:[a-z0-9-]+\/)*$/.test(u.pathname)&&!u.search&&!u.hash),
  'Canonical sitemap contains an unsafe URL');
const allowedDocuments=new Set([...canonical.map(u=>u.pathname),'/manage/']);
const browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{})});
await mkdir(OUT,{recursive:true});
const rows=[],violations=[];
let blocked=0,simulatedDestinationCalls=0;
const mapFixture={
  id:'budapest',configuration_version:2,booking_horizon_days:21,
  rider_policy:{
    standard_min_age:16,assessment_min_age:15,
    child_passenger_min_age:3,child_passenger_max_age:15,
    baby_passenger_min_age:1,baby_passenger_max_age:2
  },
  meeting_point:{
    address:'Városház utca 14, 1052 Budapest, Hungary',
    maps_url:EXPECTED_MAP
  }
};
function check(value,message){assert.ok(value,message);}
function failText(error){return String(error?.message||error).replace(/[\r\n]/g,' ').slice(0,330);}
function firstPartyAsset(req,u){
  return req.method()==='GET'&&!u.username&&!u.password&&!u.port&&(
    (/^(image|font|script|stylesheet|other)$/.test(req.resourceType())&&
      u.pathname.startsWith('/assets/'))||
    (req.resourceType()==='fetch'&&
      u.pathname==='/assets/budapest-approved-reviews.json')
  );
}
async function launch(path,{width=390,fixture=false,reducedMotion='reduce'}={}){
  check(allowedDocuments.has(path),'Test attempted unapproved public route: '+path);
  const context=await browser.newContext({
    viewport:{width,height:844},deviceScaleFactor:1,reducedMotion,
    serviceWorkers:'block',acceptDownloads:false
  });
  const outbounds=[];
  await context.route('**/*',async route=>{
    const req=route.request();
    let url;
    try{url=new URL(req.url());}catch{return route.abort('blockedbyclient');}
    // No network ever reaches the backend: only this exact GET returns a fixture.
    if(fixture&&req.method()==='GET'&&url.origin===API&&
       url.pathname==='/api/v1/destinations/budapest'&&!url.search){
      simulatedDestinationCalls++;
      return route.fulfill({
        status:200,
        headers:{'content-type':'application/json','access-control-allow-origin':ORIGIN},
        body:JSON.stringify(mapFixture)
      });
    }
    if(url.protocol==='https:'&&['voy-pro.com','www.voy-pro.com'].includes(url.hostname)&&
       !url.username&&!url.password&&!url.port){
      if(req.method()==='GET'&&req.resourceType()==='document'&&
         allowedDocuments.has(url.pathname)&&!url.search)return route.continue();
      if(firstPartyAsset(req,url))return route.continue();
    }
    blocked++;
    outbounds.push({method:req.method(),host:url.hostname,path:url.pathname});
    return route.abort('blockedbyclient');
  });
  const page=await context.newPage();
  const response=await page.goto(ORIGIN+path,{waitUntil:'domcontentloaded',timeout:20000});
  check(response?.status()===200,'Live '+path+' HTTP status != 200');
  const consent=page.locator('[data-consent-essential]');
  if(await consent.isVisible().catch(()=>false))await consent.click({timeout:2200});
  return {page,context,outbounds};
}
async function scenario(name,path,opts,verify){
  let session;
  const result={name,path,status:'fail',notes:[]};
  try{
    session=await launch(path,opts);
    const assertCase=(condition,message)=>{
      check(condition,message);result.notes.push(message);
    };
    await verify(session.page,assertCase,result,session.outbounds);
    check(!session.outbounds.some(r=>r.method!=='GET'),
      'App attempted an outbound write (blocked): '+JSON.stringify(session.outbounds.filter(x=>x.method!=='GET')));
    result.status='pass';
    console.log('PASS '+name);
  }catch(error){
    result.error=failText(error);
    violations.push(name+': '+result.error);
    console.error('FAIL '+name+' — '+result.error);
  }finally{
    rows.push(result);
    await session?.context.close().catch(()=>{});
  }
}
// Check the *deployed* consent UI after a visitor has explicitly chosen
// essential-only storage. Closing reopened settings must not change consent
// or leak events to analytics; outbound writes remain blocked by launch().
for(const [locale,path,closeLabel] of [
  ['EN','/','Close without changes'],
  ['HE','/he/budapest/','סגירה ללא שינוי'],
  ['HU','/hu/budapest/','Bezárás módosítás nélkül'],
  ['PT','/pt/portugal/','Fechar sem alterações']
]){
  await scenario('public privacy close '+locale,path,{width:390},
    async(page,ok,result)=>{
      await page.waitForFunction(()=>
        document.querySelector('footer [data-cookie-settings]')&&
        document.documentElement.dataset.analyticsConsent,
        null,{timeout:6500});
      const essential=page.locator('[data-consent-essential]');
      let saved=await page.evaluate(()=>localStorage.getItem('voy_consent_v1'));
      if(!saved){
        await essential.waitFor({state:'visible',timeout:4500});
        ok(await page.locator('[data-consent-dismiss]').count()===0,
          'first-time consent UI cannot be dismissed without a choice');
        await essential.click();
        saved=await page.evaluate(()=>localStorage.getItem('voy_consent_v1'));
      }
      ok(Boolean(saved)&&JSON.parse(saved).analytics===false,
        'guest explicitly chose essential-only storage');
      const open=page.locator('footer [data-cookie-settings]').first();
      await open.click();
      const bar=page.locator('.consent-banner');
      const close=bar.locator('[data-consent-dismiss]');
      ok(await bar.isVisible()&&await close.isVisible(),
        'reopening preferences offers a neutral Close choice');
      ok((await close.innerText()).trim()===closeLabel,
        'close label matches the page language');
      const selected=bar.locator('[data-consent-essential]');
      const unselected=bar.locator('[data-consent-analytics]');
      ok(await selected.getAttribute('aria-pressed')==='true'&&
        await unselected.getAttribute('aria-pressed')==='false',
        'reopened privacy dialog identifies essential as the saved choice');
      ok(await selected.evaluate(el=>getComputedStyle(el).boxShadow!=='none'),
        'selected preference has a visible distinction as well as aria-pressed');
      await bar.screenshot({
        path:join(OUT,'privacy-current-choice-'+locale.toLowerCase()+'.png'),
        animations:'disabled'
      });
      await close.click();
      ok(await bar.isHidden()&&
        await page.evaluate(()=>localStorage.getItem('voy_consent_v1'))===saved,
        'clicking Close preserves analytics and marketing consent');
      ok(await open.evaluate(el=>document.activeElement===el),
        'focus returns to the preferences opener after Close');
      await open.click();
      await essential.waitFor({state:'visible',timeout:4500});
      ok(await bar.locator('[data-consent-essential]').getAttribute('aria-pressed')==='true'&&
        await bar.locator('[data-consent-analytics]').getAttribute('aria-pressed')==='false',
        'previously saved choice is still shown when settings reopen');
      await page.keyboard.press('Escape');
      ok(await bar.isHidden()&&
        await page.evaluate(()=>localStorage.getItem('voy_consent_v1'))===saved,
        'Escape dismisses reopened preferences without changing consent');
      ok(await open.evaluate(el=>document.activeElement===el),
        'keyboard Escape restores focus to the footer opener');
      result.notes.push('No analytics opt-in or network writes performed.');
    });
}
// Live mobile nav: real pointer and keyboard behavior in 3 locales.
// Existing offline QA covers more pages; this catches deployed runtime regressions.
for(const [locale,path] of [
  ['EN','/budapest/'],['HE','/he/budapest/'],['PT','/pt/portugal/']
]){
  await scenario('mobile menu '+locale,path,{width:390},async(page,ok)=>{
    const button=page.locator('.nav-menu-toggle');
    const modal=page.locator('#mobile-nav-sheet');
    ok(await button.isVisible(),'menu opener visible');
    await button.click();
    ok(await modal.isVisible(),'mobile menu opens');
    await modal.screenshot({path:join(OUT,'mobile-menu-'+locale.toLowerCase()+'.png'),animations:'disabled'});
    ok(await button.getAttribute('aria-expanded')==='true','accessible expanded state');
    ok(await page.evaluate(()=>document.activeElement?.classList.contains('mobile-nav-close')),
      'initial focus in modal');
    const links=await modal.locator('a[href]').evaluateAll(nodes=>nodes.map(a=>a.getAttribute('href')));
    ok(links.some(h=>h.startsWith('/budapest/')||h.startsWith('/he/budapest/')),
      'Budapest destination reachable');
    ok(links.some(h=>h.startsWith('/portugal/')||h.startsWith('/pt/portugal/')||
      h.startsWith('/he/portugal/')),'Portugal destination reachable');
    await page.keyboard.press('Escape');
    ok(!(await modal.isVisible()),'Escape closes menu');
    ok(await button.getAttribute('aria-expanded')==='false','expanded state reset');
    ok(await page.evaluate(()=>document.activeElement?.classList.contains('nav-menu-toggle')),
      'focus returned to opener');
    await button.click();
    await page.locator('#mobile-nav-sheet .mobile-nav-close').click();
    ok(!(await modal.isVisible()),'close button works');
  });
}
// Real approved review ticker: verify approved material, URLs, and user controls.
// reducedMotion=no-preference exposes pause/resume; nothing opens vendor URLs.
for(const [locale,path] of [
  ['EN','/budapest/'],['HE','/he/budapest/'],['HU','/hu/budapest/']
]){
  await scenario('reviews '+locale,path,{width:390,reducedMotion:'no-preference'},async(page,ok,result)=>{
    const root=page.locator('[data-vp-reviews-root]');
    await page.waitForFunction(()=>document.querySelectorAll('[data-vp-reviews-root] .vp-review-card').length===60,
      null,{timeout:6500});
    ok(await root.isVisible(),'approved ticker visible');
    await root.screenshot({path:join(OUT,'approved-reviews-'+locale.toLowerCase()+'.png'),animations:'disabled'});
    const cards=page.locator('[data-vp-reviews-root] .vp-review-card');
    ok(await cards.count()===60,'exactly 20 reviews, three seamless copies');
    const links=await root.locator('.vp-review-card a[href]').evaluateAll(nodes=>
      nodes.map(a=>a.getAttribute('href')));
    ok(links.length===60&&links.every(value=>{
      try{const u=new URL(value);return u.protocol==='https:'&&REVIEW_HOSTS.some(host=>
        u.hostname===host||u.hostname.endsWith('.'+host));}catch{return false;}
    }),'all 60 review source links use trusted platforms');
    const quotes=await cards.locator('.vp-review-text').allTextContents();
    ok(quotes.slice(0,20).every(q=>q.trim().length>=35),'full-length review text');
    // PR #529 is now deployed on the public Staging alias; this must also
    // pass for every future PR (not merely the weekly/manual run).
      // The entire approved review must be readable without scrolling a
      // tiny inner text pane. No external original-review URL is opened.
      const original=root.locator('.vp-review-group').nth(1).
        locator('.vp-review-card').first();
      const full=await original.locator('.vp-review-text').innerText();
      const originalHref=await original.locator('.vp-review-bottom a[href]').getAttribute('href');
      const expand=original.locator('.vp-review-expand');
      ok(await expand.count()===1,'explicit full-review reading control exists');
      const pauseBeforeRead=root.locator('[data-vp-reviews-pause]');
      if(await pauseBeforeRead.getAttribute('aria-pressed')!=='true')await pauseBeforeRead.click();
      ok(await pauseBeforeRead.getAttribute('aria-pressed')==='true','reader can pause the moving reviews before selecting one');
      await expand.scrollIntoViewIfNeeded({timeout:4000});
      await expand.click({timeout:5500});
      const dialog=page.locator('dialog.vp-review-dialog');
      await dialog.waitFor({state:'visible',timeout:3500});
      ok((await dialog.locator('.vp-review-dialog-text').innerText()).trim()===full.trim(),
        'modal displays full approved review without truncation');
      ok(await dialog.locator('.vp-review-dialog-link').getAttribute('href')===originalHref,
        'modal retains authentic source URL');
      await dialog.screenshot({path:join(OUT,'full-review-dialog-'+locale.toLowerCase()+'.png'),
        animations:'disabled'});
      await page.keyboard.press('Escape');
      ok(!(await dialog.isVisible()),'Escape closes complete-review dialog');
      ok(await expand.evaluate(el=>document.activeElement===el),'modal restores opener focus');

    const pause=root.locator('[data-vp-reviews-pause]');
    ok(await pause.isVisible(),'pause control accessible');
    if(await pause.getAttribute('aria-pressed')==='true')await pause.click();
    await pause.click();
    ok(await pause.getAttribute('aria-pressed')==='true','pause updates aria state');
    const before=await root.locator('[data-vp-reviews-viewport]').evaluate(el=>el.scrollLeft);
    await root.locator('[data-vp-reviews-right]').click();
    const after=await root.locator('[data-vp-reviews-viewport]').evaluate(el=>el.scrollLeft);
    ok(Math.abs(after-before)>5,'manual arrow scroll changes position');
    await pause.click();
    ok(await pause.getAttribute('aria-pressed')==='false','resume updates aria state');
  });
}
// Map verification uses the public deployed site.js, with an in-browser FBM
// fixture for the destination config. No third-party map iframe is loaded.
await scenario('Budapest exact business map rendered using API fixture',
  '/budapest/',{width:390,fixture:true},async(page,ok,result)=>{
    await page.waitForSelector('[data-branch-meeting-point] .meeting-point-button',
      {timeout:6500,state:'attached'});
    const link=page.locator('[data-branch-meeting-point] .meeting-point-button');
    ok(await link.getAttribute('href')===EXPECTED_MAP,'official business link exact');
    const frame=page.locator('[data-branch-meeting-point] iframe.meeting-map-frame');
    const raw=await frame.getAttribute('src');
    const src=new URL(raw);
    ok(src.origin==='https://www.google.com'&&src.pathname==='/maps/embed',
      'Google embed is a business-specific map');
    const pb=src.searchParams.get('pb')||'';
    ok(pb.includes('0x0:0xbfcd8e3fb5a649b5')&&pb.includes('47.4944')&&pb.includes('19.0552'),
      'correct Google business CID and coordinates');
    ok(await page.locator('[data-branch-meeting-point] .meeting-map-label').innerText()
      .then(x=>x.includes('EZRaider Budapest by Voy PRO')),
      'correct business label on displayed map');
    await page.locator('[data-branch-meeting-point] .meeting-point-copy').screenshot({path:join(OUT,'budapest-meeting-details.png'),animations:'disabled'});
    result.notes.push('FBM destination GET was fulfilled from a local fixture; no live FBM integration asserted.');
  });
await scenario('Marvao public meeting map markup',
  '/pt/portugal/',{width:390},async(page,ok)=>{
    await page.waitForSelector('[data-branch-meeting-point] .meeting-point-button',
      {timeout:6500,state:'attached'});
    ok(await page.locator('[data-branch-meeting-point] .meeting-point-button').getAttribute('href')===
      EXPECTED_PORTUGAL_MAP,'Marvao direct business Maps link unchanged');
    const map=page.locator('[data-branch-meeting-point] iframe.meeting-map-frame');
    ok(await map.count()===1,'meeting map iframe created');
    const raw=await map.getAttribute('src');
    ok(Boolean(raw)&&/^https:\/\//.test(raw),'map iframe has HTTPS source (remote iframe deliberately blocked)');
  });
// Verify the *deployed* Marvão manual WhatsApp handoff copy and validation.
// Never open WhatsApp or send the guest's message: only exercise a past-date
// validation case with synthetic data. The route requests remain human-approved.
for(const [locale,path,copy] of [
  ['EN','/portugal/',{
    button:'Continue to WhatsApp',send:'Tap Send in WhatsApp',
    approval:'not booked until our team confirms',past:'Choose today or a future date.'
  }],
  ['PT','/pt/portugal/',{
    button:'Continuar no WhatsApp',send:'Toque em Enviar no WhatsApp',
    approval:'só fica reservado após a nossa confirmação',
    past:'Escolha a data de hoje ou uma data futura.'
  }],
  ['HE','/he/portugal/',{
    button:'המשך ל־WhatsApp',send:'יש ללחוץ על שליחה ב־WhatsApp',
    approval:'הסיור יוזמן רק לאחר אישור מאיתנו',
    past:'יש לבחור את התאריך של היום או תאריך עתידי.'
  }]
]){
  await scenario('Marvao request handoff '+locale,path,{width:390},
    async(page,ok,result,outbounds)=>{
      const form=page.locator('#request [data-portugal-request-form]');
      const btn=form.locator('button[type="submit"]');
      const note=form.locator('[data-portugal-request-status]');
      ok(await form.count()===1&&await btn.count()===1,
        'public page has exactly one Marvao enquiry form and submit control');
      ok((await btn.innerText()).trim()===copy.button,
        'button describes continuing to WhatsApp, not an already sent enquiry');
      const intro=await note.innerText();
      ok(intro.includes(copy.send)&&intro.includes(copy.approval),
        'localized instructions require tapping Send and local confirmation');
      ok(await note.getAttribute('role')==='status'&&
        await note.getAttribute('aria-live')==='polite',
        'request help text is accessible as a live status');
      const route=form.locator('select[name="route"]');
      for(const code of ['express','explorer','megalithic']){
        const link=page.locator('[data-portugal-tour="'+code+'"]');
        ok(await link.count()===1,'one dedicated link for '+code);
        await link.click();
        ok(await route.inputValue()===code,
          'request CTA chooses the requested '+code+' tour');
      }
      await route.selectOption('express');
      const date=form.locator('[name="date"]');
      ok(/^\d{4}-\d{2}-\d{2}$/.test(await date.getAttribute('min')||''),
        'Portugal-local calendar date is set as minimum');
      await date.fill('2000-01-01');
      await form.locator('[name="guide_language"]').selectOption('en');
      await form.locator('[name="full_name"]').fill('Synthetic QA Guest');
      const before=page.url();
      const prevented=await form.evaluate(el=>
        !el.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
      ok(prevented,'expired request submission is prevented');
      ok((await note.innerText()).includes(copy.past),
        'expired date displays localized validation instead of leaving website');
      ok(page.url()===before&&
        !outbounds.some(x=>x.method!=='GET'),
        'invalid enquiry does not trigger a navigation or network write');
      await note.screenshot({
        path:join(OUT,'marvao-invalid-date-'+locale.toLowerCase()+'.png'),
        animations:'disabled'
      });
      result.notes.push('No real WhatsApp contact, booking or payment attempted.');
    });
}
// Test a valid Marvão enquiry all the way to its *attempted* WhatsApp
// navigation, with browser fetches intercepted in-memory. The global route
// guard aborts wa.me before any external network request is sent, and this
// scenario never opens or sends an actual WhatsApp chat/message.
for(const [locale,path,routeName,dateLabel] of [
  ['EN','/portugal/','Vila de Marvão Express Tour','Preferred date'],
  ['PT','/pt/portugal/','Vila de Marvão Express Tour','Data preferida'],
  ['HE','/he/portugal/','Vila de Marvão Express Tour','תאריך מועדף']
]){
  await scenario('Marvao valid WhatsApp handoff '+locale,path,{width:390},
    async(page,ok,result,outbounds)=>{
      const form=page.locator('#request [data-portugal-request-form]');
      await form.waitFor({state:'visible',timeout:6000});
      // A best-effort session write may normally be attempted, but must not
      // gate a customer's chat. Stall every in-page fetch before entering any
      // fake information: no fetch can touch a backend in this scenario.
      await page.evaluate(()=>{
        window.fetch=()=>new Promise(()=>{});
      });
      const dateField=form.locator('[name="date"]');
      const min=await dateField.getAttribute('min');
      ok(/^\d{4}-\d{2}-\d{2}$/.test(min||''),
        'actual deployed page exposes Portugal-local request date minimum');
      const future=new Date(Date.parse(min+'T12:00:00Z')+3*86400000)
        .toISOString().slice(0,10);
      await form.locator('[name="route"]').selectOption('express');
      await dateField.fill(future);
      await form.locator('[name="people"]').selectOption('4');
      await form.locator('[name="guide_language"]').selectOption('en');
      await form.locator('[name="full_name"]').fill('Synthetic QA Guest');
      await form.locator('[name="notes"]').fill('QA synthetic group, do not send');
      const request=page.waitForRequest(req=>
        req.url().startsWith('https://wa.me/351935695004?text='),
        {timeout:6500});
      // Dispatch in a future browser task so the test has already returned
      // before its JS context is destroyed by the attempted external nav.
      await form.evaluate(el=>{
        setTimeout(()=>el.dispatchEvent(
          new Event('submit',{bubbles:true,cancelable:true})),0);
      });
      const outbound=await request;
      const target=new URL(outbound.url());
      ok(target.protocol==='https:'&&target.hostname==='wa.me'&&
        target.pathname==='/351935695004',
        'only the verified Marvao WhatsApp number is the external handoff');
      const msg=target.searchParams.get('text')||'';
      ok(msg.includes(routeName)&&msg.includes('Synthetic QA Guest')&&
        msg.includes('QA synthetic group, do not send')&&
        msg.includes('4')&&msg.includes(path),
        'prepared WhatsApp text includes selected tour, party, name, notes and source locale');
      ok(msg.includes(dateLabel+':')&&
        (locale==='EN'?msg.includes(future):msg.includes(future.slice(0,4))&&
          msg.includes(String(Number(future.slice(8,10))))),
        'correct localized date label and requested future date are preserved');
      // Playwright emits Request before the async context.route callback
      // finishes writing its abort audit record. Wait for that record rather
      // than weakening the required external-block invariant.
      for(let attempt=0;attempt<50;attempt++){
        if(outbounds.some(x=>x.host==='wa.me'&&x.path==='/351935695004'))break;
        await new Promise(resolve=>setTimeout(resolve,25));
      }
      ok(!outbounds.some(x=>x.method!=='GET'),
        'no real booking, backend session write or payment request was made');
      ok(outbounds.some(x=>x.host==='wa.me'&&x.path==='/351935695004'),
        'WhatsApp navigation was intercepted and explicitly blocked before network');
      result.notes.push('Synthetic data only. Stalled in-page fetch; WhatsApp navigation aborted by global browser network guard. No message sent.');
    });
}
// Booking preflight only: change group composition, never submit or create a hold.
// All remote API requests remain blocked. Full mocked booking flow has its own CI suite.
await scenario('Budapest booking composition preflight',
  '/budapest/',{width:390},async(page,ok,result)=>{
    const form=page.locator('#availability-form');
    ok(await form.count()===1,'booking form present');
    for(const key of ['experience','date','adults','children','babies']){
      ok(await form.locator('[name="'+key+'"]').count()===1,key+' field present');
    }
    const submit=form.locator('button[type="submit"]');
    ok(await submit.count()===1,'availability search control available');
    ok(await page.locator('#slotlist').innerText()==='','no invented live slots before search');
    const riders=form.locator('select[name="adults"]');
    const children=form.locator('select[name="children"]');
    await riders.selectOption('2');
    await children.selectOption('1');
    const preview=form.locator('[data-group-composition-preview]');
    await preview.waitFor({timeout:4000,state:'visible'});
    ok((await preview.innerText()).includes('3'),'group summary updates after quantity change');
    ok(await page.locator('#slotlist').innerText()==='','no hold or times manufactured without backend');
    await form.screenshot({path:join(OUT,'booking-group-preflight.png'),animations:'disabled'});
    result.notes.push('No form submission, no live price, no Stripe action, no customer record.');
  });
// Read-only, deployed manual WhatsApp planners: verify all three
// English-alternative states without clicking the WhatsApp send action.
// This tests public HTML/JS, not the unapproved canonical FBM v2 consent flow.
for(const [lang,prefix] of [['en',''],['he','/he'],['hu','/hu']]){
  for(const type of ['group-tours','corporate-events']){
    const path=prefix+'/budapest/'+type+'/';
    await scenario('B2B English preference '+lang+' '+type,
      path,{width:390},async(page,ok)=>{
        const planner=page.locator('form[data-b2b-planner]');
        ok(await planner.count()===1,'single manual enquiry planner');
        const guide=planner.locator('select[name="guide_language"]');
        const yes=planner.locator('input[name="english_ok"]');
        const no=planner.locator('[data-b2b-english-decline]');
        const yesRow=planner.locator('.b2b-english-check');
        ok(await guide.count()===1&&await yes.count()===1&&await no.count()===1,
          'requested guide language and separate yes/no choices');
        ok(!(await yes.isChecked())&&await yes.isDisabled()&&
           !(await yesRow.isVisible())&&!(await no.isVisible()),
          'English primary hides alternatives with unanswered initial state');
        await guide.selectOption('he');
        ok(await yesRow.isVisible()&&await no.isVisible()&&
           !(await yes.isChecked())&&await no.getAttribute('aria-pressed')==='false',
          'non-English choice exposes separate unanswered options');
        await no.click();
        ok(await no.getAttribute('aria-pressed')==='true'&&!(await yes.isChecked()),
          'explicit rejection is distinct from unknown');
        await yes.check();
        ok(await no.getAttribute('aria-pressed')==='false'&&await yes.isChecked(),
          'accepting English clears previous rejection');
        await guide.selectOption('hu');
        ok(!(await yes.isChecked())&&await no.getAttribute('aria-pressed')==='false',
          'changing primary language revokes previous English consent');
        await no.click();
        await guide.selectOption('en');
        ok(await yes.isDisabled()&&!(await no.isVisible())&&
           await no.getAttribute('aria-pressed')==='false',
          'returning to English revokes prior rejection');
        // Revisit after the language switches to capture truthful clean UI
        // rather than leaving the control with a hidden selected value.
        await guide.selectOption('he');
        await planner.locator('.b2b-english-decline').screenshot({
          path:join(OUT,'b2b-language-choice-'+lang+'-'+type+'.png'),
          animations:'disabled'
        });
        ok(await planner.locator('[data-b2b-open]').count()===1,
          'WhatsApp handoff button exists but is never clicked in live CI');
      });
  }
}
// Verify the *deployed* request-only pages after RTB tri-state release.
// Fill exclusively synthetic QA input. An unanswered English alternative must
// create no request UUID/POST and must offer guest-controlled manual contact.
// This is not proof that the separately disabled relay/FBM intake works.
for(const [language,prefix] of [['en',''],['he','/he'],['hu','/hu']]){
  for(const routeName of [
    'heroes-square-city-ezraider-tour',
    'citadella-advanced-ezraider-tour',
    'buda-margaret-extended-tour'
  ]){
    const path=prefix+'/budapest/tours/'+routeName+'/';
    await scenario('RTB English tri-state '+language+' '+routeName,
      path,{width:390},async(page,ok,result)=>{
        const form=page.locator('main form.voy-rtb-enquiry');
        await form.waitFor({state:'visible',timeout:8500});
        const languageField=form.locator('[name="requested_guide_language"]');
        const yes=form.locator('[name="english_alternative_accepted"]');
        const no=form.locator('[data-rtb-english-decline]');
        const yesRow=form.locator('.voy-rtb-checkbox');
        ok(await languageField.count()===1&&await yes.count()===1&&await no.count()===1,
          'guide preference plus three-state alternative controls present');
        ok(!(await yesRow.isVisible())&&!(await no.isVisible()),
          'an unset requested language never infers English consent');
        await languageField.selectOption('he');
        ok(await yesRow.isVisible()&&await no.isVisible()&&
          !(await yes.isChecked())&&await no.getAttribute('aria-pressed')==='false',
          'Hebrew request starts with unknown English alternative');
        if(routeName==='heroes-square-city-ezraider-tour'){
          await no.screenshot({path:join(OUT,'rtb-english-decline-'+language+'.png'),
            animations:'disabled'});
        }
        await no.click();
        ok(await no.getAttribute('aria-pressed')==='true'&&!(await yes.isChecked()),
          'original-language-only is explicitly selected');
        await yes.check();
        ok(await yes.isChecked()&&await no.getAttribute('aria-pressed')==='false',
          'English approval clears explicit refusal');
        await languageField.selectOption('hu');
        ok(!(await yes.isChecked())&&await no.getAttribute('aria-pressed')==='false',
          'a language switch invalidates previous permission');
        await no.click();
        await no.click();
        ok(!(await yes.isChecked())&&await no.getAttribute('aria-pressed')==='false',
          'decline can be reversed to unknown');
        // Use real native validation and safe synthetic strings. If this
        // accidentally sends a POST the network guard fails the scenario.
        const date=form.locator('[name="requested_date"]');
        const min=await date.getAttribute('min');
        ok(/^\d{4}-\d{2}-\d{2}$/.test(min||''),'Budapest local min date is set');
        const future=await date.evaluate(el=>{
          const base=Date.parse(el.min+'T12:00:00Z');
          return new Date(base+7*86400000).toISOString().slice(0,10);
        });
        await date.fill(future);
        await form.locator('[name="requested_time"]').fill('13:00');
        await form.locator('[name="contact_name"]').fill('Synthetic QA Guest');
        await form.locator('[name="contact_email"]').fill('qa@example.invalid');
        const submit=form.locator('button[type="submit"]');
        await submit.click({timeout:3500});
        const link=form.locator('[data-rtb-manual]');
        await link.waitFor({state:'attached',timeout:3000});
        ok((await link.getAttribute('href')).startsWith('https://wa.me/'),
          'unknown guest receives manual guest-clicked WhatsApp link');
        const message=new URL(await link.getAttribute('href')).searchParams.get('text')||'';
        const unknownMarker=language==='he'?'לא נענתה השאלה'
          :language==='hu'?'Nincs válasz':'Not answered';
        ok(message.includes(unknownMarker),
          'manual handoff labels unknown without inventing refusal');
        result.notes.push('No real contact submitted, and the WhatsApp link was not opened.');
      });
  }
}
await browser.close();
const summary={
  time:new Date().toISOString(),
  mode:'live public website UI; all third-party service requests blocked; Budapest map uses in-browser fixture',
  scenarios:rows.length,passed:rows.filter(x=>x.status==='pass').length,
  failed:violations.length,blockedRequests:blocked,simulatedDestinationCalls,rows
};
await writeFile(join(OUT,'results.json'),JSON.stringify(summary,null,2));
await writeFile(join(OUT,'report.md'),[
  '# VOY PRO — public live interactions',
  '',
  '**Checked:** '+summary.time,
  '**Outcome:** '+summary.passed+'/'+summary.scenarios+' passed, '+summary.failed+' failed.',
  '**Safety:** anonymous browser, no real FBM, Stripe, external Maps requests, form submissions or payments.',
  '**Blocked outbound requests:** '+blocked,
  '**Mocked Budapest destination responses:** '+simulatedDestinationCalls,
  '',
  '## Scenarios',
  ...rows.map(r=>'- **'+r.status.toUpperCase()+'** '+r.name+(r.error?' — '+r.error:'')),
  '',
  '## Limitations',
  'External map imagery, partner sites, real availability, card payments and a complete paid booking are deliberately outside this test.',
  'Map markup is checked with a FBM destination fixture; it is not evidence that the actual backend currently responds.',
  'The artifact includes B2B explicit guiding-language preference screenshots without PII, plus menu, approved reviews, map label and booking preflight.',
  'This test does not authorize public Production separation, indexing or any DNS/alias changes.',
  ''
].join('\n'));
if(violations.length)process.exitCode=1;
