import fs from 'node:fs';
const errors=[];
const check=(ok,msg)=>{if(!ok)errors.push(msg)};
const types=['group-tours','corporate-events'];
const locs=['','he/','hu/'];
for(const loc of locs)for(const type of types){
 const p='site/'+loc+'budapest/'+type+'/index.html';
 const html=fs.readFileSync(p,'utf8'),context=type==='group-tours'?'group':'corporate';
 check((html.match(/data-b2b-planner=/g)||[]).length===1,p+': planner missing/duplicated');
 check(html.includes('data-b2b-planner="'+context+'"'),p+': wrong intent');
 check(html.includes('href="#plan-your-'),p+': planner jump link missing');
 check(html.includes('data-b2b-open'),p+': WhatsApp hand-off missing');
 check(html.includes('name="headcount"')&&html.includes('name="guide_language"'),p+': required fields missing');
 check(html.includes('name="english_ok"'),p+': English flexibility question missing');
 check(html.includes('type="button" class="btn alt" data-b2b-open'),p+': button must not submit to site');
 check(html.includes('data-special-request="'+context+'"'),p+': existing WhatsApp fallback removed');
 check(!html.includes('data-b2b-submit-to-crm'),p+': unverified CRM endpoint must not be used');
 if(context==='corporate')check(html.includes('name="company"'),p+': company field missing');
}
const js=fs.readFileSync('site/assets/site.js','utf8');
check(js.includes('function bindB2BEnquiryPlanner()'),'Builder binding missing');
check(js.includes("location.href='https://wa.me/36300993099?text='+encodeURIComponent(lines.join("),'WhatsApp transfer missing');
check(js.includes("if(!form.reportValidity())return"),'Native validation missing');
check(js.includes("if(!Number.isSafeInteger(size)||size<1||size>10000)return"),'Headcount guard missing');
check(js.includes("source:'b2b_planner'"),'Non-PII attribution missing');
check(!js.includes("fetch('/api/v1/commercial-enquiries'"),'Do not introduce unverified CRM write');
const css=fs.readFileSync('site/assets/site.css','utf8');
check(css.includes('.b2b-planner-fields')&&css.includes('@media(max-width:800px)'), 'Responsive design missing');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('B2B planner (EN/HE/HU × Groups/Corporate), accessibility, WhatsApp hand-off and CRM boundary checks OK.');
