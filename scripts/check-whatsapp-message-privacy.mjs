import fs from 'node:fs';

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
  "form.addEventListener('submit',async e=>",
  "context:'portugal_availability_request'",
  "await createSession('whatsapp_clicked',requestAnalytics)",
  "track('whatsapp_clicked',requestAnalytics)"
]){
  if(!portugal.includes(token))failures.push('Portugal attribution must stay internal via session/event: '+token);
}

if(failures.length){
  console.error('WhatsApp customer-copy privacy guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('WhatsApp customer-copy privacy guard OK: Budapest and Portugal keep attribution internal while customer-visible request context remains useful.');
