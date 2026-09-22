(async function(){
  const cfg = window.VOY_CONFIG || window.VOY_RUNTIME_CONFIG || {};
  const apiRoot = (cfg.apiRoot || '').replace(/\/$/,'');
  const page = document.body.dataset.page || location.pathname;
  const declaredLang=(document.documentElement.lang||'en').toLowerCase();
  const routePath=(location.pathname||'/').toLowerCase();
  const routeLocale=routePath.startsWith('/he/')?'he':routePath.startsWith('/hu/')?'hu':routePath.startsWith('/pt/')?'pt':null;
  const isPortugalPage=routePath.includes('/portugal/');
  const isLegalPage=routePath.includes('/legal/');
  const destinationId=isPortugalPage?'portugal-marvao':'budapest';
  const destinationClients=(cfg.destinationClients&&typeof cfg.destinationClients==='object')?cfg.destinationClients:{};
  const destinationClient=destinationClients[destinationId]||null;
  const clientKey=String(destinationClient?.clientKey||((destinationId==='budapest'&&cfg.clientKey)||'')).trim();
  const bookingEnabled=!!(!isLegalPage&&cfg.bookingEnabled&&apiRoot&&clientKey);
  const locale=routeLocale||(declaredLang.startsWith('he')?'he':declaredLang.startsWith('hu')?'hu':declaredLang.startsWith('pt')?'pt':'en');
  // Route is the locale contract. This prevents cached or mis-generated lang attributes from mixing UI languages.
  document.documentElement.lang=locale;
  if(locale==='he'){document.documentElement.dir='rtl';document.body?.classList.add('rtl')}else{document.documentElement.removeAttribute('dir');}
  const qs = new URLSearchParams(location.search);
  const campaignPromo=(qs.get('promo')||'').trim().toUpperCase()||null;
  const now = () => new Date().toISOString();
  const safeJSON = (s, fallback=null) => { try{return JSON.parse(s)}catch(e){return fallback} };

  // Consent-aware storage. Booking-critical state may persist as strictly necessary;
  // analytics, attribution and experiments stay in memory until analytics consent.
  const CONSENT_KEY='voy_consent_v1';
  const ESSENTIAL_KEYS=new Set(['voy_session_id','voy_experience_id','voy_recovery_state']);
  const memoryStore=new Map();
  function readConsent(){
    try{return safeJSON(localStorage.getItem(CONSENT_KEY),{decided:false,analytics:false,marketing:false})||{decided:false,analytics:false,marketing:false}}
    catch(e){return {decided:false,analytics:false,marketing:false}}
  }
  let consent=readConsent();
  const analyticsAllowed=()=>consent.analytics===true;
  const getStore=(k)=>{
    if(ESSENTIAL_KEYS.has(k)){try{return localStorage.getItem(k)}catch(e){return memoryStore.get(k)||null}}
    if(!analyticsAllowed()) return memoryStore.get(k)||null;
    try{return localStorage.getItem(k)}catch(e){return memoryStore.get(k)||null}
  };
  const setStore=(k,v)=>{
    memoryStore.set(k,String(v));
    if(ESSENTIAL_KEYS.has(k)||analyticsAllowed()){try{localStorage.setItem(k,v)}catch(e){}}
  };
  const delStore=(k)=>{
    memoryStore.delete(k);
    if(ESSENTIAL_KEYS.has(k)||analyticsAllowed()){try{localStorage.removeItem(k)}catch(e){}}
  };
  function setConsent(next){
    consent={decided:true,analytics:!!next.analytics,marketing:!!next.marketing,updated_at:new Date().toISOString()};
    try{localStorage.setItem(CONSENT_KEY,JSON.stringify(consent))}catch(e){}
    if(!consent.analytics){
      ['voy_visitor_id','voy_first_attribution','voy_last_attribution','voy_segment','voy_experiments','voy_event_queue_v1'].forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});
    }
    document.documentElement.dataset.analyticsConsent=consent.analytics?'granted':'denied';
  }
  const uuid = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'v_'+Date.now()+'_'+Math.random().toString(36).slice(2);
  const money=(amount,currency='EUR')=>new Intl.NumberFormat(locale==='he'?'he-IL':locale==='hu'?'hu-HU':locale==='pt'?'pt-PT':'en-IE',{style:'currency',currency}).format(Number(amount||0));
  function confirmationDateLabel(value){
    const raw=String(value||'').trim();
    const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return raw;
    const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
    const dt=new Date(Date.UTC(year,month-1,day));
    if(dt.getUTCFullYear()!==year||dt.getUTCMonth()!==month-1||dt.getUTCDate()!==day)return raw;
    const dateLocale=locale==='he'?'he-IL':locale==='hu'?'hu-HU':locale==='pt'?'pt-PT':'en-GB';
    return new Intl.DateTimeFormat(dateLocale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(dt);
  }
  function confirmationTimeLabel(value){
    const raw=String(value||'').trim();
    const m=raw.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
    return m?`${m[1]}:${m[2]}`:raw;
  }
  const HU={
    'Regular price':'Normál ár','Discount':'Kedvezmény','Additions':'Kiegészítések','Total':'Összesen','Tour':'Túra','Date':'Dátum','Time':'Időpont','From €70':'€70-tól','Live availability · Final price before confirmation · Local support':'Aktuális elérhetőség · Végső ár megerősítés előtt · Helyi segítség',
    'Discounts and additions are shown separately before confirmation.':'A kedvezmények és kiegészítések külön jelennek meg a megerősítés előtt.',
    'Menu':'Menü','Close menu':'Menü bezárása','Explore Budapest':'Fedezd fel Budapestet','Buda Castle Tour':'Budavári túra','Margaret Island':'Margitsziget','Extended Tour':'Hosszabb túra','Private Tours':'Privát túrák','Budapest with Kids':'Budapest gyerekekkel','Portugal · Marvão':'Portugália · Marvão','Check availability':'Szabad időpontok','Ask us on WhatsApp':'Kérdezz WhatsAppon','View Buda tour':'Budai túra','See the most popular route':'Legnépszerűbb útvonal','Cookie preferences':'Süti beállítások','Your privacy choices':'Adatvédelmi beállítások','Essential storage keeps booking features working. Optional analytics helps us understand which pages and campaigns lead to bookings.':'A szükséges tárolás a foglalási funkciók működéséhez kell. Az opcionális analitika segít megérteni, mely oldalak vezetnek foglaláshoz.','Essential only':'Csak szükséges','Allow analytics':'Analitika engedélyezése',
    'Tell us what you need':'Írd meg, mire van szükséged','We’ll send the details to the Budapest team on WhatsApp.':'Az adatokat WhatsAppon elküldjük a budapesti csapatnak.','Preferred date':'Kívánt dátum','Independent riders':'Önálló vezetők','Guide language':'Vezetés nyelve','Choose language':'Válassz nyelvet','Private?':'Privát?','No · regular extended request':'Nem · normál hosszabb túra','Yes · our group only':'Igen · csak a mi csoportunk','Preferred start time':'Kívánt indulási idő','(optional)':'(opcionális)','Send request on WhatsApp':'Kérés küldése WhatsAppon','This sends a request, not a confirmed booking. Our local team will confirm the route, time, vehicles and guide language.':'Ez még kérés, nem megerősített foglalás. Helyi csapatunk visszaigazolja az útvonalat, időpontot, járműveket és a vezetés nyelvét.','Extended Buda + Margaret':'Buda + Margitsziget hosszabb túra',
    'From ':'Ettől: ','Contact the local team':'Kapcsolat a helyi csapattal','Online booking':'Online foglalás','Choose guide language':'Válassz vezetési nyelvet','Every booking must include the requested guiding language.':'Minden foglalásnál ki kell választani a kért vezetési nyelvet.','TOUR STYLE':'TÚRA TÍPUSA','Choose how you want to ride':'Válaszd ki a túra típusát','Final price is shown after you choose a departure.':'A végső ár az indulás kiválasztása után jelenik meg.','Join a scheduled tour':'Csatlakozás menetrend szerinti túrához','Current rider price':'Aktuális ár vezetőnként','Share the departure with other VOY PRO guests.':'Az induláson más VOY PRO vendégek is részt vehetnek.','Private tour · your group only':'Privát túra · csak a ti csoportotok','Private upgrade shown before confirmation':'Privát felár a megerősítés előtt','Need a different private start time? Send a request with your date and group':'Más privát indulási időt szeretnél? Küldd el a dátumot és a csoport létszámát','Private availability requires an empty departure.':'Privát foglaláshoz szabad indulás szükséges.','Private mode selected. Search again to see departures that can be reserved for your group only.':'Privát túra kiválasztva. Keress újra a kizárólag a csoportodnak foglalható indulásokhoz.','Scheduled tour selected. Search available departures for your group.':'Menetrend szerinti túra kiválasztva. Keress szabad időpontot a csoportodnak.','MORE BUDAPEST':'MÉG TÖBB BUDAPEST','Want Buda and Margaret Island in one longer experience?':'Szeretnéd Budát és a Margitszigetet egy hosszabb élményben?','See the Extended Buda + Margaret option before you choose a departure.':'Nézd meg a hosszabb Buda + Margitsziget lehetőséget indulás választása előtt.','See extended tour':'Hosszabb túra',
    'Private surcharge shown before confirmation':'A privát felár a megerősítés előtt jelenik meg','Restore your last tour selection':'Legutóbbi túraválasztás visszaállítása','We will recheck availability and price before anything is confirmed.':'Megerősítés előtt újra ellenőrizzük az aktuális időpontot és árat.','Restore selection':'Választás visszaállítása','Selection restored. Search again to recheck availability and price.':'A választást visszaállítottuk. Keress újra az aktuális időpontért és árért.','Online booking is temporarily unavailable':'Az online foglalás átmenetileg nem elérhető','Extended Buda + Margaret — contact us':'Buda + Margitsziget — lépj kapcsolatba velünk','Margaret Island — contact us':'Margitsziget — lépj kapcsolatba velünk','Contact us for this route':'Lépj kapcsolatba velünk ehhez az útvonalhoz','The extended Buda + Margaret tour is currently confirmed by the local team. Contact us on WhatsApp.':'Ezt a hosszabb túrát jelenleg a helyi csapat erősíti meg. Írj nekünk WhatsAppon.','Margaret Island is currently confirmed by the local team. Contact us on WhatsApp, or view the Buda tour for online booking.':'A margitszigeti túrát jelenleg a helyi csapat erősíti meg. Írj WhatsAppon, vagy válaszd a budai túrát online foglaláshoz.','Tour options are temporarily unavailable':'A túrák átmenetileg nem tölthetők be',
    'BOOKING':'FOGLALÁS','Current availability could not be loaded. Please try again or contact us on WhatsApp.':'Az aktuális elérhetőséget nem sikerült betölteni. Próbáld újra, vagy írj nekünk WhatsAppon.','No departures found right now.':'Jelenleg nincs elérhető indulás.','Private tour: yes':'Privát túra: igen','Scheduled tour selected. Search availability for your group.':'Menetrend szerinti túra kiválasztva. Keress elérhető indulást a csoportodnak.',
        'LIVE CHECKOUT':'FOGLALÁS','Complete your booking':'Foglalás befejezése','Change selection':'Választás módosítása','Current price':'Aktuális ár','Places held while you finish':'A helyeket rövid ideig tartjuk','Direct Budapest team':'Közvetlen budapesti csapat','Full name':'Teljes név','Phone':'Telefon','Payment':'Fizetés','Pay by card on arrival':'Fizetés kártyával a helyszínen','Pay cash on arrival':'Fizetés készpénzzel a helyszínen','Confirm booking':'Foglalás megerősítése','Book now – payment obligation':'Foglalás fizetési kötelezettséggel','I accept the Terms of Use and confirm I have read the Privacy Notice.':'Elfogadom a Felhasználási feltételeket, és tudomásul veszem az Adatkezelési tájékoztatót.','Terms of Use':'Felhasználási feltételek','Privacy Notice':'Adatkezelési tájékoztató','Selection unlocked. Update the tour, date or group and search again.':'A választás újra módosítható. Állítsd át a túrát, dátumot vagy létszámot, majd keress újra.','Hold expired — select the departure again.':'A foglalási idő lejárt — válaszd ki újra az indulást.','Complete booking':'Foglalás befejezése','Choose a time':'Válassz időpontot','Check availability':'Szabad időpontok keresése','Riders 16+':'Vezetők 16+','Children 3–15':'Gyermekek 3–15','Babies 1–2':'Kisgyermekek 1–2','Checking price and reserving your places…':'Ár ellenőrzése és helyek ideiglenes tartása…','Scheduled tour':'Menetrend szerinti túra','Your places are held for 10 minutes while you complete the booking.':'A helyeket 10 percig tartjuk, amíg befejezed a foglalást.','This booking needs a quick confirmation.':'Ehhez a foglaláshoz gyors megerősítés szükséges.','This departure can no longer be made private. Choose another departure or ask the team for a flexible private time.':'Ez az indulás már nem foglalható privátként. Válassz másik indulást, vagy kérj rugalmas privát időpontot.','Could not hold this departure. Please choose another time.':'Ezt az indulást nem sikerült lefoglalni. Válassz másik időpontot.','Request confirmation':'Megerősítés kérése','Private request':'Privát kérés','This group needs a quick availability confirmation.':'Ehhez a csoporthoz gyors elérhetőségi megerősítés szükséges.','Send confirmation request':'Megerősítési kérés küldése','Online booking is not available for this route right now. Please contact the local team.':'Ehhez az útvonalhoz most nincs online foglalás. Kérjük, lépj kapcsolatba a helyi csapattal.','Choose the guide language for your tour.':'Válaszd ki a túra vezetési nyelvét.','That guide language is not available for this branch.':'Ez a vezetési nyelv ezen a helyszínen nem elérhető.','Checking availability…':'Szabad időpontok keresése…','No departures found right now.':'Jelenleg nincs elérhető indulás.','Choose a departure:':'Válassz indulást:',' · confirmation':' · megerősítés',' · limited':' · kevés hely','This private group needs a quick confirmation. Send the requested date and time and we’ll check the available setup.':'A privát csoporthoz gyors megerősítés szükséges. Küldd el a kívánt dátumot és időpontot, és ellenőrizzük a lehetőségeket.','Availability could not be loaded. Please contact us on WhatsApp.':'Az aktuális időpontokat most nem sikerült betölteni. Írj nekünk WhatsAppon.','Reference copied':'Hivatkozási szám másolva','Reference: ':'Hivatkozás: ','Please complete name, email and phone.':'Add meg a nevet, e-mail címet és telefonszámot.','Sending request…':'Kérés küldése…','Request sent':'Kérés elküldve','Reference':'Hivatkozás','The Budapest team will confirm the vehicles and guides needed for your group.':'A budapesti csapat visszaigazolja a szükséges járműveket és idegenvezetőt.','Back to Budapest':'Vissza Budapesthez','The hold expired. Please select the departure again.':'A foglalási idő lejárt. Válaszd ki újra az indulást.','Confirming booking…':'Foglalás megerősítése…','Booking confirmed':'Foglalás megerősítve','Booking reference':'Foglalási szám','Private tour':'Privát túra','Guide':'Vezetés','Paid online by card':'online kártyával fizetve','Cash on arrival':'készpénz a helyszínen','cash on arrival':'készpénz a helyszínen','Card on arrival':'kártya a helyszínen','card on arrival':'kártya a helyszínen','Manage booking':'Foglalás kezelése','Copy reference':'Szám másolása','Add to calendar':'Hozzáadás a naptárhoz','What happens next':'Mi történik ezután','Your booking is confirmed. Use Manage Booking for current details or available changes.':'A foglalásod megerősítve. A Foglalás kezelése oldalon láthatod az aktuális részleteket és az elérhető módosításokat.','Keep the Manage Booking link private — it gives access to this booking.':'A Foglalás kezelése linket kezeld bizalmasan, mert hozzáférést ad ehhez a foglaláshoz.','This booking needs an additional confirmation. Please search again and send a request.':'Ehhez a foglaláshoz további megerősítés szükséges. Keress újra, és küldj megerősítési kérést.','The booking could not be completed. No online card charge was made.':'A foglalást nem sikerült befejezni. Online kártyaterhelés nem történt.'
  };
  function huDynamic(en){
    if(HU[en]) return HU[en];
    let m;
    if((m=en.match(/^Selected: (.+)\. Choose your date and group size\.$/))) return `Kiválasztva: ${m[1]}. Válassz dátumot és csoportlétszámot.`;
    if((m=en.match(/^(.+) per independent rider$/))) return `${m[1]} / önálló vezető`;
    if((m=en.match(/^Regular rate \+ (.+) per rider$/))) return `Normál ár + ${m[1]} / vezető`;
    if((m=en.match(/^Available from (\d+) independent riders\.$/))) return `${m[1]} önálló vezetőtől elérhető.`;
    if((m=en.match(/^Private tours require at least (\d+) independent riders\.$/))) return `Privát túrához legalább ${m[1]} önálló vezető szükséges.`;
    if((m=en.match(/^Your places are held for (.+)$/))) return `A helyeket még ${m[1]} ideig tartjuk.`;
    if((m=en.match(/^Tour: (.+)$/))) return `Túra: ${m[1]}`;
    if((m=en.match(/^Source: (.+)$/))) return `Forrás: ${m[1]}`;
    if((m=en.match(/^Campaign: (.+)$/))) return `Kampány: ${m[1]}`;
    if((m=en.match(/^Referral: (.+)$/))) return `Ajánlói kód: ${m[1]}`;
    if((m=en.match(/^Booking reference: (.+)$/))) return `Foglalási szám: ${m[1]}`;
    if((m=en.match(/^Preferred date: (.+)$/))) return `Kívánt dátum: ${m[1]}`;
    if((m=en.match(/^Preferred time: (.+)$/))) return `Kívánt időpont: ${m[1]}`;
    if((m=en.match(/^Independent riders: (.+)$/))) return `Önálló vezetők: ${m[1]}`;
    if((m=en.match(/^Children 3–15: (.+)$/))) return `Gyermekek 3–15: ${m[1]}`;
    if((m=en.match(/^Babies 1–2: (.+)$/))) return `Kisgyermekek 1–2: ${m[1]}`;
    if((m=en.match(/^Guide language: (.+)$/))) return `Vezetés nyelve: ${m[1]}`;
    if((m=en.match(/^Payment: (.+)$/))) return `Fizetés: ${m[1]}`;
    if((m=en.match(/^Total: (.+)$/))) return `Összesen: ${m[1]}`;
    return en;
  }
  const t=(en,he)=>locale==='he'?he:locale==='hu'?huDynamic(en):en;
  const GUIDE_LANGUAGE_NAMES={en:{en:'English',he:'אנגלית',hu:'Angol'},he:{en:'Hebrew',he:'עברית',hu:'Héber'},hu:{en:'Hungarian',he:'הונגרית',hu:'Magyar'},es:{en:'Spanish',he:'ספרדית',hu:'Spanyol'},pt:{en:'Portuguese',he:'פורטוגזית',hu:'Portugál'}};
  const guideLanguageLabel=(code)=>{const key=String(code||'').toLowerCase();return GUIDE_LANGUAGE_NAMES[key]?.[locale]||GUIDE_LANGUAGE_NAMES[key]?.en||key.toUpperCase();};
  const BUDAPEST_GUIDE_LANGUAGES=['en','he','hu','es'];
  const localeBudapestHome=()=>locale==='he'?'/he/budapest/':locale==='hu'?'/hu/budapest/':'/budapest/';
  const localeBudapestBooking=()=>localeBudapestHome()+'#booking';
  const legalBasePath=()=>locale==='he'?'/he/legal/':locale==='hu'?'/hu/legal/':locale==='pt'?'/pt/legal/':'/legal/';
  const localeBudapestCore=(slug)=>locale==='he'?`/he/budapest/${slug}`:locale==='hu'?`/hu/budapest/${slug}`:`/budapest/${slug}`;
  const escapeHTML=(value)=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const finiteNumber=(value)=>{const n=Number(value);return Number.isFinite(n)?n:null};
  function quoteLineArray(quote){
    for(const key of ['line_items','lineItems','lines','items','breakdown']) if(Array.isArray(quote?.[key])) return quote[key];
    return [];
  }
  function normalizedQuoteLines(quote){
    const currency=quote?.currency||'EUR';
    const raw=quoteLineArray(quote);
    const lines=raw.map((item,i)=>{
      if(item==null||typeof item!=='object') return null;
      const label=item.label??item.name??item.title??item.description??item.code??t(`Price item ${i+1}`,`רכיב מחיר ${i+1}`);
      const majorAmount=finiteNumber(item.total??item.amount??item.value??item.line_total??item.lineTotal);
      const minorAmount=finiteNumber(item.line_total_minor??item.lineTotalMinor??item.amount_minor??item.amountMinor);
      const amount=majorAmount!=null?majorAmount:(minorAmount!=null?minorAmount/100:null);
      if(amount==null) return null;
      const type=String(item.type??item.category??item.kind??'').toLowerCase();
      return {label:String(label),amount,type,currency:item.currency||currency};
    }).filter(Boolean);
    if(lines.length) return lines;
    const regular=finiteNumber(quote?.regular_total??quote?.list_total??quote?.base_total??quote?.subtotal_before_adjustments);
    const discountRaw=finiteNumber(quote?.discount_total??quote?.discounts_total??quote?.discount_amount);
    const additions=finiteNumber(quote?.surcharge_total??quote?.surcharges_total??quote?.extras_total??quote?.additions_total);
    const fallback=[];
    if(regular!=null) fallback.push({label:t('Regular price','מחיר רגיל'),amount:regular,type:'base',currency});
    if(discountRaw!=null&&discountRaw!==0) fallback.push({label:t('Discount','הנחה'),amount:-Math.abs(discountRaw),type:'discount',currency});
    if(additions!=null&&additions!==0) fallback.push({label:t('Additions','תוספות'),amount:Math.abs(additions),type:'surcharge',currency});
    return fallback;
  }
  function renderQuoteBreakdown(quote){
    const currency=quote?.currency||'EUR';
    const lines=normalizedQuoteLines(quote);
    const rows=lines.map(line=>{
      const discount=line.amount<0||/discount|coupon|promo/.test(line.type);
      const cls=discount?' quote-row-discount':(/surcharge|extra|addon|addition|private/.test(line.type)?' quote-row-addon':'');
      return `<div class="quote-row${cls}"><span>${escapeHTML(line.label)}</span><b>${escapeHTML(money(line.amount,line.currency||currency))}</b></div>`;
    }).join('');
    const total=finiteNumber(quote?.total);
    const totalRow=total==null?'':`<div class="quote-row quote-row-total"><span>${t('Total','סה״כ')}</span><strong>${escapeHTML(money(total,currency))}</strong></div>`;
    const note=lines.length?`<small class="quote-note">${t('Discounts and additions are shown separately before confirmation.','הנחות ותוספות מוצגות בנפרד לפני האישור.')}</small>`:'';
    return `<div class="quote-breakdown">${rows}${totalRow}${note}</div>`;
  }
  function currentRequestDetails(){
    const form=document.querySelector('#availability-form');
    if(!form) return {};
    const data=new FormData(form);
    const experienceSelect=form.querySelector('select[name="experience"]');
    const option=experienceSelect?.selectedOptions?.[0];
    return {
      experience_title:(option?.textContent||'').trim()||null,
      date:String(data.get('date')||'').trim()||null,
      riders:Number(data.get('adults')||0)||null,
      children:Number(data.get('children')||0)||0,
      babies:Number(data.get('babies')||0)||0,
      is_private:String(data.get('is_private')||'')==='true',
      guide_language:String(data.get('guide_language')||'').trim().toLowerCase()||null,
    };
  }
  function whatsAppUrl(context='',overrides={}){
    const details={...currentRequestDetails(),...overrides};
    const generic=isPortugalPage?(locale==='he'?`היי, הגעתי מאתר VOY PRO (${location.pathname}) ואני רוצה לבדוק סיור EZRaider במרבאו, פורטוגל.`:locale==='pt'?`Olá, cheguei pelo site VOY PRO (${location.pathname}) e gostaria de verificar um passeio de EZRaider em Marvão, Portugal.`:`Hi, I came from the VOY PRO website (${location.pathname}) and I’d like to check an EZRaider tour in Marvão, Portugal.`):(locale==='hu'?`Szia, a VOY PRO weboldaláról érkeztem (${location.pathname}), és egy budapesti túráról szeretnék érdeklődni.`:t(`Hi, I came from the VOY PRO website (${location.pathname}) and I’d like to check a Budapest tour.`,`היי, הגעתי מהאתר VOY PRO (${location.pathname}) ואני רוצה לבדוק סיור בבודפשט.`));
    const privateFlexible=locale==='hu'?`Szia, a VOY PRO weboldaláról érkeztem (${location.pathname}), és privát budapesti túrát szeretnék kérni rugalmas indulási idővel.`:t(`Hi, I came from the VOY PRO website (${location.pathname}) and I’d like to request a private Budapest tour at a flexible departure time.`,`היי, הגעתי מאתר VOY PRO (${location.pathname}) ואני רוצה לבקש סיור פרטי בבודפשט בשעת יציאה גמישה.`);
    const extended=locale==='hu'?`Szia, a VOY PRO weboldaláról érkeztem (${location.pathname}), és a hosszabb Buda + Margitsziget túráról szeretnék érdeklődni.`:t(`Hi, I came from the VOY PRO website (${location.pathname}) and I’d like to check the Extended Buda + Margaret tour.`,`היי, הגעתי מאתר VOY PRO (${location.pathname}) ואני רוצה לבדוק את הסיור הארוך בודה + מרגיט.`);
    const bookingConfirmed=locale==='hu'?`Szia, van egy megerősített VOY PRO Budapest foglalásom, és segítséget szeretnék kérni vele kapcsolatban.`:t(`Hi, I have a confirmed VOY PRO Budapest booking and I’d like help with it.`,`היי, יש לי הזמנה מאושרת ל־VOY PRO Budapest ואני רוצה עזרה בנוגע להזמנה.`);
    const lines=[context==='booking_confirmation'?bookingConfirmed:context==='private_flexible'?privateFlexible:context==='extended'?extended:generic];
    const detailLines=[];
    const affiliateRef=qs.get('ref')||qs.get('affiliate')||null;
    const sourceLabel=[attr.source,attr.medium].filter(Boolean).join('/');
    if(sourceLabel&&attr.source!=='direct')detailLines.push(t(`Source: ${sourceLabel}`,`מקור הפניה: ${sourceLabel}`));
    if(attr.campaign)detailLines.push(t(`Campaign: ${attr.campaign}`,`קמפיין: ${attr.campaign}`));
    if(affiliateRef)detailLines.push(t(`Referral: ${affiliateRef}`,`קוד הפניה: ${affiliateRef}`));
    if(details.booking_reference)detailLines.push(t(`Booking reference: ${details.booking_reference}`,`מספר הזמנה: ${details.booking_reference}`));
    if(details.experience_title)detailLines.push(t(`Tour: ${details.experience_title}`,`סיור: ${details.experience_title}`));
    const confirmedBooking=context==='booking_confirmation';
    if(details.date)detailLines.push(confirmedBooking?(locale==='he'?`תאריך: ${details.date}`:locale==='hu'?`Dátum: ${details.date}`:`Date: ${details.date}`):t(`Preferred date: ${confirmationDateLabel(details.date)}`,`תאריך מועדף: ${confirmationDateLabel(details.date)}`));
    if(details.requested_time)detailLines.push(confirmedBooking?(locale==='he'?`שעה: ${details.requested_time}`:locale==='hu'?`Időpont: ${details.requested_time}`:`Time: ${details.requested_time}`):t(`Preferred time: ${confirmationTimeLabel(details.requested_time)}`,`שעה מועדפת: ${confirmationTimeLabel(details.requested_time)}`));
    if(details.riders)detailLines.push(t(`Independent riders: ${details.riders}`,`רוכבים עצמאיים: ${details.riders}`));
    if(Number(details.children||0)>0)detailLines.push(t(`Children 3–15: ${details.children}`,`ילדים 3–15: ${details.children}`));
    if(Number(details.babies||0)>0)detailLines.push(t(`Babies 1–2: ${details.babies}`,`פעוטות 1–2: ${details.babies}`));
    if(details.guide_language)detailLines.push(t(`Guide language: ${guideLanguageLabel(details.guide_language)}`,`שפת הדרכה: ${guideLanguageLabel(details.guide_language)}`));
    if(details.is_private)detailLines.push(t('Private tour: yes','סיור פרטי: כן'));
    if(Array.isArray(details.extras)&&details.extras.length){
      const extrasText=details.extras.map(item=>`${item.name} ×${Number(item.quantity||0)}`).join(', ');
      detailLines.push(`${ancillaryText('selectedExtras')}: ${extrasText}`);
    }
    if(details.payment_method){const paymentName=details.payment_method==='pay_now_card'?t('Paid online by card','שולם מראש בכרטיס'):details.payment_method==='pay_arrival_cash'?t('Cash on arrival','מזומן במקום'):t('Card on arrival','כרטיס במקום');detailLines.push(t(`Payment: ${paymentName}`,`תשלום: ${paymentName}`));}
    if(details.total!=null)detailLines.push(t(`Total: ${money(details.total,details.currency||'EUR')}`,`סה״כ: ${money(details.total,details.currency||'EUR')}`));
    if(detailLines.length)lines.push('',...detailLines);
    return 'https://wa.me/36300993099?text='+encodeURIComponent(lines.join('\n'));
  }

  function bindPortugalRequestFlow(){
    if(!isPortugalPage)return;
    const form=document.querySelector('[data-portugal-request-form]');
    if(!form)return;
    const labels=locale==='he'?{
      route:'מסלול',date:'תאריך מועדף',people:'משתתפים',language:'שפת הדרכה',name:'שם',notes:'הערות',source:'מקור הפניה',
      missing:'יש להשלים מסלול, תאריך, שפת הדרכה ושם.'
    }:locale==='pt'?{
      route:'Passeio',date:'Data preferida',people:'Pessoas',language:'Idioma do guia',name:'Nome',notes:'Notas',source:'Origem',
      missing:'Preencha o passeio, a data, o idioma e o nome.'
    }:{
      route:'Tour',date:'Preferred date',people:'People',language:'Guide language',name:'Name',notes:'Notes',source:'Source',
      missing:'Please complete tour, date, guide language and name.'
    };
    const routeNames={express:'Vila de Marvão Express Tour',explorer:'Marvão Explorer Tour',megalithic:locale==='pt'?'Rota Megalítica':'Megalithic Route'};
    const routeSelect=form.querySelector('[name="route"]');
    document.querySelectorAll('[data-portugal-tour]').forEach(a=>a.addEventListener('click',()=>{
      const route=String(a.dataset.portugalTour||'');
      if(routeSelect&&routeNames[route])routeSelect.value=route;
    }));
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const f=new FormData(form);
      const route=String(f.get('route')||'').trim();
      const date=String(f.get('date')||'').trim();
      const people=String(f.get('people')||'').trim();
      const guide=String(f.get('guide_language')||'').trim();
      const name=String(f.get('full_name')||'').trim();
      const notes=String(f.get('notes')||'').trim();
      const status=form.querySelector('[data-portugal-request-status]');
      if(!route||!date||!guide||!name){
        if(status)status.textContent=labels.missing;
        return;
      }
      const intro=locale==='he'
        ?'היי, אני רוצה לבקש זמינות לסיור EZRaider במרבאו דרך VOY PRO.'
        :locale==='pt'
          ?'Olá, gostaria de pedir disponibilidade para um passeio de EZRaider em Marvão através da VOY PRO.'
          :'Hi, I’d like to request availability for an EZRaider tour in Marvão through VOY PRO.';
      const lines=[
        intro,'',
        labels.route+': '+(routeNames[route]||route),
        labels.date+': '+(locale==='pt'?confirmationDateLabel(date):date),
        labels.people+': '+people,
        labels.language+': '+guideLanguageLabel(guide),
        labels.name+': '+name
      ];
      if(notes)lines.push(labels.notes+': '+notes);
      const sourceLabel=[attr.source,attr.medium].filter(Boolean).join('/');
      if(sourceLabel&&attr.source!=='direct')lines.push(labels.source+': '+sourceLabel);
      if(attr.campaign)lines.push((locale==='pt'?'Campanha':'Campaign')+': '+attr.campaign);
      const affiliateRef=qs.get('ref')||qs.get('affiliate')||null;
      if(affiliateRef)lines.push((locale==='pt'?'Referência':'Referral')+': '+affiliateRef);
      lines.push((locale==='pt'?'Página':'Page')+': '+location.pathname);
      location.href='https://wa.me/36300993099?text='+encodeURIComponent(lines.join('\n'));
    });
  }
  bindPortugalRequestFlow();

  function enhanceMobileNavigation(){
    const nav=document.querySelector('.navlinks'); if(!nav||document.querySelector('.nav-menu-toggle')) return;
    const btn=document.createElement('button');btn.type='button';btn.className='nav-menu-toggle';btn.setAttribute('aria-expanded','false');btn.textContent=t('Menu','תפריט');nav.insertBefore(btn,nav.firstChild);
    const sheet=document.createElement('div');sheet.className='mobile-nav-sheet';sheet.hidden=true;
    if(isPortugalPage){
      const portugalHome=locale==='he'?'/he/portugal/':locale==='pt'?'/pt/portugal/':'/portugal/';
      const budapestHome=locale==='he'?'/he/budapest/':'/budapest/';
      const heading=locale==='he'?'פורטוגל · מרבאו':locale==='pt'?'Portugal · Marvão':'Portugal · Marvão';
      const tours=locale==='he'?'סיורים':locale==='pt'?'Passeios':'Tours';
      const request=locale==='he'?'בקשת זמינות':locale==='pt'?'Pedir disponibilidade':'Request availability';
      const budapest=locale==='he'?'בודפשט':locale==='pt'?'Budapeste':'Budapest';
      sheet.innerHTML=`<div class="mobile-nav-card"><button type="button" class="mobile-nav-close" aria-label="${t('Close menu','סגירת תפריט')}">×</button><b>${heading}</b><a href="${portugalHome}#tours">${tours}</a><a href="${portugalHome}#request">${request}</a><a href="${budapestHome}">${budapest}</a><div class="mobile-language-row" data-mobile-language-row></div><a class="btn secondary" data-mobile-nav-wa href="https://wa.me/36300993099">WhatsApp · VOY PRO</a><a href="${portugalHome}#request" class="btn">${request}</a></div>`;
    }else{
      sheet.innerHTML=`<div class="mobile-nav-card"><button type="button" class="mobile-nav-close" aria-label="${t('Close menu','סגירת תפריט')}">×</button><b>${t('Explore Budapest','לגלות את בודפשט')}</b><a href="${localeBudapestCore('tours/buda-castle-ezraider-tour/')}">${t('Buda Castle Tour','סיור בודה')}</a><a href="${localeBudapestCore('tours/margaret-island-ezraider-tour/')}">${t('Margaret Island','אי מרגיט')}</a><a href="${localeBudapestCore('tours/buda-margaret-extended-tour/')}">${t('Extended Tour','הסיור הארוך')}</a><a href="${localeBudapestCore('private-tours/')}">${t('Private Tours','סיורים פרטיים')}</a><a href="${locale==='he'?'/he/budapest/with-kids/':locale==='hu'?'/hu/budapest/#tours':'/budapest/with-kids/'}">${t('Budapest with Kids','בודפשט עם ילדים')}</a><a href="${locale==='he'?'/he/portugal/':locale==='hu'?'/portugal/':'/portugal/'}">${t('Portugal · Marvão','פורטוגל · מרבאו')}</a><div class="mobile-language-row" data-mobile-language-row></div><a class="btn secondary" data-mobile-nav-wa href="https://wa.me/36300993099">${t('Ask us on WhatsApp','פנייה ב-WhatsApp')}</a><a href="${localeBudapestBooking()}" class="btn">${t('Check availability','בדיקת זמינות')}</a></div>`;
    }
    document.body.appendChild(sheet);
    const langRow=sheet.querySelector('[data-mobile-language-row]');
    if(langRow)document.querySelectorAll('.language-picker .lang-switch').forEach(link=>langRow.appendChild(link.cloneNode(true)));
    const mobileWa=sheet.querySelector('[data-mobile-nav-wa]');
    if(mobileWa){mobileWa.href=whatsAppUrl();mobileWa.addEventListener('click',()=>track('whatsapp_clicked',{page,context:'mobile_nav'}));}
    const close=()=>{sheet.hidden=true;btn.setAttribute('aria-expanded','false');document.body.classList.remove('nav-open')};
    btn.onclick=()=>{sheet.hidden=false;btn.setAttribute('aria-expanded','true');document.body.classList.add('nav-open')};sheet.querySelector('.mobile-nav-close').onclick=close;sheet.addEventListener('click',e=>{if(e.target===sheet)close()});sheet.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
  }
  function rescueMarkup(message){return `${message}<div class="status-actions"><a class="btn secondary" href="#" data-inline-wa>${t('Ask us on WhatsApp','פנייה ב‑WhatsApp')}</a><a class="btn secondary" href="${localeBudapestCore('tours/buda-castle-ezraider-tour/')}">${t('View Buda tour','לצפייה בסיור בודה')}</a></div>`}
  function bindInlineWhatsApp(root=document){root.querySelectorAll('[data-inline-wa]').forEach(a=>{a.href=whatsAppUrl();a.onclick=()=>track('whatsapp_clicked',{page,context:'booking_rescue'})})}
  function budapestDate(offsetDays=0){
    const dt=new Date(Date.now()+offsetDays*86400000);
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(dt);
    const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return `${v.year}-${v.month}-${v.day}`;
  }

  let visitorId = getStore('voy_visitor_id') || uuid();
  if(analyticsAllowed()) setStore('voy_visitor_id',visitorId);
  const referrer = document.referrer || '';
  const inferredSource = qs.get('utm_source') || (referrer.includes('google.')?'google':referrer.includes('bing.')?'bing':referrer.includes('tripadvisor.')?'tripadvisor':referrer.includes('getyourguide.')?'getyourguide':referrer?'referral':'direct');
  const inferredMedium = qs.get('utm_medium') || ((inferredSource==='google'||inferredSource==='bing')?'organic':referrer?'referral':'none');
  const attr = {
    touch_id: uuid(),
    source: inferredSource, medium: inferredMedium,
    campaign: qs.get('utm_campaign') || null, content: qs.get('utm_content') || null,
    term: qs.get('utm_term') || null, referrer: referrer || null,
    gclid:qs.get('gclid')||null, gbraid:qs.get('gbraid')||null, wbraid:qs.get('wbraid')||null,
    fbclid:qs.get('fbclid')||null, msclkid:qs.get('msclkid')||null, ttclid:qs.get('ttclid')||null,
    landing_page: location.pathname + location.search, captured_at: now()
  };
  const first = safeJSON(getStore('voy_first_attribution'));
  if(analyticsAllowed()){
    if(!first) setStore('voy_first_attribution',JSON.stringify(attr));
    setStore('voy_last_attribution',JSON.stringify(attr));
  }

  const INTENT_MAP = [
    [/with-kids/,'family'],[/private-tours/,'private'],[/group-tours|corporate-events/,'group'],
    [/buda-margaret-extended/,'extended'],[/buda-castle/,'buda'],[/margaret-island/,'margaret'],[/first-day/,'first_day'],[/where-to-stay/,'planning']
  ];
  function pathSegment(){ for(const [rx,id] of INTENT_MAP) if(rx.test(page)) return id; if(/tripadvisor|getyourguide|viator/.test(referrer)) return 'ota_referral'; if(attr.source==='google'&&attr.medium==='organic') return 'organic_google'; return 'default'; }
  const segment = pathSegment(); document.body.dataset.segment=segment; if(analyticsAllowed()) setStore('voy_segment',segment);

  function hashString(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function assignExperiment(id,variants){
    const normalized=(Array.isArray(variants)?variants:[]).map(v=>typeof v==='string'?{key:v,weight_bps:1}:v).filter(v=>v&&v.key&&Number(v.weight_bps)>0);
    if(!normalized.length)return null;
    const keys=normalized.map(v=>String(v.key));
    const key='voy_exp_'+id;
    const existing=getStore(key);
    if(existing&&keys.includes(existing))return existing;
    const total=normalized.reduce((sum,v)=>sum+Number(v.weight_bps||0),0);
    let bucket=hashString(visitorId+id)%Math.max(1,total);
    let selected=keys[keys.length-1];
    for(const v of normalized){
      bucket-=Number(v.weight_bps||0);
      if(bucket<0){selected=String(v.key);break;}
    }
    setStore(key,selected);
    return selected;
  }
  async function loadRuntimeExperiments(){
    if(!bookingEnabled)return [];
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),800);
    try{
      const response=await fetch(apiRoot+'/marketing/experiments?page='+encodeURIComponent(page),{
        method:'GET',
        headers:{'x-voy-client-key':clientKey,'x-voy-client':'voy-pro-website'},
        signal:controller.signal,
        cache:'no-store',
      });
      if(!response.ok)return [];
      const data=await response.json();
      return Array.isArray(data?.experiments)?data.experiments:[];
    }catch(e){
      return [];
    }finally{
      clearTimeout(timer);
    }
  }
  const experiments={};
  const runtimeExperiments=await loadRuntimeExperiments();
  for(const experiment of runtimeExperiments){
    const id=String(experiment?.key||'').trim();
    const variants=Array.isArray(experiment?.variants)?experiment.variants:[];
    if(!id||variants.length<2)continue;
    const assigned=assignExperiment(id,variants);
    if(assigned)experiments[id]=assigned;
  }
  if(analyticsAllowed()) setStore('voy_experiments',JSON.stringify(experiments));

  const SEGMENT_COPY = {
    family:{en:['FAMILY-FRIENDLY BUDAPEST','Check family availability','Child-seat options depend on seat availability for your departure.'],he:['בודפשט למשפחות','בדיקת זמינות למשפחה','אפשרויות לכיסאות ילדים תלויות בזמינות הכיסאות ליציאה שבחרתם.'],hu:['CSALÁDBARÁT BUDAPEST','Családi időpontok','A gyermekülés a kiválasztott indulás elérhetőségétől függ.']},
    private:{en:['PRIVATE BUDAPEST EXPERIENCE','Check private tour options','A dedicated guide and private-group setup, subject to availability.'],he:['חוויה פרטית בבודפשט','בדיקת סיור פרטי','מדריך ייעודי ומבנה קבוצה פרטי, בכפוף לזמינות החיה.'],hu:['PRIVÁT BUDAPEST ÉLMÉNY','Privát túra lehetőségek','Saját idegenvezető és privát csoportbeállítás, az elérhetőségtől függően.']},
    group:{en:['GROUPS & EVENTS','Plan a group ride','We coordinate the vehicles, guides and escorts your group needs.'],he:['קבוצות ואירועים','תכנון סיור לקבוצה','אנחנו מתאמים את הכלים, המדריכים והמלווים שהקבוצה צריכה.'],hu:['CSOPORTOK ÉS ESEMÉNYEK','Csoportos túra tervezése','A szükséges járműveket, idegenvezetőket és kísérőket összehangoljuk a csoportod számára.']},
    buda:{en:["BUDA CASTLE · FISHERMAN'S BASTION",'Check Buda tour availability','The most popular VOY PRO route for Castle Hill highlights and Danube views.'],he:['טירת בודה · מצודת הדייגים','בדיקת זמינות לסיור בודה','המסלול הפופולרי של VOY PRO באזור גבעת המצודה ותצפיות הדנובה.'],hu:['BUDAI VÁR · HALÁSZBÁSTYA','Budai túra időpontjai','A VOY PRO legnépszerűbb útvonala a Várnegyed fő látnivalóival és dunai panorámákkal.']},
    margaret:{en:['MARGARET ISLAND · GREEN RIDE','Check Margaret Island availability','Margaret Island runs daily with an 18:00 departure.'],he:['אי מרגיט · המסלול הירוק','בדיקת זמינות לאי מרגיט','סיור אי מרגיט יוצא בכל יום בשעה 18:00.'],hu:['MARGITSZIGET · ZÖLD TÚRA','Margitszigeti időpontok','A margitszigeti túra minden nap 18:00-kor indul.']},
    extended:{en:['BUDA + MARGARET · EXTENDED TOUR','Request the Extended Tour','One longer guided experience combining the Buda and Margaret Island routes.'],he:['בודה + מרגיט · הסיור הארוך','בקשת הסיור הארוך','חוויה מודרכת ארוכה יותר שמשלבת את מסלולי בודה ואי מרגיט.'],hu:['BUDA + MARGITSZIGET · HOSSZABB TÚRA','Hosszabb túra kérése','Egy hosszabb vezetett élmény, amely a budai és margitszigeti útvonalat kombinálja.']},
    planning:{en:['PLAN YOUR BUDAPEST BASE','See live tour availability','Choose the area that fits your trip, then use VOY PRO to understand the wider city.'],he:['לתכנן את הבסיס בבודפשט','בדיקת זמינות לסיורים','בחרו אזור שמתאים לחופשה ואז השתמשו ב־VOY PRO כדי להבין את העיר הרחבה.'],hu:['TERVEZD MEG A BUDAPESTI BÁZISOD','Túrák elérhetősége','Válaszd ki az utazásodhoz illő környéket, majd ismerd meg a város többi részét a VOY PRO-val.']},
    first_day:{en:['A SMART FIRST DAY IN BUDAPEST','Start with an EZRaider overview','Cover key areas early, then decide what you want to revisit on foot.'],he:['דרך חכמה להתחיל את בודפשט','להתחיל עם סיור היכרות','רואים אזורים מרכזיים בתחילת החופשה ואז מחליטים לאן לחזור.'],hu:['OKOS ELSŐ NAP BUDAPESTEN','Kezdd egy EZRaider városnézéssel','Lásd a fő területeket már az elején, majd döntsd el, hová szeretnél gyalog visszatérni.']},
    organic_google:{en:['DISCOVER BUDAPEST DIFFERENTLY','See availability','Book directly with the local VOY PRO team.'],he:['לגלות את בודפשט אחרת','לבדיקת זמינות','הזמנה ישירה מול צוות VOY PRO המקומי.'],hu:['FEDEZD FEL BUDAPESTET MÁSKÉPP','Szabad időpontok','Foglalj közvetlenül a helyi VOY PRO csapattal.']},
    ota_referral:{en:["YOU'VE FOUND THE LOCAL TEAM",'Book with VOY PRO','Questions, availability and booking are handled directly by the Budapest team.'],he:['הגעתם ישירות לצוות המקומי','להזמנה עם VOY PRO','שאלות, זמינות והזמנה מטופלות ישירות על ידי צוות בודפשט.'],hu:['KÖZVETLENÜL A HELYI CSAPATNÁL JÁRSZ','Foglalás a VOY PRO-val','A kérdéseket, az elérhetőséget és a foglalást közvetlenül a budapesti csapat kezeli.']}
  };
  const segCopy=SEGMENT_COPY[segment]&&SEGMENT_COPY[segment][locale];
  if(segCopy){
    const kicker=document.querySelector('[data-personalize-kicker]'); if(kicker) kicker.textContent=segCopy[0];
    const cta=document.querySelector('[data-personalize-cta]'); if(cta) cta.textContent=segCopy[1];
    const note=document.querySelector('[data-personalize-note]'); if(note){note.textContent=segCopy[2];note.hidden=false;}
  }
  if(experiments.budapest_home_cta_v1==='route_first'){
    const cta=document.querySelector('[data-personalize-cta]'); if(cta){cta.textContent=t('See the most popular route','לצפייה במסלול הפופולרי');cta.href=localeBudapestCore('tours/buda-castle-ezraider-tour/');}
  }
  document.documentElement.dataset.trustVariant=experiments.trust_placement_v1||'default';
  enhanceMobileNavigation();

  function optimizeHomeConversion(){
    const isHome=page==='/budapest/'||page==='/he/budapest/'||page==='/hu/budapest/';
    if(!isHome)return;
    const gallery=document.querySelector('.photo-gallery-section');
    const booking=document.querySelector('#booking');
    if(gallery&&booking&&gallery.previousElementSibling!==booking) booking.insertAdjacentElement('afterend',gallery);
    const actions=document.querySelector('.hero-actions');
    const book=actions?.querySelector('[data-track="booking_cta"]');
    const picker=actions?.querySelector('[data-track="tour_picker_cta"]');
    if(actions&&book&&picker){
      book.classList.add('alt');book.classList.remove('hero-secondary');
      picker.classList.add('hero-secondary');picker.classList.remove('alt');
      actions.insertBefore(book,picker);
    }
    const facts=document.querySelector('.hero .facts');
    if(facts&&!facts.querySelector('[data-home-live-price]')){
      const price=document.createElement('span');price.dataset.homeLivePrice='';price.dataset.runtimePrice='';
      price.textContent=t('From €70','החל מ־€70');facts.insertBefore(price,facts.firstChild);
    }
  }
  optimizeHomeConversion();

  const EVENT_KEY='voy_event_queue_v1';
  function payload(event, metadata={}){
    return {event_id:uuid(),event,timestamp:now(),visitor_id:visitorId,session_id:getStore('voy_session_id')||null,destination_id:destinationId,page,locale,
      source:attr.source,medium:attr.medium,campaign:attr.campaign,content:attr.content,term:attr.term,referrer:attr.referrer,
      click_ids:{gclid:attr.gclid,gbraid:attr.gbraid,wbraid:attr.wbraid,fbclid:attr.fbclid,msclkid:attr.msclkid,ttclid:attr.ttclid},
      personalization_segment:segment,experiment_assignments:experiments,metadata};
  }
  let eventFlushTimer=null;
  let eventFlushInFlight=false;
  async function flushEventQueue({keepalive=false}={}){
    if(!analyticsAllowed()||!bookingEnabled||eventFlushInFlight) return;
    const queued=safeJSON(getStore(EVENT_KEY),[])||[];
    if(!queued.length) return;
    const batch=queued.slice(0,25);
    eventFlushInFlight=true;
    try{
      const response=await fetch(apiRoot+'/marketing/events',{
        method:'POST',
        headers:authHeaders(),
        body:JSON.stringify({session_id:getStore('voy_session_id')||null,events:batch}),
        keepalive,
      });
      if(!response.ok) return;
      const sentIds=new Set(batch.map(item=>item?.event_id));
      const current=safeJSON(getStore(EVENT_KEY),[])||[];
      const remaining=current.filter(item=>!sentIds.has(item?.event_id)).slice(-25);
      setStore(EVENT_KEY,JSON.stringify(remaining));
    }catch(e){
      // Analytics delivery must never interrupt booking.
    }finally{
      eventFlushInFlight=false;
      const remaining=safeJSON(getStore(EVENT_KEY),[])||[];
      if(remaining.length&&!keepalive) scheduleEventFlush(false);
    }
  }
  function scheduleEventFlush(immediate=false){
    if(!analyticsAllowed()||!bookingEnabled) return;
    if(eventFlushTimer) clearTimeout(eventFlushTimer);
    eventFlushTimer=setTimeout(()=>{eventFlushTimer=null;flushEventQueue();},immediate?50:1400);
  }
  function track(event,metadata={}){
    if(!analyticsAllowed()||!bookingEnabled) return;
    const q=safeJSON(getStore(EVENT_KEY),[])||[];
    q.push(payload(event,metadata));
    setStore(EVENT_KEY,JSON.stringify(q.slice(-25)));
    scheduleEventFlush(q.length>=8||['booking_completed','capacity_request_created','whatsapp_clicked'].includes(event));
  }
  function recentEvents(){return analyticsAllowed()&&bookingEnabled?(safeJSON(getStore(EVENT_KEY),[])||[]):[];}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushEventQueue({keepalive:true});});
  window.addEventListener('pagehide',()=>{flushEventQueue({keepalive:true});});
  track('page_view',{title:document.title}); if(segment!=='default') track('personalization_applied',{segment});

  function initAccessibility(){
    document.querySelector('main')?.setAttribute('id','main-content');
    document.querySelectorAll('.status,[data-checkout-status],[data-hold-timer]').forEach(el=>{el.setAttribute('role','status');el.setAttribute('aria-live','polite');});
    document.querySelectorAll('.field').forEach((field,i)=>{
      const label=field.querySelector('label'); const control=field.querySelector('input,select,textarea');
      if(label&&control){if(!control.id) control.id='voy-field-'+i+'-'+Math.random().toString(36).slice(2,7);label.htmlFor=control.id;}
    });
  }
  function consentCopy(){
    if(locale==='pt') return {aria:'Preferências de cookies',title:'As suas escolhas de privacidade',body:'O armazenamento essencial mantém as funções de reserva. A análise opcional ajuda-nos a perceber que páginas e campanhas levam a reservas.',essential:'Apenas essencial',analytics:'Permitir análise'};
    return {aria:t('Cookie preferences','העדפות עוגיות'),title:t('Your privacy choices','בחירות הפרטיות שלך'),body:t('Essential storage keeps booking features working. Optional analytics helps us understand which pages and campaigns lead to bookings.','אחסון חיוני מפעיל את תהליך ההזמנה. אנליטיקה אופציונלית עוזרת לנו להבין אילו עמודים וקמפיינים מובילים להזמנות.'),essential:t('Essential only','חיוני בלבד'),analytics:t('Allow analytics','לאפשר אנליטיקה')};
  }
  function showConsentPreferences(force=false){
    document.documentElement.dataset.analyticsConsent=analyticsAllowed()?'granted':'denied';
    if(document.querySelector('.consent-banner')||(!force&&consent.decided)) return;
    const copy=consentCopy();
    const bar=document.createElement('section');
    bar.className='consent-banner';
    bar.setAttribute('role','dialog');
    bar.setAttribute('aria-label',copy.aria);
    bar.innerHTML=`<div><b>${copy.title}</b><p>${copy.body}</p></div><div class="consent-actions"><button type="button" class="btn secondary" data-consent-essential>${copy.essential}</button><button type="button" class="btn" data-consent-analytics>${copy.analytics}</button></div>`;
    document.body.appendChild(bar);
    document.body.classList.add('consent-open');
    bar.querySelector('[data-consent-essential]').addEventListener('click',()=>{setConsent({analytics:false,marketing:false});document.body.classList.remove('consent-open');bar.remove();});
    bar.querySelector('[data-consent-analytics]').addEventListener('click',()=>{setConsent({analytics:true,marketing:false});document.body.classList.remove('consent-open');bar.remove();location.reload();});
  }
  function initConsent(){
    showConsentPreferences(false);
    document.querySelectorAll('[data-cookie-settings]').forEach(btn=>btn.addEventListener('click',()=>showConsentPreferences(true)));
  }
  initAccessibility();
  initConsent();

  function authHeaders(extra={}){return {'Content-Type':'application/json','x-voy-client-key':clientKey,'x-voy-client':'voy-pro-website',...extra};}
  async function api(path,options={}){
    if(!bookingEnabled) throw new Error('BOOKING_NOT_CONFIGURED');
    const headers=authHeaders(options.headers||{});
    const timeoutMs=Math.max(1000,Number(options.timeoutMs||8000));
    const externalSignal=options.signal;
    const controller=externalSignal?null:new AbortController();
    const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
    const {timeoutMs:_timeoutMs,...fetchOptions}=options;
    try{
      const r=await fetch(apiRoot+path,{...fetchOptions,headers,signal:externalSignal||controller?.signal});
      const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch(e){data={error:text||r.statusText};}
      if(!r.ok){const err=new Error(data?.error||('HTTP '+r.status));err.status=r.status;err.code=data?.code;err.data=data;throw err;}
      return data;
    }catch(e){
      if(e?.name==='AbortError'){const err=new Error('Request timed out');err.code='REQUEST_TIMEOUT';throw err;}
      throw e;
    }finally{if(timer)clearTimeout(timer);}
  }

  async function createSession(stage, extra={}){
    if(!bookingEnabled) return null;
    try{
      const existing=getStore('voy_session_id');
      if(existing){await patchSession({stage,...extra});return {id:existing};}
      const storedFirst=analyticsAllowed()?(safeJSON(getStore('voy_first_attribution'))||attr):null;
      const exp=extra.experience_id||getStore('voy_experience_id')||null;
      const analyticsPayload=analyticsAllowed()?{
        visitor_id:visitorId,
        attribution:{first_touch:storedFirst,last_touch:attr},
        personalization_segment:segment,
        experiment_assignments:experiments,
        recent_events:recentEvents()
      }:{consent:'essential_only'};
      const data=await api('/sessions',{method:'POST',body:JSON.stringify({destination_id:destinationId,experience_id:exp,locale,stage,...analyticsPayload,...extra})});
      if(data?.id){
        setStore('voy_session_id',data.id);
        if(analyticsAllowed()){
          try{await api('/attribution/sync',{method:'POST',body:JSON.stringify({session_id:data.id,visitor_id:visitorId,attribution:{first_touch:storedFirst,last_touch:attr}})});}catch(e){}
          scheduleEventFlush(true);
        }
      }
      return data;
    }catch(e){return null;}
  }
  async function patchSession(extra={}){
    const sid=getStore('voy_session_id'); if(!sid||!bookingEnabled) return null;
    try{
      const result=await api('/sessions/'+encodeURIComponent(sid),{method:'PATCH',body:JSON.stringify({...extra,...(analyticsAllowed()?{recent_events:recentEvents()}:{})})});
      if(analyticsAllowed()) scheduleEventFlush(true);
      return result;
    }catch(e){return null;}
  }


  function enhanceFormLabels(root=document){
    let seq=0;
    root.querySelectorAll('label').forEach(label=>{
      if(label.htmlFor||label.querySelector('input,select,textarea')) return;
      const scope=label.closest('.field')||label.parentElement;
      const control=scope?.querySelector('input,select,textarea');
      if(!control) return;
      if(!control.id){
        seq+=1;
        control.id='voy-field-'+seq;
      }
      label.htmlFor=control.id;
    });
  }
  enhanceFormLabels();

  document.querySelectorAll('details[data-faq]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open) track('faq_opened',{question:d.dataset.faq});}));
  document.querySelectorAll('[data-review-source]').forEach(a=>a.addEventListener('click',()=>track('trust_source_clicked',{provider:a.dataset.reviewSource})));
  document.querySelectorAll('[data-related]').forEach(a=>a.addEventListener('click',()=>track('related_tour_clicked',{target:a.getAttribute('href')})));
  document.querySelectorAll('[data-tour-detail]').forEach(a=>a.addEventListener('click',()=>track('tour_detail_clicked',{target:a.getAttribute('href'),source:'tour_picker'})));
  document.querySelectorAll('[data-track]').forEach(el=>el.addEventListener('click',()=>{
    const name=el.dataset.track;
    if(name==='whatsapp_clicked') createSession('whatsapp_clicked',{page});
    else if(name==='booking_cta') createSession('booking_intent',{page});
    track(name==='booking_cta'?'hero_cta_clicked':name,{label:(el.textContent||'').trim().slice(0,120),href:el.getAttribute('href')});
  }));
  document.querySelectorAll('[data-wa]').forEach(a=>{a.href=whatsAppUrl();const refresh=()=>{a.href=whatsAppUrl();};a.addEventListener('pointerdown',refresh);a.addEventListener('click',refresh);});
  document.querySelectorAll('[data-special-request]').forEach(a=>a.addEventListener('click',()=>{
    const context=a.dataset.specialRequest||'private_flexible';
    a.href=whatsAppUrl(context);
    createSession('whatsapp_clicked',{page,context,...currentRequestDetails()});
    track('special_request_clicked',{context,page,...currentRequestDetails()});
  }));

  const productCache={bySlug:{},byId:{}};
  function ensureSpecialRequestBuilder(){
    if(document.body.dataset.intent!=='extended'||document.querySelector('[data-special-request-builder]')) return;
    const panel=document.querySelector('.special-request-panel');if(!panel)return;
    panel.classList.add('has-builder');
    const form=document.createElement('form');form.className='special-request-builder';form.dataset.specialRequestBuilder='';
    const riderOptions=Array.from({length:11},(_,i)=>i+2).map(n=>`<option value="${n}">${n}</option>`).join('');
    const guideOptions=BUDAPEST_GUIDE_LANGUAGES.map(code=>`<option value="${code}">${guideLanguageLabel(code)}</option>`).join('');
    form.innerHTML=`<div class="special-builder-head"><b>${t('Tell us what you need','ספרו לנו מה אתם צריכים')}</b><span>${t('We’ll send the details to the Budapest team on WhatsApp.','נשלח את הפרטים לצוות בודפשט ב‑WhatsApp.')}</span></div><div class="special-builder-grid"><label>${t('Preferred date','תאריך מועדף')}<input type="date" name="special_date" required></label><label>${t('Independent riders','רוכבים עצמאיים')}<select name="special_riders">${riderOptions}</select></label><label>${t('Guide language','שפת הדרכה')}<select name="special_guide_language" required><option value="">${t('Choose language','בחרו שפה')}</option>${guideOptions}</select></label><label>${t('Private?','פרטי?')}<select name="special_private"><option value="false">${t('No · regular extended request','לא · בקשת סיור ארוך רגיל')}</option><option value="true">${t('Yes · our group only','כן · רק הקבוצה שלנו')}</option></select></label><label>${t('Preferred start time','שעת יציאה מועדפת')} <small>${t('(optional)','(אופציונלי)')}</small><input type="time" name="special_time"></label></div><button class="btn alt" type="submit">${t('Send request on WhatsApp','שליחת בקשה ב‑WhatsApp')}</button><small class="special-builder-note">${t('This sends a request, not a confirmed booking. Our local team will confirm the route, time, vehicles and guide language.','זו בקשה ולא הזמנה מאושרת. הצוות המקומי יאשר מסלול, שעה, כלים, מדריכים ושפת הדרכה.')}</small>`;
    panel.appendChild(form);
    const date=form.querySelector('[name="special_date"]');date.min=budapestDate(0);date.max=budapestDate(365);date.value=budapestDate(1);
    form.addEventListener('submit',e=>{
      e.preventDefault();const data=new FormData(form);
      const details={experience_title:t('Extended Buda + Margaret','בודה + מרגיט — הסיור הארוך'),date:String(data.get('special_date')||''),requested_time:String(data.get('special_time')||''),riders:Number(data.get('special_riders')||2),children:0,babies:0,guide_language:String(data.get('special_guide_language')||'').trim().toLowerCase(),is_private:String(data.get('special_private'))==='true'};
      const href=whatsAppUrl('extended',details);
      track('special_request_builder_submitted',{context:'extended',page,...details});
      createSession('whatsapp_clicked',{page,context:'extended_builder',...details});
      location.href=href;
    });
  }
  ensureSpecialRequestBuilder();
  const aliasesFrom=(value)=>String(value||'').split(',').map(x=>x.trim()).filter(Boolean);
  function productByAliases(value,products=null){
    const aliases=aliasesFrom(value);
    const list=products||Object.values(productCache.byId);
    for(const slug of aliases){const p=productCache.bySlug[slug]||list.find(x=>x?.slug===slug);if(p)return p;}
    return null;
  }
  function setSelectedTourHint(p){
    const hint=document.querySelector('[data-selected-tour-hint]'); if(!hint||!p)return;
    const selectedTitle=localizedBudapestExperienceTitle(p,p.title);
    hint.textContent=t(`Selected: ${selectedTitle}. Choose your date and group size.`,`נבחר: ${selectedTitle}. עכשיו בחרו תאריך וגודל קבוצה.`);
    hint.classList.add('is-selected');
  }
  function hydrateTourCards(products=[]){
    document.querySelectorAll('[data-tour-card][data-experience-slugs]').forEach(card=>{
      const p=productByAliases(card.dataset.experienceSlugs,products);
      const price=card.querySelector('[data-tour-price]'), state=card.querySelector('[data-tour-live-state]');
      card.classList.remove('is-live','is-unavailable');
      if(p){
        card.dataset.productId=p.id||'';
        if(price&&p.priceFrom!=null) price.textContent=t('From ','החל מ־')+money(p.priceFrom,p.currency||'EUR');
        if(p.bookingEnabled===false){card.classList.add('is-unavailable');if(state)state.textContent=t('Contact the local team','פנו לצוות המקומי');}
        else {card.classList.add('is-live');if(state)state.textContent=t('Online booking','הזמנה באתר');}
      }else{card.classList.add('is-unavailable');if(state)state.textContent=t('Contact the local team','פנו לצוות המקומי');}
    });
  }
  function bindTourCardSelectors(){
    document.querySelectorAll('[data-select-experience]').forEach(link=>link.addEventListener('click',e=>{
      const card=link.closest('[data-tour-card]'); if(!card)return;
      const p=productByAliases(card.dataset.experienceSlugs);
      if(!p||p.bookingEnabled===false)return; // Keep the route-page fallback link when not live.
      const select=document.querySelector('select[name="experience"]'); if(!select)return;
      e.preventDefault(); select.disabled=false; select.value=p.id; select.dispatchEvent(new Event('change',{bubbles:true}));
      setSelectedTourHint(p);
      document.querySelector('#booking')?.scrollIntoView({behavior:'smooth',block:'start'});
      track('tour_card_selected',{experience_id:p.id,experience_slug:p.slug,source:'tour_picker'});
      patchSession({stage:'booking_intent',experience_id:p.id,page});
    }));
  }
  bindTourCardSelectors();

  function guideLanguagesForProduct(product){
    const live=Array.isArray(product?.guideLanguages)?product.guideLanguages.map(x=>String(x).toLowerCase()).filter(Boolean):[];
    return live.length?live:BUDAPEST_GUIDE_LANGUAGES;
  }
  function ensureGuideLanguageField(form){
    if(!form||form.querySelector('[data-guide-language-field]')) return;
    const dateField=form.querySelector('input[name="date"]')?.closest('.field');
    if(!dateField)return;
    const field=document.createElement('div');field.className='field guide-language-field';field.dataset.guideLanguageField='';
    field.innerHTML=`<label>${t('Guide language','שפת הדרכה')}</label><select name="guide_language" required aria-required="true"><option value="">${t('Choose guide language','בחרו שפת הדרכה')}</option></select><small>${t('Every booking must include the requested guiding language.','בכל הזמנה יש לבחור את שפת ההדרכה המבוקשת.')}</small>`;
    dateField.insertAdjacentElement('afterend',field);
    const select=field.querySelector('select');
    form._updateGuideLanguages=(product,{preserve=true}={})=>{
      const before=preserve?String(select.value||''):'';
      const languages=guideLanguagesForProduct(product);
      select.innerHTML=`<option value="">${t('Choose guide language','בחרו שפת הדרכה')}</option>`+languages.map(code=>`<option value="${escapeHTML(code)}">${escapeHTML(guideLanguageLabel(code))}</option>`).join('');
      const smartDefault=languages.includes(locale)?locale:(languages.includes('en')?'en':languages[0]||'');
      if(before&&languages.includes(before))select.value=before;else if(smartDefault)select.value=smartDefault;
      field.dataset.availableLanguages=languages.join(',');
    };
    form._updateGuideLanguages(null,{preserve:false});
  }
  function updateGuideLanguageField(product){
    const form=document.querySelector('#availability-form');
    if(form&&typeof form._updateGuideLanguages==='function')form._updateGuideLanguages(product);
  }

  function ensurePrivateUpgrade(form){
    if(!form||form.querySelector('[data-private-upgrade]')) return;
    const experienceField=form.querySelector('select[name="experience"]')?.closest('.field');
    if(!experienceField) return;
    const box=document.createElement('div');
    box.className='booking-mode-selector';box.dataset.privateUpgrade='';box.hidden=true;
    box.innerHTML=`<input type="hidden" name="is_private" value="false"><div class="booking-mode-head"><div><small>${t('TOUR STYLE','סוג הסיור')}</small><b>${t('Choose how you want to ride','בחרו איך תרצו לצאת')}</b></div><span data-booking-mode-note>${t('Final price is shown after you choose a departure.','המחיר הסופי מחושב בזמן אמת לאחר בחירת יציאה.')}</span></div><div class="booking-mode-grid"><button type="button" class="booking-mode-card is-active" data-booking-mode="standard" aria-pressed="true"><span class="booking-mode-check">✓</span><b>${t('Join a scheduled tour','להצטרף לסיור רגיל')}</b><small data-standard-mode-price>${t('Current rider price','מחיר נוכחי לרוכב')}</small><em>${t('Share the departure with other VOY PRO guests.','היציאה יכולה לכלול אורחי VOY PRO נוספים.')}</em></button><button type="button" class="booking-mode-card is-private" data-booking-mode="private" aria-pressed="false"><span class="booking-mode-check">✓</span><b>${t('Private tour · your group only','סיור פרטי · רק הקבוצה שלכם')}</b><small data-private-price>${t('Private upgrade shown before confirmation','תוספת לסיור פרטי מוצגת לפני האישור')}</small><em data-private-min></em></button></div><div class="booking-mode-foot"><a href="#" data-special-request="private_flexible" data-private-flexible>${t('Need a different private start time? Send a request with your date and group','צריכים שעה אחרת לסיור פרטי? שלחו בקשה עם התאריך והקבוצה')}</a><span>${t('Private availability requires an empty departure.','זמינות פרטית דורשת יציאה שטרם הוזמנה.')}</span></div>`;
    experienceField.insertAdjacentElement('afterend',box);
    const nudge=document.createElement('div');nudge.className='experience-nudge';nudge.dataset.experienceNudge='';nudge.hidden=true;box.insertAdjacentElement('afterend',nudge);
    const hidden=box.querySelector('input[name="is_private"]');
    const setMode=(mode,{silent=false}={})=>{
      const privateMode=mode==='private';
      hidden.value=privateMode?'true':'false';
      box.querySelectorAll('[data-booking-mode]').forEach(btn=>{
        const active=btn.dataset.bookingMode===mode;
        btn.classList.toggle('is-active',active);btn.setAttribute('aria-pressed',String(active));
      });
      if(!silent){
        releaseHold();
        document.querySelector('#live-checkout-shell')?.setAttribute('hidden','');
        const slots=document.querySelector('#slotlist');if(slots)slots.innerHTML='';
        const status=document.querySelector('#availability-status');if(status)status.textContent=privateMode?t('Private mode selected. Search again to see departures that can be reserved for your group only.','נבחר סיור פרטי. חפשו שוב כדי לראות יציאות שניתן לשמור רק לקבוצה שלכם.'):t('Scheduled tour selected. Search availability for your group.','נבחר סיור רגיל. חפשו זמינות לקבוצה שלכם.');
        setBookingStep(1);
        track('booking_mode_changed',{mode,page,experience_id:form.querySelector('select[name="experience"]')?.value||null});
        patchSession({stage:'booking_mode_changed',is_private:privateMode});
      }
    };
    box._setBookingMode=setMode;
    box.querySelectorAll('[data-booking-mode]').forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.bookingMode)));
    const link=box.querySelector('[data-special-request]');
    if(link)link.addEventListener('click',()=>{link.href=whatsAppUrl('private_flexible',{is_private:true});createSession('whatsapp_clicked',{page,context:'private_flexible',...currentRequestDetails(),is_private:true});track('special_request_clicked',{context:'private_flexible',page,...currentRequestDetails(),is_private:true});});
  }
  function updateExperienceNudge(product){
    const nudge=document.querySelector('[data-experience-nudge]');if(!nudge)return;
    const slug=String(product?.slug||'');
    const isCore=/buda-highlights|buda-castle|margaret-island/.test(slug);
    if(!isCore){nudge.hidden=true;nudge.innerHTML='';return;}
    const href=localeBudapestCore('tours/buda-margaret-extended-tour/');
    nudge.hidden=false;
    nudge.innerHTML=`<div><small>${t('MORE BUDAPEST','עוד מבודפשט')}</small><b>${t('Want Buda and Margaret Island in one longer experience?','רוצים את בודה ואת מרגיט בחוויה ארוכה אחת?')}</b><span>${t('See the Extended Buda + Margaret option before you choose a departure.','בדקו את אפשרות בודה + מרגיט הארוכה לפני בחירת היציאה.')}</span></div><a class="btn secondary" href="${href}" data-related>${t('See extended tour','לסיור הארוך')}</a>`;
    nudge.querySelector('a')?.addEventListener('click',()=>track('extended_route_nudge_clicked',{from_experience:product?.id||null,page}));
  }
  function enhanceBookingFormLayout(form){
    if(!form||form.dataset.conversionLayout==='ready')return;
    form.dataset.conversionLayout='ready';
    const partyNames=['adults','children','babies'];
    const partyFields=partyNames.map(name=>form.querySelector(`[name="${name}"]`)?.closest('.field')).filter(Boolean);
    if(partyFields.length===3){
      const grid=document.createElement('div');grid.className='party-fields';grid.setAttribute('aria-label',t('Group composition','הרכב הקבוצה'));
      partyFields[0].insertAdjacentElement('beforebegin',grid);partyFields.forEach(field=>grid.appendChild(field));
    }
    const submit=form.querySelector('button[type="submit"]');
    if(submit&&!form.querySelector('[data-booking-form-assurance]')){
      const assurance=document.createElement('div');assurance.className='booking-form-assurance';assurance.dataset.bookingFormAssurance='';
      assurance.textContent=t('Live availability · Final price before confirmation · Local support','זמינות בזמן אמת · מחיר סופי לפני אישור · תמיכה מקומית');
      submit.insertAdjacentElement('afterend',assurance);
    }
  }

  function updatePrivateUpgrade(product){
    const box=document.querySelector('[data-private-upgrade]');if(!box)return;
    const allowed=Boolean(product?.privateAllowed);box.hidden=!allowed;
    const hidden=box.querySelector('input[name="is_private"]');
    if(!allowed){if(hidden)hidden.value='false';updateExperienceNudge(product);return;}
    const surcharge=finiteNumber(product.privateSurchargePerRider);
    const min=Math.max(1,Number(product.privateMinRiders||2));
    const standardPrice=box.querySelector('[data-standard-mode-price]');
    if(standardPrice)standardPrice.textContent=finiteNumber(product.priceFrom)!=null?t(`${money(product.priceFrom,product.currency||'EUR')} per independent rider`,`‏${money(product.priceFrom,product.currency||'EUR')} לרוכב עצמאי`):t('Current rider price','מחיר נוכחי לרוכב');
    const price=box.querySelector('[data-private-price]');
    if(price)price.textContent=surcharge!=null?t(`Regular rate + ${money(surcharge,product.currency||'EUR')} per rider`,`מחיר רגיל + ${money(surcharge,product.currency||'EUR')} לכל רוכב`):t('Private surcharge shown before confirmation','תוספת הסיור הפרטי תוצג במחיר החי');
    const minNode=box.querySelector('[data-private-min]');if(minNode)minNode.textContent=t(`Available from ${min} independent riders.`,`זמין החל מ־${min} רוכבים עצמאיים.`);
    const flexible=box.querySelector('[data-private-flexible]');if(flexible)flexible.hidden=product.flexibleDepartureWhenPrivate===false;
    const defaultMode=page.includes('/private-tours/')?'private':'standard';
    if(typeof box._setBookingMode==='function')box._setBookingMode(defaultMode,{silent:true});
    updateExperienceNudge(product);
  }


  const RECOVERY_TTL_MS=2*60*60*1000;
  function savedSelectionRecovery(){
    const state=safeJSON(getStore('voy_recovery_state'));
    if(!state||!state.saved_at||Date.now()-Number(state.saved_at)>RECOVERY_TTL_MS){delStore('voy_recovery_state');return null;}
    if(!state.experience_id||!state.date||!state.composition)return null;
    return state;
  }
  function saveSelectionRecovery(experience,date,composition,isPrivate,guideLanguage){
    if(!experience?.id||!date||!composition)return;
    setStore('voy_recovery_state',JSON.stringify({version:1,saved_at:Date.now(),experience_id:experience.id,experience_slug:experience.slug||null,experience_title:experience.title||null,date,composition:{riders_16_plus:Number(composition.riders_16_plus||0),child_passengers_3_15:Number(composition.child_passengers_3_15||0),baby_passengers_1_2:Number(composition.baby_passengers_1_2||0),request_15yo_independent_assessment:Boolean(composition.request_15yo_independent_assessment)},is_private:Boolean(isPrivate),guide_language:String(guideLanguage||'').trim().toLowerCase()||null}));
  }
  async function initSelectionRecovery(){
    const shell=document.querySelector('[data-resume-booking]');if(!shell)return;
    const state=savedSelectionRecovery();if(!state){shell.hidden=true;return;}
    const title=shell.querySelector('[data-resume-title]');if(title)title.textContent=t('Restore your last tour selection','שחזור הבחירה האחרונה');
    const sub=shell.querySelector('[data-resume-sub]');if(sub)sub.textContent=t('We will recheck availability and price before anything is confirmed.','נבדוק מחדש זמינות ומחיר חיים לפני אישור כלשהו.');
    const cta=shell.querySelector('[data-resume-cta]');if(!cta)return;
    cta.textContent=t('Restore selection','שחזור בחירה');shell.hidden=false;
    cta.onclick=async e=>{
      e.preventDefault();
      const form=document.querySelector('#availability-form');if(!form)return;
      if(!productCache.byId[state.experience_id])await hydrateCatalog();
      const experience=productCache.byId[state.experience_id];if(!experience){delStore('voy_recovery_state');shell.hidden=true;return;}
      const select=form.querySelector('[name="experience"]');if(select){select.value=experience.id;select.dispatchEvent(new Event('change',{bubbles:true}));}
      const date=form.querySelector('[name="date"]');if(date)date.value=state.date;
      const adults=form.querySelector('[name="adults"]');if(adults)adults.value=String(state.composition.riders_16_plus||1);
      const children=form.querySelector('[name="children"]');if(children)children.value=String(state.composition.child_passengers_3_15||0);
      const babies=form.querySelector('[name="babies"]');if(babies)babies.value=String(state.composition.baby_passengers_1_2||0);
      const language=form.querySelector('[name="guide_language"]');if(language&&state.guide_language)language.value=state.guide_language;
      const mode=document.querySelector('[data-private-upgrade]');if(mode&&typeof mode._setBookingMode==='function')mode._setBookingMode(state.is_private?'private':'standard',{silent:true});
      setSelectedTourHint(experience);updatePrivateUpgrade(experience);
      const status=document.querySelector('#availability-status');if(status)status.textContent=t('Selection restored. Search again to recheck availability and price.','הבחירה שוחזרה. חפשו שוב כדי לבדוק מחדש זמינות ומחיר חיים.');
      track('selection_recovery_restored',{experience_id:experience.id,date:state.date,is_private:Boolean(state.is_private),guide_language:state.guide_language||null});patchSession({stage:'selection_recovery_restored',experience_id:experience.id,selected_date:state.date,is_private:Boolean(state.is_private),guide_language:state.guide_language||null});
      shell.hidden=true;form.scrollIntoView({behavior:'smooth',block:'center'});
    };
  }

  function fallbackBudapestProducts(){
    const title=(en,he,hu)=>locale==='he'?he:locale==='hu'?hu:en;
    return [
      {id:'exp_bud_buda',slug:'buda-highlights',title:title('Buda Highlights by EZRaider','סיור בודה על EZRaider','Budai városnézés EZRaiderrel'),durationMinutes:120,basePrice:70,priceFrom:70,currency:'EUR',maxIndependentRiders:12,bookingEnabled:true,privateAllowed:true,privateSurchargePerRider:30,privateMinRiders:2,flexibleDepartureWhenPrivate:true,guideLanguages:['en','he','hu','es']},
      {id:'exp_bud_margaret',slug:'margaret-island',title:title('Margaret Island by EZRaider','סיור אי מרגיט על EZRaider','Margitsziget EZRaiderrel'),durationMinutes:120,basePrice:70,priceFrom:70,currency:'EUR',maxIndependentRiders:12,bookingEnabled:true,privateAllowed:true,privateSurchargePerRider:30,privateMinRiders:2,flexibleDepartureWhenPrivate:true,guideLanguages:['en','he','hu','es']}
    ];
  }
  function localizedBudapestExperienceTitle(experience,fallbackTitle=''){
    const raw=[experience?.slug,experience?.id,experience?.title,fallbackTitle].filter(Boolean).join(' ').toLowerCase();
    if(raw.includes('extended')||(raw.includes('buda')&&raw.includes('margaret')))return locale==='he'?'סיור ארוך בודה + מרגיט':locale==='hu'?'Buda + Margitsziget hosszabb túra':'Extended Buda + Margaret Tour';
    const localized=fallbackBudapestProducts().find(p=>String(p.id)===String(experience?.id||'')||p.slug===experience?.slug);
    return String(localized?.title||experience?.title||fallbackTitle||'').trim();
  }
  function seedExperienceSelects(selects,products){
    (products||[]).forEach(p=>{productCache.bySlug[p.slug]=p;productCache.byId[p.id]=p;});
    selects.forEach(s=>{
      const before=s.value;
      s.innerHTML='';
      (products||[]).forEach(p=>{const o=document.createElement('option');o.value=p.id;o.dataset.slug=p.slug;o.textContent=localizedBudapestExperienceTitle(p,p.title);s.appendChild(o);});
      if(before&&(products||[]).some(p=>p.id===before))s.value=before;
    });
  }

  async function hydrateCatalog(){
    const selects=[...document.querySelectorAll('select[name="experience"]')];
    const provisional=fallbackBudapestProducts();
    seedExperienceSelects(selects,provisional);
    if(!bookingEnabled){
      selects.forEach(s=>{s.innerHTML=`<option value="">${t('Online booking is temporarily unavailable','ההזמנה החיה בתהליך חיבור')}</option>`;s.disabled=true;});
      hydrateTourCards([]); return [];
    }
    try{
      let catalogFallback=false;
      let products=[];
      try{products=await api('/experiences',{method:'GET',timeoutMs:5000});}
      catch(catalogError){catalogFallback=true;products=fallbackBudapestProducts();}
      if(!Array.isArray(products)||!products.length){catalogFallback=true;products=fallbackBudapestProducts();}
      (products||[]).forEach(p=>{productCache.bySlug[p.slug]=p;productCache.byId[p.id]=p;});
      hydrateTourCards(products||[]);
      const bookable=(products||[]).filter(p=>p.bookingEnabled!==false);
      const requested=qs.get('experience');
      const intentAliases=requested?[requested]:(page.includes('buda-margaret-extended')?['buda-margaret-extended','extended-buda-margaret','buda-and-margaret','buda-margaret']:(page.includes('margaret-island')?['margaret-island','margaret-island-tour']:['buda-highlights','buda-castle']));
      const intended=intentAliases.map(slug=>bookable.find(p=>p.slug===slug)).find(Boolean)||null;
      selects.forEach(s=>{
        const before=s.value;
        s.innerHTML=''; s.disabled=false;
        bookable.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.dataset.slug=p.slug;o.textContent=localizedBudapestExperienceTitle(p,p.title);s.appendChild(o);});
        if(before&&bookable.some(p=>p.id===before))s.value=before;
        else if(intended)s.value=intended.id;
      });
      const isSpecialPage=page.includes('margaret-island')||page.includes('buda-margaret-extended');
      const selectedId=selects.find(s=>s.value)?.value||null;
      const active=(selectedId?bookable.find(p=>p.id===selectedId):null)||intended||(!isSpecialPage?bookable[0]:null);
      if(catalogFallback){
        const st=document.querySelector('#availability-status');
        if(st)st.textContent=locale==='he'?'בחרו סיור, תאריך וקבוצה. הזמינות העדכנית תיבדק בעת החיפוש.':locale==='hu'?'Válassz túrát, dátumot és létszámot. Az aktuális elérhetőséget a kereséskor ellenőrizzük.':'Choose a tour, date and group. Live availability will be checked when you search.';
      }
      if(active){setStore('voy_experience_id',active.id);hydratePrice(active);setSelectedTourHint(active);updatePrivateUpgrade(active);updateGuideLanguageField(active);}
      if(isSpecialPage&&!intended){
        const isExtended=page.includes('buda-margaret-extended');
        const label=isExtended?t('Extended Buda + Margaret — contact us','בודה + מרגיט — פנו אלינו'):t('Margaret Island — contact us','אי מרגיט — פנו אלינו');
        selects.forEach(s=>{s.innerHTML=`<option value="">${label}</option>`;s.disabled=true;});
        document.querySelectorAll('[data-runtime-price]').forEach(n=>n.textContent=t('Contact us for this route','פנו אלינו לגבי המסלול'));
        const st=document.querySelector('#availability-status');if(st)st.textContent=isExtended?t('The extended Buda + Margaret tour is currently confirmed by the local team. Contact us on WhatsApp.','הסיור הארוך בודה + מרגיט מתואם כרגע מול הצוות המקומי. אפשר לפנות אלינו ב‑WhatsApp.'):t('Margaret Island is currently confirmed by the local team. Contact us on WhatsApp, or view the Buda tour for online booking.','אי מרגיט מתואם כרגע מול הצוות המקומי. אפשר לפנות אלינו ב‑WhatsApp, או לעבור לסיור בודה להזמנה באתר.');
        const submit=document.querySelector('#availability-form button[type="submit"]'); if(submit) submit.disabled=true;
      }
      return products||[];
    }catch(e){selects.forEach(s=>{s.innerHTML=`<option value="">${t('Tour options are temporarily unavailable','הקטלוג החי אינו זמין')}</option>`;s.disabled=true;});hydrateTourCards([]);return []}
  }
  function hydratePrice(p){
    if(!p||p.priceFrom==null)return; document.querySelectorAll('[data-runtime-price]').forEach(n=>n.textContent=t('From ','החל מ־')+money(p.priceFrom,p.currency||'EUR'));
  }

  function ensureCheckoutShell(){
    const booking=document.querySelector('#booking .booking-grid'); if(!booking||document.querySelector('#live-checkout-shell')) return;
    const shell=document.createElement('div');shell.id='live-checkout-shell';shell.className='live-checkout-shell';shell.hidden=true;
    shell.innerHTML=`<div class="panel checkout-panel"><div class="checkout-title-row"><div><div class="eyebrow">${t('BOOKING','הזמנה')}</div><h3 data-checkout-heading>${t('Complete your booking','השלמת ההזמנה')}</h3></div><button type="button" class="checkout-edit" data-checkout-edit>${t('Change selection','שינוי בחירה')}</button></div><div data-checkout-summary class="checkout-summary"></div><div class="checkout-assurance"><span>${t('Current price','מחיר נוכחי')}</span><span>${t('Places held while you finish','המקומות נשמרים בזמן השלמת ההזמנה')}</span><span>${t('Direct Budapest team','צוות בודפשט ישירות')}</span></div><div data-hold-timer class="hold-timer"></div><section data-ancillary-upsell class="ancillary-upsell" hidden></section><form id="live-checkout-form"><div class="checkout-fields"><div class="field"><label>${t('Full name','שם מלא')}</label><input name="full_name" required autocomplete="name"></div><div class="field"><label>Email</label><input name="email" type="email" required autocomplete="email"></div><div class="field"><label>${t('Phone','טלפון')}</label><input name="phone" required autocomplete="tel"></div><div class="field payment-field"><label>${t('Payment','תשלום')}</label><select name="payment_method"><option value="pay_arrival_card">${t('Pay by card on arrival','תשלום בכרטיס במקום')}</option><option value="pay_arrival_cash">${t('Pay cash on arrival','תשלום במזומן במקום')}</option></select><small class="payment-method-note" data-payment-method-note aria-live="polite">${escapeHTML(paymentMethodHelp('pay_arrival_card'))}</small></div></div><div class="checkout-legal" data-checkout-legal><label><input type="checkbox" name="legal_acceptance" required><span>${t('I accept the Terms of Use and confirm I have read the Privacy Notice.','אני מאשר/ת את תנאי השימוש ומאשר/ת שקראתי את הצהרת הפרטיות.')} <a href="${legalBasePath()}terms/" target="_blank" rel="noopener">${t('Terms of Use','תנאי שימוש')}</a> · <a href="${legalBasePath()}privacy/" target="_blank" rel="noopener">${t('Privacy Notice','הצהרת פרטיות')}</a></span></label></div><button class="btn checkout-confirm" type="submit">${t('Book now – payment obligation','אישור הזמנה – התחייבות לתשלום')}</button><div class="status" data-checkout-status></div></form></div>`;
    (booking.firstElementChild||booking).appendChild(shell);
    shell.querySelector('[data-checkout-edit]')?.addEventListener('click',()=>{
      releaseHold();shell.hidden=true;setBookingStep(1);
      const slots=document.querySelector('#slotlist');if(slots)slots.innerHTML='';
      const status=document.querySelector('#availability-status');if(status)status.textContent=t('Selection unlocked. Update the tour, date or group and search again.','הבחירה נפתחה מחדש. עדכנו סיור, תאריך או קבוצה וחפשו שוב.');
      document.querySelector('#availability-form')?.scrollIntoView({behavior:'smooth',block:'center'});
      track('checkout_edit_selection',{page});patchSession({stage:'selection_edit'});
    });
  }
  ensureCheckoutShell();

  function paymentMethodHelp(method){
    const copy={
      en:{
        pay_now_card:'Secure online card payment. You will continue to the secure payment page after confirming.',
        pay_arrival_card:'Reserve now and pay by card at the meeting point.',
        pay_arrival_cash:'Reserve now and pay cash at the meeting point.'
      },
      he:{
        pay_now_card:'תשלום מאובטח בכרטיס אונליין. לאחר האישור תעברו לעמוד התשלום המאובטח.',
        pay_arrival_card:'שומרים את ההזמנה עכשיו ומשלמים בכרטיס בנקודת המפגש.',
        pay_arrival_cash:'שומרים את ההזמנה עכשיו ומשלמים במזומן בנקודת המפגש.'
      },
      hu:{
        pay_now_card:'Biztonságos online bankkártyás fizetés. A megerősítés után a biztonságos fizetési oldalra lépsz.',
        pay_arrival_card:'Foglalj most, és fizess bankkártyával a találkozási ponton.',
        pay_arrival_cash:'Foglalj most, és fizess készpénzzel a találkozási ponton.'
      }
    };
    const lang=copy[locale]||copy.en;
    return lang[method]||lang.pay_arrival_card;
  }

  let paymentCapabilities={online_card:false};
  async function hydratePaymentMethods(){
    const select=document.querySelector('#live-checkout-form [name=\"payment_method\"]');
    if(!select||!bookingEnabled)return;
    try{
      const caps=await api('/payments/capabilities',{method:'GET',timeoutMs:5000});
      paymentCapabilities=caps||paymentCapabilities;
      if(caps?.online_card&&!select.querySelector('option[value=\"pay_now_card\"]')){
        const option=document.createElement('option');
        option.value='pay_now_card';
        option.textContent=t('Pay now by card','תשלום מיידי בכרטיס');
        option.defaultSelected=true;
        option.selected=true;
        select.insertBefore(option,select.firstChild);
      }
      const submit=document.querySelector('#live-checkout-form button[type=\"submit\"]');
      const note=document.querySelector('#live-checkout-form [data-payment-method-note]');
      const sync=()=>{
        if(submit)submit.textContent=select.value==='pay_now_card'?t('Continue to secure card payment','המשך לתשלום מאובטח בכרטיס'):t('Book now – payment obligation','אישור הזמנה – התחייבות לתשלום');
        if(note)note.textContent=paymentMethodHelp(select.value);
      };
      select._voySyncPayment=sync;
      select.addEventListener('change',sync);sync();
    }catch{}
  }
  let bookingState={slot:null,composition:null,quote:null,hold:null,experience:null,date:null,isPrivate:false,guideLanguage:null,idempotencyKey:null,extras:[],ancillaryOffers:[]};
  hydratePaymentMethods();
  let holdTimer=null;
  function releaseHold(){const id=bookingState.hold?.id;if(id&&bookingEnabled){api('/holds/'+encodeURIComponent(id),{method:'DELETE'}).catch(()=>{});}bookingState.hold=null;if(holdTimer)clearInterval(holdTimer);}
  function startHoldTimer(expires){const node=document.querySelector('[data-hold-timer]');if(!node)return;if(holdTimer)clearInterval(holdTimer);const tick=()=>{const left=Math.max(0,new Date(expires).getTime()-Date.now());if(!left){node.textContent=t('Hold expired — select the departure again.','שמירת המקום פגה — יש לבחור שעה מחדש.');clearInterval(holdTimer);bookingState.hold=null;patchSession({stage:'hold_expired',hold_expired_at:now()});return;}const m=Math.floor(left/60000),s=Math.floor((left%60000)/1000);node.textContent=t(`Your places are held for ${m}:${String(s).padStart(2,'0')}`,`המקומות נשמרים למשך ${m}:${String(s).padStart(2,'0')}`);};tick();holdTimer=setInterval(tick,1000);}

  function setBookingStep(step){
    document.querySelectorAll('[data-booking-step]').forEach(el=>{
      const n=Number(el.getAttribute('data-booking-step'));
      el.classList.toggle('is-active',n===step);
      el.classList.toggle('is-done',n<step);
    });
    const mobileCta=document.querySelector('.mobilebook .btn');
    if(mobileCta){
      if(step===3){mobileCta.textContent=t('Complete booking','השלמת הזמנה');mobileCta.setAttribute('href','#live-checkout-shell');}
      else if(step===2){mobileCta.textContent=t('Choose a time','בחירת שעה');mobileCta.setAttribute('href','#slotlist');}
      else{mobileCta.textContent=t('Check availability','בדיקת זמינות');mobileCta.setAttribute('href','#booking');}
    }
  }

  function resetCheckoutMode(){
    const shell=document.querySelector('#live-checkout-shell'); if(!shell) return;
    const form=shell.querySelector('#live-checkout-form');
    shell.querySelector('[data-checkout-heading]').textContent=t('Complete your booking','השלמת ההזמנה');
    const pay=form?.querySelector('[name="payment_method"]')?.closest('.field'); if(pay) pay.hidden=false;
    const legal=form?.querySelector('[data-checkout-legal]'); if(legal){legal.hidden=false;const box=legal.querySelector('input');if(box){box.required=true;box.checked=false;}}
    const submit=form?.querySelector('button[type="submit"]'); if(submit) submit.textContent=t('Book now – payment obligation','אישור הזמנה – התחייבות לתשלום');
    const st=shell.querySelector('[data-checkout-status]'); if(st) st.textContent='';
  }

  function renderPartySummary(composition){
    const chips=[];
    if(Number(composition?.riders_16_plus||0)>0)chips.push(`<span>${t('Riders 16+','רוכבים 16+')} · ${Number(composition.riders_16_plus)}</span>`);
    if(Number(composition?.child_passengers_3_15||0)>0)chips.push(`<span>${t('Children 3–15','ילדים 3–15')} · ${Number(composition.child_passengers_3_15)}</span>`);
    if(Number(composition?.baby_passengers_1_2||0)>0)chips.push(`<span>${t('Babies 1–2','פעוטות 1–2')} · ${Number(composition.baby_passengers_1_2)}</span>`);
    return chips.length?`<div class="party-summary">${chips.join('')}</div>`:'';
  }


  const ANCILLARY_COPY={
    en:{
      kicker:'MAKE THE RIDE YOURS',title:'Upgrade your ride before you go',
      intro:'Stay warmer, ride more comfortably and capture better memories with extras chosen for your tour.',
      sale:'BUY',rental:'RENT',add:'Add',added:'Added',soldout:'Unavailable',
      paymentNote:'Selected extras are included in your booking total and follow your selected payment method.',
      updating:'Updating your total…',winter:'Winter comfort',gear:'Tour extra',
      rentalNote:'Rental for your tour',saleNote:'Yours to keep',perTour:'per tour',each:'each',
      decrease:'Decrease quantity',increase:'Increase quantity',quantity:'Quantity',selectedExtras:'Selected extras',
      loadError:'Extras could not be loaded right now. You can continue booking without them.'
    },
    he:{
      kicker:'משדרגים את החוויה',title:'משדרגים את הרכיבה לפני שיוצאים',
      intro:'יותר חום, יותר נוחות וזיכרונות טובים יותר – תוספות שנבחרו במיוחד לסיור שלכם.',
      sale:'קנייה',rental:'השכרה',add:'הוספה',added:'נוסף',soldout:'לא זמין',
      paymentNote:'התוספות נכללות בסכום ההזמנה ומשולמות בהתאם לאמצעי התשלום שבחרתם.',
      updating:'מעדכנים את המחיר…',winter:'נוחות לחורף',gear:'תוספת לסיור',
      rentalNote:'השכרה למשך הסיור',saleNote:'נשאר אצלכם',perTour:'לסיור',each:'ליחידה',
      decrease:'הפחתת כמות',increase:'הגדלת כמות',quantity:'כמות',selectedExtras:'תוספות שנבחרו',
      loadError:'לא הצלחנו לטעון כרגע את התוספות. אפשר להמשיך בהזמנה בלעדיהן.'
    },
    hu:{
      kicker:'TEDD TELJESEBBÉ AZ ÉLMÉNYT',title:'Tedd még jobbá a túrát indulás előtt',
      intro:'Több meleg, nagyobb kényelem és jobb emlékek – a túrádhoz válogatott kiegészítőkkel.',
      sale:'VÁSÁRLÁS',rental:'BÉRLÉS',add:'Hozzáadás',added:'Hozzáadva',soldout:'Nem elérhető',
      paymentNote:'A kiválasztott kiegészítők bekerülnek a foglalás végösszegébe, és a választott fizetési mód szerint fizetendők.',
      updating:'Ár frissítése…',winter:'Téli kényelem',gear:'Túra kiegészítő',
      rentalNote:'Bérlés a túra idejére',saleNote:'Megtarthatod',perTour:'túránként',each:'darabonként',
      decrease:'Mennyiség csökkentése',increase:'Mennyiség növelése',quantity:'Mennyiség',selectedExtras:'Kiválasztott extrák',
      loadError:'A kiegészítőket most nem sikerült betölteni. A foglalást nélkülük is folytathatod.'
    }
  };
  const ancillaryText=(key)=>ANCILLARY_COPY[locale]?.[key]||ANCILLARY_COPY.en[key]||key;
  const ancillaryIcon=(offer)=>{
    const sku=String(offer?.sku||'').toUpperCase(),category=String(offer?.metadata?.category||'').toLowerCase();
    if(sku.includes('GOPRO'))return '🎥';
    if(sku.includes('DRONE'))return '🚁';
    if(sku.includes('HAT'))return '🧢';
    if(sku.includes('SCARF'))return '🧣';
    if(sku.includes('WARMER')||category==='cold_weather')return '🧥';
    return offer?.product_kind==='rental'?'📷':'✨';
  };
  function ancillaryDisplayName(offer){
    const sku=String(offer?.sku||'').toUpperCase();
    const copy={
      en:{GOPRO:'GoPro rental',WARMER:'Body warmer pack',HAT:'Fleece hat',SCARF:'Fleece scarf',DRONE:'Drone rental'},
      he:{GOPRO:'השכרת GoPro',WARMER:'ערכת חימום לגוף',HAT:'כובע פליז',SCARF:'צעיף פליז',DRONE:'השכרת רחפן'},
      hu:{GOPRO:'GoPro bérlés',WARMER:'Testmelegítő csomag',HAT:'Polár sapka',SCARF:'Polár sál',DRONE:'Drónbérlés'}
    };
    const lang=copy[locale]||copy.en;
    if(sku.includes('GOPRO'))return lang.GOPRO;
    if(sku.includes('WARMER'))return lang.WARMER;
    if(sku.includes('HAT'))return lang.HAT;
    if(sku.includes('SCARF'))return lang.SCARF;
    if(sku.includes('DRONE'))return lang.DRONE;
    return offer?.name||offer?.sku||'Extra';
  }
  function ancillaryPitch(offer){
    const sku=String(offer?.sku||'').toUpperCase();
    const copy={
      en:{
        GOPRO:'Film like a pro — capture the ride with a GoPro. Phone use is not allowed while riding.',
        WARMER:'Cold outside? Add extra warmth and stay comfortable throughout the ride.',
        HAT:'Keep your head warm and stay comfortable on colder rides.',
        SCARF:'Block the chill around your neck and enjoy a warmer, more comfortable ride.',
        DRONE:'Add a cinematic perspective to your Budapest memories — drone rental available where permitted.'
      },
      he:{
        GOPRO:'צלמו כמו מקצוענים – תעדו את הרכיבה עם GoPro. השימוש בטלפון אסור במהלך הרכיבה.',
        WARMER:'קר בחוץ? הוסיפו חימום נוסף ושמרו על נוחות לאורך כל הרכיבה.',
        HAT:'שמרו על הראש חם ותיהנו מרכיבה נוחה יותר בימים קרים.',
        SCARF:'חסמו את הקור באזור הצוואר ותיהנו מרכיבה חמה ונוחה יותר.',
        DRONE:'הוסיפו זווית קולנועית לזיכרונות מבודפשט – השכרת רחפן זמינה במקומות שבהם הדבר מותר.'
      },
      hu:{
        GOPRO:'Videózz profiként – örökítsd meg a túrát GoPróval. Menet közben a telefon használata nem megengedett.',
        WARMER:'Hideg van? Adj extra meleget, és maradj kényelmes az egész túra alatt.',
        HAT:'Tartsd melegen a fejed, és élvezd kényelmesebben a hidegebb túrákat.',
        SCARF:'Védd a nyakad a hidegtől, és élvezd melegebben, kényelmesebben a túrát.',
        DRONE:'Adj filmes perspektívát a budapesti emlékeidhez – drónbérlés ott érhető el, ahol ez megengedett.'
      }
    };
    const lang=copy[locale]||copy.en;
    if(sku.includes('GOPRO'))return lang.GOPRO;
    if(sku.includes('WARMER'))return lang.WARMER;
    if(sku.includes('HAT'))return lang.HAT;
    if(sku.includes('SCARF'))return lang.SCARF;
    if(sku.includes('DRONE'))return lang.DRONE;
    return offer?.product_kind==='rental'?ancillaryText('rentalNote'):ancillaryText('saleNote');
  }
  function ancillaryCta(offer){
    const sku=String(offer?.sku||'').toUpperCase();
    const copy={
      en:{GOPRO:'Rent GoPro',WARMER:'Add warmth',HAT:'Add hat',SCARF:'Add scarf',DRONE:'Rent drone'},
      he:{GOPRO:'השכרת GoPro',WARMER:'הוספת חימום',HAT:'הוספת כובע',SCARF:'הוספת צעיף',DRONE:'השכרת רחפן'},
      hu:{GOPRO:'GoPro bérlése',WARMER:'Extra meleg',HAT:'Sapka hozzáadása',SCARF:'Sál hozzáadása',DRONE:'Drón bérlése'}
    };
    const lang=copy[locale]||copy.en;
    if(sku.includes('GOPRO'))return lang.GOPRO;
    if(sku.includes('WARMER'))return lang.WARMER;
    if(sku.includes('HAT'))return lang.HAT;
    if(sku.includes('SCARF'))return lang.SCARF;
    if(sku.includes('DRONE'))return lang.DRONE;
    return ancillaryText('add');
  }
  function ancillaryAvailabilityNote(offer){
    if(offer?.available_quantity==null)return '';
    const available=Math.max(0,Number(offer.available_quantity||0));
    if(available<1||available>2)return '';
    if(locale==='he')return available===1?'נותרה יחידה אחת ליציאה הזו':'נותרו 2 יחידות ליציאה הזו';
    if(locale==='hu')return available===1?'1 darab érhető el ehhez az induláshoz':'2 darab érhető el ehhez az induláshoz';
    return available===1?'1 available for this departure':'2 available for this departure';
  }
  function syncAncillaryPaymentAvailability(){
    const select=document.querySelector('#live-checkout-form [name="payment_method"]');
    if(select&&typeof select._voySyncPayment==='function')select._voySyncPayment();
  }
  function selectedAncillaryDetails(){
    const extras=Array.isArray(bookingState.extras)?bookingState.extras.filter(x=>Number(x?.quantity||0)>0):[];
    const offers=Array.isArray(bookingState.ancillaryOffers)?bookingState.ancillaryOffers:[];
    return extras.map(extra=>{
      const offer=offers.find(x=>String(x.product_id)===String(extra.product_id));
      return {name:offer?ancillaryDisplayName(offer):String(extra.product_id),quantity:Number(extra.quantity||0)};
    });
  }
  function renderSelectedAncillarySummary(){
    const items=selectedAncillaryDetails();
    if(!items.length)return '';
    const rows=items.map(item=>`<span><b>${escapeHTML(item.name)}</b><strong>×${item.quantity}</strong></span>`).join('');
    return `<div class="checkout-extras-summary"><small>${escapeHTML(ancillaryText('selectedExtras'))}</small><div>${rows}</div></div>`;
  }
  function renderConfirmationAncillarySummary(){
    const items=selectedAncillaryDetails();
    if(!items.length)return '';
    const rows=items.map(item=>`<span><b>${escapeHTML(item.name)}</b><strong>×${item.quantity}</strong></span>`).join('');
    return `<div class="confirmation-extras"><small>${escapeHTML(ancillaryText('selectedExtras'))}</small><div>${rows}</div></div>`;
  }

  function renderStandardCheckoutSummary(){
    const shell=document.querySelector('#live-checkout-shell');
    if(!shell||!bookingState.experience||!bookingState.slot)return;
    const privateLabel=bookingState.isPrivate
      ?`<span class="checkout-private-flag">${t('Private tour · your group only','סיור פרטי · הקבוצה שלכם בלבד')}</span>`
      :`<span class="checkout-standard-flag">${t('Scheduled tour','סיור רגיל')}</span>`;
    const sum=shell.querySelector('[data-checkout-summary]');
    const checkoutTourTitle=localizedBudapestExperienceTitle(bookingState.experience);
    if(sum)sum.innerHTML=`<div class="checkout-summary-head"><div><b>${escapeHTML(checkoutTourTitle)}</b><span>${escapeHTML(confirmationDateLabel(bookingState.date))} · ${escapeHTML(confirmationTimeLabel(bookingState.slot.time))}</span></div>${privateLabel}</div>${renderPartySummary(bookingState.composition)}<div class="party-summary"><span>${t('Guide language','שפת הדרכה')} · ${escapeHTML(guideLanguageLabel(bookingState.guideLanguage))}</span></div>${renderSelectedAncillarySummary()}${renderQuoteBreakdown(bookingState.quote)}`;
  }
  function selectedAncillaryQuantity(productId){
    const hit=(bookingState.extras||[]).find(x=>String(x.product_id)===String(productId));
    return Number(hit?.quantity||0);
  }
  function renderAncillaryOffers(){
    const node=document.querySelector('[data-ancillary-upsell]');
    if(!node)return;
    const offers=Array.isArray(bookingState.ancillaryOffers)?bookingState.ancillaryOffers:[];
    if(!offers.length){node.hidden=true;node.innerHTML='';return;}
    node.hidden=false;
    const cards=offers.map(offer=>{
      const available=offer.available_quantity==null?99:Math.max(0,Number(offer.available_quantity||0));
      const maxConfigured=offer.max_per_booking==null?99:Math.max(1,Number(offer.max_per_booking||1));
      const max=Math.max(0,Math.min(available,maxConfigured));
      const qty=Math.min(selectedAncillaryQuantity(offer.product_id),max);
      const unavailable=max<=0;
      const price=money(Number(offer.price_minor||0)/100,offer.currency||bookingState.quote?.currency||'EUR');
      const category=String(offer?.metadata?.category||'').toLowerCase();
      const kind=offer.product_kind==='rental'?'rental':'sale';
      const badge=kind==='rental'?ancillaryText('rental'):ancillaryText('sale');
      const note=ancillaryPitch(offer);
      const availabilityNote=ancillaryAvailabilityNote(offer);
      return `<article class="ancillary-card ${qty?'is-selected':''} ${unavailable?'is-unavailable':''}" data-ancillary-product="${escapeHTML(offer.product_id)}">
        <div class="ancillary-visual"><span aria-hidden="true">${ancillaryIcon(offer)}</span><em>${escapeHTML(category==='cold_weather'?ancillaryText('winter'):ancillaryText('gear'))}</em></div>
        <div class="ancillary-card-body">
          <div class="ancillary-card-top"><span class="ancillary-kind ${kind}">${escapeHTML(badge)}</span><strong class="ancillary-price"><span>${escapeHTML(price)}</span><small>${escapeHTML(kind==='rental'?ancillaryText('perTour'):ancillaryText('each'))}</small></strong></div>
          <h4>${escapeHTML(ancillaryDisplayName(offer))}</h4><p>${escapeHTML(note)}</p>
          ${availabilityNote?`<div class="ancillary-availability" aria-label="${escapeHTML(availabilityNote)}">● ${escapeHTML(availabilityNote)}</div>`:''}
          ${unavailable?`<button type="button" class="ancillary-soldout" disabled>${escapeHTML(ancillaryText('soldout'))}</button>`:
          qty===0
            ?`<button type="button" class="ancillary-add-btn" data-ancillary-add="${escapeHTML(offer.product_id)}" aria-label="${escapeHTML(ancillaryCta(offer))}: ${escapeHTML(ancillaryDisplayName(offer))}">${escapeHTML(ancillaryCta(offer))}</button>`
            :`<div class="ancillary-selected-row">
                <span class="ancillary-added-label">✓ ${escapeHTML(ancillaryText('added'))}</span>
                <div class="ancillary-qty" aria-label="${escapeHTML(ancillaryDisplayName(offer))}">
                  <button type="button" data-ancillary-minus="${escapeHTML(offer.product_id)}" aria-label="${escapeHTML(ancillaryText('decrease'))}: ${escapeHTML(ancillaryDisplayName(offer))}">−</button>
                  <span aria-label="${escapeHTML(ancillaryText('quantity'))}: ${qty}">${qty}</span>
                  <button type="button" data-ancillary-plus="${escapeHTML(offer.product_id)}" aria-label="${escapeHTML(ancillaryText('increase'))}: ${escapeHTML(ancillaryDisplayName(offer))}">+</button>
                </div>
              </div>`}
        </div></article>`;
    }).join('');
    node.innerHTML=`<div class="ancillary-head"><div><small>${escapeHTML(ancillaryText('kicker'))}</small><h3>${escapeHTML(ancillaryText('title'))}</h3><p>${escapeHTML(ancillaryText('intro'))}</p></div><span class="ancillary-spark" aria-hidden="true">✦</span></div>
      <div class="ancillary-grid">${cards}</div>
      <div class="ancillary-payment-note">${escapeHTML(ancillaryText('paymentNote'))}</div>
      <span class="sr-only" data-ancillary-live role="status" aria-live="polite" aria-atomic="true"></span>`;
    node.querySelectorAll('[data-ancillary-add]').forEach(btn=>btn.addEventListener('click',()=>changeAncillaryQuantity(btn.dataset.ancillaryAdd,1)));
    node.querySelectorAll('[data-ancillary-minus]').forEach(btn=>btn.addEventListener('click',()=>changeAncillaryQuantity(btn.dataset.ancillaryMinus,-1)));
    node.querySelectorAll('[data-ancillary-plus]').forEach(btn=>btn.addEventListener('click',()=>changeAncillaryQuantity(btn.dataset.ancillaryPlus,1)));
  }
  function restoreAncillaryControlFocus(productId,intent='plus'){
    const node=document.querySelector('[data-ancillary-upsell]');
    if(!node)return;
    const id=String(productId);
    const buttons=[...node.querySelectorAll('button')];
    const byData=(key)=>buttons.find(btn=>String(btn.dataset?.[key]||'')===id);
    let target=intent==='minus'?byData('ancillaryMinus'):intent==='add'?byData('ancillaryAdd'):byData('ancillaryPlus');
    if(!target&&intent==='minus')target=byData('ancillaryAdd');
    if(!target)target=byData('ancillaryPlus')||byData('ancillaryAdd')||byData('ancillaryMinus');
    if(target)target.focus({preventScroll:true});
  }
  async function loadAncillaryOffers(){
    bookingState.ancillaryOffers=[];bookingState.extras=[];
    const node=document.querySelector('[data-ancillary-upsell]');if(node){node.hidden=true;node.innerHTML='';}
    if(!bookingEnabled||!bookingState.slot?.id)return;
    try{
      const offers=await api('/ancillary/offers',{method:'POST',body:JSON.stringify({slot_id:bookingState.slot.id})});
      bookingState.ancillaryOffers=Array.isArray(offers)?offers:[];
      renderAncillaryOffers();
      if(bookingState.ancillaryOffers.length)track('ancillary_offers_viewed',{slot_id:bookingState.slot.id,count:bookingState.ancillaryOffers.length,destination_id:destinationId});
    }catch(e){
      bookingState.ancillaryOffers=[];
      if(node){
        node.hidden=false;
        node.innerHTML=`<div class="ancillary-load-error" role="status">${escapeHTML(ancillaryText('loadError'))}</div>`;
      }
    }
  }
  async function changeAncillaryQuantity(productId,delta){
    const node=document.querySelector('[data-ancillary-upsell]');
    if(node?.getAttribute('aria-busy')==='true')return;
    const active=document.activeElement;
    const id=String(productId);
    const focusIntent=active?.dataset?.ancillaryMinus===id?'minus':active?.dataset?.ancillaryAdd===id?'add':'plus';
    const offer=(bookingState.ancillaryOffers||[]).find(x=>String(x.product_id)===id);
    if(!offer||!bookingState.slot?.id)return;
    const available=offer.available_quantity==null?99:Math.max(0,Number(offer.available_quantity||0));
    const maxConfigured=offer.max_per_booking==null?99:Math.max(1,Number(offer.max_per_booking||1));
    const max=Math.max(0,Math.min(available,maxConfigured));
    const current=selectedAncillaryQuantity(productId);
    const next=Math.max(0,Math.min(max,current+delta));
    if(next===current)return;
    if(node)node.setAttribute('aria-busy','true');
    const previous=[...(bookingState.extras||[])];
    const others=previous.filter(x=>String(x.product_id)!==String(productId));
    bookingState.extras=next?[...others,{product_id:productId,quantity:next}]:others;
    renderAncillaryOffers();restoreAncillaryControlFocus(productId,focusIntent);syncAncillaryPaymentAvailability();
    try{
      const quote=await api('/quotes',{method:'POST',body:JSON.stringify({
        slot_id:bookingState.slot.id,group_composition:bookingState.composition,
        is_private:Boolean(bookingState.isPrivate),extras:bookingState.extras,promo_code:bookingState.promoCode||campaignPromo
      })});
      bookingState.quote=quote;renderStandardCheckoutSummary();renderAncillaryOffers();restoreAncillaryControlFocus(productId,focusIntent);syncAncillaryPaymentAvailability();
      const live=document.querySelector('[data-ancillary-live]');
      if(live)live.textContent=`${ancillaryDisplayName(offer)}: ${ancillaryText('quantity')} ${next}`;
      track(next>current?'ancillary_added':'ancillary_removed',{product_id:productId,sku:offer.sku,quantity:next,product_kind:offer.product_kind,quote_total:quote.total,currency:quote.currency});
    }catch(e){
      bookingState.extras=previous;renderAncillaryOffers();restoreAncillaryControlFocus(productId,focusIntent);syncAncillaryPaymentAvailability();
      const status=document.querySelector('[data-checkout-status]');
      if(status)status.textContent=e?.code==='ANCILLARY_OUT_OF_SEASON'?t('This extra is not available for the selected date.','התוספת אינה זמינה בתאריך שנבחר.'):t('That extra is no longer available. Your booking selection was not changed.','התוספת כבר אינה זמינה. בחירת הסיור לא השתנתה.');
    }finally{if(node)node.removeAttribute('aria-busy');}
  }

  async function prepareStandardCheckout(slot,composition,date,experience,isPrivate=false,guideLanguage=''){
    releaseHold(); resetCheckoutMode();
    const status=document.querySelector('#availability-status');
    try{
      setBookingStep(2);status.textContent=t('Checking price and reserving your places…','בודקים מחיר ושומרים את המקומות שלכם…');
      const quote=await api('/quotes',{method:'POST',body:JSON.stringify({slot_id:slot.id,group_composition:composition,is_private:isPrivate,extras:[],promo_code:campaignPromo})});
      const hold=await api('/holds',{method:'POST',body:JSON.stringify({slot_id:slot.id,group_composition:composition,is_private:isPrivate,guide_language:guideLanguage})});
      bookingState={slot,composition,quote,hold,experience,date,isPrivate,guideLanguage,promoCode:campaignPromo,idempotencyKey:'voy_'+uuid(),extras:[],ancillaryOffers:[]};
      const shell=document.querySelector('#live-checkout-shell');shell.hidden=false;setBookingStep(3);
      renderStandardCheckoutSummary();
      loadAncillaryOffers();
      startHoldTimer(hold.expires_at);
      status.textContent=t('Your places are held for 10 minutes while you complete the booking.','המקומות נשמרים ל־10 דקות בזמן השלמת ההזמנה.');
      shell.scrollIntoView({behavior:'smooth',block:'center'});
      track('hold_created',{hold_id:hold.id,slot_id:slot.id,quote_total:quote.total,currency:quote.currency,is_private:isPrivate,guide_language:guideLanguage,promo_code_applied:quote.promo_code_applied||campaignPromo||null,discount:quote.discount||0});
      patchSession({stage:'checkout_ready',selected_date:date,selected_time:slot.time,slot_id:slot.id,quote_id:quote.id,hold_id:hold.id,hold_expires_at:hold.expires_at,group_composition:composition,is_private:isPrivate,guide_language:guideLanguage});
    }catch(e){
      const privateConflict=['PRIVATE_DEPARTURE_NOT_EMPTY','PRIVATE_HOLD_MISMATCH','PRIVATE_DEPARTURE_RESERVED'].includes(e.code);
      const msg=e.code==='ANCILLARY_NOT_CONFIGURED'?t('This booking needs a quick confirmation.','ההזמנה הזו דורשת אישור קצר.'):privateConflict?t('This departure can no longer be made private. Choose another departure or ask the team for a flexible private time.','כבר לא ניתן להפוך את היציאה הזו לפרטית. בחרו שעה אחרת או בקשו מהצוות שעה גמישה לסיור פרטי.'):t('Could not hold this departure. Please choose another time.','לא ניתן לשמור את היציאה. בחרו שעה אחרת.');
      status.innerHTML=rescueMarkup(msg);bindInlineWhatsApp(status);
    }
  }

  function capacityRequestForm(slot,composition,date,experience,isPrivate=false,guideLanguage=''){
    releaseHold(); setBookingStep(3); const shell=document.querySelector('#live-checkout-shell');shell.hidden=false;
    shell.querySelector('[data-checkout-heading]').textContent=t('Request confirmation','בקשת אישור');
    shell.querySelector('[data-checkout-summary]').innerHTML=`<div class="checkout-summary-head"><div><b>${escapeHTML(experience.title)}</b><span>${escapeHTML(date)} · ${escapeHTML(slot.time)}</span></div>${isPrivate?`<span class="checkout-private-flag">${t('Private request','בקשה פרטית')}</span>`:''}</div>${renderPartySummary(composition)}<div class="party-summary"><span>${t('Guide language','שפת הדרכה')} · ${escapeHTML(guideLanguageLabel(guideLanguage))}</span></div><span>${t('This group needs a quick availability confirmation.','לקבוצה הזו נדרש אישור זמינות קצר.')}</span>`;
    shell.querySelector('[data-hold-timer]').textContent='';
    const ancillary=shell.querySelector('[data-ancillary-upsell]');if(ancillary){ancillary.hidden=true;ancillary.innerHTML='';}
    const form=shell.querySelector('#live-checkout-form');const pay=form.querySelector('[name="payment_method"]').closest('.field');pay.hidden=true;
    const legal=form.querySelector('[data-checkout-legal]');if(legal){legal.hidden=true;const box=legal.querySelector('input');if(box){box.required=false;box.checked=false;}}
    form.querySelector('button[type="submit"]').textContent=t('Send confirmation request','שליחת בקשת אישור');
    bookingState={slot,composition,quote:null,hold:null,experience,date,capacityRequest:true,isPrivate,guideLanguage,idempotencyKey:'voy_'+uuid()};
    shell.scrollIntoView({behavior:'smooth',block:'center'});
  }

  const form=document.querySelector('#availability-form');
  if(form){
    const status=document.querySelector('#availability-status'), slots=document.querySelector('#slotlist');
    const dateInput=form.querySelector('input[name="date"]');
    if(dateInput){dateInput.min=budapestDate(0);dateInput.max=budapestDate(365);if(!dateInput.value)dateInput.value=budapestDate(0);}
    ensurePrivateUpgrade(form);
    ensureGuideLanguageField(form);
    enhanceBookingFormLayout(form);
    hydrateCatalog().then(()=>{
      if(qs.get('mode')==='private'){
        const mode=document.querySelector('[data-private-upgrade]');
        if(mode&&typeof mode._setBookingMode==='function'&&!mode.hidden) mode._setBookingMode('private',{silent:true});
      }
    });
    form.addEventListener('change',e=>{if(e.target.name==='experience'){const p=productCache.byId[e.target.value];if(p){setStore('voy_experience_id',p.id);hydratePrice(p);setSelectedTourHint(p);updatePrivateUpgrade(p);updateGuideLanguageField(p);}}});
    form.addEventListener('submit',async e=>{
      e.preventDefault();releaseHold();document.querySelector('#live-checkout-shell')?.setAttribute('hidden','');slots.innerHTML='';
      const data=new FormData(form); const experience=productCache.byId[data.get('experience')];
      if(!experience){status.innerHTML=rescueMarkup(t('Online booking is not available for this route right now. Please contact the local team.','לא ניתן להשלים כרגע את ההזמנה הזו באתר. אפשר לפנות לצוות המקומי.'));bindInlineWhatsApp(status);return;}
      const composition={riders_16_plus:Number(data.get('adults')||0),child_passengers_3_15:Number(data.get('children')||0),baby_passengers_1_2:Number(data.get('babies')||0),request_15yo_independent_assessment:false};
      const isPrivate=String(data.get('is_private')||'')==='true';
      const guideLanguage=String(data.get('guide_language')||'').trim().toLowerCase();
      if(!guideLanguage){status.textContent=t('Choose the guide language for your tour.','בחרו את שפת ההדרכה לסיור.');return;}
      const allowedGuideLanguages=guideLanguagesForProduct(experience);
      if(!allowedGuideLanguages.includes(guideLanguage)){status.textContent=t('That guide language is not available for this branch.','שפת ההדרכה הזו אינה זמינה בסניף זה.');return;}
      const privateMin=Math.max(1,Number(experience.privateMinRiders||2));
      if(isPrivate&&composition.riders_16_plus<privateMin){status.textContent=t(`Private tours require at least ${privateMin} independent riders.`,`סיור פרטי דורש לפחות ${privateMin} רוכבים עצמאיים.`);return;}
      const party=composition.riders_16_plus+composition.child_passengers_3_15+composition.baby_passengers_1_2;
      saveSelectionRecovery(experience,String(data.get('date')),composition,isPrivate,guideLanguage);
      status.textContent=t('Checking availability…','בודקים זמינות…');
      await createSession('availability_search',{experience_id:experience.id,selected_date:data.get('date'),party_size:party,group_composition:composition,is_private:isPrivate,guide_language:guideLanguage,page});track('availability_search',{date:data.get('date'),party_size:party,experience_id:experience.id,is_private:isPrivate,guide_language:guideLanguage});
      const q=new URLSearchParams({date:String(data.get('date')),riders_16_plus:String(composition.riders_16_plus),child_passengers_3_15:String(composition.child_passengers_3_15),baby_passengers_1_2:String(composition.baby_passengers_1_2),is_private:String(isPrivate),guide_language:guideLanguage});
      try{
        const out=await api('/experiences/'+encodeURIComponent(experience.id)+'/availability?'+q.toString(),{method:'GET'});
        const list=(out.slots||[]).filter(s=>!s.starts_at||new Date(s.starts_at).getTime()>Date.now());
        if(!list.length){patchSession({stage:'availability_empty',selected_date:String(data.get('date')),experience_id:experience.id});status.innerHTML=rescueMarkup(t('No departures found right now.','לא נמצאו יציאות זמינות כרגע.'));bindInlineWhatsApp(status);return;}
        setBookingStep(2);status.textContent=t('Choose a departure:','בחרו שעה:');
        list.forEach(s=>{const b=document.createElement('button');b.type='button';b.className='slot';b.disabled=!s.sellable&&!s.requestable;const suffix=s.requestable?t(' · confirmation',' · נדרש אישור'):s.status==='low'?t(' · limited',' · זמינות מוגבלת'):'';b.textContent=s.time+suffix;b.onclick=()=>{document.querySelectorAll('.slot').forEach(x=>x.classList.remove('on'));b.classList.add('on');track('slot_selected',{date:data.get('date'),time:s.time,party_size:party,status:s.status,is_private:isPrivate,guide_language:guideLanguage});patchSession({stage:'slot_selected',selected_date:data.get('date'),selected_time:s.time,slot_id:s.id,group_composition:composition,is_private:isPrivate,guide_language:guideLanguage});if(s.requestable&&isPrivate){status.innerHTML=`${t('This private group needs a quick confirmation. Send the requested date and time and we’ll check the available setup.','לקבוצה הפרטית הזו נדרש אישור קצר. שלחו את התאריך והשעה המבוקשים ונבדוק את האפשרויות הזמינות.')}<div class="status-actions"><a class="btn secondary" href="${whatsAppUrl('private_flexible',{experience_title:experience.title,date:String(data.get('date')),requested_time:s.time,riders:composition.riders_16_plus,children:composition.child_passengers_3_15,babies:composition.baby_passengers_1_2,is_private:true,guide_language:guideLanguage})}">WhatsApp</a></div>`;}else if(s.requestable)capacityRequestForm(s,composition,String(data.get('date')),experience,false,guideLanguage);else prepareStandardCheckout(s,composition,String(data.get('date')),experience,isPrivate,guideLanguage);};slots.appendChild(b)});
      }catch(err){patchSession({stage:'availability_error',error_code:err?.code||String(err?.status||'availability_error')});status.innerHTML=rescueMarkup(t('Current availability could not be loaded. Please try again or contact us on WhatsApp.','לא הצלחנו לטעון כרגע את הזמינות. נסו שוב או פנו אלינו ב‑WhatsApp.'));bindInlineWhatsApp(status);}
    });
  }else{hydrateCatalog();}

  function calendarUrlForBooking(booking){
    const date=String(bookingState.date||booking?.selected_date||'');
    const time=String(bookingState.slot?.time||booking?.slot_time||'');
    const m=date.match(/^(\d{4})-(\d{2})-(\d{2})$/),tm=time.match(/^(\d{1,2}):(\d{2})/);
    if(!m||!tm)return '#';
    const duration=Math.max(30,Number(bookingState.experience?.durationMinutes||120));
    const start=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(tm[1]),Number(tm[2])));
    const end=new Date(start.getTime()+duration*60000);
    const compact=d=>`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}T${String(d.getUTCHours()).padStart(2,'0')}${String(d.getUTCMinutes()).padStart(2,'0')}00`;
    const calendarTourTitle=localizedBudapestExperienceTitle(bookingState.experience,booking?.experience_title)||'VOY PRO Budapest';
    const privateSuffix=bookingState.isPrivate?(locale==='he'?' · פרטי':locale==='hu'?' · Privát':' · Private'):'';
    const title=encodeURIComponent(`${calendarTourTitle}${privateSuffix}`);
    const meetingPoint='Városház utca 14, 1052 Budapest, Hungary';
    const mapsUrl='https://maps.app.goo.gl/BNqXWux5XAnHi2W19';
    const bookingLabel=locale==='he'?'הזמנת VOY PRO':locale==='hu'?'VOY PRO foglalás':'VOY PRO booking';
    const meetingLabel=locale==='he'?'נקודת מפגש':locale==='hu'?'Találkozási pont':'Meeting point';
    const details=encodeURIComponent(`${bookingLabel} ${booking?.reference||''}\n${meetingLabel}: ${meetingPoint}\nGoogle Maps: ${mapsUrl}`);
    const locationParam=encodeURIComponent(meetingPoint);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${compact(start)}/${compact(end)}&ctz=Europe%2FBudapest&details=${details}&location=${locationParam}`;
  }
  async function copyBookingReference(value){
    const text=String(value||'');
    try{
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}
    }catch(e){}
    const field=document.createElement('textarea');
    field.value=text;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();
    let copied=false;try{copied=document.execCommand('copy')}catch(e){}field.remove();return copied;
  }
  function bindConfirmationActions(root,booking){
    const copy=root?.querySelector('[data-copy-booking-ref]');if(copy)copy.onclick=async()=>{const copied=await copyBookingReference(booking.reference);if(copied){copy.textContent=t('Reference copied','מספר ההזמנה הועתק');track('booking_reference_copied',{reference:booking.reference})}else{copy.textContent=t('Reference: ','מספר הזמנה: ')+String(booking.reference||'')}};
    const cal=root?.querySelector('[data-calendar-booking]');if(cal){cal.href=calendarUrlForBooking(booking);cal.target='_blank';cal.rel='noopener';}
  }

  const checkoutForm=document.querySelector('#live-checkout-form');
  if(checkoutForm){checkoutForm.addEventListener('submit',async e=>{
    e.preventDefault();const st=document.querySelector('[data-checkout-status]');
    const ancillary=document.querySelector('[data-ancillary-upsell]');
    if(ancillary?.getAttribute('aria-busy')==='true'){if(st)st.textContent=ancillaryText('updating');return;}
    const f=new FormData(checkoutForm);const customer={full_name:String(f.get('full_name')||'').trim(),email:String(f.get('email')||'').trim(),phone:String(f.get('phone')||'').trim(),preferred_language:locale};
    if(!customer.full_name||!customer.email||!customer.phone){st.textContent=t('Please complete name, email and phone.','יש להשלים שם, אימייל וטלפון.');return;}
    if(checkoutForm.dataset.submitting==='true')return;
    checkoutForm.dataset.submitting='true';checkoutForm.setAttribute('aria-busy','true');
    const submitButton=checkoutForm.querySelector('button[type="submit"]');if(submitButton)submitButton.disabled=true;
    const sid=getStore('voy_session_id'); const idem=bookingState.idempotencyKey||(bookingState.idempotencyKey='voy_'+uuid());let terminal=false;
    try{
      if(bookingState.capacityRequest){
        st.textContent=t('Sending request…','שולחים בקשה…');
        const req=await api('/booking-capacity-requests',{method:'POST',headers:{'Idempotency-Key':idem},body:JSON.stringify({session_id:sid,destination_id:'budapest',experience_id:bookingState.experience.id,experience_slug:bookingState.experience.slug,experience_title:bookingState.experience.title,slot_id:bookingState.slot.id,selected_date:bookingState.date,slot_time:bookingState.slot.time,party_size:Object.values(bookingState.composition).filter(v=>typeof v==='number').reduce((a,b)=>a+b,0),group_composition:bookingState.composition,is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage,customer,attribution:attr})});
        terminal=true;st.classList.add('success-card');st.innerHTML=`<div class="success-icon">✓</div><h3>${t('Request sent','הבקשה נשלחה')}</h3><p>${t('Reference','מספר פנייה')}: <b>${req.reference}</b></p><p>${t('The Budapest team will confirm the vehicles and guides needed for your group.','צוות בודפשט יאשר את הצוות והכלים הנדרשים.')}</p><div class="success-actions"><a class="btn alt" href="${whatsAppUrl()}">WhatsApp</a><a class="btn secondary" href="${localeBudapestHome()}">${t('Back to Budapest','חזרה לבודפשט')}</a></div>`;checkoutForm.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);track('capacity_request_created',{request_id:req.id,reference:req.reference});patchSession({stage:'capacity_request_created',capacity_request_id:req.id,capacity_request_reference:req.reference});delStore('voy_recovery_state');return;
      }
      if(!bookingState.hold?.id){st.textContent=t('The hold expired. Please select the departure again.','שמירת המקום פגה. יש לבחור את היציאה מחדש.');return;}
      st.textContent=t('Confirming booking…','מאשרים הזמנה…');
      const paymentMethod=String(f.get('payment_method')||'pay_arrival_card');
      if(paymentMethod==='pay_now_card'){
        st.textContent=t('Opening secure card payment…','פותחים תשלום מאובטח בכרטיס…');
        const payment=await api('/payments/intents',{method:'POST',headers:{'Idempotency-Key':idem},body:JSON.stringify({payment_type:'online',payment_method:'pay_now_card',hold_id:bookingState.hold.id,session_id:sid,customer,selected_date:bookingState.date,slot_time:bookingState.slot.time,experience_title:bookingState.experience.title,is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage,currency:bookingState.quote?.currency||'EUR',extras:bookingState.extras||[],promo_code:bookingState.promoCode||null})});
        if(!payment?.checkout_url)throw Object.assign(new Error('Secure card payment could not be started.'),{code:'PAYMENT_START_FAILED'});
        terminal=true;patchSession({stage:'payment_redirect',payment_provider:'stripe',payment_checkout_id:payment.id,booking_id:payment.booking_id,booking_reference:payment.booking_reference});
        location.assign(payment.checkout_url);
        return;
      }
      const booking=await api('/bookings',{method:'POST',headers:{'Idempotency-Key':idem},body:JSON.stringify({hold_id:bookingState.hold.id,session_id:sid,customer,payment_method:paymentMethod,selected_date:bookingState.date,slot_time:bookingState.slot.time,experience_title:bookingState.experience.title,is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage,extras:bookingState.extras||[],promo_code:bookingState.promoCode||null})});
      clearInterval(holdTimer); bookingState.hold=null; delStore('voy_recovery_state');
      const manageToken=booking.manage_token||booking.secure_token||'';const manageLang=locale==='he'?'?lang=he':locale==='hu'?'?lang=hu':'';const manageUrl='/manage/'+manageLang+'#token='+encodeURIComponent(manageToken);
      const bookingWhatsApp=whatsAppUrl('booking_confirmation',{booking_reference:booking.reference,experience_title:localizedBudapestExperienceTitle(bookingState.experience,booking.experience_title),date:confirmationDateLabel(bookingState.date||booking.selected_date),requested_time:confirmationTimeLabel(bookingState.slot?.time||booking.slot_time),riders:bookingState.composition?.riders_16_plus||0,children:bookingState.composition?.child_passengers_3_15||0,babies:bookingState.composition?.baby_passengers_1_2||0,is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage||booking.guide_language,payment_method:paymentMethod,extras:selectedAncillaryDetails(),total:booking.total,currency:booking.currency||'EUR'});
      const confirmationMeetingLabel=locale==='he'?'נקודת מפגש':locale==='hu'?'Találkozási pont':'Meeting point';
      const confirmationMapsLabel=locale==='he'?'פתיחה ב־Google Maps':locale==='hu'?'Megnyitás a Google Térképen':'Open in Google Maps';
      const confirmationTotal=finiteNumber(booking.total);
      const confirmationTour=localizedBudapestExperienceTitle(bookingState.experience,booking.experience_title);
      terminal=true;st.classList.add('success-card');st.innerHTML=`<div class="success-icon">✓</div><h3>${t('Booking confirmed','ההזמנה אושרה')}</h3><div class="confirmation-reference"><span>${t('Booking reference','מספר הזמנה')}</span><b>${escapeHTML(booking.reference)}</b></div>${confirmationTour?`<div class="confirmation-tour"><span>${t('Tour','סיור')}</span><strong>${escapeHTML(confirmationTour)}</strong></div>`:''}${renderPartySummary(bookingState.composition)}${confirmationTotal!=null?`<div class="confirmation-total"><span>${t('Total','סה״כ')}</span><strong>${escapeHTML(money(confirmationTotal,booking.currency||'EUR'))}</strong></div>`:''}<div class="party-summary confirmation-meta"><span>${t('Date','תאריך')} · ${escapeHTML(confirmationDateLabel(bookingState.date))}</span><span>${t('Time','שעה')} · ${escapeHTML(confirmationTimeLabel(bookingState.slot.time))}</span>${bookingState.isPrivate?`<span>${t('Private tour','סיור פרטי')}</span>`:''}<span>${t('Guide','הדרכה')} · ${escapeHTML(guideLanguageLabel(bookingState.guideLanguage))}</span><span>${t('Payment','תשלום')} · ${paymentMethod==='pay_now_card'?t('Paid online by card','שולם מראש בכרטיס'):paymentMethod==='pay_arrival_cash'?t('Cash on arrival','מזומן במקום'):t('Card on arrival','כרטיס במקום')}</span></div>${renderConfirmationAncillarySummary()}<div class="confirmation-meeting-point"><div><small>${escapeHTML(confirmationMeetingLabel)}</small><b>Városház utca 14, 1052 Budapest</b></div><a class="btn secondary" href="https://maps.app.goo.gl/BNqXWux5XAnHi2W19" target="_blank" rel="noopener">${escapeHTML(confirmationMapsLabel)}</a></div><div class="success-actions"><a class="btn" href="${manageUrl}">${t('Manage booking','ניהול הזמנה')}</a><button type="button" class="btn secondary" data-copy-booking-ref>${t('Copy reference','העתקת מספר')}</button><a class="btn secondary" data-calendar-booking href="#">${t('Add to calendar','הוספה ליומן')}</a><a class="btn secondary" href="${bookingWhatsApp}" target="_blank" rel="noopener">WhatsApp</a></div><div class="confirmation-next"><b>${t('What happens next','מה עכשיו')}</b><span>${t('Your booking is confirmed. Use Manage Booking for current details or available changes.','ההזמנה אושרה. בניהול ההזמנה תוכלו לראות את הפרטים העדכניים ואת השינויים הזמינים.')}</span><span>${t('Keep the Manage Booking link private — it gives access to this booking.','שמרו את קישור ניהול ההזמנה פרטי — הוא מעניק גישה להזמנה הזו.')}</span></div>`;
      bindConfirmationActions(st,booking);checkoutForm.querySelectorAll('input,select,button:not([data-copy-booking-ref])').forEach(el=>el.disabled=true);document.querySelector('.mobilebook')?.setAttribute('hidden','');
      track('booking_completed',{booking_id:booking.id,reference:booking.reference,revenue:booking.total,currency:booking.currency,is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage,promo_code_applied:booking.promo_code_applied||bookingState.promoCode||null,discount:booking.discount||0});patchSession({stage:'booking_completed',booking_id:booking.id,booking_reference:booking.reference,is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage});
    }catch(err){patchSession({stage:'booking_failed',error_code:err?.code||String(err?.status||'booking_failed')});const msg=err.code==='HOLD_EXPIRED'?t('The hold expired. Please select the departure again.','שמירת המקום פגה. יש לבחור יציאה מחדש.'):err.code==='STAFF_CONFIRMATION_REQUIRED'?t('This booking needs an additional confirmation. Please search again and send a request.','להזמנה הזו נדרש אישור נוסף. יש לחפש מחדש ולשלוח בקשה.'):t('The booking could not be completed. No online card charge was made.','לא ניתן להשלים את ההזמנה. לא בוצע חיוב מקוון.');st.innerHTML=rescueMarkup(msg);bindInlineWhatsApp(st);}
    finally{checkoutForm.dataset.submitting='';checkoutForm.removeAttribute('aria-busy');if(!terminal&&submitButton)submitButton.disabled=false;}
  });}

  function initPaymentReturnNotice(){
    if(!form||qs.get('payment')!=='cancelled')return;
    const status=document.querySelector('#availability-status');if(status){status.innerHTML=rescueMarkup(t('Card payment was cancelled. No successful online card payment was completed. Restore your selection to recheck availability, or contact us on WhatsApp for help.','תשלום הכרטיס בוטל. לא הושלם תשלום מקוון מוצלח. אפשר לשחזר את הבחירה ולבדוק זמינות מחדש, או לפנות אלינו ב-WhatsApp לעזרה.'));bindInlineWhatsApp(status);}
    const clean=new URL(location.href);clean.searchParams.delete('payment');history.replaceState({},'',clean.pathname+(clean.searchParams.toString()?'?'+clean.searchParams.toString():'')+(clean.hash||'#booking'));
    patchSession({stage:'payment_cancelled_return'});track('payment_cancelled_return',{page});
  }

  const WEBSITE_VISUAL_COPY={
    en:{
      meeting:'MEETING POINT',budapestTitle:'Start in central Budapest.',budapestBody:'Please arrive about 15 minutes before departure for check-in, equipment fitting and riding instructions.',budapestName:'VOY PRO Budapest',budapestAddress:'Városház utca 14, 1052 Budapest, Hungary',
      portugalTitle:'Start your Marvão experience here.',portugalBody:'Use the Google Maps pin for the exact meeting point before departure. The local experience is operated by Pombais Experience & Villas.',portugalName:'Pombais Experience & Villas',portugalAddress:'Marvão, Portugal',
      maps:'Open in Google Maps',exactPin:'Exact meeting point',pictures:'ROUTE IN PICTURES',schematic:'ROUTE SCHEMATIC',schematicNote:'Illustrative route — the exact sequence can vary.'
    },
    he:{
      meeting:'נקודת מפגש',budapestTitle:'מתחילים במרכז בודפשט.',budapestBody:'נא להגיע כ־15 דקות לפני היציאה לצ׳ק-אין, התאמת ציוד ותדריך רכיבה.',budapestName:'VOY PRO Budapest',budapestAddress:'Városház utca 14, 1052 Budapest, Hungary',
      portugalTitle:'מתחילים את חוויית מרבאו כאן.',portugalBody:'לפני היציאה השתמשו בסימון המדויק ב-Google Maps. החוויה המקומית מופעלת על ידי Pombais Experience & Villas.',portugalName:'Pombais Experience & Villas',portugalAddress:'Marvão, Portugal',
      maps:'פתיחה ב-Google Maps',exactPin:'נקודת המפגש המדויקת',pictures:'המסלול בתמונות',schematic:'תרשים המסלול',schematicNote:'המחשה בלבד — סדר המסלול בפועל עשוי להשתנות.'
    },
    hu:{
      meeting:'TALÁLKOZÁSI PONT',budapestTitle:'Indulás Budapest belvárosából.',budapestBody:'Kérjük, érkezz körülbelül 15 perccel indulás előtt a bejelentkezéshez, felszereléshez és a vezetési oktatáshoz.',budapestName:'VOY PRO Budapest',budapestAddress:'Városház utca 14, 1052 Budapest, Hungary',
      portugalTitle:'Itt kezdődik a marvãói élmény.',portugalBody:'Indulás előtt használd a Google Maps pontos találkozási pontját. A helyi élményt a Pombais Experience & Villas üzemelteti.',portugalName:'Pombais Experience & Villas',portugalAddress:'Marvão, Portugal',
      maps:'Megnyitás a Google Térképen',exactPin:'Pontos találkozási pont',pictures:'AZ ÚTVONAL KÉPEKBEN',schematic:'ÚTVONALVÁZLAT',schematicNote:'Szemléltető útvonal — a pontos sorrend változhat.'
    },
    pt:{
      meeting:'PONTO DE ENCONTRO',budapestTitle:'Partida no centro de Budapeste.',budapestBody:'Chegue cerca de 15 minutos antes da partida para check-in, ajuste do equipamento e instruções de condução.',budapestName:'VOY PRO Budapest',budapestAddress:'Városház utca 14, 1052 Budapest, Hungary',
      portugalTitle:'A sua experiência em Marvão começa aqui.',portugalBody:'Antes da partida, utilize o ponto exato no Google Maps. A experiência local é operada pela Pombais Experience & Villas.',portugalName:'Pombais Experience & Villas',portugalAddress:'Marvão, Portugal',
      maps:'Abrir no Google Maps',exactPin:'Ponto de encontro exato',pictures:'PERCURSO EM IMAGENS',schematic:'ESQUEMA DO PERCURSO',schematicNote:'Esquema ilustrativo — a ordem exata pode variar.'
    }
  };

  function injectBranchMeetingPoint(){
    const budapestHomes=new Set(['/budapest/','/he/budapest/','/hu/budapest/']);
    const portugalHomes=new Set(['/portugal/','/he/portugal/','/pt/portugal/']);
    const budapest=budapestHomes.has(routePath),portugal=portugalHomes.has(routePath);
    if((!budapest&&!portugal)||document.querySelector('[data-branch-meeting-point]'))return;
    const copy=WEBSITE_VISUAL_COPY[locale]||WEBSITE_VISUAL_COPY.en;
    const data=budapest?{
      title:copy.budapestTitle,body:copy.budapestBody,name:copy.budapestName,address:copy.budapestAddress,
      maps:'https://maps.app.goo.gl/BNqXWux5XAnHi2W19',
      mapQuery:'47.494133,19.055124',
      mapZoom:19
    }:{
      title:copy.portugalTitle,body:copy.portugalBody,name:copy.portugalName,address:copy.portugalAddress,
      maps:'https://maps.app.goo.gl/tfkNvDZNgaq3vN9LA?g_st=ac',
      mapQuery:'Pombais Experience & Villas, Marvão, Portugal',
      mapZoom:16
    };
    const section=document.createElement('section');
    section.className='section meeting-point-section';
    section.dataset.branchMeetingPoint='';
    section.innerHTML=`<div class="wrap meeting-point-grid">
      <div class="meeting-point-copy">
        <div class="eyebrow">${escapeHTML(copy.meeting)}</div>
        <h2>${escapeHTML(data.title)}</h2>
        <p>${escapeHTML(data.body)}</p>
        <div class="meeting-point-address"><b>${escapeHTML(data.name)}</b><strong>${escapeHTML(data.address)}</strong></div>
        <a class="btn secondary meeting-point-button" href="${escapeHTML(data.maps)}" target="_blank" rel="noopener" data-track="meeting_point_maps">${escapeHTML(copy.maps)}</a>
      </div>
      <div class="meeting-map-card">
        <iframe
          class="meeting-map-frame"
          title="${escapeHTML(data.name)} — ${escapeHTML(copy.exactPin)}"
          src="https://www.google.com/maps?q=${encodeURIComponent(data.mapQuery)}&amp;z=${data.mapZoom||16}&amp;output=embed"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          allowfullscreen></iframe>
        <div class="meeting-map-label"><small>${escapeHTML(copy.exactPin)}</small><b>${escapeHTML(data.name)}</b><span>${escapeHTML(data.address)}</span></div>
      </div>
    </div>`;
    document.querySelector('main')?.appendChild(section);
  }

  function routeVisualCoords(count){
    const ys=[39,29,35,23,31,19,25,14,20,12];
    return Array.from({length:count},(_,i)=>{
      const x=count===1?50:7+(86*i/(count-1));
      return [Number(x.toFixed(1)),ys[i%ys.length]];
    });
  }

  function buildRouteSchematic(stops,copy){
    const coords=routeVisualCoords(stops.length);
    const points=coords.map(([x,y])=>`${x},${y}`).join(' ');
    const nodes=coords.map(([x,y],i)=>`<g><circle cx="${x}" cy="${y}" r="3.2"></circle><text x="${x}" y="${y+.95}" text-anchor="middle">${i+1}</text></g>`).join('');
    return `<div class="route-schematic-panel">
      <div class="route-visual-label">${escapeHTML(copy.schematic)}</div>
      <div class="route-schematic-canvas" aria-hidden="true">
        <svg viewBox="0 0 100 52" preserveAspectRatio="none" focusable="false">
          <path class="route-river-shape" d="M48 -8 C38 9 60 17 48 31 C39 41 54 48 50 60"></path>
          <polyline class="route-schematic-line" points="${points}"></polyline>
          <g class="route-schematic-nodes">${nodes}</g>
        </svg>
      </div>
      <div class="route-schematic-legend">${stops.map((name,i)=>`<span><b>${i+1}</b>${escapeHTML(name)}</span>`).join('')}</div>
      <small class="route-schematic-note">${escapeHTML(copy.schematicNote)}</small>
    </div>`;
  }

  function buildRoutePictures(stops,images,copy,maxCards=6){
    const visible=stops.slice(0,Math.min(maxCards,stops.length));
    return `<div class="route-picture-panel"><div class="route-visual-label">${escapeHTML(copy.pictures)}</div><div class="route-photo-strip">${visible.map((name,i)=>`<figure class="route-photo-card"><img src="${escapeHTML(images[i%images.length])}" alt="${escapeHTML(name)}" loading="lazy" decoding="async"/><figcaption><span>${String(i+1).padStart(2,'0')}</span><b>${escapeHTML(name)}</b></figcaption></figure>`).join('')}</div></div>`;
  }

  function injectTourRouteVisuals(){
    const copy=WEBSITE_VISUAL_COPY[locale]||WEBSITE_VISUAL_COPY.en;
    const budapestImages={
      buda:['/assets/images/budapest/img13.jpg','/assets/images/budapest/img17.jpg','/assets/images/budapest/img13.jpg','/assets/images/budapest/img08.jpg','/assets/images/budapest/img12.jpg','/assets/images/budapest/img14.jpg'],
      margaret:['/assets/images/budapest/img02.jpg','/assets/images/budapest/img14.jpg','/assets/images/budapest/img15.jpg','/assets/images/budapest/img16.jpg','/assets/images/budapest/img14.jpg','/assets/images/budapest/img02.jpg'],
      extended:['/assets/images/budapest/img13.jpg','/assets/images/budapest/img17.jpg','/assets/images/budapest/img13.jpg','/assets/images/budapest/img08.jpg','/assets/images/budapest/img12.jpg','/assets/images/budapest/img02.jpg']
    };
    const intent=String(document.body?.dataset.intent||'').toLowerCase();
    const routeSection=document.querySelector('.route-itinerary');
    if(routeSection&&!routeSection.querySelector('[data-route-visual]')&&budapestImages[intent]){
      const stops=[...routeSection.querySelectorAll('.route-itinerary-grid > .route-stop')].map(stop=>stop.querySelector('h3,h4')?.textContent?.trim()).filter(Boolean);
      if(stops.length){
        const visual=document.createElement('div');
        visual.className='route-visual-restored';
        visual.dataset.routeVisual='';
        visual.innerHTML=buildRoutePictures(stops,budapestImages[intent],copy,6)+buildRouteSchematic(stops,copy);
        routeSection.querySelector('.route-itinerary-lede')?.insertAdjacentElement('afterend',visual);
      }
    }

    const portugalImages=['/assets/images/portugal/marvao-01.jpg','/assets/images/portugal/marvao-02.jpg','/assets/images/portugal/marvao-03.webp','/assets/images/portugal/marvao-04.jpg'];
    document.querySelectorAll('.marvao-route-card').forEach((card,index)=>{
      if(card.querySelector('[data-route-visual]'))return;
      const stops=[...card.querySelectorAll('.route-itinerary-grid > .route-stop')].map(stop=>stop.querySelector('h3,h4')?.textContent?.trim()).filter(Boolean);
      if(!stops.length)return;
      const rotated=portugalImages.map((_,i)=>portugalImages[(i+index)%portugalImages.length]);
      const visual=document.createElement('div');
      visual.className='route-visual-restored route-visual-compact';
      visual.dataset.routeVisual='';
      visual.innerHTML=buildRoutePictures(stops,rotated,copy,3)+buildRouteSchematic(stops,copy);
      card.querySelector('.marvao-route-head')?.insertAdjacentElement('afterend',visual);
    });
  }

  injectBranchMeetingPoint();
  injectTourRouteVisuals();

  // We never reconstruct a booking from browser storage. Only the last non-PII selection
  // can be restored, and live availability + price are always rechecked before checkout.
  initSelectionRecovery();
  initPaymentReturnNotice();

  window.VOYBookingIntelligence={track,createSession,patchSession,api,bookingEnabled};
})();
