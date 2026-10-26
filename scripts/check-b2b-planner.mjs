import fs from 'node:fs';
import vm from 'node:vm';
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
 check(html.includes('name="english_ok" value="yes" disabled'),p+': fallback opt-in must be disabled until a non-English guiding language is selected');
 check(html.includes('<label class="b2b-english-check" hidden>'),p+': fallback question must begin hidden');
 check(html.includes('data-b2b-english-decline aria-pressed="false" disabled hidden'),
   p+': explicit negative preference must begin unknown, disabled and hidden');
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
// Exercise the live planner handler without opening WhatsApp or creating a real booking.
const plannerStart=js.indexOf('function bindB2BEnquiryPlanner()');
const plannerEnd=js.indexOf('  const aliasesFrom=',plannerStart);
check(plannerStart>=0&&plannerEnd>plannerStart,'Cannot isolate B2B date handling');
if(plannerStart>=0&&plannerEnd>plannerStart){
 const plannerScript=js.slice(plannerStart,plannerEnd);
 for(const [locale,expectedError] of [
  ['en','Choose today or a future date.'],
  ['he','יש לבחור תאריך מהיום והלאה.'],
  ['hu','Válassz mai vagy későbbi dátumot.']
 ])for(const kind of ['group','corporate']){
  const clock={today:'2026-10-09'};
  const date={value:'2026-10-09',min:'',error:'',events:{},
   addEventListener(event,cb){this.events[event]=cb;},
   setCustomValidity(message){this.error=message;},
   reportValidity(){this.errorPresented=this.error;return !this.error;}
  };
  let clicked;
  const btn={addEventListener(type,handler){if(type==='click')clicked=handler;}};
  const languageField={value:'en',events:{},
    addEventListener(name,handler){this.events[name]=handler;}};
  const englishRow={hidden:false};
  const englishChoice={checked:false,disabled:false,events:{},
    addEventListener(type,handler){this.events[type]=handler;},
    closest(selector){return selector==='.b2b-english-check'?englishRow:null;}};
  const englishDecline={hidden:false,disabled:false,attrs:{'aria-pressed':'false'},events:{},
    getAttribute(key){return this.attrs[key];},
    setAttribute(key,value){this.attrs[key]=value;},
    addEventListener(type,handler){this.events[type]=handler;}};
  const form={dataset:{b2bPlanner:kind},querySelector(selector){
   if(selector==='input[name="requested_date"]')return date;
   if(selector==='select[name="guide_language"]')return languageField;
   if(selector==='input[name="english_ok"]')return englishChoice;
   if(selector==='[data-b2b-english-decline]')return englishDecline;
   return selector==='[data-b2b-open]'?btn:null;
  },reportValidity(){return !date.error;}};
  const formValues={headcount:'12',time_window:'afternoon',private_preference:'flexible',company:'',organizer:'',notes:''};
  const context={
   document:{querySelectorAll:selector=>selector==='form[data-b2b-planner]'?[form]:[]},
   locale,budapestDate:()=>clock.today,FormData:class{get(key){
    if(key==='requested_date')return date.value;
    if(key==='guide_language')return languageField.value;
    if(key==='english_ok')return englishChoice.checked&&!englishChoice.disabled?'yes':null;
    return formValues[key]??null;
   }},
   track:()=>{context.tracks++;},tracks:0,
   location:{pathname:'/'+locale+'/budapest/'+kind+'/',href:''},page:'/budapest/',encodeURIComponent
  };
  try{vm.runInNewContext(plannerScript,context,{timeout:1000});}
  catch(error){errors.push(locale+'/'+kind+': planner cannot execute: '+error.message);continue;}
  check(typeof clicked==='function',locale+'/'+kind+': planner button handler missing');
  if(typeof clicked!=='function')continue;
  check(englishRow.hidden===true&&englishChoice.disabled===true&&
    englishDecline.hidden===true&&englishDecline.disabled===true,
    locale+'/'+kind+': English primary must not have a visible second-language fallback');
  check(englishDecline.getAttribute('aria-pressed')==='false',
    locale+'/'+kind+': English alternative refusal must start unanswered');
  check(englishChoice.checked===false,locale+'/'+kind+': English opt-in cannot be preselected');
  check(date.min==='2026-10-09',locale+'/'+kind+': initial Budapest minimum date missing');
  clock.today='2026-10-10'; // Page left open across Budapest midnight.
  date.events.focus?.();
  check(date.min==='2026-10-10',locale+'/'+kind+': minimum date not refreshed after midnight');
  clicked();
  check(date.error===expectedError,locale+'/'+kind+': expired-date error not localized');
  check(context.location.href==='',locale+'/'+kind+': invalid date opened WhatsApp');
  check(context.tracks===0,locale+'/'+kind+': invalid enquiry was tracked as opened');
  date.value='2026-10-10';
  date.events.change?.();
  check(date.error==='',locale+'/'+kind+': date error not cleared after correction');
  clicked();
  check(context.location.href.startsWith('https://wa.me/36300993099?text='),locale+'/'+kind+': valid date did not hand off to WhatsApp');
  const localMessage=decodeURIComponent(context.location.href);
  check(localMessage.includes('2026-10-10'),locale+'/'+kind+': corrected date not included in message');
  const readableWindow=locale==='he'?'צהריים':locale==='hu'?'Délután':'Afternoon';
  const readableEnglish=locale==='he'?'אנגלית':locale==='hu'?'Angol':'English';
  check(localMessage.includes(readableWindow),
    locale+'/'+kind+': manual request must include localized afternoon instead of a raw window code');
  check(localMessage.includes(readableEnglish),
    locale+'/'+kind+': manual request must include the readable requested guide language');
  check(context.tracks===1,locale+'/'+kind+': valid handoff analytics count wrong');
  const englishLabel=locale==='he'?'גם אנגלית מתאימה':locale==='hu'?'Angol is megfelelő':'English also possible';
  languageField.value='he';languageField.events.change?.();
  check(!englishRow.hidden&&!englishChoice.disabled&&
    !englishDecline.hidden&&!englishDecline.disabled,
    locale+'/'+kind+': choosing Hebrew must reveal yes/no optional English fallback');
  englishChoice.checked=true;
  englishChoice.events.change?.();
  clicked();
  const requestedHebrew=locale==='he'?'עברית':locale==='hu'?'Héber':'Hebrew';
  check(decodeURIComponent(context.location.href).includes(requestedHebrew),
    locale+'/'+kind+': explicit Hebrew request was not human-readable');
  check(decodeURIComponent(context.location.href).includes(englishLabel+': yes'),
    locale+'/'+kind+': explicitly accepted English option was not passed to WhatsApp');
  languageField.value='hu';languageField.events.change?.();
  check(!englishChoice.checked&&!englishChoice.disabled,
    locale+'/'+kind+': changing to another non-English language must clear old consent');
  clicked();
  const requestedHungarian=locale==='he'?'הונגרית':locale==='hu'?'Magyar':'Hungarian';
  check(decodeURIComponent(context.location.href).includes(requestedHungarian),
    locale+'/'+kind+': switched Hungarian guiding-language request was not human-readable');
  check(!decodeURIComponent(context.location.href).includes(englishLabel+': yes'),
    locale+'/'+kind+': previously accepted English consent leaked to the new primary language');
  englishDecline.events.click?.();
  check(englishDecline.getAttribute('aria-pressed')==='true'&&!englishChoice.checked,
    locale+'/'+kind+': explicit refusal and consent must be mutually exclusive');
  clicked();
  const deniedLabel=locale==='he'?'אנגלית אינה חלופה מתאימה'
    :locale==='hu'?'Az angol nem megfelelő alternatíva':'English not accepted as an alternative';
  check(decodeURIComponent(context.location.href).includes(deniedLabel),
    locale+'/'+kind+': explicitly declined alternative not sent to WhatsApp');
  englishChoice.checked=true;englishChoice.events.change?.();
  check(englishDecline.getAttribute('aria-pressed')==='false',
    locale+'/'+kind+': explicitly accepting English must clear earlier refusal');
  languageField.value='en';languageField.events.change?.();
  check(englishRow.hidden===true&&englishChoice.disabled===true&&!englishChoice.checked&&
    englishDecline.hidden===true&&englishDecline.disabled===true&&
    englishDecline.getAttribute('aria-pressed')==='false',
    locale+'/'+kind+': English primary must hide and clear both fallback choices');
  clicked();
  check(!decodeURIComponent(context.location.href).includes(englishLabel+': yes'),
    locale+'/'+kind+': English cannot be its own alternative');
  check(context.tracks===5,locale+'/'+kind+': valid manual WhatsApp handoffs not counted');
 }
}

const css=fs.readFileSync('site/assets/site.css','utf8');
check(css.includes('.b2b-planner-fields')&&css.includes('@media(max-width:800px)'), 'Responsive design missing');
check(css.includes('.b2b-english-check[hidden]{display:none!important}'), 'Hidden English fallback must not show through flex CSS');
check(css.includes('.b2b-english-decline[hidden]{display:none!important}')&&
 css.includes('.b2b-english-decline:focus-visible'),
 'Refusal control must remain keyboard accessible and hidden until eligible');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('B2B planner (EN/HE/HU × Groups/Corporate), accessibility, WhatsApp hand-off and CRM boundary checks OK.');
