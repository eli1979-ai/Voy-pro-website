import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const site=fs.readFileSync('site/assets/site.js','utf8');
const start=site.indexOf('function whatsAppUrl');
const end=site.indexOf('function bindPortugalRequestFlow',start);
const block=start>=0&&end>start?site.slice(start,end):'';
const failures=[];

if(!block)failures.push('whatsAppUrl() could not be isolated');

const forbidden=[
  "Source: ${sourceLabel}",
  "Campaign: ${attr.campaign}",
  "Referral: ${affiliateRef}",
  'מקור הפניה:',
  'קמפיין:',
  'קוד הפניה:',
  "qs.get('affiliate')",
];

for(const token of forbidden){
  if(block.includes(token))failures.push('customer WhatsApp message still exposes attribution token: '+token);
}

for(const required of [
  'details.booking_reference',
  'details.experience_title',
  'details.date',
  'details.requested_time',
  'details.guide_language'
]){
  if(!block.includes(required))failures.push('customer-useful WhatsApp context was removed: '+required);
}

const portugalStart=site.indexOf('function bindPortugalRequestFlow');
const portugalEnd=site.indexOf('function enhanceMobileNavigation',portugalStart);
const portugal=portugalStart>=0&&portugalEnd>portugalStart?site.slice(portugalStart,portugalEnd):'';
if(!portugal)failures.push('Portugal request flow could not be isolated');

for(const token of [
  'sourceLabel=[attr.source,attr.medium]',
  'attr.campaign',
  "qs.get('affiliate')",
  'מקור הפניה:',
  'קמפיין:',
  'קוד הפניה:',
  'Campanha:',
  'Referência:',
  'Source:',
  'Campaign:',
  'Referral:'
]){
  if(portugal.includes(token))failures.push('Portugal customer WhatsApp copy still exposes attribution token: '+token);
}
for(const token of [
  "form.addEventListener('submit',e=>",
  "context:'portugal_availability_request'",
  "void createSession('whatsapp_clicked',requestAnalytics).catch(()=>{})",
  "track('whatsapp_clicked',requestAnalytics)"
]){
  if(!portugal.includes(token))failures.push('Portugal attribution must stay internal via session/event: '+token);
}

if(!portugal.includes("location.href='https://wa.me/351935695004?text='"))failures.push('Portugal customer enquiry cannot navigate to Marvão WhatsApp');
if(portugal.includes("await createSession('whatsapp_clicked'"))failures.push('Portugal WhatsApp redirect is blocked by an analytics network await');
if(failures.length){
  console.error('WhatsApp customer-copy privacy guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('WhatsApp customer-copy privacy guard OK: Budapest and Portugal keep attribution internal while customer-visible request context remains useful.');

const detailsStart=site.indexOf('function currentRequestDetails()');
const detailsEnd=site.indexOf('function bindPortugalRequestFlow()',detailsStart);
assert.ok(detailsStart>=0&&detailsEnd>detailsStart,'Customer WhatsApp context functions missing');
const detailsScript=site.slice(detailsStart,detailsEnd);
for(const locale of ['en','pt','he']){
  const values={
    route:'express',date:'2026-10-29',people:'4',guide_language:'en',
    full_name:'Private Customer Name',notes:'Private customer details and phone 1234'
  };
  const form={};
  const sandbox={
    locale,isPortugalPage:true,isBudapestPage:false,vehicleGuideSource:null,
    location:{pathname:locale==='en'?'/portugal/':'/'+locale+'/portugal/'},
    document:{querySelector:q=>q==='[data-portugal-request-form]'?form:null},
    FormData:class {constructor(target){assert.equal(target,form);}get(key){return values[key];}},
    t:(en,he)=>locale==='he'?he:en,
    portugalDate:()=> '2026-10-28',
    confirmationDateLabel:x=>x,
    guideLanguageLabel:x=>x==='pt'?'Português':'English',
    ancillaryText:()=>'',money:x=>String(x)
  };
  vm.runInNewContext(detailsScript+'; compose=whatsAppUrl;',sandbox,{timeout:1000});
  const message=()=>new URL(sandbox.compose()).searchParams.get('text')||'';
  const first=message();
  assert.ok(first.includes('Vila de Marvão Express Tour'),locale+': selected tour lost');
  assert.ok(first.includes('2026-10-29'),locale+': selected future date lost');
  assert.ok(first.includes(locale==='he'?'משתתפים: 4':locale==='pt'?'Pessoas: 4':'People: 4'),
    locale+': selected party size missing or mislabeled');
  assert.ok(first.includes('English'),locale+': selected guide language lost');
  assert.ok(!first.includes(values.full_name)&&!first.includes(values.notes),
    locale+': personal name or notes leaked into the generic WhatsApp URL');
  const url=new URL(sandbox.compose());
  assert.equal(url.hostname,'wa.me');
  assert.equal(url.pathname,'/351935695004',locale+': wrong Marvão WhatsApp number');
  assert.ok(url.href.length<1800,locale+': short selection overflowed WhatsApp URL');
  values.route='explorer';values.date='2026-10-30';values.people='3';values.guide_language='pt';
  const refreshed=message();
  assert.ok(refreshed.includes('Marvão Explorer Tour')&&refreshed.includes('2026-10-30')&&
    refreshed.includes(locale==='he'?'משתתפים: 3':locale==='pt'?'Pessoas: 3':'People: 3')&&
    refreshed.includes('Português'),locale+': updated form state not reflected in a fresh handoff');
  assert.ok(!refreshed.includes('Vila de Marvão Express Tour')&&!refreshed.includes('2026-10-29'),
    locale+': stale choices survived an updated form');
  if(locale==='pt'){
    for(const label of ['Passeio: ','Data preferida: ','Pessoas: ','Idioma do guia: '])
      assert.ok(refreshed.includes(label),'PT handoff label not localized: '+label);
  }
  values.route='unknown';values.date='2000-01-01';values.people='900';values.guide_language='bad';
  const invalid=message();
  assert.ok(!invalid.includes('Marvão Explorer Tour')&&!invalid.includes('2000-01-01')&&
    !invalid.includes('People: 900')&&!invalid.includes('Pessoas: 900')&&
    !invalid.includes('משתתפים: 900'),locale+': malformed/past form selections were included as valid');
  assert.ok(!invalid.includes(values.full_name)&&!invalid.includes(values.notes),
    locale+': customer private text leaked after invalid input');
}
console.log('PASS: Marvão EN/PT/HE generic WhatsApp handoff preserves valid live tour selections, never name/notes/attribution.');
