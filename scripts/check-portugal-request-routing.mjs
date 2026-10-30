import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('site/assets/site.js','utf8');
const start=source.indexOf('function bindPortugalRequestFlow()');
const end=source.indexOf('  bindPortugalRequestFlow();',start);
assert.ok(start>=0&&end>start,'Portugal availability request handler missing');
const handler=source.slice(start,end);
assert.ok(!handler.includes('wa.me/36300993099'),'Portuguese request handler must not use Hungarian number');
assert.ok(handler.includes("https://wa.me/351935695004?text="),'Portuguese number missing');

for(const locale of ['en','pt','he']){
  const staticPage=locale==='en'?'site/portugal/index.html':'site/'+locale+'/portugal/index.html';
  const html=fs.readFileSync(staticPage,'utf8');

  // Current-language accessibility: exactly one semantically current locale,
  // matching the visibly selected link, on each Marvão request-first page.
  const languageLinks=[...html.matchAll(/<a\b[^>]*class="[^"]*\blang-switch\b[^"]*"[^>]*>/g)]
    .map(match=>match[0]);
  const selected=languageLinks.filter(link=>
    /\bactive\b/.test((link.match(/\bclass="([^"]+)"/)||[])[1]||''));
  const current=languageLinks.filter(link=>/\baria-current="page"/.test(link));
  const expectedCurrent=locale==='en'?'/portugal/':'/'+locale+'/portugal/';
  assert.equal(languageLinks.length,3,locale+': Marvão must offer EN/PT/HE links');
  assert.equal(selected.length,1,locale+': exactly one visible current language');
  assert.equal(current.length,1,locale+': exactly one ARIA current page language');
  assert.equal(current[0],selected[0],locale+': active and ARIA current must agree');
  assert.ok(current[0].includes('href="'+expectedCurrent+'"'),
    locale+': current language must link to the exact local destination page');
  assert.equal((html.match(/\baria-current="page"/g)||[]).length,1,
    locale+': no extra current-page marker outside the language picker');

  // Marvão inquiries are not confirmed bookings: no localized headline may
  // imply a booking was completed by opening the WhatsApp request form.
  const requestHeading={
    en:'Request availability through VOY PRO',
    pt:'Peça disponibilidade à VOY PRO',
    he:'בקשת זמינות דרך VOY PRO'
  }[locale];
  assert.ok(html.includes('<h3>'+requestHeading+'</h3>'),
    locale+': request-first Marvão assurance heading must be truthful and localized');

  const labels={
    en:{cta:'Continue to WhatsApp',send:'Tap Send in WhatsApp',confirmation:'not booked until our team confirms'},
    pt:{cta:'Continuar no WhatsApp',send:'Toque em Enviar no WhatsApp',confirmation:'só fica reservado após a nossa confirmação'},
    he:{cta:'המשך ל־WhatsApp',send:'יש ללחוץ על שליחה ב־WhatsApp',confirmation:'הסיור יוזמן רק לאחר אישור מאיתנו'}
  }[locale];
  assert.ok(html.includes('<button class="btn" type="submit">'+labels.cta+'</button>'),
    locale+': request CTA must describe opening WhatsApp, not a completed submission');
  assert.ok(html.includes(labels.send)&&html.includes(labels.confirmation),
    locale+': clearly require the guest to press Send and wait for human confirmation');
  assert.ok(html.includes('name="full_name" autocomplete="name" maxlength="100" required'),
    locale+': constrain name to a WhatsApp-safe length');
  assert.ok(html.includes('name="notes" rows="3" maxlength="500"'),
    locale+': constrain notes to a WhatsApp-safe length');
  const pathname=(locale==='en'?'/portugal/':`/${locale}/portugal/`);
  const location={pathname,href:''};
  const values={route:'express',date:'2026-10-18',people:'4',guide_language:'en',full_name:'Test Customer',notes:'Test group'};
  const submitListeners=[],inputListeners=[],changeListeners=[];
  const trackEvents=[];
  const sessionCalls=[];
  const initialStatus='The customer must press Send in WhatsApp; this is not a confirmed booking.';
  const status={textContent:initialStatus};
  const routeLinks=Object.fromEntries(['express','explorer','megalithic'].map(route=>[
    route,{dataset:{portugalTour:route},onClick:null,
      addEventListener(event,fn){if(event==='click')this.onClick=fn;}}
  ]));
  const routeSelect={value:'',dispatchEvent(event){
    assert.equal(event.type,'change');
    assert.equal(event.bubbles,true,'card-originated form change must bubble');
    for(const fn of changeListeners)fn(event);
  }};
  let dateFocusCount=0;
  const dateInput={min:'',focus(){
    dateFocusCount++;
    // Browser blur of the organizer-name input can emit a trailing change
    // while validation moves focus back to the invalid date.
    for(const fn of changeListeners)fn({target:{type:'text'}});
  }};
  const form={
    querySelector(selector){
      if(selector==='[name="route"]')return routeSelect;
      if(selector==='[name="date"]')return dateInput;
      if(selector==='[data-portugal-request-status]')return status;
      return null;
    },
    addEventListener(event,fn){
      if(event==='submit')submitListeners.push(fn);
      if(event==='input')inputListeners.push(fn);
      if(event==='change')changeListeners.push(fn);
    }
  };
  const sandbox={
    isPortugalPage:true,locale,location,page:pathname,
    document:{
      querySelector(selector){return selector==='[data-portugal-request-form]'?form:null},
      querySelectorAll(selector){return selector==='[data-portugal-tour]'?Object.values(routeLinks):[]}
    },
    FormData:class {constructor(target){assert.equal(target,form)}get(key){return values[key]}},
    portugalDate:()=> '2026-10-09',
    confirmationDateLabel:x=>x,
    guideLanguageLabel:x=>x,
    Event:class{constructor(type,options={}){this.type=type;this.bubbles=Boolean(options.bubbles)}},
    // Simulate an analytics server that never answers. The manual guest
    // WhatsApp request must still navigate within the SAME submit turn.
    createSession:(stage,metadata)=>{sessionCalls.push({stage,metadata});return new Promise(()=>{});},
    track:(event,payload)=>trackEvents.push({event,payload}),
  };
  vm.runInNewContext(handler+';bindPortugalRequestFlow();',sandbox,{timeout:1000});
  assert.equal(submitListeners.length,1,locale+': missing submit listener');
  assert.equal(inputListeners.length,1,locale+': error reset must react to text changes');
  assert.equal(changeListeners.length,1,locale+': error reset must react to date/select changes');
  values.route='';
  location.href='';
  submitListeners[0]({preventDefault(){}});
  assert.ok(status.textContent!==initialStatus,locale+': missing-field error not announced');
  assert.ok(routeLinks.explorer.onClick,locale+': route CTA click handler not registered');
  routeLinks.explorer.onClick();
  assert.equal(routeSelect.value,'explorer',
    locale+': tour card must prefill the selected route');
  assert.equal(status.textContent,initialStatus,
    locale+': tour card must dispatch form change and clear stale validation');
  assert.equal(location.href,'',locale+': selecting a tour card must not open WhatsApp');
  assert.equal(trackEvents.length,0,locale+': selecting a tour card must not track enquiry submission');
  assert.equal(sessionCalls.length,0,locale+': selecting a tour card must not open a request session');
  for(const code of ['express','megalithic']){
    assert.ok(routeLinks[code].onClick,locale+' '+code+': missing CTA handler');
    routeLinks[code].onClick();
    assert.equal(routeSelect.value,code,locale+' '+code+': tour CTA route not selected');
  }
  changeListeners[0]();
  assert.equal(status.textContent,initialStatus,
    locale+': correcting a required select should restore the original sending guidance');
  values.route='express';
  values.date='2026-10-08';
  submitListeners[0]({preventDefault(){}});
  assert.ok(status.textContent!==initialStatus,locale+': past-date error not announced');
  assert.equal(dateFocusCount,1,locale+': past-date validation must focus date exactly once');
  values.date='2026-10-18';
  inputListeners[0]();
  assert.equal(status.textContent,initialStatus,
    locale+': correcting an expired date must clear the stale warning');
  values.route='🚀'.repeat(2000);
  submitListeners[0]({preventDefault(){}});
  assert.ok(status.textContent!==initialStatus,
    locale+': oversized encoded message must display a warning');
  assert.equal(location.href,'',locale+': overlong message must not navigate');
  values.route='express';
  changeListeners[0]();
  assert.equal(status.textContent,initialStatus,
    locale+': fixing an oversized message must restore the original guidance');
  // Field edits are not a submission, tracking or backend operation.
  assert.equal(trackEvents.length,0,locale+': correction itself must not emit analytics');
  assert.equal(sessionCalls.length,0,locale+': correction itself must not invoke backend');
  let prevented=false;
  submitListeners[0]({preventDefault(){prevented=true}});
  assert.equal(prevented,true,locale+': form should prevent direct browser submit');
  assert.ok(location.href.startsWith('https://wa.me/351935695004?text='),locale+': wrong destination number');
  const parsed=new URL(location.href);
  const message=parsed.searchParams.get('text')||'';
  assert.ok(message.includes('2026-10-18')&&message.includes('Test Customer'),locale+': form details missing');
  assert.ok(message.includes(pathname),locale+': originating page missing');
  assert.ok(trackEvents.some(x=>x.event==='whatsapp_clicked'),locale+': attribution event missing');
  assert.equal(sessionCalls.length,1,locale+': best-effort request session was not attempted');
  assert.ok(sessionCalls[0].metadata.route==='express'&&sessionCalls[0].metadata.guide_language==='en',
    locale+': booking inquiry analytics lost safe route/language context');
  assert.ok(!Object.hasOwn(sessionCalls[0].metadata,'full_name')&&
    !Object.hasOwn(sessionCalls[0].metadata,'notes'),
    locale+': guest name/notes must not enter analytics metadata');
  // Restore oversized values as may happen on browser back or through
  // programmatic form updates; the final WhatsApp href must still be bounded.
  values.full_name='N'.repeat(200);
  values.notes='X'.repeat(2400);
  location.href='';
  submitListeners[0]({preventDefault(){}});
  const oversizedMessage=new URL(location.href).searchParams.get('text')||'';
  assert.ok(oversizedMessage.includes('N'.repeat(100))&&!oversizedMessage.includes('N'.repeat(101)),
    locale+': long customer name must be safely capped in the outgoing URL');
  assert.ok(oversizedMessage.includes('X'.repeat(500))&&!oversizedMessage.includes('X'.repeat(501)),
    locale+': long notes must be safely capped in the outgoing URL');
  assert.ok(location.href.length<1800,
    locale+': outgoing WhatsApp URL too long even after bounded free text');
  // Character-count limits are insufficient for percent-encoded Hebrew,
  // emojis and combining sequences. Keep source/route/date and avoid invalid
  // UTF-16 even when restored form data is malformed.
  for(const [scenario,fullName,fullNotes] of [
    ['Hebrew','ש'.repeat(100),'מ'.repeat(500)],
    ['emoji','👨‍👩‍👧'.repeat(24),'🛴'.repeat(500)],
    ['mixed','א'.repeat(90)+'👩🏽‍💻','שלום🚴'.repeat(300)],
    ['lone-surrogates','A\uD800'.repeat(80),'B\uDC00'.repeat(400)]
  ]){
    values.full_name=fullName;
    values.notes=fullNotes;
    location.href='';
    submitListeners[0]({preventDefault(){}});
    assert.ok(location.href.startsWith('https://wa.me/351935695004?text='),
      locale+' '+scenario+': request stopped opening WhatsApp');
    assert.ok(location.href.length<1800,
      locale+' '+scenario+': URL exceeds safe encoded length');
    const text=new URL(location.href).searchParams.get('text')||'';
    assert.ok(text.includes('2026-10-18')&&text.includes(pathname)&&text.includes('Vila de Marvão Express Tour')&&text.includes('4'),
      locale+' '+scenario+': required staff context lost to link clipping');
    if(scenario!=='lone-surrogates'){
      assert.ok(text.includes('…'),
        locale+' '+scenario+': shortened notes must visibly end with an ellipsis');
    }else{
      assert.ok(!text.includes('…'),
        locale+' '+scenario+': a compact cleaned message must not claim truncation');
    }
    assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text),
      locale+' '+scenario+': malformed Unicode leaked to WhatsApp');
    assert.ok(!Object.hasOwn(sessionCalls.at(-1).metadata,'full_name')&&
      !Object.hasOwn(sessionCalls.at(-1).metadata,'notes'),
      locale+' '+scenario+': personal text leaked to analytics');
  }
}

console.log('PASS: Marvão EN/PT/HE request navigates to +351 WhatsApp immediately, even with a permanently stalled analytics session.');
