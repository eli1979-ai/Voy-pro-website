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
  const labels={
    en:{cta:'Continue to WhatsApp',send:'Tap Send in WhatsApp',confirmation:'not booked until our team confirms'},
    pt:{cta:'Continuar no WhatsApp',send:'Toque em Enviar no WhatsApp',confirmation:'só fica reservado após a nossa confirmação'},
    he:{cta:'המשך ל־WhatsApp',send:'יש ללחוץ על שליחה ב־WhatsApp',confirmation:'הסיור יוזמן רק לאחר אישור מאיתנו'}
  }[locale];
  assert.ok(html.includes('<button class="btn" type="submit">'+labels.cta+'</button>'),
    locale+': request CTA must describe opening WhatsApp, not a completed submission');
  assert.ok(html.includes(labels.send)&&html.includes(labels.confirmation),
    locale+': clearly require the guest to press Send and wait for human confirmation');
  const pathname=(locale==='en'?'/portugal/':`/${locale}/portugal/`);
  const location={pathname,href:''};
  const values={route:'express',date:'2026-10-18',people:'4',guide_language:'en',full_name:'Test Customer',notes:'Test group'};
  const submitListeners=[];
  const trackEvents=[];
  const status={textContent:''};
  const routeSelect={value:''};
  const dateInput={min:'',focus(){}};
  const form={
    querySelector(selector){
      if(selector==='[name="route"]')return routeSelect;
      if(selector==='[name="date"]')return dateInput;
      if(selector==='[data-portugal-request-status]')return status;
      return null;
    },
    addEventListener(event,fn){if(event==='submit')submitListeners.push(fn)}
  };
  const sandbox={
    isPortugalPage:true,locale,location,page:pathname,
    document:{
      querySelector(selector){return selector==='[data-portugal-request-form]'?form:null},
      querySelectorAll(){return []}
    },
    FormData:class {constructor(target){assert.equal(target,form)}get(key){return values[key]}},
    portugalDate:()=> '2026-10-09',
    confirmationDateLabel:x=>x,
    guideLanguageLabel:x=>x,
    createSession:async()=>({id:'test'}),
    track:(event,payload)=>trackEvents.push({event,payload}),
  };
  vm.runInNewContext(handler+';bindPortugalRequestFlow();',sandbox,{timeout:1000});
  assert.equal(submitListeners.length,1,locale+': missing submit listener');
  let prevented=false;
  await submitListeners[0]({preventDefault(){prevented=true}});
  assert.equal(prevented,true,locale+': form should prevent direct browser submit');
  assert.ok(location.href.startsWith('https://wa.me/351935695004?text='),locale+': wrong destination number');
  const parsed=new URL(location.href);
  const message=parsed.searchParams.get('text')||'';
  assert.ok(message.includes('2026-10-18')&&message.includes('Test Customer'),locale+': form details missing');
  assert.ok(message.includes(pathname),locale+': originating page missing');
  assert.ok(trackEvents.some(x=>x.event==='whatsapp_clicked'),locale+': attribution event missing');
}
console.log('PASS: Marvão availability form opens Portuguese WhatsApp (+351935695004) in EN, PT and HE with request details.');
