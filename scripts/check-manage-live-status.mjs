import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('site/manage/index.html','utf8');
const failures=[];

const required=[
  'data-contact-status role="status" aria-live="polite"',
  'id="manage-change-status" role="status" aria-live="polite"',
  'id="manage-cancel-status" role="status" aria-live="polite"',
  'class="manage-error" role="alert"'
];
for(const token of required){
  if(!html.includes(token)) failures.push('missing '+token);
}

 // In the tokenless/disabled fail-closed state, visitors need a safe,
 // localized next step without a generic booking-reference form or API call.
 const recovery="Booking details cannot be opened from this link. Use the private Manage Booking link in your confirmation or contact VOY PRO support.";
 const recoveryPt='Não é possível abrir os detalhes da reserva a partir deste link. Use o link privado para gerir a reserva que recebeu na confirmação ou contacte o apoio da VOY PRO.';
 if(!html.includes("if(!token||!c.bookingEnabled){box.innerHTML='<p>'+T("))
   failures.push('Manage missing-token fallback must remain fail-closed before the authenticated API flow');
 for(const marker of [
   recovery,
   recoveryPt,
   'לא ניתן לפתוח את פרטי ההזמנה מהקישור הזה.',
   'Ebből a linkből nem nyithatók meg a foglalási adatok.',
   '<a href="mailto:support@voy-pro.com">support@voy-pro.com</a>'
 ]){
   if(!html.includes(marker))failures.push('Manage tokenless recovery/support missing: '+marker.slice(0,55));
 }
 if(html.includes("T('Booking management is not available from this link.'"))
   failures.push('Legacy tokenless Manage dead-end wording must be replaced');


// This executes only the inline locale bootstrap with synthetic URLs, never
// the private Manage API, an authentication token or any external network.
// A Portuguese private token must continue to use the existing English flow.
const bootstrap=html.match(/<title>VOY PRO<\/title><script>([\s\S]*?)<\/script>/)?.[1];
if(!bootstrap){
  failures.push('Cannot find Manage document-locale bootstrap');
}else{
  function bootstrapLocale(urlText){
    const u=new URL(urlText),element={
      lang:'en',dir:'ltr',
      removeAttribute(name){if(name==='dir')this.dir='';}
    };
    const ctx={location:{search:u.search,hash:u.hash},window:{},
      document:{documentElement:element},URLSearchParams};
    vm.runInNewContext(bootstrap,ctx,{timeout:1000,filename:'Manage locale bootstrap'});
    return {locale:ctx.window.VOY_MANAGE_LOCALE,lang:element.lang,dir:element.dir};
  }
  for(const [url,lang] of [
    ['https://voy-pro.com/manage/?lang=pt','pt'],
    ['https://voy-pro.com/manage/?lang=he','he'],
    ['https://voy-pro.com/manage/?lang=hu','hu'],
    ['https://voy-pro.com/manage/','en'],
    ['https://voy-pro.com/manage/?lang=pt&token=synthetic-query','en'],
    ['https://voy-pro.com/manage/?lang=pt#token=synthetic-hash','en'],
    ['https://voy-pro.com/manage/?lang=pt#source=confirmation','pt']
  ]){
    try{
      const actual=bootstrapLocale(url);
      if(actual.locale!==lang||actual.lang!==lang||
        (lang==='he'?actual.dir!=='rtl':actual.dir==='rtl'))
        failures.push('Manage locale bootstrap not fail-closed for '+url.replace(/token=[^&#]*/,'token=REDACTED'));
    }catch(error){failures.push('Manage locale bootstrap execution failed: '+error.message);}
  }
}
const notFound=fs.readFileSync('site/404.html','utf8');
if(!notFound.includes("manage:['/manage/?lang=pt','Ajuda para gerir a reserva']"))
  failures.push('Portuguese 404 does not link to localized tokenless Manage support');

const riderStatuses=(html.match(/data-rider-status/g)||[]).length;
const liveRiderStatuses=(html.match(/data-rider-status role="status" aria-live="polite"/g)||[]).length;
if(riderStatuses && riderStatuses!==liveRiderStatuses){
  failures.push('all dynamic rider status regions must be polite live regions');
}
if(failures.length){
  console.error('Manage live-status accessibility guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Manage live-status accessibility guard OK: operational updates are announced and fatal load errors use alert semantics.');
