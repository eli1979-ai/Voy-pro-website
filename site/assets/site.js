(()=>{
  const head=document.head;
  if(head){
    if(!head.querySelector('link[data-voy-brand-icon="favicon"]')){
      const favicon=document.createElement('link');
      favicon.rel='icon';
      favicon.type='image/png';
      favicon.href='/assets/brand/voy-pro-symbol.png';
      favicon.dataset.voyBrandIcon='favicon';
      head.appendChild(favicon);
    }
    if(!head.querySelector('link[data-voy-brand-icon="apple-touch"]')){
      const apple=document.createElement('link');
      apple.rel='apple-touch-icon';
      apple.href='/assets/brand/voy-pro-symbol.png';
      apple.dataset.voyBrandIcon='apple-touch';
      head.appendChild(apple);
    }
  }
})();

(async function(){
  const cfg = window.VOY_CONFIG || window.VOY_RUNTIME_CONFIG || {};
  const apiRoot = (cfg.apiRoot || '').replace(/\/$/,'');
  const page = document.body.dataset.page || location.pathname;
  const declaredLang=(document.documentElement.lang||'en').toLowerCase();
  const routePath=(location.pathname||'/').toLowerCase();
  const routeLocale=routePath.startsWith('/he/')?'he':routePath.startsWith('/hu/')?'hu':routePath.startsWith('/pt/')?'pt':null;
  const isPortugalPage=routePath.includes('/portugal/');
  const isBudapestPage=routePath.includes('/budapest/');
  const isLegalPage=routePath.includes('/legal/');
  // Shared EZRaider guide: customer may arrive from any VOY PRO destination.
  const vehicleGuideSource=/^\/(?:he\/|hu\/|pt\/)?ezraider\/$/.test(routePath)?new URLSearchParams(location.search).get('from'):null;
  const destinationId=isPortugalPage?'portugal-marvao':isBudapestPage?'budapest':'network';
  const destinationClients=(cfg.destinationClients&&typeof cfg.destinationClients==='object')?cfg.destinationClients:{};
  const destinationClient=destinationClients[destinationId]||null;
  const clientKey=String(destinationClient?.clientKey||((destinationId==='budapest'&&cfg.clientKey)||'')).trim();
  const bookingEnabled=!!(!isLegalPage&&destinationId!=='network'&&cfg.bookingEnabled&&apiRoot&&clientKey);
  let destinationRuntime=null;
  const locale=routeLocale||(declaredLang.startsWith('he')?'he':declaredLang.startsWith('hu')?'hu':declaredLang.startsWith('pt')?'pt':'en');
  // Route is the locale contract. This prevents cached or mis-generated lang attributes from mixing UI languages.
  document.documentElement.lang=locale;
  if(locale==='he'){document.documentElement.dir='rtl';document.body?.classList.add('rtl')}else{document.documentElement.removeAttribute('dir');}
  const qs = new URLSearchParams(location.search);
  const campaignPromo=(qs.get('promo')||'').trim().toUpperCase()||null;
  // Affiliate referral is booking-essential state, not analytics attribution.
  const AFFILIATE_SESSION_KEY='voy_active_affiliate_ref_v1:'+destinationId;
  const affiliateQuery=(qs.get('affiliate')||'').trim().toUpperCase();
  const validAffiliateCode=code=>/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(String(code||''));
  if(affiliateQuery&&validAffiliateCode(affiliateQuery)){
    try{sessionStorage.setItem(AFFILIATE_SESSION_KEY,affiliateQuery);}catch(e){}
  }
  let affiliateCode=validAffiliateCode(affiliateQuery)?affiliateQuery:null;
  if(!affiliateCode){try{const prev=sessionStorage.getItem(AFFILIATE_SESSION_KEY);if(validAffiliateCode(prev))affiliateCode=prev;}catch(e){}}
  const initialPromoCode=affiliateCode||campaignPromo||null;
  const effectivePromoCode=()=>affiliateCode||(bookingState&&Object.prototype.hasOwnProperty.call(bookingState,'promoCode')?bookingState.promoCode:initialPromoCode);
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
  const PAYMENT_RETRY_KEY='voy_payment_retry_v1';
  function isStripeCheckoutUrl(value){
    try{
      const u=new URL(String(value||''));
      return u.protocol==='https:'&&u.hostname==='checkout.stripe.com';
    }catch(e){return false;}
  }
  function rememberPaymentRetry(payment){
    const checkoutUrl=String(payment?.checkout_url||'').trim();
    if(!isStripeCheckoutUrl(checkoutUrl))return;
    const expiresMs=Date.parse(String(payment?.expires_at||''));
    const fallbackExpires=Date.now()+45*60*1000;
    const state={
      version:1,
      saved_at:Date.now(),
      checkout_url:checkoutUrl,
      expires_at:Number.isFinite(expiresMs)?new Date(expiresMs).toISOString():new Date(fallbackExpires).toISOString(),
      booking_id:payment?.booking_id||null,
      booking_reference:payment?.booking_reference||null,
      payment_checkout_id:payment?.id||null
    };
    try{sessionStorage.setItem(PAYMENT_RETRY_KEY,JSON.stringify(state))}catch(e){}
  }
  function paymentRetryState(){
    let state=null;
    try{state=safeJSON(sessionStorage.getItem(PAYMENT_RETRY_KEY))}catch(e){}
    if(!state||!isStripeCheckoutUrl(state.checkout_url)){clearPaymentRetry();return null;}
    const expiresMs=Date.parse(String(state.expires_at||''));
    if(!Number.isFinite(expiresMs)||expiresMs<=Date.now()){clearPaymentRetry();return null;}
    return state;
  }
  function clearPaymentRetry(){
    try{sessionStorage.removeItem(PAYMENT_RETRY_KEY)}catch(e){}
  }
  const ANALYTICS_STORAGE_KEYS=['voy_visitor_id','voy_first_attribution','voy_last_attribution','voy_segment','voy_experiments','voy_event_queue_v1'];
  const ANALYTICS_SESSION_KEYS=['voy_booking_started_v1'];
  function clearAnalyticsState(){
    // Cancel all queued/ongoing optional telemetry before deleting its data.
    cancelEventFlush();
    ANALYTICS_STORAGE_KEYS.forEach(k=>{
      memoryStore.delete(k);
      try{localStorage.removeItem(k)}catch(e){}
    });
    ANALYTICS_SESSION_KEYS.forEach(k=>{try{sessionStorage.removeItem(k)}catch(e){}});
    for(const k of [...memoryStore.keys()]){
      if(k.startsWith('voy_exp_'))memoryStore.delete(k);
    }
    try{
      for(let i=localStorage.length-1;i>=0;i--){
        const k=localStorage.key(i);
        if(k&&k.startsWith('voy_exp_'))localStorage.removeItem(k);
      }
    }catch(e){}
  }
  function setConsent(next){
    consent={decided:true,analytics:!!next.analytics,marketing:!!next.marketing,updated_at:new Date().toISOString()};
    try{localStorage.setItem(CONSENT_KEY,JSON.stringify(consent))}catch(e){}
    if(!consent.analytics)clearAnalyticsState();
    document.documentElement.dataset.analyticsConsent=consent.analytics?'granted':'denied';
  }
  const uuid = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'v_'+Date.now()+'_'+Math.random().toString(36).slice(2);
  const money=(amount,currency='EUR')=>new Intl.NumberFormat(locale==='he'?'he-IL':locale==='hu'?'hu-HU':locale==='pt'?'pt-PT':'en-IE',{style:'currency',currency}).format(Number(amount||0));
  function liveDurationLabel(value){
    const total=Math.round(Number(value));
    if(!Number.isFinite(total)||total<=0)return null;
    const hours=Math.floor(total/60),minutes=total%60;
    if(locale==='he'){
      const h=hours===1?'שעה':hours>1?`${hours} שעות`:'';
      const m=minutes?`${minutes} דקות`:'';
      return [h,m].filter(Boolean).join(' ו־');
    }
    if(locale==='hu'){
      const h=hours?`${hours} óra`:'';
      const m=minutes?`${minutes} perc`:'';
      return [h,m].filter(Boolean).join(' ');
    }
    if(locale==='pt'){
      const h=hours?`${hours} h`:'';
      const m=minutes?`${minutes} min`:'';
      return [h,m].filter(Boolean).join(' ');
    }
    if(!hours)return `${minutes} min`;
    if(!minutes)return hours===1?'1 hour':`${hours} hours`;
    return `${hours} hr ${minutes} min`;
  }
  function durationUnavailableLabel(){
    return locale==='he'?'משך הסיור אינו זמין כרגע'
      :locale==='hu'?'A túra időtartama jelenleg nem érhető el'
      :locale==='pt'?'Duração temporariamente indisponível'
      :'Duration temporarily unavailable';
  }
  function isDurationPlaceholder(node){
    const value=String(node?.textContent||'').trim();
    return ['Live duration','משך חי','Élő időtartam'].includes(value);
  }

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
    'Regular price':'Normál ár','Discount':'Kedvezmény','Additions':'Kiegészítések','Total':'Összesen','Tour':'Túra','Date':'Dátum','Time':'Időpont','Live availability · Final price before confirmation · Local support':'Aktuális elérhetőség · Végső ár megerősítés előtt · Helyi segítség',
    'Discounts and additions are shown separately before confirmation.':'A kedvezmények és kiegészítések külön jelennek meg a megerősítés előtt.',
    'Menu':'Menü','Close menu':'Menü bezárása','Explore Budapest':'Fedezd fel Budapestet','Buda Castle Tour':'Budavári túra','Margaret Island':'Margitsziget','Extended Tour':'Hosszabb túra','Private Tours':'Privát túrák','Budapest with Kids':'Budapest gyerekekkel','Portugal · Marvão':'Portugália · Marvão','Check availability':'Szabad időpontok','This departure has already started. Search again for current availability.':'Ez az indulás már elkezdődött. Keressen újra az aktuális elérhetőséghez.','Ask us on WhatsApp':'Kérdezz WhatsAppon','View Buda tour':'Budai túra','See the most popular route':'Legnépszerűbb útvonal','Cookie preferences':'Süti beállítások','Your privacy choices':'Adatvédelmi beállítások','Close without changes':'Bezárás módosítás nélkül','Essential storage keeps booking features working. Optional analytics helps us understand which pages and campaigns lead to bookings.':'A szükséges tárolás a foglalási funkciók működéséhez kell. Az opcionális analitika segít megérteni, mely oldalak vezetnek foglaláshoz.','Essential only':'Csak szükséges','Allow analytics':'Analitika engedélyezése',
    'Tell us what you need':'Írd meg, mire van szükséged','We’ll send the details to the Budapest team on WhatsApp.':'Az adatokat WhatsAppon elküldjük a budapesti csapatnak.','Preferred date':'Kívánt dátum','Independent riders':'Önálló vezetők','Guide language':'Vezetés nyelve','Choose language':'Válassz nyelvet','Private?':'Privát?','No · regular extended request':'Nem · normál hosszabb túra','Yes · our group only':'Igen · csak a mi csoportunk','Preferred start time':'Kívánt indulási idő','(optional)':'(opcionális)','Send request on WhatsApp':'Kérés küldése WhatsAppon','This sends a request, not a confirmed booking. Our local team will confirm the route, time, vehicles and guide language.':'Ez még kérés, nem megerősített foglalás. Helyi csapatunk visszaigazolja az útvonalat, időpontot, járműveket és a vezetés nyelvét.','Extended Buda + Margaret':'Buda + Margitsziget hosszabb túra',
    'From ':'Ettől: ','Contact the local team':'Kapcsolat a helyi csapattal','Online booking':'Online foglalás','Choose guide language':'Válassz vezetési nyelvet','Every booking must include the requested guiding language.':'Minden foglalásnál ki kell választani a kért vezetési nyelvet.','TOUR STYLE':'TÚRA TÍPUSA','Choose how you want to ride':'Válaszd ki a túra típusát','Final price is shown after you choose a departure.':'A végső ár az indulás kiválasztása után jelenik meg.','Join a scheduled tour':'Csatlakozás menetrend szerinti túrához','Current rider price':'Aktuális ár vezetőnként','Share the departure with other VOY PRO guests.':'Az induláson más VOY PRO vendégek is részt vehetnek.','Private tour · your group only':'Privát túra · csak a ti csoportotok','Private upgrade shown before confirmation':'Privát felár a megerősítés előtt','Need a different private start time? Send a request with your date and group':'Más privát indulási időt szeretnél? Küldd el a dátumot és a csoport létszámát','Private availability requires an empty departure.':'Privát foglaláshoz szabad indulás szükséges.','Private mode selected. Search again to see departures that can be reserved for your group only.':'Privát túra kiválasztva. Keress újra a kizárólag a csoportodnak foglalható indulásokhoz.','Scheduled tour selected. Search available departures for your group.':'Menetrend szerinti túra kiválasztva. Keress szabad időpontot a csoportodnak.','MORE BUDAPEST':'MÉG TÖBB BUDAPEST','Want Buda and Margaret Island in one longer experience?':'Szeretnéd Budát és a Margitszigetet egy hosszabb élményben?','See the Extended Buda + Margaret option before you choose a departure.':'Nézd meg a hosszabb Buda + Margitsziget lehetőséget indulás választása előtt.','See extended tour':'Hosszabb túra',
    'Private surcharge shown before confirmation':'A privát felár a megerősítés előtt jelenik meg','Restore your last tour selection':'Legutóbbi túraválasztás visszaállítása','We will recheck availability and price before anything is confirmed.':'Megerősítés előtt újra ellenőrizzük az aktuális időpontot és árat.','Restore selection':'Választás visszaállítása','Selection restored. Search again to recheck availability and price.':'A választást visszaállítottuk. Keress újra az aktuális időpontért és árért.','Online booking is temporarily unavailable':'Az online foglalás átmenetileg nem elérhető','Extended Buda + Margaret — contact us':'Buda + Margitsziget — lépj kapcsolatba velünk','Margaret Island — contact us':'Margitsziget — lépj kapcsolatba velünk','Contact us for this route':'Lépj kapcsolatba velünk ehhez az útvonalhoz','The extended Buda + Margaret tour is currently confirmed by the local team. Contact us on WhatsApp.':'Ezt a hosszabb túrát jelenleg a helyi csapat erősíti meg. Írj nekünk WhatsAppon.','Margaret Island is currently confirmed by the local team. Contact us on WhatsApp, or view the Buda tour for online booking.':'A margitszigeti túrát jelenleg a helyi csapat erősíti meg. Írj WhatsAppon, vagy válaszd a budai túrát online foglaláshoz.','Tour options are temporarily unavailable':'A túrák átmenetileg nem tölthetők be',
    'BOOKING':'FOGLALÁS','Current availability could not be loaded. Please try again or contact us on WhatsApp.':'Az aktuális elérhetőséget nem sikerült betölteni. Próbáld újra, vagy írj nekünk WhatsAppon.','No departures found right now.':'Jelenleg nincs elérhető indulás.','Private tour: yes':'Privát túra: igen','Scheduled tour selected. Search availability for your group.':'Menetrend szerinti túra kiválasztva. Keress elérhető indulást a csoportodnak.',
        'LIVE CHECKOUT':'FOGLALÁS','Complete your booking':'Foglalás befejezése','Change selection':'Választás módosítása','Current price':'Aktuális ár','Places held while you finish':'A helyeket rövid ideig tartjuk','Direct Budapest team':'Közvetlen budapesti csapat','Full name':'Teljes név','Phone':'Telefon','Payment':'Fizetés','Pay now by card':'Fizetés most bankkártyával','Online card payment is currently unavailable':'Az online bankkártyás fizetés jelenleg nem érhető el.','Pay by card on arrival':'Fizetés kártyával a helyszínen','Pay cash on arrival':'Fizetés készpénzzel a helyszínen','Confirm booking':'Foglalás megerősítése','Book now – payment obligation':'Foglalás fizetési kötelezettséggel','I accept the Terms of Use and confirm I have read the Privacy Notice.':'Elfogadom a Felhasználási feltételeket, és tudomásul veszem az Adatkezelési tájékoztatót.','Terms of Use':'Felhasználási feltételek','Privacy Notice':'Adatkezelési tájékoztató','Selection unlocked. Update the tour, date or group and search again.':'A választás újra módosítható. Állítsd át a túrát, dátumot vagy létszámot, majd keress újra.','Hold expired — select the departure again.':'A foglalási idő lejárt — válaszd ki újra az indulást.','Complete booking':'Foglalás befejezése','Choose a time':'Válassz időpontot','Check availability':'Szabad időpontok keresése','Independent riders':'Önálló vezetők','Child passengers':'Gyermek utasok','Baby passengers':'Kisgyermek utasok','Checking price and reserving your places…':'Ár ellenőrzése és helyek ideiglenes tartása…','Scheduled tour':'Menetrend szerinti túra','Your places are temporarily held while you complete the booking.':'A helyeket ideiglenesen tartjuk, amíg befejezed a foglalást.','This booking needs a quick confirmation.':'Ehhez a foglaláshoz gyors megerősítés szükséges.','This departure can no longer be made private. Choose another departure or ask the team for a flexible private time.':'Ez az indulás már nem foglalható privátként. Válassz másik indulást, vagy kérj rugalmas privát időpontot.','Could not hold this departure. Please choose another time.':'Ezt az indulást nem sikerült lefoglalni. Válassz másik időpontot.','Temporary reservation could not be verified. Please choose a departure again.':'Az ideiglenes helyfoglalást nem sikerült ellenőrizni. Válassz új indulási időpontot.','Request confirmation':'Megerősítés kérése','Private request':'Privát kérés','This group needs a quick availability confirmation.':'Ehhez a csoporthoz gyors elérhetőségi megerősítés szükséges.','Send confirmation request':'Megerősítési kérés küldése','Online booking is not available for this route right now. Please contact the local team.':'Ehhez az útvonalhoz most nincs online foglalás. Kérjük, lépj kapcsolatba a helyi csapattal.','Choose the guide language for your tour.':'Válaszd ki a túra vezetési nyelvét.','That guide language is not available for this branch.':'Ez a vezetési nyelv ezen a helyszínen nem elérhető.','Checking availability…':'Szabad időpontok keresése…','No departures found right now.':'Jelenleg nincs elérhető indulás.','Choose a departure:':'Válassz indulást:',' · confirmation':' · megerősítés',' · limited':' · kevés hely','This private group needs a quick confirmation. Send the requested date and time and we’ll check the available setup.':'A privát csoporthoz gyors megerősítés szükséges. Küldd el a kívánt dátumot és időpontot, és ellenőrizzük a lehetőségeket.','Availability could not be loaded. Please contact us on WhatsApp.':'Az aktuális időpontokat most nem sikerült betölteni. Írj nekünk WhatsAppon.','Reference copied':'Hivatkozási szám másolva','Reference: ':'Hivatkozás: ','Please complete name, email and phone.':'Add meg a nevet, e-mail címet és telefonszámot.','Sending request…':'Kérés küldése…','Request sent':'Kérés elküldve','Reference':'Hivatkozás','The Budapest team will confirm the vehicles and guides needed for your group.':'A budapesti csapat visszaigazolja a szükséges járműveket és idegenvezetőt.','Back to Budapest':'Vissza Budapesthez','The hold expired. Please select the departure again.':'A foglalási idő lejárt. Válaszd ki újra az indulást.','Confirming booking…':'Foglalás megerősítése…','Booking confirmed':'Foglalás megerősítve','Booking reference':'Foglalási szám','Private tour':'Privát túra','Guide':'Vezetés','Paid online by card':'online kártyával fizetve','Cash on arrival':'készpénz a helyszínen','cash on arrival':'készpénz a helyszínen','Card on arrival':'kártya a helyszínen','card on arrival':'kártya a helyszínen','Manage booking':'Foglalás kezelése','Copy reference':'Szám másolása','Add to calendar':'Hozzáadás a naptárhoz','What happens next':'Mi történik ezután','Your booking is confirmed. Use Manage Booking for current details or available changes.':'A foglalásod megerősítve. A Foglalás kezelése oldalon láthatod az aktuális részleteket és az elérhető módosításokat.','Keep the Manage Booking link private — it gives access to this booking.':'A Foglalás kezelése linket kezeld bizalmasan, mert hozzáférést ad ehhez a foglaláshoz.','This booking needs an additional confirmation. Please search again and send a request.':'Ehhez a foglaláshoz további megerősítés szükséges. Keress újra, és küldj megerősítési kérést.','The payment or booking outcome could not be verified.':'A fizetés vagy foglalás eredménye nem ellenőrizhető.',
    "Live languages unavailable":"Az elérhető idegenvezetési nyelvek jelenleg nem tölthetők be",
    "Live price unavailable":"Az aktuális ár jelenleg nem elérhető",
    "Group composition":"A csoport összetétele",
    "Private-tour minimum is temporarily unavailable.":"A privát túra minimális létszáma jelenleg nem elérhető.",
    "Continue to secure card payment":"Tovább a biztonságos bankkártyás fizetéshez",
    "Discount coupon (optional)":"Kedvezménykupon (nem kötelező)",
    "Enter one code":"Adj meg egy kuponkódot",
    "Apply code":"Kupon alkalmazása",
    "Enter one valid coupon code.":"Adj meg egy érvényes kuponkódot.",
    "This code is already applied.":"Ezt a kuponkódot már alkalmaztuk.",
    "Checking coupon and price…":"Kupon és ár ellenőrzése…",
    "Coupon applied. Total updated.":"A kupont alkalmaztuk, az összeg frissült.",
    "Coupon removed.":"A kupont eltávolítottuk.",
    "Coupon unavailable. Your price is unchanged.":"A kupon nem érhető el. Az ár változatlan maradt.",
    "Hold could not be verified — select the departure again.":"Az ideiglenes foglalás nem ellenőrizhető — válaszd ki újra az indulást.",
    "Partner offer applied automatically":"A partnerkedvezményt automatikusan alkalmaztuk",
    "The updated total could not be verified. Your previous extras selection was restored. Please try again.":"A módosított végösszeg nem ellenőrizhető. Visszaállítottuk az előző kiegészítőválasztást. Próbáld újra.",
    "This extra is not available for the selected date.":"Ez a kiegészítő a kiválasztott dátumon nem érhető el.",
    "That extra is no longer available. Your booking selection was not changed.":"Ez a kiegészítő már nem érhető el. A foglalásodat nem módosítottuk.",
    "The temporary hold could not be verified. Choose the departure again.":"Az ideiglenes helyfoglalást nem sikerült ellenőrizni. Válaszd ki újra az indulást.",
    "The live price could not be verified. Please search again or contact the local team.":"Az aktuális ár nem ellenőrizhető. Keress újra, vagy fordulj a helyi csapathoz.",
    "Selection changed. Search again to refresh availability.":"A választás módosult. Keress újra a szabad időpontok frissítéséhez.",
    "Guide languages cannot be verified right now. Please contact our local team.":"Az elérhető idegenvezetési nyelvek most nem ellenőrizhetők. Lépj kapcsolatba a helyi csapattal.",
    "Private-tour rules are temporarily unavailable. Please try again or contact us.":"A privát túrák szabályai átmenetileg nem érhetők el. Próbáld újra, vagy lépj kapcsolatba velünk.",
    "Please finish applying your coupon first.":"Előbb fejezd be a kupon alkalmazását.",
    "Apply or clear the coupon code before confirming the price.":"Az ár jóváhagyása előtt alkalmazd vagy töröld a kuponkódot.",
    "Opening secure card payment…":"Biztonságos bankkártyás fizetés megnyitása…",
    "Retry card payment":"Bankkártyás fizetés újbóli megkísérlése",
    "Choose the guiding language that works for your group. We do not select a language automatically.":"Válaszd ki a csoportodnak megfelelő idegenvezetési nyelvet. Nem választunk automatikusan nyelvet.",
    "Guide languages unavailable – contact our team":"Az idegenvezetési nyelvek nem érhetők el – lépj kapcsolatba a csapatunkkal.",
    "Heroes’ Square":"Hősök tere",
    "Citadella Advanced":"Citadella – haladó túra",
    "Your selected date is now in the past in Budapest. Choose another date.":"A kiválasztott dátum már elmúlt Budapesten. Válassz új dátumot.",
    "This date is outside the current booking window. Choose an earlier date.":"Ez a dátum kívül esik a foglalási időszakon. Válassz korábbi dátumot."
  };
  function huDynamic(en){
    if(HU[en]) return HU[en];
    // Declare before the first match to prevent a temporal-dead-zone
    // ReferenceError from aborting the Hungarian website runtime.
    let m;
    if((m=en.match(/^Price item (\d+)$/))) return `Árelem ${m[1]}`;
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
    if((m=en.match(/^Child passengers: (.+)$/))) return `Gyermek utasok: ${m[1]}`;
    if((m=en.match(/^Baby passengers: (.+)$/))) return `Kisgyermek utasok: ${m[1]}`;
    if((m=en.match(/^Guide language: (.+)$/))) return `Vezetés nyelve: ${m[1]}`;
    if((m=en.match(/^Requested guiding language: (.+)$/))) return `Kért idegenvezetési nyelv: ${m[1]}`;
    if((m=en.match(/^Payment: (.+)$/))) return `Fizetés: ${m[1]}`;
    if((m=en.match(/^Total: (.+)$/))) return `Összesen: ${m[1]}`;
    return en;
  }
  const t=(en,he)=>locale==='he'?he:locale==='hu'?huDynamic(en):en;
  // Selecting a guide language records the guest's request, not a verified
  // guide/escort assignment. Do not imply language delivery is guaranteed
  // until human-guided language delivery has been independently verified.
  const requestedGuideLanguageLabel=()=>locale==='he'?'שפת הדרכה מבוקשת'
    :locale==='hu'?'Kért idegenvezetési nyelv'
    :locale==='pt'?'Idioma de acompanhamento solicitado'
    :'Requested guiding language';
  const GUIDE_LANGUAGE_NAMES={en:{en:'English',he:'אנגלית',hu:'Angol',pt:'Inglês'},he:{en:'Hebrew',he:'עברית',hu:'Héber'},hu:{en:'Hungarian',he:'הונגרית',hu:'Magyar'},es:{en:'Spanish',he:'ספרדית',hu:'Spanyol'},pt:{en:'Portuguese',he:'פורטוגזית',hu:'Portugál',pt:'Português'}};
  const guideLanguageLabel=(code)=>{const key=String(code||'').toLowerCase();return GUIDE_LANGUAGE_NAMES[key]?.[locale]||GUIDE_LANGUAGE_NAMES[key]?.en||key.toUpperCase();};
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
  // A successful HTTP status is not evidence that inventory is reserved.
  // Never unlock checkout without a concrete hold token and an expiry in the
  // future. The server remains authoritative for price and availability.
  function checkoutHoldIsValid(hold,atMs=Date.now()){
    const id=typeof hold?.id==='string'?hold.id.trim():'';
    // Holds must expire at a concrete instant. Date.parse() also accepts
    // date-only, local/offset-less and human-readable strings; these are
    // ambiguous across guest time zones and must not authorize checkout.
    const stamp=typeof hold?.expires_at==='string'?hold.expires_at.trim():'';
    const zonedInstant=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/i.test(stamp);
    const expiry=zonedInstant?Date.parse(stamp):NaN;
    return Boolean(id)&&Number.isFinite(expiry)&&expiry>atMs;
  }
  function abandonInvalidHold(hold){
    const id=typeof hold?.id==='string'?hold.id.trim():'';
    // If the backend returned a usable token but broken expiry, release the
    // tentative hold best-effort; never claim its places are confirmed.
    if(id&&bookingEnabled)api('/holds/'+encodeURIComponent(id),{method:'DELETE'}).catch(()=>{});
    const err=new Error('Temporary hold could not be verified.');
    err.code='HOLD_INVALID';
    throw err;
  }

  function assertCheckoutQuote(quote){
    const total=finiteNumber(quote?.total);
    const currency=String(quote?.currency||'').trim();
    if(total==null||total<0||!/^[A-Za-z]{3}$/.test(currency)){
      const err=new Error('Live quote could not be verified.');
      err.code='QUOTE_INVALID';
      throw err;
    }
    return {total,currency};
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
    if(isPortugalPage){
      // A guest may use the floating or mobile-nav WhatsApp button after
      // filling part of the Marvão request form. Carry only public tour choices
      // into that explicit handoff; never copy their name, notes or attribution.
      const requestForm=document.querySelector('[data-portugal-request-form]');
      if(!requestForm)return {};
      const selected=new FormData(requestForm);
      const route=String(selected.get('route')||'').trim();
      const date=String(selected.get('date')||'').trim();
      const people=String(selected.get('people')||'').trim();
      const guide=String(selected.get('guide_language')||'').trim().toLowerCase();
      const names={express:'Vila de Marvão Express Tour',
        explorer:'Marvão Explorer Tour',
        megalithic:(locale==='pt'||locale==='he')?'Rota Megalítica':'Megalithic Route'};
      const dateMs=/^\d{4}-\d{2}-\d{2}$/.test(date)?Date.parse(date+'T12:00:00Z'):NaN;
      const dateValid=Number.isFinite(dateMs)&&new Date(dateMs).toISOString().slice(0,10)===date&&
        date>=portugalDate(0);
      return {
        experience_title:names[route]||null,
        date:dateValid?date:null,
        people:['2','3','4'].includes(people)?people:null,
        guide_language:['en','pt'].includes(guide)?guide:null
      };
    }
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
    const whatsappPortugal=isPortugalPage||vehicleGuideSource==='marvao'||vehicleGuideSource==='marvao-pt';
    const whatsappBudapest=isBudapestPage||vehicleGuideSource==='budapest';
    const generic=whatsappPortugal?(locale==='he'?`היי, הגעתי מאתר VOY PRO (${location.pathname}) ואני רוצה לבדוק סיור EZRaider במרבאו, פורטוגל.`:locale==='pt'?`Olá, cheguei pelo site VOY PRO (${location.pathname}) e gostaria de verificar um passeio de EZRaider em Marvão, Portugal.`:`Hi, I came from the VOY PRO website (${location.pathname}) and I’d like to check an EZRaider tour in Marvão, Portugal.`):whatsappBudapest?(locale==='hu'?`Szia, a VOY PRO weboldaláról érkeztem (${location.pathname}), és egy budapesti túráról szeretnék érdeklődni.`:t(`Hi, I came from the VOY PRO website (${location.pathname}) and I’d like to check a Budapest tour.`,`היי, הגעתי מהאתר VOY PRO (${location.pathname}) ואני רוצה לבדוק סיור בבודפשט.`)):`Hi, I came from the VOY PRO website (${location.pathname}) and I’d like help choosing a destination or experience.`;
    const privateFlexible=locale==='hu'?`Szia, a VOY PRO weboldaláról érkeztem (${location.pathname}), és privát budapesti túrát szeretnék kérni rugalmas indulási idővel.`:t(`Hi, I came from the VOY PRO website (${location.pathname}) and I’d like to request a private Budapest tour at a flexible departure time.`,`היי, הגעתי מאתר VOY PRO (${location.pathname}) ואני רוצה לבקש סיור פרטי בבודפשט בשעת יציאה גמישה.`);
    const extended=locale==='hu'?`Szia, a VOY PRO weboldaláról érkeztem (${location.pathname}), és a hosszabb Buda + Margitsziget túráról szeretnék érdeklődni.`:t(`Hi, I came from the VOY PRO website (${location.pathname}) and I’d like to check the Extended Buda + Margaret tour.`,`היי, הגעתי מאתר VOY PRO (${location.pathname}) ואני רוצה לבדוק את הסיור הארוך בודה + מרגיט.`);
    const bookingConfirmed=locale==='hu'?`Szia, van egy megerősített VOY PRO Budapest foglalásom, és segítséget szeretnék kérni vele kapcsolatban.`:t(`Hi, I have a confirmed VOY PRO Budapest booking and I’d like help with it.`,`היי, יש לי הזמנה מאושרת ל־VOY PRO Budapest ואני רוצה עזרה בנוגע להזמנה.`);
    const groupRequest=locale==='hu'?`Szia, csoportos EZRaider programot tervezünk Budapesten. Segítséget szeretnénk kérni a dátum, a létszám és a megfelelő túraformátum összehangolásában.`:t(`Hi, we’re planning a group EZRaider experience in Budapest. We’d like help coordinating the date, group size and the best tour format.`,`היי, אנחנו מתכננים חוויית EZRaider לקבוצה בבודפשט ורוצים עזרה בתיאום התאריך, גודל הקבוצה ומבנה הסיור המתאים.`);
    const corporateRequest=locale==='hu'?`Szia, céges vagy csapatépítő EZRaider programot tervezünk Budapesten. Szeretnénk egyeztetni a létszámot, az időzítést, az útvonalat és a szervezési részleteket.`:t(`Hi, we’re planning a corporate or team-building EZRaider event in Budapest. We’d like to coordinate group size, timing, route and event details.`,`היי, אנחנו מתכננים פעילות חברה או גיבוש עם EZRaider בבודפשט ורוצים לתאם את גודל הקבוצה, לוח הזמנים, המסלול ופרטי האירוע.`);
    const lines=[context==='booking_confirmation'?bookingConfirmed:context==='private_flexible'?privateFlexible:context==='extended'?extended:context==='group'?groupRequest:context==='corporate'?corporateRequest:generic];
    const detailLines=[];
    if(details.booking_reference)detailLines.push(t(`Booking reference: ${details.booking_reference}`,`מספר הזמנה: ${details.booking_reference}`));
    if(details.experience_title)detailLines.push(whatsappPortugal&&locale==='pt'
      ?`Passeio: ${details.experience_title}`
      :t(`Tour: ${details.experience_title}`,`סיור: ${details.experience_title}`));
    const confirmedBooking=context==='booking_confirmation';
    if(details.date)detailLines.push(confirmedBooking?(locale==='he'?`תאריך: ${details.date}`:locale==='hu'?`Dátum: ${details.date}`:`Date: ${details.date}`)
      :whatsappPortugal&&locale==='pt'?`Data preferida: ${confirmationDateLabel(details.date)}`
      :t(`Preferred date: ${confirmationDateLabel(details.date)}`,`תאריך מועדף: ${confirmationDateLabel(details.date)}`));
    if(details.requested_time)detailLines.push(confirmedBooking?(locale==='he'?`שעה: ${details.requested_time}`:locale==='hu'?`Időpont: ${details.requested_time}`:`Time: ${details.requested_time}`):t(`Preferred time: ${confirmationTimeLabel(details.requested_time)}`,`שעה מועדפת: ${confirmationTimeLabel(details.requested_time)}`));
    if(details.riders)detailLines.push(t(`Independent riders: ${details.riders}`,`רוכבים עצמאיים: ${details.riders}`));
    if(whatsappPortugal&&details.people)detailLines.push(locale==='he'
      ?`משתתפים: ${details.people}`:locale==='pt'
        ?`Pessoas: ${details.people}`:`People: ${details.people}`);
    if(Number(details.children||0)>0)detailLines.push(t(`Child passengers: ${details.children}`,`נוסעים ילדים: ${details.children}`));
    if(Number(details.babies||0)>0)detailLines.push(t(`Baby passengers: ${details.babies}`,`נוסעים פעוטות: ${details.babies}`));
    if(details.guide_language)detailLines.push(whatsappPortugal&&locale==='pt'
      ?`Idioma do guia: ${guideLanguageLabel(details.guide_language)}`
      :t(`Requested guiding language: ${guideLanguageLabel(details.guide_language)}`,`שפת הדרכה מבוקשת: ${guideLanguageLabel(details.guide_language)}`));
    if(details.is_private)detailLines.push(t('Private tour: yes','סיור פרטי: כן'));
    if(Array.isArray(details.extras)&&details.extras.length){
      const extrasText=details.extras.map(item=>`${item.name} ×${Number(item.quantity||0)}`).join(', ');
      detailLines.push(`${ancillaryText('selectedExtras')}: ${extrasText}`);
    }
    if(details.payment_method){const paymentName=details.payment_method==='pay_now_card'?t('Paid online by card','שולם מראש בכרטיס'):details.payment_method==='pay_arrival_cash'?t('Cash on arrival','מזומן במקום'):t('Card on arrival','כרטיס במקום');detailLines.push(t(`Payment: ${paymentName}`,`תשלום: ${paymentName}`));}
    if(details.total!=null)detailLines.push(t(`Total: ${money(details.total,details.currency||'EUR')}`,`סה״כ: ${money(details.total,details.currency||'EUR')}`));
    if(detailLines.length)lines.push('',...detailLines);
    return 'https://wa.me/'+(whatsappPortugal?'351935695004':'36300993099')+'?text='+encodeURIComponent(lines.join('\n'));
  }

  function bindPortugalRequestFlow(){
    if(!isPortugalPage)return;
    const form=document.querySelector('[data-portugal-request-form]');
    if(!form)return;
    const labels=locale==='he'?{
      route:'מסלול',date:'תאריך מועדף',people:'משתתפים',language:'שפת הדרכה',name:'שם',notes:'הערות',
      missing:'יש להשלים מסלול, תאריך, שפת הדרכה ושם.',
      past:'יש לבחור את התאריך של היום או תאריך עתידי.'
    }:locale==='pt'?{
      route:'Passeio',date:'Data preferida',people:'Pessoas',language:'Idioma do guia',name:'Nome',notes:'Notas',
      missing:'Preencha o passeio, a data, o idioma e o nome.',
      past:'Escolha a data de hoje ou uma data futura.'
    }:{
      route:'Tour',date:'Preferred date',people:'People',language:'Guide language',name:'Name',notes:'Notes',
      missing:'Please complete tour, date, guide language and name.',
      past:'Choose today or a future date.'
    };
    const routeNames={express:'Vila de Marvão Express Tour',explorer:'Marvão Explorer Tour',megalithic:(locale==='pt'||locale==='he')?'Rota Megalítica':'Megalithic Route'};
    const routeSelect=form.querySelector('[name="route"]');
    const dateInput=form.querySelector('[name="date"]');
    const status=form.querySelector('[data-portugal-request-status]');
    const defaultStatus=status?.textContent||'';
    let showingRequestError=false;
    const showRequestError=message=>{
      if(status){status.textContent=message;showingRequestError=true;}
    };
    const clearRequestError=()=>{
      if(showingRequestError&&status){
        status.textContent=defaultStatus;
        showingRequestError=false;
      }
    };
    // Keep the original explanation about pressing Send and human confirmation
    // available after a guest corrects a field, instead of leaving a stale
    // "missing details", expired-date or long-link warning on screen.
    form.addEventListener('input',clearRequestError);
    form.addEventListener('change',clearRequestError);
    // WordPress, browser back/forward and mobile tabs can stay open overnight.
    // Use the local Lisbon calendar date for the visible picker and validation.
    const syncPortugalRequestDateMin=()=>{
      const today=portugalDate(0);
      if(dateInput)dateInput.min=today;
      return today;
    };
    syncPortugalRequestDateMin();
    dateInput?.addEventListener?.('focus',syncPortugalRequestDateMin);
    document.querySelectorAll('[data-portugal-tour]').forEach(a=>a.addEventListener('click',()=>{
      const route=String(a.dataset.portugalTour||'');
      if(routeSelect&&routeNames[route]){
        routeSelect.value=route;
        // A tour-card choice is a genuine form edit: notify the existing
        // input/change flow so obsolete validation is cleared immediately.
        routeSelect.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }));
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const today=syncPortugalRequestDateMin();
      const f=new FormData(form);
      const route=String(f.get('route')||'').trim();
      const date=String(f.get('date')||'').trim();
      const people=String(f.get('people')||'').trim();
      const guide=String(f.get('guide_language')||'').trim();
      // Limit the *encoded link*, not only visible characters: Hebrew and
      // emoji may expand to 6-12 URL bytes per Unicode code point. Discard
      // malformed lone surrogate halves so encodeURIComponent cannot throw.
      const safePoints=value=>Array.from(String(value||'').trim())
        .filter(point=>!(point.length===1&&/^[\uD800-\uDFFF]$/.test(point)));
      const name=safePoints(f.get('full_name')).slice(0,100);
      const allNotes=safePoints(f.get('notes'));
      const notes=allNotes.slice(0,500);
      if(!route||!date||!guide||!name.length){
        showRequestError(labels.missing);
        return;
      }
      if(date<today){
        // Focusing the date can blur a just-edited text field and dispatch
        // a bubbling change event. Focus first so that our own reset handler
        // cannot immediately erase this important past-date warning.
        dateInput?.focus({preventScroll:true});
        showRequestError(labels.past);
        return;
      }
      const intro=locale==='he'
        ?'היי, אני רוצה לבקש זמינות לסיור EZRaider במרבאו דרך VOY PRO.'
        :locale==='pt'
          ?'Olá, gostaria de pedir disponibilidade para um passeio de EZRaider em Marvão através da VOY PRO.'
          :'Hi, I’d like to request availability for an EZRaider tour in Marvão through VOY PRO.';
      const requiredLines=[
        intro,'',
        labels.route+': '+(routeNames[route]||route),
        labels.date+': '+((locale==='pt'||locale==='he')?confirmationDateLabel(date):date),
        labels.people+': '+people,
        labels.language+': '+guideLanguageLabel(guide)
      ];
      const sourceLine=(locale==='pt'?'Página':locale==='he'?'עמוד':'Page')+': '+location.pathname;
      const messageFor=(nameCount,notesCount)=>{
        const lines=[...requiredLines,labels.name+': '+name.slice(0,nameCount).join('')];
        if(notes.length){
          // The ellipsis tells the guest that more details may need to be
          // sent in WhatsApp; never silently remove the source or route.
          const clipped=notesCount<allNotes.length;
          lines.push(labels.notes+': '+notes.slice(0,notesCount).join('')+(clipped?'…':''));
        }
        lines.push(sourceLine);
        return lines.join('\n');
      };
      const urlPrefix='https://wa.me/351935695004?text=';
      const withinBudget=message=>urlPrefix.length+encodeURIComponent(message).length<1800;
      const maxFitting=(upper,build)=>{
        let low=0,high=upper;
        while(low<high){
          const mid=Math.ceil((low+high)/2);
          if(withinBudget(build(mid)))low=mid;
          else high=mid-1;
        }
        return low;
      };
      // Preserve essential context and as much of the name as possible,
      // then fill the remaining link budget with optional notes.
      const nameCount=maxFitting(name.length,n=>messageFor(n,0));
      const notesCount=maxFitting(notes.length,n=>messageFor(nameCount,n));
      const message=messageFor(nameCount,notesCount);
      if(!withinBudget(message)){
        showRequestError(locale==='he'?'ההודעה ארוכה מדי. נא לקצר את הפרטים.':
          locale==='pt'?'Mensagem demasiado longa. Reduza os detalhes.':'Message too long. Please shorten the details.');
        return;
      }
      const requestAnalytics={page,context:'portugal_availability_request',route,date,people:people||null,guide_language:guide};
      // A guest's WhatsApp action must not wait for a best-effort session
      // write: mobile navigation would otherwise stall when the API is slow.
      // This does not create a booking, and event tracking remains subject
      // to optional analytics consent. No customer name/notes enter telemetry.
      track('whatsapp_clicked',requestAnalytics);
      void createSession('whatsapp_clicked',requestAnalytics).catch(()=>{});
      location.href='https://wa.me/351935695004?text='+encodeURIComponent(message);
    });
  }
  bindPortugalRequestFlow();

  function enhanceMobileNavigation(){
    const nav=document.querySelector('.navlinks'); if(!nav||document.querySelector('.nav-menu-toggle')) return;
    const btn=document.createElement('button');btn.type='button';btn.className='nav-menu-toggle';btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls','mobile-nav-sheet');btn.setAttribute('aria-haspopup','dialog');btn.textContent=t('Menu','תפריט');nav.insertBefore(btn,nav.firstChild);
    const sheet=document.createElement('div');sheet.id='mobile-nav-sheet';sheet.className='mobile-nav-sheet';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label',locale==='he'?'תפריט ניווט':locale==='pt'?'Menu de navegação':locale==='hu'?'Navigációs menü':'Navigation menu');sheet.hidden=true;
    const closeMenuLabel=locale==='he'?'סגירת תפריט':locale==='pt'?'Fechar menu':locale==='hu'?'Menü bezárása':t('Close menu','סגירת תפריט');
    if(document.body?.dataset?.intent==='vehicle'){
      // A destination-neutral guide needs a destination-aware, four-language
      // mobile menu. The generic network-home menu would lose branch attribution.
      const mobileOrigin=['budapest','marvao','marvao-pt'].includes(vehicleGuideSource)?vehicleGuideSource:'home';
      const mobileMarvao=mobileOrigin==='marvao'||mobileOrigin==='marvao-pt';
      const mobileBudapest=mobileOrigin==='budapest';
      const mobileBudapestHome=locale==='he'?'/he/budapest/':locale==='hu'?'/hu/budapest/':'/budapest/';
      const mobileMarvaoHome=mobileOrigin==='marvao-pt'||locale==='pt'?'/pt/portugal/':locale==='he'?'/he/portugal/':'/portugal/';
      const mobileOriginHome=mobileBudapest?mobileBudapestHome:mobileMarvao?mobileMarvaoHome:'/';
      const mobileOriginBooking=mobileBudapest?mobileBudapestHome+'#booking':mobileMarvao?mobileMarvaoHome+'#request':'#choose-destination';
      const vehicleLabels={
        en:{heading:'Explore EZRaider',back:'Back to your destination',budapest:'Budapest · Hungary',marvao:'Portugal · Marvão',book:'Continue to availability',choose:'Choose destination',contact:'Contact the local team'},
        he:{heading:'הכירו את איזיריידר',back:'חזרה ליעד שלכם',budapest:'בודפשט · הונגריה',marvao:'מרבאו · פורטוגל',book:'המשך לבדיקת זמינות',choose:'בחירת יעד',contact:'יצירת קשר עם הצוות המקומי'},
        hu:{heading:'Ismerd meg az EZRaidert',back:'Vissza a helyszínre',budapest:'Budapest · Magyarország',marvao:'Portugália · Marvão',book:'Tovább az időpontokhoz',choose:'Úti cél választása',contact:'Kapcsolat a helyi csapattal'},
        pt:{heading:'Conheça o EZRaider',back:'Voltar ao destino',budapest:'Budapeste · Hungria',marvao:'Portugal · Marvão',book:'Consultar disponibilidade',choose:'Escolher destino',contact:'Contactar a equipa local'}
      }[locale]||{heading:'Explore EZRaider',back:'Back',budapest:'Budapest',marvao:'Marvão',book:'Availability',choose:'Choose destination',contact:'Contact local team'};
      sheet.innerHTML=`<div class="mobile-nav-card"><button type="button" class="mobile-nav-close" aria-label="${closeMenuLabel}">×</button><b>${vehicleLabels.heading}</b><a data-ez-context="back" href="${mobileOriginHome}">${mobileBudapest||mobileMarvao?vehicleLabels.back:vehicleLabels.choose}</a><a href="${mobileBudapestHome}">${vehicleLabels.budapest}</a><a href="${mobileMarvaoHome}">${vehicleLabels.marvao}</a><div class="mobile-language-row" data-mobile-language-row></div>${mobileOrigin==='home'?'':`<a class="btn secondary" data-mobile-nav-wa href="${whatsAppUrl()}">${vehicleLabels.contact}</a>`}<a class="btn" data-ez-context="booking" href="${mobileOriginBooking}">${mobileOrigin==='home'?vehicleLabels.choose:vehicleLabels.book}</a></div>`;
    }else if(!isPortugalPage&&!isBudapestPage){
      sheet.innerHTML=`<div class="mobile-nav-card"><button type="button" class="mobile-nav-close" aria-label="${closeMenuLabel}">×</button><b>Choose destination</b><a href="/budapest/">Budapest · Hungary</a><a href="/portugal/">Portugal · Marvão</a><a href="/manage/">Manage Booking</a><a class="btn secondary" data-mobile-nav-wa href="https://wa.me/36300993099">Ask VOY PRO</a><a href="/#destinations" class="btn">Choose destination</a></div>`;
    }else if(isPortugalPage){
      const portugalHome=locale==='he'?'/he/portugal/':locale==='pt'?'/pt/portugal/':'/portugal/';
      const budapestHome=locale==='he'?'/he/budapest/':'/budapest/';
      const heading=locale==='he'?'פורטוגל · מרבאו':locale==='pt'?'Portugal · Marvão':'Portugal · Marvão';
      const tours=locale==='he'?'סיורים':locale==='pt'?'Passeios':'Tours';
      const request=locale==='he'?'בקשת זמינות':locale==='pt'?'Pedir disponibilidade':'Request availability';
      const budapest=locale==='he'?'בודפשט':locale==='pt'?'Budapeste':'Budapest';
      sheet.innerHTML=`<div class="mobile-nav-card"><button type="button" class="mobile-nav-close" aria-label="${closeMenuLabel}">×</button><b>${heading}</b><a href="${portugalHome}#tours">${tours}</a><a href="${portugalHome}#request">${request}</a><a href="${budapestHome}">${budapest}</a><div class="mobile-language-row" data-mobile-language-row></div><a class="btn secondary" data-mobile-nav-wa href="https://wa.me/36300993099">WhatsApp · VOY PRO</a><a href="${portugalHome}#request" class="btn">${request}</a></div>`;
    }else{
      sheet.innerHTML=`<div class="mobile-nav-card"><button type="button" class="mobile-nav-close" aria-label="${closeMenuLabel}">×</button><b>${t('Explore Budapest','לגלות את בודפשט')}</b><a href="${localeBudapestCore('tours/buda-castle-ezraider-tour/')}">${t('Buda Castle Tour','סיור בודה')}</a><a href="${localeBudapestCore('tours/margaret-island-ezraider-tour/')}">${t('Margaret Island','אי מרגיט')}</a><a href="${localeBudapestCore('tours/heroes-square-city-ezraider-tour/')}">${locale==='hu'?'Hősök tere':t('Heroes’ Square','כיכר הגיבורים')}</a><a href="${localeBudapestCore('tours/citadella-advanced-ezraider-tour/')}">${locale==='hu'?'Citadella – haladó túra':t('Citadella Advanced','סיטדלה – סיור מתקדם')}</a><a href="${localeBudapestCore('tours/buda-margaret-extended-tour/')}">${t('Extended Tour','הסיור הארוך')}</a><a href="${localeBudapestCore('private-tours/')}">${t('Private Tours','סיורים פרטיים')}</a><a href="${locale==='he'?'/he/budapest/with-kids/':locale==='hu'?'/hu/budapest/with-kids/':'/budapest/with-kids/'}">${t('Budapest with Kids','בודפשט עם ילדים')}</a><a href="${locale==='he'?'/he/portugal/':locale==='hu'?'/portugal/':'/portugal/'}">${t('Portugal · Marvão','פורטוגל · מרבאו')}</a><div class="mobile-language-row" data-mobile-language-row></div><a class="btn secondary" data-mobile-nav-wa href="https://wa.me/36300993099">${t('Ask us on WhatsApp','פנייה ב-WhatsApp')}</a><a href="${localeBudapestBooking()}" class="btn">${t('Check availability','בדיקת זמינות')}</a></div>`;
    }
    document.body.appendChild(sheet);
    const langRow=sheet.querySelector('[data-mobile-language-row]');
    if(langRow)document.querySelectorAll('.language-picker .lang-switch').forEach(link=>langRow.appendChild(link.cloneNode(true)));
    const mobileWa=sheet.querySelector('[data-mobile-nav-wa]');
    if(mobileWa){
      // Tour/date/party choices can change after page load; never reuse a stale link.
      const refreshMobileWhatsApp=()=>{mobileWa.href=whatsAppUrl();};
      refreshMobileWhatsApp();
      mobileWa.addEventListener('pointerdown',refreshMobileWhatsApp);
      mobileWa.addEventListener('click',()=>{
        refreshMobileWhatsApp();
        track('whatsapp_clicked',{page,context:'mobile_nav'});
      });
    }
    const close=()=>{sheet.hidden=true;btn.setAttribute('aria-expanded','false');document.body.classList.remove('nav-open')};
    // CSS hides the menu toggle above 1180px. If a visitor rotates their
    // device or widens the window while the sheet is open, close the modal
    // and release the body's scroll lock before the opener disappears.
    const desktopNav=window.matchMedia?.('(min-width:1181px)');
    const closeOnDesktop=event=>{
      if(!event.matches||sheet.hidden)return;
      // When the toggle disappears at desktop width, do not strand keyboard
      // focus inside an aria-modal which is now hidden. The header logo stays
      // visible across breakpoints; only transfer focus if it was in the sheet.
      const hadFocus=sheet.contains(document.activeElement);
      close();
      if(hadFocus)document.querySelector('header a.brand')?.focus();
    };
    desktopNav?.addEventListener?.('change',closeOnDesktop);
    if(desktopNav?.matches)close();
    btn.onclick=()=>{if(mobileWa)mobileWa.href=whatsAppUrl();sheet.hidden=false;btn.setAttribute('aria-expanded','true');document.body.classList.add('nav-open');sheet.querySelector('.mobile-nav-close').focus()};sheet.querySelector('.mobile-nav-close').onclick=()=>{close();btn.focus()};sheet.addEventListener('click',e=>{if(e.target===sheet){close();btn.focus()}});sheet.addEventListener('keydown',e=>{if(e.key==='Escape'){close();btn.focus();return}if(e.key==='Tab'){const focusable=[...sheet.querySelectorAll('button,a[href]')];if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});// A same-document link can close the sheet without leaving the page;
    // return keyboard focus to its visible opener instead of a hidden link.
    // Do not prevent default navigation or change any destination.
    sheet.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{close();btn.focus({preventScroll:true})}));
  }
  document.querySelectorAll('a.brand').forEach(link=>{link.href='/';});

  function rescueMarkup(message){return `${message}<div class="status-actions"><a class="btn secondary" href="#" data-inline-wa>${t('Ask us on WhatsApp','פנייה ב‑WhatsApp')}</a><a class="btn secondary" href="${localeBudapestCore('tours/buda-castle-ezraider-tour/')}">${t('View Buda tour','לצפייה בסיור בודה')}</a></div>`}
  function bindInlineWhatsApp(root=document){root.querySelectorAll('[data-inline-wa]').forEach(a=>{a.href=whatsAppUrl();a.onclick=()=>track('whatsapp_clicked',{page,context:'booking_rescue'})})}
  function budapestDate(offsetDays=0){
    // Start from today's Budapest calendar day. Adding elapsed 24-hour periods
    // is wrong across DST: a 21-day booking window can shift by one day.
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    const day=new Date(Date.UTC(Number(v.year),Number(v.month)-1,Number(v.day)));
    day.setUTCDate(day.getUTCDate()+offsetDays);
    return day.toISOString().slice(0,10);
  }

  function portugalDate(offsetDays=0){
    // Marvão uses the Lisbon *calendar day*, never the visitor's local time.
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    const day=new Date(Date.UTC(Number(v.year),Number(v.month)-1,Number(v.day)));
    day.setUTCDate(day.getUTCDate()+offsetDays);
    return day.toISOString().slice(0,10);
  }

  let visitorId = getStore('voy_visitor_id') || uuid();
  if(analyticsAllowed()) setStore('voy_visitor_id',visitorId);
  const referrer = document.referrer || '';
  function analyticsReferrer(value){
    try{
      const u=new URL(String(value||''));
      return u.origin+u.pathname;
    }catch(e){return null;}
  }
  const inferredSource = qs.get('utm_source') || (referrer.includes('google.')?'google':referrer.includes('bing.')?'bing':referrer.includes('tripadvisor.')?'tripadvisor':referrer.includes('getyourguide.')?'getyourguide':referrer?'referral':'direct');
  const inferredMedium = qs.get('utm_medium') || ((inferredSource==='google'||inferredSource==='bing')?'organic':referrer?'referral':'none');
  const attr = {
    touch_id: uuid(),
    source: inferredSource, medium: inferredMedium,
    campaign: qs.get('utm_campaign') || null, content: qs.get('utm_content') || null,
    term: qs.get('utm_term') || null, referrer: analyticsReferrer(referrer),
    gclid:qs.get('gclid')||null, gbraid:qs.get('gbraid')||null, wbraid:qs.get('wbraid')||null,
    fbclid:qs.get('fbclid')||null, msclkid:qs.get('msclkid')||null, ttclid:qs.get('ttclid')||null,
    landing_page: location.pathname, captured_at: now()
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
    margaret:{en:['MARGARET ISLAND · GREEN RIDE','Check Margaret Island availability','Margaret Island departure times are confirmed from live availability.'],he:['אי מרגיט · המסלול הירוק','בדיקת זמינות לאי מרגיט','שעות היציאה לסיור אי מרגיט מאושרות לפי הזמינות החיה.'],hu:['MARGITSZIGET · ZÖLD TÚRA','Margitszigeti időpontok','A margitszigeti indulási időpontokat az élő elérhetőség erősíti meg.']},
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
  document.querySelectorAll('.language-picker .lang-switch.active, .language-picker .lang-switch.is-current').forEach(link=>link.setAttribute('aria-current','page'));
  enhanceMobileNavigation();

  function compactStickyBookingWhatsapp(){
    // Only pages with a Budapest mobile booking bar need the smaller floating action.
    if(!(isBudapestPage||isPortugalPage)||!document.querySelector('.mobilebook'))return;
    const link=document.querySelector('a.whatsapp:not(.home-whatsapp)');
    if(!link||link.classList.contains('compact-booking-whatsapp'))return;
    link.classList.add('compact-booking-whatsapp');
    link.setAttribute('aria-label',isPortugalPage?(locale==='he'?'שיחה עם צוות מרבאו ב־WhatsApp':locale==='pt'?'Conversar com a equipa de Marvão no WhatsApp':'Chat with the Marvão team on WhatsApp'):(locale==='he'?'שיחה עם צוות VOY PRO ב-WhatsApp':locale==='hu'?'VOY PRO ügyfélszolgálat WhatsAppon':'Chat with VOY PRO on WhatsApp'));
    link.innerHTML="<svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" focusable=\"false\"><path d=\"M20.5 3.5A11.6 11.6 0 0 0 12.1 0C5.7 0 .4 5.2.4 11.6c0 2 .5 4 1.6 5.7L0 24l6.9-1.8c1.6.9 3.4 1.4 5.2 1.4 6.4 0 11.6-5.2 11.6-11.6 0-3.1-1.2-6-3.2-8.2Zm-8.4 18.1c-1.7 0-3.4-.5-4.8-1.4l-.4-.2-4.1 1.1 1.1-4-.3-.4a9.6 9.6 0 0 1-1.5-5.1c0-5.3 4.3-9.6 9.6-9.6a9.6 9.6 0 0 1 0 19.2Zm5.3-7.1c-.3-.1-1.7-.8-2-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1a7.8 7.8 0 0 1-2.3-1.4 8.7 8.7 0 0 1-1.6-2c-.2-.3 0-.4.1-.6l.5-.5c.2-.2.2-.3.3-.5 0-.2 0-.4-.1-.5l-.9-2.1c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5 0-.8.3s-1 1-1 2.4 1.1 2.8 1.2 3c.2.2 2.1 3.2 5.1 4.4.7.3 1.3.4 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z\"/></svg>"+'<span class="compact-booking-whatsapp-label">WhatsApp</span>';
    // Anchor the icon just above the real sticky booking bar, not a fixed
    // offset that leaves a large gap on tall/short or translated bar labels.
    const bar=document.querySelector('.mobilebook');
    const syncFloatingGap=()=>{
      if(window.innerWidth>800)return;
      const rect=bar.getBoundingClientRect();
      if(rect.height<=0)return;
      const clearance=Math.ceil(window.innerHeight-rect.top+12);
      link.style.setProperty('--booking-whatsapp-bottom',clearance+'px');
    };
    syncFloatingGap();
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(syncFloatingGap).observe(bar);
    window.addEventListener('resize',syncFloatingGap,{passive:true});
  }
  compactStickyBookingWhatsapp();

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
      price.textContent=locale==='he'?'טוען מחיר חי…':locale==='hu'?'Élő ár betöltése…':'Loading live price…';facts.insertBefore(price,facts.firstChild);
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
  let eventFlushFailures=0;
  let eventFlushGeneration=0;
  let eventFlushController=null;
  const ANALYTICS_RETRY_BASE_MS=5000;
  const ANALYTICS_RETRY_MAX_MS=120000;
  function analyticsRetryDelay(){
    return Math.min(ANALYTICS_RETRY_MAX_MS,
      ANALYTICS_RETRY_BASE_MS*2**Math.min(Math.max(0,eventFlushFailures-1),5));
  }
  function cancelEventFlush(){
    // A response from before consent was revoked may never repopulate the
    // emptied analytics queue, even if the guest later grants consent again.
    eventFlushGeneration++;
    eventFlushFailures=0;
    if(eventFlushTimer!==null)clearTimeout(eventFlushTimer);
    eventFlushTimer=null;
    eventFlushController?.abort();
  }
  async function flushEventQueue({keepalive=false}={}){
    if(!analyticsAllowed()||!bookingEnabled||eventFlushInFlight)return;
    const queued=safeJSON(getStore(EVENT_KEY),[])||[];
    if(!queued.length)return;
    const batch=queued.slice(0,25);
    const generation=eventFlushGeneration;
    eventFlushInFlight=true;
    const controller=new AbortController();
    eventFlushController=controller;
    const timer=setTimeout(()=>controller.abort(),5000);
    let delivered=false;
    try{
      const response=await fetch(apiRoot+'/marketing/events',{
        method:'POST',
        headers:authHeaders(),
        body:JSON.stringify({session_id:getStore('voy_session_id')||null,events:batch}),
        keepalive,
        signal:controller.signal,
        cache:'no-store',
      });
      if(!response.ok)return;
      if(generation!==eventFlushGeneration||!analyticsAllowed())return;
      const sentIds=new Set(batch.map(item=>item?.event_id));
      const current=safeJSON(getStore(EVENT_KEY),[])||[];
      const remaining=current.filter(item=>!sentIds.has(item?.event_id)).slice(-25);
      setStore(EVENT_KEY,JSON.stringify(remaining));
      delivered=true;
      eventFlushFailures=0;
      // A visibility/page event may complete delivery while an old retry
      // is still queued. Cancel that obsolete timer after a successful ACK.
      if(eventFlushTimer!==null)clearTimeout(eventFlushTimer);
      eventFlushTimer=null;
    }catch(e){
      // Optional analytics must never interrupt the tour booking.
    }finally{
      clearTimeout(timer);
      if(eventFlushController===controller)eventFlushController=null;
      eventFlushInFlight=false;
      if(generation!==eventFlushGeneration){
        // The old request was cancelled on revocation. A new, explicitly
        // consented queue (if any) can start after the cancelled request ends.
        const next=analyticsAllowed()?(safeJSON(getStore(EVENT_KEY),[])||[]):[];
        if(next.length&&!keepalive)scheduleEventFlush(false);
        return;
      }
      if(!analyticsAllowed())return;
      if(!delivered)eventFlushFailures=Math.min(8,eventFlushFailures+1);
      const remaining=safeJSON(getStore(EVENT_KEY),[])||[];
      if(remaining.length&&!keepalive)scheduleEventFlush(false);
    }
  }
  function scheduleEventFlush(immediate=false){
    if(!analyticsAllowed()||!bookingEnabled)return;
    if(eventFlushTimer!==null)clearTimeout(eventFlushTimer);
    const delay=eventFlushFailures
      ?Math.max(immediate?50:1400,analyticsRetryDelay())
      :(immediate?50:1400);
    eventFlushTimer=setTimeout(()=>{eventFlushTimer=null;void flushEventQueue();},delay);
  }
  function track(event,metadata={}){
    if(!analyticsAllowed()||!bookingEnabled) return;
    const q=safeJSON(getStore(EVENT_KEY),[])||[];
    q.push(payload(event,metadata));
    setStore(EVENT_KEY,JSON.stringify(q.slice(-25)));
    scheduleEventFlush(q.length>=8||['booking_completed','capacity_request_created','whatsapp_clicked'].includes(event));
  }
  function recentEvents(){return analyticsAllowed()&&bookingEnabled?(safeJSON(getStore(EVENT_KEY),[])||[]):[];}
  const BOOKING_STARTED_KEY='voy_booking_started_v1';
  function resetBookingStarted(){
    try{sessionStorage.removeItem(BOOKING_STARTED_KEY)}catch(e){}
  }
  function trackBookingStarted(metadata={}){
    if(!analyticsAllowed()||!bookingEnabled)return;
    try{
      if(sessionStorage.getItem(BOOKING_STARTED_KEY)==='1')return;
      sessionStorage.setItem(BOOKING_STARTED_KEY,'1');
    }catch(e){}
    track('booking_started',metadata);
  }

  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushEventQueue({keepalive:true});});
  window.addEventListener('pagehide',()=>{flushEventQueue({keepalive:true});});
  track('page_view',{title:document.title}); if(segment!=='default') track('personalization_applied',{segment});

  function initAccessibility(){
    document.querySelector('main')?.setAttribute('id','main-content');
    document.querySelectorAll('[data-booking-step].is-active').forEach(el=>el.setAttribute('aria-current','step'));
    document.querySelectorAll('.status,[data-checkout-status],[data-hold-timer]').forEach(el=>{el.setAttribute('role','status');el.setAttribute('aria-live','polite');});
    document.querySelectorAll('.field').forEach((field,i)=>{
      const label=field.querySelector('label'); const control=field.querySelector('input,select,textarea');
      if(label&&control){if(!control.id) control.id='voy-field-'+i+'-'+Math.random().toString(36).slice(2,7);label.htmlFor=control.id;}
    });
  }
  function consentCopy(){
    if(locale==='pt') return {aria:'Preferências de cookies',title:'As suas escolhas de privacidade',body:'O armazenamento essencial mantém as funções de reserva. A análise opcional ajuda-nos a perceber que páginas e campanhas levam a reservas.',essential:'Apenas essencial',analytics:'Permitir análise',close:'Fechar sem alterações'};
    return {aria:t('Cookie preferences','העדפות עוגיות'),title:t('Your privacy choices','בחירות הפרטיות שלך'),body:t('Essential storage keeps booking features working. Optional analytics helps us understand which pages and campaigns lead to bookings.','אחסון חיוני מפעיל את תהליך ההזמנה. אנליטיקה אופציונלית עוזרת לנו להבין אילו עמודים וקמפיינים מובילים להזמנות.'),essential:t('Essential only','חיוני בלבד'),analytics:t('Allow analytics','לאפשר אנליטיקה'),close:t('Close without changes','סגירה ללא שינוי')};
  }
  function showConsentPreferences(force=false,returnFocusTo=null){
    document.documentElement.dataset.analyticsConsent=analyticsAllowed()?'granted':'denied';
    if(document.querySelector('.consent-banner')||(!force&&consent.decided)) return;
    const copy=consentCopy();
    const bar=document.createElement('section');
    bar.className='consent-banner';
    bar.setAttribute('role','dialog');
    bar.setAttribute('aria-label',copy.aria);
    // Only a returning guest with a saved decision can close preferences
    // without changing anything. First-time visitors still choose explicitly.
    const mayDismiss=Boolean(force&&consent.decided);
    bar.innerHTML=`<div><b>${copy.title}</b><p>${copy.body}</p></div><div class="consent-actions"><button type="button" class="btn secondary" data-consent-essential>${copy.essential}</button><button type="button" class="btn" data-consent-analytics>${copy.analytics}</button>${mayDismiss?`<button type="button" class="btn secondary consent-dismiss" data-consent-dismiss>${copy.close}</button>`:''}</div>`;
    document.body.appendChild(bar);
    document.body.classList.add('consent-open');
    // A returning visitor should be able to SEE and HEAR which setting is
    // already saved. No option is marked for a first-time undecided visitor.
    // aria-pressed is only presentation; closing preferences never writes it.
    if(mayDismiss){
      const selectedAnalytics=analyticsAllowed();
      bar.querySelector('[data-consent-essential]').setAttribute('aria-pressed',String(!selectedAnalytics));
      bar.querySelector('[data-consent-analytics]').setAttribute('aria-pressed',String(selectedAnalytics));
    }
    if(force) bar.querySelector('[data-consent-essential]').focus();
    const closePreferences=()=>{
      document.body.classList.remove('consent-open');
      bar.remove();
      returnFocusTo?.focus();
    };
    bar.querySelector('[data-consent-essential]').addEventListener('click',()=>{setConsent({analytics:false,marketing:false});closePreferences();});
    bar.querySelector('[data-consent-analytics]').addEventListener('click',()=>{const wasAnalytics=analyticsAllowed();setConsent({analytics:true,marketing:false});closePreferences();if(!wasAnalytics)resumeAnalyticsAfterConsent();});
    if(mayDismiss){
      bar.querySelector('[data-consent-dismiss]').addEventListener('click',closePreferences);
      bar.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();closePreferences();}
      });
    }
  }
  function initConsent(){
    showConsentPreferences(false);
    document.querySelectorAll('[data-cookie-settings]').forEach(btn=>btn.addEventListener('click',()=>showConsentPreferences(true,btn)));
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
      const r=await fetch(apiRoot+path,{...fetchOptions,headers,signal:externalSignal||controller?.signal,cache:fetchOptions.cache||'no-store'});
      const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch(e){data={error:text||r.statusText};}
      if(!r.ok){const err=new Error(data?.error||('HTTP '+r.status));err.status=r.status;err.code=data?.code;err.data=data;throw err;}
      return data;
    }catch(e){
      if(e?.name==='AbortError'){const err=new Error('Request timed out');err.code='REQUEST_TIMEOUT';throw err;}
      throw e;
    }finally{if(timer)clearTimeout(timer);}
  }

  async function hydrateDestinationRuntime(){
    if(!bookingEnabled||!isBudapestPage)return null;
    try{
      const data=await api('/destinations/budapest',{method:'GET',timeoutMs:5000});
      if(!data?.rider_policy||!data?.meeting_point)throw new Error('DESTINATION_CONFIG_INCOMPLETE');
      destinationRuntime=data;
      return data;
    }catch(e){
      destinationRuntime=null;
      return null;
    }
  }
  const budapestPolicy=()=>destinationRuntime?.rider_policy||null;
  function safeHttpsUrl(value){
    try{const u=new URL(String(value||''));return u.protocol==='https:'?u.toString():''}catch(e){return ''}
  }
  const budapestMeetingPoint=()=>{
    const meeting=destinationRuntime?.meeting_point;
    if(!meeting?.address)return null;
    return {address:String(meeting.address),maps_url:safeHttpsUrl(meeting.maps_url)};
  };
  function riderPolicyLabels(){
    const policy=budapestPolicy();
    if(!policy){
      return locale==='he'
        ?{riders:'רוכבים עצמאיים',children:'נוסעים ילדים',babies:'נוסעים פעוטות'}
        :locale==='hu'
          ?{riders:'Önálló vezetők',children:'Gyermek utasok',babies:'Kisgyermek utasok'}
          :{riders:'Independent riders',children:'Child passengers',babies:'Baby passengers'};
    }
    const riderAge=Number(policy.standard_min_age);
    const childMin=Number(policy.child_passenger_min_age),childMax=Number(policy.child_passenger_max_age);
    const babyMin=Number(policy.baby_passenger_min_age),babyMax=Number(policy.baby_passenger_max_age);
    if(locale==='he')return {
      riders:`רוכבים עצמאיים ${riderAge}+`,
      children:`ילדים ${childMin}–${childMax}`,
      babies:`פעוטות ${babyMin}–${babyMax}`,
    };
    if(locale==='hu')return {
      riders:`Önálló vezetők ${riderAge}+`,
      children:`Gyermekek ${childMin}–${childMax}`,
      babies:`Kisgyermekek ${babyMin}–${babyMax}`,
    };
    return {
      riders:`Independent riders ${riderAge}+`,
      children:`Children ${childMin}–${childMax}`,
      babies:`Babies ${babyMin}–${babyMax}`,
    };
  }
  function riderPolicyUnavailableLabel(){
    return locale==='he'?'פרטי הזכאות לרכיבה אינם זמינים כרגע'
      :locale==='hu'?'Az önálló vezetés feltételei jelenleg nem érhetők el'
      :locale==='pt'?'Os critérios de condução estão temporariamente indisponíveis'
      :'Riding eligibility details are temporarily unavailable';
  }
  function agePolicyUnavailableLabel(){
    return locale==='he'?'כללי הגיל העדכניים אינם זמינים כרגע — ניתן לפנות לצוות המקומי'
      :locale==='hu'?'Az aktuális korhatárok jelenleg nem érhetők el — kérjük, lépj kapcsolatba a helyi csapattal'
      :locale==='pt'?'As regras de idade estão temporariamente indisponíveis — contacte a equipa local'
      :'Current age rules are temporarily unavailable — please contact the local team';
  }

  function agePolicyText(){
    const policy=budapestPolicy();
    if(!policy)return null;
    const standard=Number(policy.standard_min_age);
    const assessment=Number(policy.assessment_min_age);
    const babyMin=Number(policy.baby_passenger_min_age);
    const childMax=Number(policy.child_passenger_max_age);
    if(locale==='he')return `רכיבה עצמאית מותרת מגיל ${standard}. בני ${assessment} יכולים לקבל אישור חריג מהצוות. ילדים מגיל ${babyMin} ועד גיל ${childMax} כולל יכולים להצטרף כנוסעים באמצעות כיסא או מערך נוסע מתאים.`;
    if(locale==='hu')return `Önállóan ${standard} éves kortól lehet vezetni. A ${assessment} éves résztvevő kivételesen, a csapat jóváhagyásával vezethet. Az ${babyMin}–${childMax} éves gyermekek utasként csatlakozhatnak, a megfelelő gyermek- vagy utasülés használatával.`;
    return `Independent riding is from age ${standard}. Riders aged ${assessment} may be approved as an exception by our team. Children from age ${babyMin} through ${childMax} can join as passengers using the appropriate child/passenger seat setup.`;
  }
  function applyDestinationRuntimeUI(){
    if(!isBudapestPage)return;
    const labels=riderPolicyLabels();
    for(const [name,label] of [['adults',labels.riders],['children',labels.children],['babies',labels.babies]]){
      document.querySelectorAll(`[name="${name}"]`).forEach(control=>{
        const field=control.closest('.field');
        const node=field?.querySelector('label');
        if(node)node.textContent=label;
      });
    }
    const policy=budapestPolicy();
    document.querySelectorAll('[data-runtime-rider-policy]').forEach(node=>{
      if(!policy){
        node.textContent=riderPolicyUnavailableLabel();
        node.dataset.runtimeState='unavailable';
        return;
      }
      node.dataset.runtimeState='ready';
      const standard=Number(policy.standard_min_age);
      const assessment=Number(policy.assessment_min_age);
      node.textContent=locale==='he'
        ?`רכיבה עצמאית בדרך כלל מגיל ${standard}; גיל ${assessment} בכפוף להערכת התאמה`
        :locale==='hu'
          ?`Önálló vezetés általában ${standard}+; ${assessment} évesen alkalmassági felméréssel`
          :`Independent riding is normally ${standard}+; age ${assessment} by suitability assessment`;
    });
    const liveAgePolicyText=agePolicyText();
    document.querySelectorAll('[data-runtime-age-policy]').forEach(node=>{
      node.textContent=liveAgePolicyText||agePolicyUnavailableLabel();
      node.dataset.runtimeState=liveAgePolicyText?'ready':'unavailable';
    });
  }

  await hydrateDestinationRuntime();
  applyDestinationRuntimeUI();

  async function resumeAnalyticsAfterConsent(){
    if(!analyticsAllowed()||!bookingEnabled)return;
    const existingFirst=safeJSON(getStore('voy_first_attribution'));
    const firstTouch=existingFirst||attr;
    setStore('voy_visitor_id',visitorId);
    if(!existingFirst)setStore('voy_first_attribution',JSON.stringify(firstTouch));
    setStore('voy_last_attribution',JSON.stringify(attr));
    setStore('voy_segment',segment);
    setStore('voy_experiments',JSON.stringify(experiments));
    const sid=getStore('voy_session_id');
    if(sid){
      try{
        await api('/attribution/sync',{method:'POST',body:JSON.stringify({
          session_id:sid,
          visitor_id:visitorId,
          attribution:{first_touch:firstTouch,last_touch:attr}
        })});
      }catch(e){}
    }
    track('page_view',{title:document.title,consent_transition:true});
    if(segment!=='default')track('personalization_applied',{segment,consent_transition:true});
    scheduleEventFlush(true);
  }

  let pendingSessionCreation=null;
  async function createSession(stage, extra={}){
    if(!bookingEnabled) return null;
    try{
      const existing=getStore('voy_session_id');
      if(existing){await patchSession({stage,...extra});return {id:existing};}
      // The first concurrent availability search must not spawn a second
      // CRM session while the initial POST is pending. Other callers may
      // await the same creation promise when they require a session.
      if(pendingSessionCreation){
        const prior=await pendingSessionCreation;
        const sid=getStore('voy_session_id');
        if(sid){await patchSession({stage,...extra});return {id:sid};}
        return prior;
      }
      const pending=(async()=>{
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
      })();
      pendingSessionCreation=pending;
      try{return await pending;}
      finally{if(pendingSessionCreation===pending)pendingSessionCreation=null;}
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
  const availabilityStatus=document.querySelector('#availability-status');if(availabilityStatus){availabilityStatus.setAttribute('role','status');availabilityStatus.setAttribute('aria-live','polite');}
  const slotList=document.querySelector('#slotlist');if(slotList){slotList.setAttribute('role','group');slotList.setAttribute('aria-label',t('Choose a departure:','בחרו שעה:'));}

  document.querySelectorAll('details[data-faq]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open) track('faq_opened',{question:d.dataset.faq});}));
  document.querySelectorAll('[data-review-source]').forEach(a=>a.addEventListener('click',()=>track('trust_source_clicked',{provider:a.dataset.reviewSource})));
  document.querySelectorAll('[data-related]').forEach(a=>a.addEventListener('click',()=>track('related_tour_clicked',{target:a.getAttribute('href')})));
  document.querySelectorAll('[data-tour-detail]').forEach(a=>a.addEventListener('click',()=>track('tour_detail_clicked',{target:a.getAttribute('href'),source:'tour_picker'})));
  function analyticsLinkTarget(value){
    const raw=String(value||'').trim();
    if(!raw)return null;
    try{
      const u=new URL(raw,location.origin);
      if(!/^https?:$/.test(u.protocol))return null;
      return u.origin===location.origin?u.pathname:u.origin+u.pathname;
    }catch(e){return null;}
  }
  document.querySelectorAll('[data-track]').forEach(el=>el.addEventListener('click',()=>{
    const name=el.dataset.track;
    if(name==='whatsapp_clicked') createSession('whatsapp_clicked',{page});
    else if(name==='booking_cta') createSession('booking_intent',{page});
    track(name==='booking_cta'?'hero_cta_clicked':name,{label:(el.textContent||'').trim().slice(0,120),target:analyticsLinkTarget(el.getAttribute('href'))});
  }));
  // Group, corporate and private enquiry pages deliberately author a detailed
  // WhatsApp brief. Never replace it with the generic Budapest greeting.
  // Ordinary booking/navigation CTAs still recompute from the live form.
  const authoredInquiryPage=/(?:^|\/)budapest\/(?:group-tours|corporate-events|private-tours)\/?$/.test(routePath);
  document.querySelectorAll('[data-wa]').forEach(a=>{
    const href=a.getAttribute('href')||'';
    let hasAuthoredInquiry=false;
    if(authoredInquiryPage&&/^https:\/\/wa\.me\/36300993099\?text=/.test(href)){
      try{hasAuthoredInquiry=(new URL(href)).searchParams.get('text')?.trim().length>30;}
      catch{hasAuthoredInquiry=false;}
    }
    if(hasAuthoredInquiry){
      // Send the public source path, not query parameters, booking tokens or
      // client state. Keep the authored multi-question message unchanged.
      const sourceLabel=locale==='he'?'עמוד':locale==='hu'?'Oldal':'Page';
      const link=new URL(href);
      const message=link.searchParams.get('text')||'';
      const sourceLine=sourceLabel+': '+location.pathname;
      if(!message.split('\n').includes(sourceLine)){
        link.searchParams.set('text',message+'\n'+sourceLine);
        a.href=link.toString();
      }
      return;
    }
    const refresh=()=>{a.href=whatsAppUrl();};
    refresh();
    a.addEventListener('pointerdown',refresh);
    a.addEventListener('click',refresh);
  });
  document.querySelectorAll('[data-special-request]').forEach(a=>a.addEventListener('click',()=>{
    const context=a.dataset.specialRequest||'private_flexible';
    // Preserve a page-authored structured enquiry; fall back to the generic request template elsewhere.
    if(!/^https:\/\/wa\.me\/\d+\?text=\S+/.test(a.getAttribute('href')||'')) a.href=whatsAppUrl(context);
    createSession('whatsapp_clicked',{page,context,...currentRequestDetails()});
    track('special_request_clicked',{context,page,...currentRequestDetails()});
  }));

  const productCache={bySlug:{},byId:{}};
  // The Request-to-Book enhancer is the ONLY authoritative request form for
  // these nine tours. Do not render the deprecated WhatsApp builder even
  // momentarily while the deferred RTB script is loading (or if it fails).
  const requestOnlyTourRoute=/^\/(?:he\/|hu\/)?budapest\/tours\/(?:heroes-square-city-ezraider-tour|citadella-advanced-ezraider-tour|buda-margaret-extended-tour)\/?$/.test(location.pathname);
  function ensureSpecialRequestBuilder(){
    if(requestOnlyTourRoute||document.body.dataset.intent!=='extended'||document.querySelector('[data-special-request-builder]')) return;
    const panel=document.querySelector('.special-request-panel');if(!panel)return;
    panel.classList.add('has-builder');
    const form=document.createElement('form');form.className='special-request-builder';form.dataset.specialRequestBuilder='';
    const riderControl=`<input type="number" name="special_riders" min="1" step="1" required value="1">`;
    form.innerHTML=`<div class="special-builder-head"><b>${t('Tell us what you need','ספרו לנו מה אתם צריכים')}</b><span>${t('We’ll send the details to the Budapest team on WhatsApp.','נשלח את הפרטים לצוות בודפשט ב‑WhatsApp.')}</span></div><div class="special-builder-grid"><label>${t('Preferred date','תאריך מועדף')}<input type="date" name="special_date" required></label><label>${t('Independent riders','רוכבים עצמאיים')}${riderControl}</label><label>${t('Guide language','שפת הדרכה')}<select name="special_guide_language" required disabled><option value="">${t('Live languages unavailable','שפות זמינות ייטענו מהמערכת')}</option></select></label><label>${t('Private?','פרטי?')}<select name="special_private"><option value="false">${t('No · regular extended request','לא · בקשת סיור ארוך רגיל')}</option><option value="true">${t('Yes · our group only','כן · רק הקבוצה שלנו')}</option></select></label><label>${t('Preferred start time','שעת יציאה מועדפת')} <small>${t('(optional)','(אופציונלי)')}</small><input type="time" name="special_time"></label></div><button class="btn alt" type="submit">${t('Send request on WhatsApp','שליחת בקשה ב‑WhatsApp')}</button><small class="special-builder-note">${t('This sends a request, not a confirmed booking. Our local team will confirm the route, time, vehicles and guide language.','זו בקשה ולא הזמנה מאושרת. הצוות המקומי יאשר מסלול, שעה, כלים, מדריכים ושפת הדרכה.')}</small>`;
    form._updateGuideLanguages=(products=[])=>{
      const select=form.querySelector('select[name="special_guide_language"]');
      if(!select)return;
      const languages=[...new Set((products||[])
        .flatMap(p=>Array.isArray(p?.guideLanguages)?p.guideLanguages:[])
        .map(code=>String(code||'').toLowerCase())
        .filter(Boolean))];
      select.innerHTML=`<option value="">${languages.length?t('Choose language','בחרו שפה'):t('Live languages unavailable','שפות זמינות אינן זמינות כרגע')}</option>`+
        languages.map(code=>`<option value="${escapeHTML(code)}">${escapeHTML(guideLanguageLabel(code))}</option>`).join('');
      select.disabled=!languages.length;
    };
    panel.appendChild(form);
    const date=form.querySelector('[name="special_date"]');const horizon=Number(destinationRuntime?.booking_horizon_days);date.min=budapestDate(0);if(Number.isInteger(horizon)&&horizon>0)date.max=budapestDate(horizon);date.value=budapestDate(1);
    form.addEventListener('submit',e=>{
      e.preventDefault();const data=new FormData(form);
      const details={experience_title:t('Extended Buda + Margaret','בודה + מרגיט — הסיור הארוך'),date:String(data.get('special_date')||''),requested_time:String(data.get('special_time')||''),riders:Number(data.get('special_riders')||0),children:0,babies:0,guide_language:String(data.get('special_guide_language')||'').trim().toLowerCase(),is_private:String(data.get('special_private'))==='true'};
      const href=whatsAppUrl('extended',details);
      track('special_request_builder_submitted',{context:'extended',page,...details});
      createSession('whatsapp_clicked',{page,context:'extended_builder',...details});
      location.href=href;
    });
  }
  ensureSpecialRequestBuilder();
  // Budapest request-only pilot: language preference and explicit English
  // alternative consent are collected without exposing a private server key.
  if(requestOnlyTourRoute){
    const loader=document.createElement('script');
    loader.src='/assets/rtb-request.js?v=20261026r11';
    loader.defer=true;
    document.head.appendChild(loader);
  }


  // W2.4: public B2B enquiry planner. WhatsApp is explicitly the delivery step;
  // no CRM write, accepted-lead acknowledgement, or contact-data analytics is implied.
  function bindB2BEnquiryPlanner(){
    document.querySelectorAll('form[data-b2b-planner]').forEach(form=>{
      const kind=form.dataset.b2bPlanner;
      if(!['group','corporate'].includes(kind))return;
      const date=form.querySelector('input[name="requested_date"]');
      const notes=form.querySelector('textarea[name="notes"]');
      const whatsAppLengthError=locale==='he'
        ?'הודעת הוואטסאפ ארוכה מדי. קצרו את הפרטים האופציונליים ונסו שוב.'
        :locale==='hu'?'A WhatsApp-üzenet túl hosszú. Rövidítsd a nem kötelező részleteket, majd próbáld újra.'
        :'The WhatsApp message is too long. Shorten the optional details and try again.';
      notes?.addEventListener('input',()=>notes.setCustomValidity(''));
      const dateErrorLabel=locale==='he'
        ?'יש לבחור תאריך מהיום והלאה.'
        :locale==='hu'?'Válassz mai vagy későbbi dátumot.':'Choose today or a future date.';
      const syncDateMinimum=()=>{if(date)date.min=budapestDate(0);};
      if(date){
        syncDateMinimum();
        date.addEventListener('focus',syncDateMinimum);
        date.addEventListener('change',()=>date.setCustomValidity(''));
      }
      // Consent is to a fallback for the *currently selected* guiding
      // language, not a general preference. Unknown stays unknown. Switching
      // languages clears any previous opt-in, including switches to English.
      const languageField=form.querySelector('select[name="guide_language"]');
      const englishChoice=form.querySelector('input[name="english_ok"]');
      const englishRow=englishChoice?.closest('.b2b-english-check');
      const englishDecline=form.querySelector('[data-b2b-english-decline]');
      // Three distinct states for a manual enquiry: not answered, accepted,
      // or explicitly declined. Unchecked is NEVER interpreted as "no".
      const clearEnglishDecline=()=>englishDecline?.setAttribute('aria-pressed','false');
      const updateEnglishChoice=()=>{
        if(!languageField||!englishChoice)return;
        englishChoice.checked=false;
        clearEnglishDecline();
        const show=Boolean(languageField.value&&languageField.value!=='en');
        englishChoice.disabled=!show;
        if(englishRow)englishRow.hidden=!show;
        if(englishDecline){englishDecline.hidden=!show;englishDecline.disabled=!show;}
      };
      englishChoice?.addEventListener('change',()=>{
        if(englishChoice.checked)clearEnglishDecline();
      });
      englishDecline?.addEventListener('click',()=>{
        if(englishDecline.disabled||englishRow?.hidden)return;
        const declined=englishDecline.getAttribute('aria-pressed')!=='true';
        englishDecline.setAttribute('aria-pressed',String(declined));
        if(declined)englishChoice.checked=false;
      });
      languageField?.addEventListener('change',updateEnglishChoice);
      updateEnglishChoice();
      const btn=form.querySelector('[data-b2b-open]');
      if(!btn)return;
      btn.addEventListener('click',()=>{
        // A previously long message must not leave stale form validity errors
        // after the guest edits any optional field and retries.
        notes?.setCustomValidity('');
        // Native HTML validity is deliberately checked here, since the button is
        // type=button to prevent a JS-disabled form from submitting private data.
        syncDateMinimum();
        if(date){
          date.setCustomValidity('');
          if(date.value&&date.value<budapestDate(0)){
            date.setCustomValidity(dateErrorLabel);
            date.reportValidity();
            return;
          }
        }
        if(!form.reportValidity())return;
        const fd=new FormData(form);
        const field=(key,max=500)=>String(fd.get(key)||'').trim().slice(0,max);
        const size=Number(field('headcount',6));
        if(!Number.isSafeInteger(size)||size<1||size>10000)return;
        const language=field('guide_language',12);
        if(!['en','he','hu','es','other'].includes(language))return;
        const dateValue=field('requested_date',10);
        if(dateValue&&dateValue<budapestDate(0)){if(date){date.setCustomValidity(dateErrorLabel);date.reportValidity();}return;}
        const labels={
          en:{intro:'Hi VOY PRO Budapest, I would like help planning a',group:'group EZRaider experience.',corporate:'corporate/team-building event.',date:'Preferred date',size:'Participants',window:'Preferred time window',language:'Preferred guiding language',english:'English also possible',englishDeclined:'English not accepted as an alternative; requested guiding language only',private:'Private group preferred',company:'Company',name:'Organizer',notes:'Notes',source:'Enquiry page'},
          he:{intro:'שלום VOY PRO בודפשט, אשמח לתכנן',group:'סיור EZRaider לקבוצה.',corporate:'פעילות גיבוש או אירוע חברה.',date:'תאריך מועדף',size:'משתתפים',window:'חלון שעות',language:'שפת הדרכה מועדפת',english:'גם אנגלית מתאימה',englishDeclined:'אנגלית אינה חלופה מתאימה; רק שפת ההדרכה המבוקשת',private:'מעדיפים קבוצה פרטית',company:'חברה',name:'איש קשר',notes:'פרטים נוספים',source:'עמוד הפנייה'},
          hu:{intro:'Szia VOY PRO Budapest, szeretnék egyeztetni egy',group:'csoportos EZRaider túrát.',corporate:'céges/csapatépítő programot.',date:'Dátum',size:'Résztvevők',window:'Előnyben részesített időszak',language:'Kért idegenvezetési nyelv',english:'Angol is megfelelő',englishDeclined:'Az angol nem megfelelő alternatíva; csak a kért idegenvezetési nyelv',private:'Privát csoportot szeretnénk',company:'Cég',name:'Kapcsolattartó',notes:'Megjegyzések',source:'Érdeklődés oldala'}
        };
        const l=labels[locale]||labels.en;
        // Share localized *display names* with staff in the manually sent
        // WhatsApp message. Keep the underlying customer choice as a stable
        // code for analytics and any future reviewed operational interface.
        const names={
          en:{languages:{en:'English',he:'Hebrew',hu:'Hungarian',es:'Spanish',other:'Other — please discuss'},
            windows:{morning:'Morning',afternoon:'Afternoon',evening:'Evening'}},
          he:{languages:{en:'אנגלית',he:'עברית',hu:'הונגרית',es:'ספרדית',other:'אחר — לתיאום עם הצוות'},
            windows:{morning:'בוקר',afternoon:'צהריים',evening:'ערב'}},
          hu:{languages:{en:'Angol',he:'Héber',hu:'Magyar',es:'Spanyol',other:'Más — egyeztetendő'},
            windows:{morning:'Délelőtt',afternoon:'Délután',evening:'Este'}}
        };
        const display=names[locale]||names.en;
        const lines=[l.intro+' '+l[kind],l.size+': '+size];
        if(dateValue)lines.push(l.date+': '+dateValue);
        const windowValue=field('time_window',12);
        if(windowValue&&windowValue!=='flexible'&&Object.hasOwn(display.windows,windowValue))
          lines.push(l.window+': '+display.windows[windowValue]);
        lines.push(l.language+': '+display.languages[language]);
        if(language!=='en'&&englishChoice&&!englishChoice.disabled&&
          englishChoice.checked&&fd.get('english_ok')==='yes')lines.push(l.english+': yes');
        else if(language!=='en'&&englishDecline&&!englishDecline.disabled&&
          englishDecline.getAttribute('aria-pressed')==='true')lines.push(l.englishDeclined);
        if(field('private_preference',12)==='private')lines.push(l.private+': yes');
        for(const [key,label,max] of [['company',l.company,90],['organizer',l.name,70],['notes',l.notes,500]]){
          const value=field(key,max);
          if(value)lines.push(label+': '+value);
        }
        lines.push(l.source+': '+location.pathname);
        // Percent-encoded Hebrew/emoji can expand a short-looking enquiry to
        // an unreliable WhatsApp deep link. Never silently discard customer
        // details, claim the enquiry was sent, or record a successful hand-off.
        const whatsAppLink='https://wa.me/36300993099?text='+encodeURIComponent(lines.join('\n'));
        if(whatsAppLink.length>=1800){
          if(notes){
            notes.setCustomValidity(whatsAppLengthError);
            notes.reportValidity();
            notes.focus();
          }
          return;
        }
        // Intentionally do not persist private text, company, or customer name
        // in analytics/session storage or submit it to an unverified backend.
        track('b2b_whatsapp_planner_opened',{context:kind,page,participants:size,guide_language:language,source:'b2b_planner'});
        location.href=whatsAppLink;
      });
    });
  }
  bindB2BEnquiryPlanner();
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
      const price=card.querySelector('[data-tour-price]'), state=card.querySelector('[data-tour-live-state]'), duration=card.querySelector('.tour-duration');
      card.classList.remove('is-live','is-unavailable');
      if(p){
        card.dataset.productId=p.id||'';
        if(duration)duration.textContent=liveDurationLabel(p.durationMinutes)||durationUnavailableLabel();
        if(price&&p.priceFrom!=null) price.textContent=t('From ','החל מ־')+money(p.priceFrom,p.currency||'EUR');
        if(p.bookingEnabled===false){card.classList.add('is-unavailable');if(state)state.textContent=t('Contact the local team','פנו לצוות המקומי');}
        else {card.classList.add('is-live');if(state)state.textContent=t('Online booking','הזמנה באתר');}
      }else{
        card.classList.add('is-unavailable');
        if(duration&&isDurationPlaceholder(duration))duration.textContent=durationUnavailableLabel();
        if(price)price.textContent=t('Live price unavailable','מחיר חי אינו זמין כרגע');
        if(state)state.textContent=t('Contact the local team','פנו לצוות המקומי');
      }
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
    return Array.isArray(product?.guideLanguages)
      ?product.guideLanguages.map(x=>String(x).toLowerCase()).filter(Boolean)
      :[];
  }
  function ensureGuideLanguageField(form){
    if(!form||form.querySelector('[data-guide-language-field]')) return;
    const dateField=form.querySelector('input[name="date"]')?.closest('.field');
    if(!dateField)return;
    const field=document.createElement('div');field.className='field guide-language-field';field.dataset.guideLanguageField='';
    const languageHelp=locale==='hu'
      ?'Válaszd ki a csoportodnak megfelelő idegenvezetési nyelvet. Nem választunk ki nyelvet automatikusan.'
      :t('Choose the guiding language that works for your group. We do not select a language automatically.','בחרו את שפת ההדרכה המתאימה לקבוצה. לא נבחרת שפה באופן אוטומטי.');
    field.innerHTML=`<label for="booking-guide-language">${t('Guide language','שפת הדרכה')}</label><select id="booking-guide-language" name="guide_language" required aria-required="true" aria-describedby="booking-guide-language-help" disabled><option value="">${t('Choose guide language','בחרו שפת הדרכה')}</option></select><small id="booking-guide-language-help">${escapeHTML(languageHelp)}</small>`;
    dateField.insertAdjacentElement('afterend',field);
    const select=field.querySelector('select');
    form._updateGuideLanguages=(product,{preserve=true}={})=>{
      const before=preserve?String(select.value||''):'';
      const languages=guideLanguagesForProduct(product);
      const placeholder=languages.length
        ?t('Choose guide language','בחרו שפת הדרכה')
        :locale==='hu'?'A nyelvi lehetőségek nem érhetők el – lépj kapcsolatba a csapatunkkal'
          :t('Guide languages unavailable – contact our team','שפות ההדרכה אינן זמינות כרגע – פנו לצוות שלנו');
      select.innerHTML=`<option value="">${escapeHTML(placeholder)}</option>`+languages.map(code=>`<option value="${escapeHTML(code)}">${escapeHTML(guideLanguageLabel(code))}</option>`).join('');
      // Preserve a language only when the guest explicitly selected it before
      // and the newly selected tour still offers it. Never silently default
      // to English, the site locale, or the first available option.
      select.value=before&&languages.includes(before)?before:'';
      select.disabled=!languages.length;
      field.dataset.availableLanguages=languages.join(',');
    };
    form._updateGuideLanguages(null,{preserve:false});
  }
  function updateGuideLanguageField(product){
    const form=document.querySelector('#availability-form');
    if(form&&typeof form._updateGuideLanguages==='function')form._updateGuideLanguages(product);
  }


  function validateGroupComposition(form,composition){
    // Validate what the guest actually selected; the server decides passenger
    // seats, capacity and pricing, so no additional business caps are invented.
    const fields=[['adults','riders_16_plus'],['children','child_passengers_3_15'],['babies','baby_passengers_1_2']];
    const invalid=locale==='he'?'בחרו מספר משתתפים תקין לפני בדיקת הזמינות.'
      :locale==='hu'?'Válassz érvényes létszámot az elérhetőség ellenőrzése előtt.'
      :'Select valid group quantities before checking availability.';
    for(const [name,key] of fields){
      const select=form?.querySelector('select[name="'+name+'"]');
      const value=composition?.[key];
      if(!select||!Number.isSafeInteger(value)||value<(name==='adults'?1:0)||
        ![...select.options].some(option=>String(option.value)===String(select.value)&&Number(option.value)===value)){
        return {valid:false,message:invalid};
      }
    }
    return {valid:true,message:''};
  }
  function ensureGroupCompositionPreview(form){
    if(!form||form.querySelector('[data-group-composition-preview]'))return;
    const lastField=form.querySelector('select[name="babies"]')?.closest('.field');
    if(!lastField)return;
    const preview=document.createElement('div');
    preview.className='booking-group-preview';
    preview.dataset.groupCompositionPreview='';
    preview.setAttribute('role','status');
    preview.setAttribute('aria-live','polite');
    lastField.insertAdjacentElement('afterend',preview);
    const update=()=>{
      const counts={
        riders_16_plus:Number(form.querySelector('select[name="adults"]')?.value),
        child_passengers_3_15:Number(form.querySelector('select[name="children"]')?.value),
        baby_passengers_1_2:Number(form.querySelector('select[name="babies"]')?.value),
      };
      const check=validateGroupComposition(form,counts);
      preview.dataset.valid=String(check.valid);
      if(!check.valid){preview.textContent=check.message;return;}
      const labels=riderPolicyLabels();
      const total=counts.riders_16_plus+counts.child_passengers_3_15+counts.baby_passengers_1_2;
      const totalLabel=locale==='he'?'סה״כ משתתפים':locale==='hu'?'Összes résztvevő':'Total participants';
      const note=locale==='he'?'זמינות כיסאות הנוסעים והמחיר הסופי מאושרים בבדיקת זמינות.'
        :locale==='hu'?'Az utasülések elérhetőségét és a végső árat az elérhetőség-ellenőrzés erősíti meg.'
        :'Passenger seat availability and final price are confirmed during live availability.';
      preview.textContent=`${labels.riders}: ${counts.riders_16_plus} · ${labels.children}: ${counts.child_passengers_3_15} · ${labels.babies}: ${counts.baby_passengers_1_2} · ${totalLabel}: ${total}. ${note}`;
    };
    form.addEventListener('change',event=>{
      if(['adults','children','babies'].includes(event.target?.name))update();
    });
    update();
  }

  let availabilitySearchGeneration=0;
  let checkoutPreparationGeneration=0;
  let checkoutPreparationActiveGeneration=null;
  function invalidateCheckoutPreparation(){
    checkoutPreparationGeneration++;
    document.querySelector('#slotlist')?.removeAttribute('aria-busy');
  }
  function ensurePrivateUpgrade(form){
    if(!form||form.querySelector('[data-private-upgrade]')) return;
    const experienceField=form.querySelector('select[name="experience"]')?.closest('.field');
    if(!experienceField) return;
    const box=document.createElement('div');
    box.className='booking-mode-selector';box.dataset.privateUpgrade='';box.hidden=true;
    box.innerHTML=`<input type="hidden" name="is_private" value="false"><div class="booking-mode-head"><div><small>${t('TOUR STYLE','סוג הסיור')}</small><b>${t('Choose how you want to ride','בחרו איך תרצו לצאת')}</b></div><span data-booking-mode-note>${t('Final price is shown after you choose a departure.','המחיר הסופי מחושב בזמן אמת לאחר בחירת יציאה.')}</span></div><div class="booking-mode-grid" role="group" aria-label="${t('TOUR STYLE','סוג הסיור')}"><button type="button" class="booking-mode-card is-active" data-booking-mode="standard" aria-pressed="true"><span class="booking-mode-check" aria-hidden="true">✓</span><b>${t('Join a scheduled tour','להצטרף לסיור רגיל')}</b><small data-standard-mode-price>${t('Current rider price','מחיר נוכחי לרוכב')}</small><em>${t('Share the departure with other VOY PRO guests.','היציאה יכולה לכלול אורחי VOY PRO נוספים.')}</em></button><button type="button" class="booking-mode-card is-private" data-booking-mode="private" aria-pressed="false"><span class="booking-mode-check" aria-hidden="true">✓</span><b>${t('Private tour · your group only','סיור פרטי · רק הקבוצה שלכם')}</b><small data-private-price>${t('Private upgrade shown before confirmation','תוספת לסיור פרטי מוצגת לפני האישור')}</small><em data-private-min></em></button></div><div class="booking-mode-foot"><a href="#" data-special-request="private_flexible" data-private-flexible>${t('Need a different private start time? Send a request with your date and group','צריכים שעה אחרת לסיור פרטי? שלחו בקשה עם התאריך והקבוצה')}</a><span>${t('Private availability requires an empty departure.','זמינות פרטית דורשת יציאה שטרם הוזמנה.')}</span></div>`;
    experienceField.insertAdjacentElement('afterend',box);
    const nudge=document.createElement('div');nudge.className='experience-nudge';nudge.dataset.experienceNudge='';nudge.hidden=true;box.insertAdjacentElement('afterend',nudge);
    const hidden=box.querySelector('input[name="is_private"]');
    const setMode=(mode,{silent=false}={})=>{
      if(!silent&&document.querySelector('#live-checkout-shell')?.hasAttribute('data-submit-locked'))return;
      const privateMode=mode==='private';
      hidden.value=privateMode?'true':'false';
      box.querySelectorAll('[data-booking-mode]').forEach(btn=>{
        const active=btn.dataset.bookingMode===mode;
        btn.classList.toggle('is-active',active);btn.setAttribute('aria-pressed',String(active));
      });
      if(!silent){
        availabilitySearchGeneration++;
        invalidateCheckoutPreparation();
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
    const min=Number(product.privateMinRiders);
    const standardPrice=box.querySelector('[data-standard-mode-price]');
    if(standardPrice)standardPrice.textContent=finiteNumber(product.priceFrom)!=null?t(`${money(product.priceFrom,product.currency||'EUR')} per independent rider`,`‏${money(product.priceFrom,product.currency||'EUR')} לרוכב עצמאי`):t('Current rider price','מחיר נוכחי לרוכב');
    const price=box.querySelector('[data-private-price]');
    if(price)price.textContent=surcharge!=null?t(`Regular rate + ${money(surcharge,product.currency||'EUR')} per rider`,`מחיר רגיל + ${money(surcharge,product.currency||'EUR')} לכל רוכב`):t('Private surcharge shown before confirmation','תוספת הסיור הפרטי תוצג במחיר החי');
    const minNode=box.querySelector('[data-private-min]');
    if(minNode)minNode.textContent=Number.isInteger(min)&&min>0
      ?t(`Available from ${min} independent riders.`,`זמין החל מ־${min} רוכבים עצמאיים.`)
      :t('Private-tour minimum is temporarily unavailable.','מינימום הרוכבים לסיור פרטי אינו זמין כרגע.');
    const flexible=box.querySelector('[data-private-flexible]');if(flexible)flexible.hidden=product.flexibleDepartureWhenPrivate===false;
    const defaultMode=page.includes('/private-tours/')?'private':'standard';
    if(typeof box._setBookingMode==='function')box._setBookingMode(defaultMode,{silent:true});
    updateExperienceNudge(product);
  }


  const RECOVERY_TTL_MS=2*60*60*1000;
  function savedSelectionRecovery(){
    const state=safeJSON(getStore('voy_recovery_state'));
    // Browser storage is untrusted and device clocks can change. Invalid,
    // non-finite and future timestamps must never keep a resume prompt alive.
    const savedAt=state?.saved_at;
    const savedAtValid=typeof savedAt==='number'&&Number.isSafeInteger(savedAt)&&savedAt>0;
    const age=savedAtValid?Date.now()-savedAt:NaN;
    if(!savedAtValid||age<0||age>RECOVERY_TTL_MS){delStore('voy_recovery_state');return null;}
    // A saved v1 party is not a booking. Discard malformed snapshots before
    // displaying a restore button that would inevitably fail after clicking.
    const party=state?.composition;
    const date=state?.date;
    const parsedDate=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)
      ?Date.parse(date+'T12:00:00Z'):NaN;
    const validDate=Number.isFinite(parsedDate)&&
      new Date(parsedDate).toISOString().slice(0,10)===date&&
      // A selection from yesterday may still be within the storage TTL,
      // but its past departure cannot be restored. Hide that stale action
      // before the guest clicks it; do not touch current form choices.
      date>=budapestDate(0);
    const validParty=party&&typeof party==='object'&&!Array.isArray(party)&&
      ['riders_16_plus','child_passengers_3_15','baby_passengers_1_2'].every(key=>
        Number.isSafeInteger(party[key])&&party[key]>=0)&&
      party.riders_16_plus>=1&&
      (party.request_15yo_independent_assessment===undefined||
        typeof party.request_15yo_independent_assessment==='boolean');
    const language=state?.guide_language;
    const validLanguage=language===null||
      (typeof language==='string'&&/^[a-z]{2,8}$/.test(language));
    if(state.version!==1||typeof state.experience_id!=='string'||
      !state.experience_id.trim()||state.experience_id.length>128||
      !validDate||!validParty||typeof state.is_private!=='boolean'||
      !validLanguage){
      delStore('voy_recovery_state');
      return null;
    }
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
    // Essential-only browser storage belongs to the guest, not a booking.
    // Offer a one-click choice to discard it without network requests or
    // touching any selections already entered in the current form.
    const actions=shell.querySelector('.resume-actions');
    if(actions&&!actions.querySelector('[data-resume-dismiss]')){
      const discard=document.createElement('button');
      discard.type='button';
      discard.className='resume-dismiss';
      discard.dataset.resumeDismiss='';
      discard.textContent=locale==='he'?'מחיקת הבחירה השמורה'
        :locale==='hu'?'Mentett választás törlése':'Discard saved selection';
      discard.setAttribute('aria-label',discard.textContent);
      discard.addEventListener('click',()=>{
        delStore('voy_recovery_state');
        shell.hidden=true;
        const status=document.querySelector('#availability-status');
        if(status){
          status.textContent=locale==='he'?'הבחירה השמורה נמחקה. לא בוצעה הזמנה.'
            :locale==='hu'?'A mentett választás törölve. Nem történt foglalás.'
            :'Saved selection discarded. No booking was made.';
          status.setAttribute('tabindex','-1');
          status.focus({preventScroll:true});
        }
      });
      actions.appendChild(discard);
    }
    cta.onclick=async e=>{
      e.preventDefault();
      const form=document.querySelector('#availability-form');if(!form)return;
      if(!productCache.byId[state.experience_id])await hydrateCatalog();
      const experience=productCache.byId[state.experience_id];
      const select=form.querySelector('[name="experience"]');
      const date=form.querySelector('[name="date"]');
      const adults=form.querySelector('select[name="adults"]');
      const children=form.querySelector('select[name="children"]');
      const babies=form.querySelector('select[name="babies"]');
      const language=form.querySelector('select[name="guide_language"]');
      const code=String(state.guide_language||'').trim().toLowerCase();
      const choices=[
        [adults,state.composition?.riders_16_plus],
        [children,state.composition?.child_passengers_3_15],
        [babies,state.composition?.baby_passengers_1_2]
      ];
      const hasOption=(field,value)=>Boolean(field&&[...field.options].some(o=>o.value===String(value)));
      const iso=String(state.date||'');
      const parsed=/^\d{4}-\d{2}-\d{2}$/.test(iso)?Date.parse(iso+'T12:00:00Z'):NaN;
      const validDate=Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,10)===iso&&
        iso>=budapestDate(0)&&(!date?.max||iso<=date.max);
      const counts={
        riders_16_plus:Number(state.composition?.riders_16_plus),
        child_passengers_3_15:Number(state.composition?.child_passengers_3_15),
        baby_passengers_1_2:Number(state.composition?.baby_passengers_1_2),
        request_15yo_independent_assessment:Boolean(state.composition?.request_15yo_independent_assessment)
      };
      // Local browser storage is not a trusted booking. Reject stale, malformed,
      // unsupported, or now-unavailable choices BEFORE mutating the live form.
      const valid=experience&&experience.bookingEnabled!==false&&
        select&&hasOption(select,experience.id)&&date&&language&&
        // A v1 snapshot with no selected guide language may still restore
        // the party and date. Keep language unset; the normal booking search
        // requires an explicit choice before any availability lookup.
        (!code||guideLanguagesForProduct(experience).includes(code))&&
        validDate&&counts.riders_16_plus>=1&&
        choices.every(([field,value])=>Number.isSafeInteger(value)&&
          value>=0&&hasOption(field,value))&&
        // validateGroupComposition checks the FORM's current selected values.
        // It is only meaningful after restore, not against the pre-restore UI.
        (!state.is_private||Boolean(experience.privateAllowed)&&
          counts.riders_16_plus>=Number(experience.privateMinRiders));
      if(!valid){delStore('voy_recovery_state');shell.hidden=true;return;}

      select.value=experience.id;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      // The tour-change handler can reset the private selector. Apply the
      // saved mode only AFTER the product and its private rules are hydrated.
      updatePrivateUpgrade(experience);
      date.value=iso;
      for(const [field,value] of choices)field.value=String(value);
      language.value=code;
      const mode=document.querySelector('[data-private-upgrade]');
      if(mode&&typeof mode._setBookingMode==='function')
        mode._setBookingMode(state.is_private?'private':'standard',{silent:true});
      // Programmatic select.value does not trigger the composition-preview
      // listener. One native change event recalculates the entire summary and
      // invalidates any stale departure result without creating a hold.
      adults.dispatchEvent(new Event('change',{bubbles:true}));
      setSelectedTourHint(experience);
      const status=document.querySelector('#availability-status');
      if(status)status.textContent=code
        ?t('Selection restored. Search again to recheck availability and price.','הבחירה שוחזרה. חפשו שוב כדי לבדוק מחדש זמינות ומחיר חיים.')
        :locale==='hu'?'A választás visszaállítva. Válaszd ki az idegenvezetés nyelvét, mielőtt elérhetőséget keresel.'
        :locale==='he'?'הבחירה שוחזרה. בחרו שפת הדרכה לפני בדיקת הזמינות.'
        :'Selection restored. Choose your guide language before checking availability.';
      track('selection_recovery_restored',{experience_id:experience.id,date:iso,is_private:Boolean(state.is_private),guide_language:code});
      patchSession({stage:'selection_recovery_restored',experience_id:experience.id,selected_date:iso,is_private:Boolean(state.is_private),guide_language:code});
      shell.hidden=true;form.scrollIntoView({behavior:'smooth',block:'center'});
    };
  }

  function localizedBudapestExperienceTitle(experience,fallbackTitle=''){
    const raw=[experience?.slug,experience?.id,experience?.title,fallbackTitle].filter(Boolean).join(' ').toLowerCase();
    if(raw.includes('extended')||(raw.includes('buda')&&raw.includes('margaret')))return locale==='he'?'סיור ארוך בודה + מרגיט':locale==='hu'?'Buda + Margitsziget hosszabb túra':'Extended Buda + Margaret Tour';
    if(raw.includes('margaret'))return locale==='he'?'סיור אי מרגיט על EZRaider':locale==='hu'?'Margitsziget EZRaiderrel':'Margaret Island by EZRaider';
    if(raw.includes('buda'))return locale==='he'?'סיור בודה על EZRaider':locale==='hu'?'Budai városnézés EZRaiderrel':'Buda Highlights by EZRaider';
    return String(experience?.title||fallbackTitle||'').trim();
  }
  function catalogLoadingLabel(){
    return locale==='he'?'טוען אפשרויות ומחירים חיים…':locale==='hu'?'Élő túraopciók és árak betöltése…':'Loading live tour options and prices…';
  }
  function catalogUnavailableLabel(){
    return locale==='he'?'אפשרויות ומחירים חיים אינם זמינים כרגע':locale==='hu'?'Az élő túraopciók és árak jelenleg nem érhetők el':'Live tour options and prices are temporarily unavailable';
  }
  // Keep long diagnostic copy in the booking panel. The sticky mobile CTA
  // is a tiny navigation surface, not a place for an error paragraph.
  function setRuntimePriceState(state){
    const verbose=state==='loading'?catalogLoadingLabel():catalogUnavailableLabel();
    const short=state==='loading'
      ?(locale==='he'?'בודקים מחיר…':locale==='hu'?'Ár ellenőrzése…':'Checking price…')
      :(locale==='he'?'מחיר לא זמין':locale==='hu'?'Ár nem elérhető':'Price unavailable');
    document.querySelectorAll('[data-runtime-price]').forEach(node=>{
      const bar=node.closest('.mobilebook');
      const heroPrice=node.matches('.hero .facts [data-home-live-price]');
      // The main booking panel owns the full error. A long sentence inside
      // the hero's wrapping badges moves its CTA and picture at load time.
      node.textContent=(bar||heroPrice)?short:verbose;
      if(heroPrice){
        node.setAttribute('aria-label',verbose);
        node.title=verbose;
      }
      if(bar){
        bar.classList.toggle('is-price-loading',state==='loading');
        bar.classList.toggle('is-price-unavailable',state==='unavailable');
        node.setAttribute('aria-label',verbose);
        node.title=verbose;
      }
    });
  }
  function setCatalogUnavailableUI(selects){
    selects.forEach(select=>{
      select.innerHTML=`<option value="">${escapeHTML(catalogUnavailableLabel())}</option>`;
      select.disabled=true;
    });
    setRuntimePriceState('unavailable');
    const status=document.querySelector('#availability-status');
    if(status)status.textContent=locale==='he'
      ?'לא ניתן לאמת כרגע אפשרויות, מחיר או זמינות מול מערכת ההזמנות. נסו שוב בעוד רגע.'
      :locale==='hu'
        ?'A foglalási rendszerből jelenleg nem ellenőrizhetők az opciók, árak vagy az elérhetőség. Kérjük, próbálja újra rövidesen.'
        :'Tour options, pricing and availability cannot be verified with the booking system right now. Please try again shortly.';
    const submit=document.querySelector('#availability-form button[type="submit"]');
    if(submit)submit.disabled=true;
  }

  async function hydrateCatalog(){
    const selects=[...document.querySelectorAll('select[name="experience"]')];
    const submit=document.querySelector('#availability-form button[type="submit"]');
    selects.forEach(select=>{
      select.innerHTML=`<option value="">${escapeHTML(catalogLoadingLabel())}</option>`;
      select.disabled=true;
    });
    setRuntimePriceState('loading');
    if(submit)submit.disabled=true;

    if(!bookingEnabled){
      selects.forEach(select=>{
        select.innerHTML=`<option value="">${t('Online booking is temporarily unavailable','ההזמנה החיה בתהליך חיבור')}</option>`;
        select.disabled=true;
      });
      setRuntimePriceState('unavailable');
      hydrateTourCards([]);
      return [];
    }

    try{
      const products=await api('/experiences',{method:'GET',timeoutMs:5000});
      if(!Array.isArray(products)||!products.length)throw new Error('CATALOG_EMPTY');

      products.forEach(p=>{productCache.bySlug[p.slug]=p;productCache.byId[p.id]=p;});
      hydrateTourCards(products);

      const bookable=products.filter(p=>p.bookingEnabled!==false);
      if(!bookable.length)throw new Error('CATALOG_NOT_BOOKABLE');

      const requested=qs.get('experience');
      const intentAliases=requested?[requested]:(page.includes('buda-margaret-extended')?['buda-margaret-extended','extended-buda-margaret','buda-and-margaret','buda-margaret']:(page.includes('margaret-island')?['margaret-island','margaret-island-tour']:['buda-highlights','buda-castle']));
      const intended=intentAliases.map(slug=>bookable.find(p=>p.slug===slug)).find(Boolean)||null;

      selects.forEach(select=>{
        const before=select.value;
        select.innerHTML='';
        select.disabled=false;
        bookable.forEach(p=>{
          const option=document.createElement('option');
          option.value=p.id;
          option.dataset.slug=p.slug;
          option.textContent=localizedBudapestExperienceTitle(p,p.title);
          select.appendChild(option);
        });
        if(before&&bookable.some(p=>p.id===before))select.value=before;
        else if(intended)select.value=intended.id;
      });

      const isSpecialPage=page.includes('margaret-island')||page.includes('buda-margaret-extended');
      const selectedId=selects.find(select=>select.value)?.value||null;
      const active=(selectedId?bookable.find(p=>p.id===selectedId):null)||intended||(!isSpecialPage?bookable[0]:null);

      if(active){
        setStore('voy_experience_id',active.id);
        hydratePrice(active);
        setSelectedTourHint(active);
        updatePrivateUpgrade(active);
        updateGuideLanguageField(active);
      }

      if(isSpecialPage&&!intended){
        const isExtended=page.includes('buda-margaret-extended');
        const label=isExtended?t('Extended Buda + Margaret — contact us','בודה + מרגיט — פנו אלינו'):t('Margaret Island — contact us','אי מרגיט — פנו אלינו');
        selects.forEach(select=>{select.innerHTML=`<option value="">${label}</option>`;select.disabled=true;});
        document.querySelectorAll('[data-runtime-price]').forEach(node=>node.textContent=t('Contact us for this route','פנו אלינו לגבי המסלול'));
        const status=document.querySelector('#availability-status');
        if(status)status.textContent=isExtended
          ?t('The extended Buda + Margaret tour is currently confirmed by the local team. Contact us on WhatsApp.','הסיור הארוך בודה + מרגיט מתואם כרגע מול הצוות המקומי. אפשר לפנות אלינו ב‑WhatsApp.')
          :t('Margaret Island is currently confirmed by the local team. Contact us on WhatsApp, or view the Buda tour for online booking.','אי מרגיט מתואם כרגע מול הצוות המקומי. אפשר לפנות אלינו ב‑WhatsApp, או לעבור לסיור בודה להזמנה באתר.');
        if(submit)submit.disabled=true;
      }else if(submit){
        submit.disabled=false;
      }

      return products;
    }catch(e){
      setCatalogUnavailableUI(selects);
      hydrateTourCards([]);
      return [];
    }
  }
  function hydratePrice(p){
    if(!p||p.priceFrom==null)return;
    document.querySelectorAll('[data-runtime-price]').forEach(node=>{
      const amount=money(p.priceFrom,p.currency||'EUR');
      // Mobile booking has its own localized "starting at" label above the amount.
      node.textContent=node.closest('.mobilebook')?amount:t('From ','החל מ־')+amount;
      const bar=node.closest('.mobilebook');
      if(bar)bar.classList.remove('is-price-loading','is-price-unavailable');
      if(bar||node.matches('.hero .facts [data-home-live-price]')){
        node.removeAttribute('aria-label');
        node.removeAttribute('title');
      }
    });
  }

  function ensureCheckoutShell(){
    const booking=document.querySelector('#booking .booking-grid'); if(!booking||document.querySelector('#live-checkout-shell')) return;
    const shell=document.createElement('div');shell.id='live-checkout-shell';shell.className='live-checkout-shell';shell.hidden=true;
    shell.innerHTML=`<div class="panel checkout-panel"><div class="checkout-title-row"><div><div class="eyebrow">${t('BOOKING','הזמנה')}</div><h3 data-checkout-heading tabindex="-1">${t('Complete your booking','השלמת ההזמנה')}</h3></div><button type="button" class="checkout-edit" data-checkout-edit>${t('Change selection','שינוי בחירה')}</button></div><div data-checkout-summary class="checkout-summary"></div><div class="checkout-assurance"><span>${t('Current price','מחיר נוכחי')}</span><span>${t('Places held while you finish','המקומות נשמרים בזמן השלמת ההזמנה')}</span><span>${t('Direct Budapest team','צוות בודפשט ישירות')}</span></div><div data-hold-timer class="hold-timer"></div><section data-ancillary-upsell class="ancillary-upsell" hidden></section><form id="live-checkout-form"><div class="checkout-fields"><div class="field"><label for="checkout-full-name">${t('Full name','שם מלא')}</label><input id="checkout-full-name" name="full_name" required autocomplete="name"></div><div class="field"><label for="checkout-email">Email</label><input id="checkout-email" name="email" type="email" required autocomplete="email"></div><div class="field"><label for="checkout-phone">${t('Phone','טלפון')}</label><input id="checkout-phone" name="phone" type="tel" required autocomplete="tel"></div><div class="field payment-field"><label for="checkout-payment-method">${t('Payment','תשלום')}</label><select id="checkout-payment-method" name="payment_method" aria-describedby="payment-method-help online-card-status"><option value="pay_now_card" disabled>${t('Pay now by card','תשלום מיידי בכרטיס')}</option><option value="pay_arrival_card">${t('Pay by card on arrival','תשלום בכרטיס במקום')}</option><option value="pay_arrival_cash">${t('Pay cash on arrival','תשלום במזומן במקום')}</option></select><small id="payment-method-help" class="payment-method-note" data-payment-method-note aria-live="polite">${escapeHTML(paymentMethodHelp('pay_arrival_card'))}</small><small id="online-card-status" class="payment-method-note" data-online-card-status aria-live="polite">${t('Online card payment is currently unavailable','תשלום מיידי בכרטיס אינו זמין כרגע')}</small></div></div><div class="checkout-legal" data-checkout-legal><label><input type="checkbox" name="legal_acceptance" required><span>${t('I accept the Terms of Use and confirm I have read the Privacy Notice.','אני מאשר/ת את תנאי השימוש ומאשר/ת שקראתי את הצהרת הפרטיות.')} <a href="${legalBasePath()}terms/" target="_blank" rel="noopener">${t('Terms of Use','תנאי שימוש')}</a> · <a href="${legalBasePath()}privacy/" target="_blank" rel="noopener">${t('Privacy Notice','הצהרת פרטיות')}</a></span></label></div><button class="btn checkout-confirm" type="submit">${t('Book now – payment obligation','אישור הזמנה – התחייבות לתשלום')}</button><div class="status" data-checkout-status role="status" aria-live="polite"></div></form></div>`;
    (booking.firstElementChild||booking).appendChild(shell);
    shell.querySelector('[data-checkout-edit]')?.addEventListener('click',()=>{
      setCheckoutSubmissionLock(false);
      if(bookingState)bookingState.submissionSnapshot=null;
      releaseHold();shell.hidden=true;setBookingStep(1);
      const slots=document.querySelector('#slotlist');if(slots)slots.innerHTML='';
      const status=document.querySelector('#availability-status');if(status)status.textContent=t('Selection unlocked. Update the tour, date or group and search again.','הבחירה נפתחה מחדש. עדכנו סיור, תאריך או קבוצה וחפשו שוב.');
      const availabilityForm=document.querySelector('#availability-form');availabilityForm?.querySelector('[name="experience"]')?.focus({preventScroll:true});availabilityForm?.scrollIntoView({behavior:'smooth',block:'center'});
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
    const select=document.querySelector('#live-checkout-form [name="payment_method"]');
    if(!select||!bookingEnabled)return;
    const payNow=select.querySelector('option[value="pay_now_card"]');
    const availability=document.querySelector('#live-checkout-form [data-online-card-status]');
    const submit=document.querySelector('#live-checkout-form button[type="submit"]');
    const note=document.querySelector('#live-checkout-form [data-payment-method-note]');
    const sync=()=>{
      if(submit)submit.textContent=select.value==='pay_now_card'?t('Continue to secure card payment','המשך לתשלום מאובטח בכרטיס'):t('Book now – payment obligation','אישור הזמנה – התחייבות לתשלום');
      if(note)note.textContent=paymentMethodHelp(select.value);
    };
    select._voySyncPayment=sync;
    let paymentSelectionTouched=false;
    const paymentSelectionFrozen=()=>select.closest('#live-checkout-form')?.dataset.submitting==='true'||Boolean(select.closest('#live-checkout-shell')?.hasAttribute('data-submit-locked'));
    select.addEventListener('change',()=>{paymentSelectionTouched=true;sync();});
    try{
      const caps=await api('/payments/capabilities',{method:'GET',timeoutMs:5000});
      paymentCapabilities=caps||paymentCapabilities;
      if(paymentSelectionFrozen())return;
      const onlineReady=Boolean(caps?.online_card);
      if(payNow){
        payNow.disabled=!onlineReady;
        if(onlineReady&&!paymentSelectionTouched){
          payNow.defaultSelected=true;
          payNow.selected=true;
        }
      }
      if(availability){
        availability.hidden=onlineReady;
        availability.textContent=onlineReady?'':t('Online card payment is currently unavailable','תשלום מיידי בכרטיס אינו זמין כרגע');
      }
      sync();
    }catch{
      if(paymentSelectionFrozen())return;
      if(payNow)payNow.disabled=true;
      if(availability){
        availability.hidden=false;
        availability.textContent=t('Online card payment is currently unavailable','תשלום מיידי בכרטיס אינו זמין כרגע');
      }
      sync();
    }
  }
  let bookingState={slot:null,composition:null,quote:null,hold:null,experience:null,date:null,isPrivate:false,guideLanguage:null,idempotencyKey:null,extras:[],ancillaryOffers:[]};

  function ensureSingleCouponControl(){
    const shell=document.querySelector('#live-checkout-shell');
    const form=shell?.querySelector('#live-checkout-form');
    if(!form)return;
    let panel=form.querySelector('[data-affiliate-coupon-panel]');
    if(!panel){
      panel=document.createElement('div');
      panel.className='field';
      panel.dataset.affiliateCouponPanel='';
      const legal=form.querySelector('[data-checkout-legal]');
      if(legal)legal.insertAdjacentElement('beforebegin',panel);
      else form.insertAdjacentElement('afterbegin',panel);
    }
    // The referral link is the only allowed discount source; do not render a coupon input.
    if(affiliateCode){
      panel.hidden=true;
      panel.replaceChildren();
      return;
    }
    panel.hidden=false;
    panel.replaceChildren();
    const label=document.createElement('label');
    label.textContent=t('Discount coupon (optional)','קופון הנחה (לא חובה)');
    const input=document.createElement('input');
    input.type='text';
    input.autocomplete='off';
    input.maxLength=40;
    input.dataset.singleCoupon='';
    input.value=bookingState.promoCode||'';
    input.placeholder=t('Enter one code','הזינו קופון אחד');
    label.appendChild(input);
    panel.appendChild(label);
    const button=document.createElement('button');
    button.type='button';
    button.className='btn secondary';
    button.dataset.applySingleCoupon='';
    button.textContent=t('Apply code','הפעלת קופון');
    panel.appendChild(button);
    const status=document.createElement('p');
    status.className='muted';
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    panel.appendChild(status);
    button.addEventListener('click',async()=>{
      if(shell.hasAttribute('data-submit-locked')||bookingState.submissionSnapshot)return;
      const next=String(input.value||'').trim().toUpperCase();
      if(next&&!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(next)){
        status.textContent=t('Enter one valid coupon code.','יש להזין קופון תקין אחד.');
        return;
      }
      const previous=bookingState.promoCode||null;
      if(next===(previous||'')){
        status.textContent=t('This code is already applied.','הקופון הזה כבר הופעל.');
        return;
      }
      button.disabled=true;
      panel.setAttribute('aria-busy','true');
      const checkoutKey=bookingState.idempotencyKey;
      status.textContent=t('Checking coupon and price…','בודקים את הקופון והמחיר…');
      try{
        if(next){
          const result=await api('/promotions/validate',{method:'POST',body:JSON.stringify({
            code:next,slot_id:bookingState.slot?.id||null
          })});
          if(!result?.valid)throw new Error(result?.message||'Coupon not valid');
        }
        if(!bookingState.capacityRequest){
          if(!bookingState.slot?.id)throw new Error('Departure selection required');
          const quote=await api('/quotes',{method:'POST',body:JSON.stringify({
            slot_id:bookingState.slot.id,
            group_composition:bookingState.composition,
            is_private:Boolean(bookingState.isPrivate),
            extras:bookingState.extras||[],
            // A private hold reserves the whole departure. Refresh its own quote;
            // a fresh departure quote would reject the existing private hold.
            ...(bookingState.isPrivate&&bookingState.hold?.id?{hold_id:bookingState.hold.id}:{}),
            promo_code:next||null
          })});
          assertCheckoutQuote(quote);
          if(checkoutKey!==bookingState.idempotencyKey)return;
          bookingState.quote=quote;
        }
        if(checkoutKey!==bookingState.idempotencyKey)return;
        bookingState.promoCode=next||null;
        if(!bookingState.capacityRequest){
          renderStandardCheckoutSummary();
          renderAncillaryOffers();
        }
        status.textContent=next?t('Coupon applied. Total updated.','הקופון הופעל והמחיר עודכן.'):t('Coupon removed.','הקופון הוסר.');
      }catch(e){
        bookingState.promoCode=previous;
        status.textContent=t('Coupon unavailable. Your price is unchanged.','הקופון אינו זמין. המחיר נותר ללא שינוי.');
      }finally{button.disabled=false;panel.removeAttribute('aria-busy');}
    });
  }

  hydratePaymentMethods();
  let holdTimer=null;
  function releaseHold(){const id=bookingState.hold?.id;if(id&&bookingEnabled){api('/holds/'+encodeURIComponent(id),{method:'DELETE'}).catch(()=>{});}bookingState.hold=null;if(holdTimer)clearInterval(holdTimer);}
  function lockExpiredCheckout({focusRecovery=false}={}){
    bookingState.hold=null;
    if(holdTimer)clearInterval(holdTimer);
    const checkout=document.querySelector('#live-checkout-form');
    const submit=checkout?.querySelector('button[type="submit"]');
    if(submit)submit.disabled=true;
    checkout?.setAttribute('data-hold-expired','true');
    setBookingStep(1);
    if(focusRecovery)document.querySelector('[data-checkout-edit]')?.focus({preventScroll:true});
  }
  function startHoldTimer(expires){const node=document.querySelector('[data-hold-timer]');if(!node){releaseHold();lockExpiredCheckout({focusRecovery:true});return false;}if(holdTimer)clearInterval(holdTimer);const expiresAtMs=Date.parse(String(expires||''));if(!Number.isFinite(expiresAtMs)){node.textContent=t('Hold could not be verified — select the departure again.','לא ניתן לאמת את שמירת המקום — יש לבחור שעה מחדש.');releaseHold();lockExpiredCheckout({focusRecovery:true});patchSession({stage:'hold_expired',hold_expired_at:now(),hold_expiry_unverified:true});return false;}const tick=()=>{const left=Math.max(0,expiresAtMs-Date.now());if(!left){node.textContent=t('Hold expired — select the departure again.','שמירת המקום פגה — יש לבחור שעה מחדש.');lockExpiredCheckout();patchSession({stage:'hold_expired',hold_expired_at:now()});return false;}const m=Math.floor(left/60000),s=Math.floor((left%60000)/1000);node.textContent=t(`Your places are held for ${m}:${String(s).padStart(2,'0')}`,`המקומות נשמרים למשך ${m}:${String(s).padStart(2,'0')}`);return true;};if(!tick())return false;holdTimer=setInterval(tick,1000);return true;}

  function setBookingStep(step){
    document.querySelectorAll('[data-booking-step]').forEach(el=>{
      const n=Number(el.getAttribute('data-booking-step'));
      el.classList.toggle('is-active',n===step);
      el.classList.toggle('is-done',n<step);
      if(n===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');
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
    const assurance=shell.querySelector('.checkout-assurance'); if(assurance)assurance.hidden=false;
    const pay=form?.querySelector('[name="payment_method"]')?.closest('.field'); if(pay) pay.hidden=false;
    const legal=form?.querySelector('[data-checkout-legal]'); if(legal){legal.hidden=false;const box=legal.querySelector('input');if(box){box.required=true;box.checked=false;}}
    const submit=form?.querySelector('button[type="submit"]'); if(submit) submit.textContent=t('Book now – payment obligation','אישור הזמנה – התחייבות לתשלום');
    const st=shell.querySelector('[data-checkout-status]'); if(st) st.textContent='';
    if(form){form.removeAttribute('data-hold-expired');const submit=form.querySelector('button[type="submit"]');if(submit)submit.disabled=false;}
  }

  function renderPartySummary(composition){
    const chips=[];
    const labels=riderPolicyLabels();
    if(Number(composition?.riders_16_plus||0)>0)chips.push(`<span>${escapeHTML(labels.riders)} · ${Number(composition.riders_16_plus)}</span>`);
    if(Number(composition?.child_passengers_3_15||0)>0)chips.push(`<span>${escapeHTML(labels.children)} · ${Number(composition.child_passengers_3_15)}</span>`);
    if(Number(composition?.baby_passengers_1_2||0)>0)chips.push(`<span>${escapeHTML(labels.babies)} · ${Number(composition.baby_passengers_1_2)}</span>`);
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
      loadError:'Extras could not be loaded right now. You can continue booking without them.',limitReached:'Maximum available quantity reached'
    },
    he:{
      kicker:'משדרגים את החוויה',title:'משדרגים את הרכיבה לפני שיוצאים',
      intro:'יותר חום, יותר נוחות וזיכרונות טובים יותר – תוספות שנבחרו במיוחד לסיור שלכם.',
      sale:'קנייה',rental:'השכרה',add:'הוספה',added:'נוסף',soldout:'לא זמין',
      paymentNote:'התוספות נכללות בסכום ההזמנה ומשולמות בהתאם לאמצעי התשלום שבחרתם.',
      updating:'מעדכנים את המחיר…',winter:'נוחות לחורף',gear:'תוספת לסיור',
      rentalNote:'השכרה למשך הסיור',saleNote:'נשאר אצלכם',perTour:'לסיור',each:'ליחידה',
      decrease:'הפחתת כמות',increase:'הגדלת כמות',quantity:'כמות',selectedExtras:'תוספות שנבחרו',
      loadError:'לא הצלחנו לטעון כרגע את התוספות. אפשר להמשיך בהזמנה בלעדיהן.',limitReached:'הגעתם לכמות המרבית הזמינה'
    },
    hu:{
      kicker:'TEDD TELJESEBBÉ AZ ÉLMÉNYT',title:'Tedd még jobbá a túrát indulás előtt',
      intro:'Több meleg, nagyobb kényelem és jobb emlékek – a túrádhoz válogatott kiegészítőkkel.',
      sale:'VÁSÁRLÁS',rental:'BÉRLÉS',add:'Hozzáadás',added:'Hozzáadva',soldout:'Nem elérhető',
      paymentNote:'A kiválasztott kiegészítők bekerülnek a foglalás végösszegébe, és a választott fizetési mód szerint fizetendők.',
      updating:'Ár frissítése…',winter:'Téli kényelem',gear:'Túra kiegészítő',
      rentalNote:'Bérlés a túra idejére',saleNote:'Megtarthatod',perTour:'túránként',each:'darabonként',
      decrease:'Mennyiség csökkentése',increase:'Mennyiség növelése',quantity:'Mennyiség',selectedExtras:'Kiválasztott extrák',
      loadError:'A kiegészítőket most nem sikerült betölteni. A foglalást nélkülük is folytathatod.',limitReached:'Elérted a maximálisan elérhető mennyiséget'
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
  function ancillaryQuantityLimit(offer){
    // The backend owns stock and per-booking limits. In particular, zero
    // means unavailable (never coerce it to one). Missing caps retain the
    // existing UI default; malformed advertised caps fail closed.
    const cap=value=>{
      if(value==null)return 99;
      if(typeof value!=='number'&&typeof value!=='string')return 0;
      if(typeof value==='string'&&!value.trim())return 0;
      const numeric=Number(value);
      return Number.isFinite(numeric)?Math.max(0,Math.floor(numeric)):0;
    };
    return Math.min(cap(offer?.available_quantity),cap(offer?.max_per_booking));
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
  function confirmedAncillaryDetails(booking,submittedExtras){
    // The booking response is authoritative. The pre-submit selection is
    // only used to detect a mismatch, never to claim an extra was reserved.
    const readItems=(input)=>{
      if(!Array.isArray(input))return null;
      const found=new Map();
      for(const item of input){
        const id=String(item?.product_id||'').trim();
        const quantity=Number(item?.quantity);
        if(!id||!Number.isSafeInteger(quantity)||quantity<=0||found.has(id))return null;
        found.set(id,{...item,product_id:id,quantity});
      }
      return found;
    };
    const expected=readItems(submittedExtras);
    const confirmed=readItems(booking?.ancillary_items);
    if(!confirmed){
      return {items:[],matches:expected?.size===0&&Array.isArray(booking?.ancillary_items)};
    }
    const items=[...confirmed.values()].map(item=>({
      name:ancillaryDisplayName(item),
      quantity:item.quantity
    }));
    const matches=Boolean(expected)&&expected.size===confirmed.size&&
      [...expected.entries()].every(([id,item])=>confirmed.get(id)?.quantity===item.quantity);
    return {items,matches};
  }

  function renderConfirmationAncillarySummary(items=selectedAncillaryDetails()){
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
    if(sum)sum.innerHTML=`${affiliateCode?`<p class="muted" data-affiliate-applied>${escapeHTML(t('Partner offer applied automatically','הטבת שותף הופעלה אוטומטית'))}</p>`:''}<div class="checkout-summary-head"><div><b>${escapeHTML(checkoutTourTitle)}</b><span>${escapeHTML(confirmationDateLabel(bookingState.date))} · ${escapeHTML(confirmationTimeLabel(bookingState.slot.time))}</span></div>${privateLabel}</div>${renderPartySummary(bookingState.composition)}<div class="party-summary"><span>${requestedGuideLanguageLabel()} · ${escapeHTML(guideLanguageLabel(bookingState.guideLanguage))}</span></div>${renderSelectedAncillarySummary()}${renderQuoteBreakdown(bookingState.quote)}`;
  }
  function selectedAncillaryQuantity(productId){
    const hit=(bookingState.extras||[]).find(x=>String(x.product_id)===String(productId));
    return Number(hit?.quantity||0);
  }
  function renderAncillaryOffers(){
    const node=document.querySelector('[data-ancillary-upsell]');
    if(!node)return;
    const checkoutFrozen=document.querySelector('#live-checkout-shell')?.hasAttribute('data-submit-locked')===true;
    const offers=Array.isArray(bookingState.ancillaryOffers)?bookingState.ancillaryOffers:[];
    if(!offers.length){node.hidden=true;node.innerHTML='';return;}
    node.hidden=false;
    const cards=offers.map(offer=>{
      const max=ancillaryQuantityLimit(offer);
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
                  <button type="button" data-ancillary-plus="${escapeHTML(offer.product_id)}" aria-label="${escapeHTML(qty>=max?ancillaryText('limitReached'):ancillaryText('increase'))}: ${escapeHTML(ancillaryDisplayName(offer))}" ${qty>=max?`disabled title="${escapeHTML(ancillaryText('limitReached'))}"`:''}>+</button>
                </div>
              </div>`}
        </div></article>`;
    }).join('');
    node.innerHTML=`<div class="ancillary-head"><div><small>${escapeHTML(ancillaryText('kicker'))}</small><h3>${escapeHTML(ancillaryText('title'))}</h3><p>${escapeHTML(ancillaryText('intro'))}</p></div><span class="ancillary-spark" aria-hidden="true">✦</span></div>
      <div class="ancillary-grid">${cards}</div>
      <div class="ancillary-payment-note">${escapeHTML(ancillaryText('paymentNote'))}</div>
      <span class="sr-only" data-ancillary-live role="status" aria-live="polite" aria-atomic="true"></span>`;
    if(checkoutFrozen)node.querySelectorAll('button').forEach(btn=>btn.disabled=true);
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
  let ancillaryLoadGeneration=0;
  async function loadAncillaryOffers(){
    const generation=++ancillaryLoadGeneration;
    bookingState.ancillaryOffers=[];bookingState.extras=[];
    const node=document.querySelector('[data-ancillary-upsell]');if(node){node.hidden=true;node.innerHTML='';}
    if(!bookingEnabled||!bookingState.slot?.id)return;
    const slotId=String(bookingState.slot.id);
    try{
      const offers=await api('/ancillary/offers',{method:'POST',body:JSON.stringify({slot_id:slotId})});
      if(generation!==ancillaryLoadGeneration||String(bookingState.slot?.id||'')!==slotId)return;
      bookingState.ancillaryOffers=Array.isArray(offers)?offers:[];
      renderAncillaryOffers();
      if(bookingState.ancillaryOffers.length)track('ancillary_offers_viewed',{slot_id:slotId,count:bookingState.ancillaryOffers.length,destination_id:destinationId});
    }catch(e){
      if(generation!==ancillaryLoadGeneration||String(bookingState.slot?.id||'')!==slotId)return;
      bookingState.ancillaryOffers=[];
      if(node){
        node.hidden=false;
        node.innerHTML=`<div class="ancillary-load-error" role="status">${escapeHTML(ancillaryText('loadError'))}</div>`;
      }
    }
  }
  async function changeAncillaryQuantity(productId,delta){
    const node=document.querySelector('[data-ancillary-upsell]');
    if(document.querySelector('#live-checkout-shell')?.hasAttribute('data-submit-locked'))return;
    if(node?.getAttribute('aria-busy')==='true')return;
    const checkoutKey=bookingState.idempotencyKey;
    const slotId=String(bookingState.slot?.id||'');
    const selectionGeneration=checkoutPreparationGeneration;
    const active=document.activeElement;
    const id=String(productId);
    const focusIntent=active?.dataset?.ancillaryMinus===id?'minus':active?.dataset?.ancillaryAdd===id?'add':'plus';
    const offer=(bookingState.ancillaryOffers||[]).find(x=>String(x.product_id)===id);
    if(!offer||!bookingState.slot?.id)return;
    const max=ancillaryQuantityLimit(offer);
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
        slot_id:slotId,group_composition:bookingState.composition,
        is_private:Boolean(bookingState.isPrivate),extras:bookingState.extras,
        ...(bookingState.isPrivate&&bookingState.hold?.id?{hold_id:bookingState.hold.id}:{}),
        promo_code:effectivePromoCode()
      })});
      if(selectionGeneration!==checkoutPreparationGeneration||bookingState.idempotencyKey!==checkoutKey||String(bookingState.slot?.id||'')!==slotId)return;
      assertCheckoutQuote(quote);
      bookingState.quote=quote;renderStandardCheckoutSummary();renderAncillaryOffers();restoreAncillaryControlFocus(productId,focusIntent);syncAncillaryPaymentAvailability();
      const live=document.querySelector('[data-ancillary-live]');
      if(live)live.textContent=`${ancillaryDisplayName(offer)}: ${ancillaryText('quantity')} ${next}`;
      track(next>current?'ancillary_added':'ancillary_removed',{product_id:productId,sku:offer.sku,quantity:next,product_kind:offer.product_kind,quote_total:quote.total,currency:quote.currency});
    }catch(e){
      if(selectionGeneration!==checkoutPreparationGeneration||bookingState.idempotencyKey!==checkoutKey||String(bookingState.slot?.id||'')!==slotId)return;
      bookingState.extras=previous;renderAncillaryOffers();restoreAncillaryControlFocus(productId,focusIntent);syncAncillaryPaymentAvailability();
      const status=document.querySelector('[data-checkout-status]');
      if(status)status.textContent=e?.code==='QUOTE_INVALID'
        ?t('The updated total could not be verified. Your previous extras selection was restored. Please try again.','לא ניתן לאמת את הסכום המעודכן. בחירת התוספות הקודמת שוחזרה. נסו שוב.')
        :e?.code==='ANCILLARY_OUT_OF_SEASON'
          ?t('This extra is not available for the selected date.','התוספת אינה זמינה בתאריך שנבחר.')
          :t('That extra is no longer available. Your booking selection was not changed.','התוספת כבר אינה זמינה. בחירת הסיור לא השתנתה.');
    }finally{
      if(selectionGeneration===checkoutPreparationGeneration&&bookingState.idempotencyKey===checkoutKey&&String(bookingState.slot?.id||'')===slotId&&node)node.removeAttribute('aria-busy');
    }
  }

  async function prepareStandardCheckout(slot,composition,date,experience,isPrivate=false,guideLanguage=''){
    const preparationGeneration=checkoutPreparationGeneration;
    if(checkoutPreparationActiveGeneration===preparationGeneration)return;
    checkoutPreparationActiveGeneration=preparationGeneration;
    const slotList=document.querySelector('#slotlist');
    const enabledSlots=[...(slotList?.querySelectorAll('.slot')||[])].filter(btn=>!btn.disabled);
    if(slotList)slotList.setAttribute('aria-busy','true');
    enabledSlots.forEach(btn=>btn.disabled=true);
    let completed=false;
    releaseHold(); resetCheckoutMode();
    const status=document.querySelector('#availability-status');
    try{
      setBookingStep(2);status.textContent=t('Checking price and reserving your places…','בודקים מחיר ושומרים את המקומות שלכם…');
      const quote=await api('/quotes',{method:'POST',body:JSON.stringify({slot_id:slot.id,group_composition:composition,is_private:isPrivate,extras:[],promo_code:initialPromoCode})});
      if(preparationGeneration!==checkoutPreparationGeneration)return;
      assertCheckoutQuote(quote);
      const hold=await api('/holds',{method:'POST',body:JSON.stringify({slot_id:slot.id,group_composition:composition,is_private:isPrivate,guide_language:guideLanguage})});
      if(preparationGeneration!==checkoutPreparationGeneration){
        const oldHoldId=typeof hold?.id==='string'?hold.id.trim():'';
        if(oldHoldId)api('/holds/'+encodeURIComponent(oldHoldId),{method:'DELETE'}).catch(()=>{});
        return;
      }
      if(!checkoutHoldIsValid(hold))abandonInvalidHold(hold);
      bookingState={slot,composition,quote,hold,experience,date,isPrivate,guideLanguage,promoCode:initialPromoCode,idempotencyKey:'voy_'+uuid(),extras:[],ancillaryOffers:[]};
      const shell=document.querySelector('#live-checkout-shell');shell.hidden=false;setBookingStep(3);
      renderStandardCheckoutSummary();ensureSingleCouponControl();
      // A newly returned hold may already be expired or have no verifiable
      // expiry. Never display a checkout-ready state or load paid extras then.
      if(!startHoldTimer(hold.expires_at)){
        status.textContent=t('The temporary hold could not be verified. Choose the departure again.','לא ניתן לאמת את שמירת המקום. יש לבחור את היציאה מחדש.');
        return;
      }
      loadAncillaryOffers();
      status.textContent=t('Your places are temporarily held while you complete the booking.','המקומות נשמרים זמנית בזמן השלמת ההזמנה.');
      shell.querySelector('[data-checkout-heading]')?.focus({preventScroll:true});
      shell.scrollIntoView({behavior:'smooth',block:'center'});
      track('hold_created',{slot_id:slot.id,quote_total:quote.total,currency:quote.currency,is_private:isPrivate,guide_language:guideLanguage,promo_code_applied:quote.promo_code_applied||initialPromoCode||null,discount:quote.discount||0});
      patchSession({stage:'checkout_ready',selected_date:date,selected_time:slot.time,slot_id:slot.id,quote_id:quote.id,hold_id:hold.id,hold_expires_at:hold.expires_at,group_composition:composition,is_private:isPrivate,guide_language:guideLanguage});
      completed=true;
    }catch(e){
      if(preparationGeneration!==checkoutPreparationGeneration)return;
      const privateConflict=['PRIVATE_DEPARTURE_NOT_EMPTY','PRIVATE_HOLD_MISMATCH','PRIVATE_DEPARTURE_RESERVED'].includes(e.code);
      const msg=e.code==='QUOTE_INVALID'?t('The live price could not be verified. Please search again or contact the local team.','לא ניתן לאמת את המחיר החי. נסו לחפש שוב או פנו לצוות המקומי.'):e.code==='HOLD_INVALID'?t('Temporary reservation could not be verified. Please choose a departure again.','לא ניתן לאמת את שמירת המקום הזמנית. בחרו מחדש שעת יציאה.'):e.code==='ANCILLARY_NOT_CONFIGURED'?t('This booking needs a quick confirmation.','ההזמנה הזו דורשת אישור קצר.'):privateConflict?t('This departure can no longer be made private. Choose another departure or ask the team for a flexible private time.','כבר לא ניתן להפוך את היציאה הזו לפרטית. בחרו שעה אחרת או בקשו מהצוות שעה גמישה לסיור פרטי.'):t('Could not hold this departure. Please choose another time.','לא ניתן לשמור את היציאה. בחרו שעה אחרת.');
      status.innerHTML=rescueMarkup(msg);bindInlineWhatsApp(status);
    }finally{
      if(checkoutPreparationActiveGeneration===preparationGeneration){
        checkoutPreparationActiveGeneration=null;
        if(slotList)slotList.removeAttribute('aria-busy');
        if(!completed&&preparationGeneration===checkoutPreparationGeneration)enabledSlots.forEach(btn=>btn.disabled=false);
      }
    }
  }

  function capacityRequestForm(slot,composition,date,experience,isPrivate=false,guideLanguage=''){
    releaseHold(); setBookingStep(3); const shell=document.querySelector('#live-checkout-shell');shell.hidden=false;
    shell.querySelector('[data-checkout-heading]').textContent=t('Request confirmation','בקשת אישור');
    shell.querySelector('[data-checkout-summary]').innerHTML=`<div class="checkout-summary-head"><div><b>${escapeHTML(experience.title)}</b><span>${escapeHTML(date)} · ${escapeHTML(slot.time)}</span></div>${isPrivate?`<span class="checkout-private-flag">${t('Private request','בקשה פרטית')}</span>`:''}</div>${renderPartySummary(composition)}<div class="party-summary"><span>${requestedGuideLanguageLabel()} · ${escapeHTML(guideLanguageLabel(guideLanguage))}</span></div><span>${t('This group needs a quick availability confirmation.','לקבוצה הזו נדרש אישור זמינות קצר.')}</span>`;
    // Staff confirmation is not a reservation: no hold or verified quote exists.
    const assurance=shell.querySelector('.checkout-assurance'); if(assurance)assurance.hidden=true;
    shell.querySelector('[data-hold-timer]').textContent='';
    const ancillary=shell.querySelector('[data-ancillary-upsell]');if(ancillary){ancillary.hidden=true;ancillary.innerHTML='';}
    const form=shell.querySelector('#live-checkout-form');const pay=form.querySelector('[name="payment_method"]').closest('.field');pay.hidden=true;
    const legal=form.querySelector('[data-checkout-legal]');if(legal){legal.hidden=true;const box=legal.querySelector('input');if(box){box.required=false;box.checked=false;}}
    form.querySelector('button[type="submit"]').textContent=t('Send confirmation request','שליחת בקשת אישור');
    bookingState={slot,composition,quote:null,hold:null,experience,date,capacityRequest:true,isPrivate,guideLanguage,promoCode:initialPromoCode,idempotencyKey:'voy_'+uuid()};ensureSingleCouponControl();
    shell.querySelector('[data-checkout-heading]')?.focus({preventScroll:true});
    shell.scrollIntoView({behavior:'smooth',block:'center'});
  }

  // The backend owns departure decisions. The browser must not interpret
  // truthy strings such as "false" as permission to book or request.
  function verifiedAvailabilitySlots(response){
    if(!response||!Array.isArray(response.slots)||response.slots.length>100)
      throw new Error('Invalid availability response');
    const ids=new Set();
    for(const slot of response.slots){
      if(!slot||typeof slot!=='object'||Array.isArray(slot)||
        typeof slot.id!=='string'||!slot.id.trim()||
        typeof slot.time!=='string'||
        !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(slot.time)||
        typeof slot.sellable!=='boolean'||
        typeof slot.requestable!=='boolean'||
        (slot.sellable&&slot.requestable)||
        ids.has(slot.id))
        throw new Error('Invalid availability slot');
      if(Object.prototype.hasOwnProperty.call(slot,'starts_at')&&
        (typeof slot.starts_at!=='string'||!Number.isFinite(Date.parse(slot.starts_at))))
        throw new Error('Invalid departure start');
      ids.add(slot.id);
    }
    return response.slots.filter(s=>!s.starts_at||new Date(s.starts_at).getTime()>Date.now());
  }

  const form=document.querySelector('#availability-form');
  if(form){
    const status=document.querySelector('#availability-status'), slots=document.querySelector('#slotlist');
    // The visual progress marker sits in the results, while status changes
    // must also be announced to keyboard and screen-reader users.
    if(status){
      status.setAttribute('role','status');
      status.setAttribute('aria-live','polite');
      status.setAttribute('aria-atomic','true');
    }
    const availabilitySelectionNames=new Set(['experience','date','adults','children','babies','guide_language']);
    const invalidateAvailabilityResults=({announce=false}={})=>{
      availabilitySearchGeneration++;
      // A stale pending request no longer owns the visible results region.
      // Keep the form editable so the guest can choose another language or
      // group size while the server is still checking availability.
      slots.removeAttribute('aria-busy');
      invalidateCheckoutPreparation();
      releaseHold();
      document.querySelector('#live-checkout-shell')?.setAttribute('hidden','');
      slots.innerHTML='';
      setBookingStep(1);
      if(announce)status.textContent=locale==='hu'
        ?'A kiválasztás megváltozott. Keress újra az aktuális elérhetőséghez.'
        :t('Selection changed. Search again to refresh availability.','הבחירה השתנתה. חפשו שוב כדי לרענן את הזמינות.');
    };
    const dateInput=form.querySelector('input[name="date"]');
    // A guest may leave the booking page open across Budapest midnight.
    // Refresh calendar bounds without modifying their chosen date or the
    // configured booking horizon; the backend remains the availability authority.
    const refreshAvailabilityDateBounds=()=>{
      const today=budapestDate(0);
      if(!dateInput)return today;
      dateInput.min=today;
      const horizon=Number(destinationRuntime?.booking_horizon_days);
      if(Number.isSafeInteger(horizon)&&horizon>0)
        dateInput.max=budapestDate(horizon);
      else dateInput.removeAttribute('max');
      return today;
    };
    if(dateInput){
      const today=refreshAvailabilityDateBounds();
      if(!dateInput.value)dateInput.value=today;
      dateInput.addEventListener('focus',refreshAvailabilityDateBounds);
    }
    ensurePrivateUpgrade(form);
    ensureGuideLanguageField(form);
    enhanceBookingFormLayout(form);
    ensureGroupCompositionPreview(form);
    hydrateCatalog().then(()=>{
      if(qs.get('mode')==='private'){
        const mode=document.querySelector('[data-private-upgrade]');
        if(mode&&typeof mode._setBookingMode==='function'&&!mode.hidden) mode._setBookingMode('private',{silent:true});
      }
    });
    form.addEventListener('change',e=>{
      if(document.querySelector('#live-checkout-shell')?.hasAttribute('data-submit-locked'))return;
      if(e.target.name==='experience'){const p=productCache.byId[e.target.value];if(p){setStore('voy_experience_id',p.id);hydratePrice(p);setSelectedTourHint(p);updatePrivateUpgrade(p);updateGuideLanguageField(p);}}
      if(availabilitySelectionNames.has(e.target.name))invalidateAvailabilityResults({announce:true});
    });
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      if(document.querySelector('#live-checkout-shell')?.hasAttribute('data-submit-locked'))return;
      const today=refreshAvailabilityDateBounds();
      const selectedDate=dateInput?.value||'';
      if(dateInput&&selectedDate&&selectedDate<today){
        invalidateAvailabilityResults();
        status.textContent=t('Your selected date is now in the past in Budapest. Choose another date.','התאריך שנבחר כבר חלף בבודפשט. בחרו תאריך חדש.');
        dateInput.focus({preventScroll:true});
        return;
      }
      if(dateInput&&dateInput.max&&selectedDate>dateInput.max){
        invalidateAvailabilityResults();
        status.textContent=t('This date is outside the current booking window. Choose an earlier date.','התאריך מחוץ לטווח ההזמנות הנוכחי. בחרו תאריך מוקדם יותר.');
        dateInput.focus({preventScroll:true});
        return;
      }
      const searchGeneration=++availabilitySearchGeneration;
      invalidateCheckoutPreparation();
      releaseHold();document.querySelector('#live-checkout-shell')?.setAttribute('hidden','');slots.innerHTML='';
      const data=new FormData(form); const experience=productCache.byId[data.get('experience')];
      if(!experience){status.innerHTML=rescueMarkup(t('Online booking is not available for this route right now. Please contact the local team.','לא ניתן להשלים כרגע את ההזמנה הזו באתר. אפשר לפנות לצוות המקומי.'));bindInlineWhatsApp(status);return;}
      const composition={riders_16_plus:Number(data.get('adults')||0),child_passengers_3_15:Number(data.get('children')||0),baby_passengers_1_2:Number(data.get('babies')||0),request_15yo_independent_assessment:false};
      const compositionCheck=validateGroupComposition(form,composition);
      if(!compositionCheck.valid){status.textContent=compositionCheck.message;return;}
      const isPrivate=String(data.get('is_private')||'')==='true';
      const guideLanguage=String(data.get('guide_language')||'').trim().toLowerCase();
      if(!guideLanguage){
        const languageSelect=form.querySelector('select[name="guide_language"]');
        status.textContent=languageSelect?.disabled
          ?(locale==='hu'?'Az idegenvezetési nyelvek most nem ellenőrizhetők. Kérjük, lépj kapcsolatba a csapatunkkal.':t('Guide languages cannot be verified right now. Please contact our local team.','לא ניתן לאמת כרגע שפות הדרכה. אנא פנו לצוות המקומי.'))
          :(locale==='hu'?'Válaszd ki a túra idegenvezetési nyelvét.':t('Choose the guide language for your tour.','בחרו את שפת ההדרכה לסיור.'));
        if(languageSelect&&!languageSelect.disabled)languageSelect.focus({preventScroll:true});
        return;
      }
      const allowedGuideLanguages=guideLanguagesForProduct(experience);
      if(!allowedGuideLanguages.includes(guideLanguage)){status.textContent=t('That guide language is not available for this branch.','שפת ההדרכה הזו אינה זמינה בסניף זה.');return;}
      const privateMin=Number(experience.privateMinRiders);
      if(isPrivate&&(!Number.isInteger(privateMin)||privateMin<1)){status.textContent=t('Private-tour rules are temporarily unavailable. Please try again or contact us.','כללי הסיור הפרטי אינם זמינים כרגע. נסו שוב או פנו אלינו.');return;}
      if(isPrivate&&composition.riders_16_plus<privateMin){status.textContent=t(`Private tours require at least ${privateMin} independent riders.`,`סיור פרטי דורש לפחות ${privateMin} רוכבים עצמאיים.`);return;}
      const party=composition.riders_16_plus+composition.child_passengers_3_15+composition.baby_passengers_1_2;
      saveSelectionRecovery(experience,String(data.get('date')),composition,isPrivate,guideLanguage);
      status.textContent=t('Checking availability…','בודקים זמינות…');
      slots.setAttribute('aria-busy','true');
      try{
      // Read-only departure searches must not wait for the best-effort CRM
      // session API or optional attribution sync. The public booking contract
      // explicitly accepts a nullable session_id during finalization.
      // createSession still records the stage and coalesces parallel POSTs.
      void createSession('availability_search',{experience_id:experience.id,selected_date:data.get('date'),party_size:party,group_composition:composition,is_private:isPrivate,guide_language:guideLanguage,page});
      if(searchGeneration!==availabilitySearchGeneration)return;
      trackBookingStarted({date:data.get('date'),party_size:party,experience_id:experience.id,is_private:isPrivate,guide_language:guideLanguage});track('availability_search',{date:data.get('date'),party_size:party,experience_id:experience.id,is_private:isPrivate,guide_language:guideLanguage});
      const q=new URLSearchParams({date:String(data.get('date')),riders_16_plus:String(composition.riders_16_plus),child_passengers_3_15:String(composition.child_passengers_3_15),baby_passengers_1_2:String(composition.baby_passengers_1_2),is_private:String(isPrivate),guide_language:guideLanguage});
      try{
        const out=await api('/experiences/'+encodeURIComponent(experience.id)+'/availability?'+q.toString(),{method:'GET'});
        if(searchGeneration!==availabilitySearchGeneration)return;
        const list=verifiedAvailabilitySlots(out);
        if(!list.length){patchSession({stage:'availability_empty',selected_date:String(data.get('date')),experience_id:experience.id});status.innerHTML=rescueMarkup(t('No departures found right now.','לא נמצאו יציאות זמינות כרגע.'));bindInlineWhatsApp(status);return;}
        setBookingStep(2);status.textContent=t('Choose a departure:','בחרו שעה:');
        list.forEach(s=>{const b=document.createElement('button');b.type='button';b.className='slot';b.setAttribute('aria-pressed','false');b.disabled=!s.sellable&&!s.requestable;const suffix=s.requestable?t(' · confirmation',' · נדרש אישור'):s.status==='low'?t(' · limited',' · זמינות מוגבלת'):'';b.textContent=s.time+suffix;b.onclick=()=>{if(s.starts_at&&Date.parse(s.starts_at)<=Date.now()){
          invalidateAvailabilityResults();
          status.textContent=t('This departure has already started. Search again for current availability.','היציאה הזו כבר התחילה. בצעו חיפוש חדש לזמינות עדכנית.');
          return;
        }
        document.querySelectorAll('.slot').forEach(x=>{x.classList.remove('on');x.setAttribute('aria-pressed','false')});b.classList.add('on');b.setAttribute('aria-pressed','true');track('slot_selected',{date:data.get('date'),time:s.time,party_size:party,status:s.status,is_private:isPrivate,guide_language:guideLanguage});patchSession({stage:'slot_selected',selected_date:data.get('date'),selected_time:s.time,slot_id:s.id,group_composition:composition,is_private:isPrivate,guide_language:guideLanguage});if(s.requestable&&isPrivate){status.innerHTML=`${t('This private group needs a quick confirmation. Send the requested date and time and we’ll check the available setup.','לקבוצה הפרטית הזו נדרש אישור קצר. שלחו את התאריך והשעה המבוקשים ונבדוק את האפשרויות הזמינות.')}<div class="status-actions"><a class="btn secondary" href="${whatsAppUrl('private_flexible',{experience_title:experience.title,date:String(data.get('date')),requested_time:s.time,riders:composition.riders_16_plus,children:composition.child_passengers_3_15,babies:composition.baby_passengers_1_2,is_private:true,guide_language:guideLanguage})}">WhatsApp</a></div>`;}else if(s.requestable)capacityRequestForm(s,composition,String(data.get('date')),experience,false,guideLanguage);else prepareStandardCheckout(s,composition,String(data.get('date')),experience,isPrivate,guideLanguage);};slots.appendChild(b)});
      }catch(err){if(searchGeneration!==availabilitySearchGeneration)return;patchSession({stage:'availability_error',error_code:err?.code||String(err?.status||'availability_error')});status.innerHTML=rescueMarkup(t('Current availability could not be loaded. Please try again or contact us on WhatsApp.','לא הצלחנו לטעון כרגע את הזמינות. נסו שוב או פנו אלינו ב‑WhatsApp.'));bindInlineWhatsApp(status);}
      }finally{
        // An older search cannot clear the new search's progress state.
        if(searchGeneration===availabilitySearchGeneration)slots.removeAttribute('aria-busy');
      }
    });
  }else{hydrateCatalog();}

  function verifiedBookingConfirmation(booking){
    // Never label a response as confirmed unless the server supplied enough
    // information to show its actual booking and a usable management link.
    const reference=typeof booking?.reference==='string'?booking.reference.trim():'';
    const token=typeof booking?.manage_token==='string'&&booking.manage_token.trim()
      ?booking.manage_token.trim()
      :typeof booking?.secure_token==='string'?booking.secure_token.trim():'';
    const total=booking?.total!=null&&booking.total!==''?finiteNumber(booking.total):null;
    const currency=String(booking?.currency||'').trim();
    const date=String(booking?.selected_date||'').trim();
    const time=String(booking?.slot_time||'').trim();
    const paymentStatus=String(booking?.payment_status||'').trim();
    if(booking?.status!=='confirmed'||!reference||!token||total==null||total<0||
       !/^[A-Za-z]{3}$/.test(currency)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
       !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)||!paymentStatus){
      const err=new Error('Booking response could not be verified.');
      err.code='BOOKING_CONFIRMATION_UNVERIFIED';
      throw err;
    }
    return {
      reference,token,total,currency,date,time,paymentStatus,
      composition:booking.group_composition&&typeof booking.group_composition==='object'
        ?booking.group_composition:bookingState.composition,
      guideLanguage:booking.guide_language||bookingState.guideLanguage,
      isPrivate:typeof booking.is_private==='boolean'?booking.is_private:Boolean(bookingState.isPrivate)
    };
  }

  function calendarUrlForBooking(booking){
    const date=String(booking?.selected_date||bookingState.date||'');
    const time=String(booking?.slot_time||bookingState.slot?.time||'');
    const m=date.match(/^(\d{4})-(\d{2})-(\d{2})$/),tm=time.match(/^(\d{1,2}):(\d{2})/);
    if(!m||!tm)return '#';
    const liveDuration=Number(bookingState.experience?.durationMinutes);
    if(!Number.isFinite(liveDuration)||liveDuration<=0)return '#';
    const duration=Math.max(30,liveDuration);
    const start=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(tm[1]),Number(tm[2])));
    const end=new Date(start.getTime()+duration*60000);
    const compact=d=>`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}T${String(d.getUTCHours()).padStart(2,'0')}${String(d.getUTCMinutes()).padStart(2,'0')}00`;
    const calendarTourTitle=localizedBudapestExperienceTitle(bookingState.experience,booking?.experience_title)||'VOY PRO Budapest';
    const privateSuffix=bookingState.isPrivate?(locale==='he'?' · פרטי':locale==='hu'?' · Privát':' · Private'):'';
    const title=encodeURIComponent(`${calendarTourTitle}${privateSuffix}`);
    const meeting=budapestMeetingPoint();
    const meetingPoint=String(meeting?.address||'').trim();
    const mapsUrl=String(meeting?.maps_url||'').trim();
    const bookingLabel=locale==='he'?'הזמנת VOY PRO':locale==='hu'?'VOY PRO foglalás':'VOY PRO booking';
    const meetingLabel=locale==='he'?'נקודת מפגש':locale==='hu'?'Találkozási pont':'Meeting point';
    const meetingLines=meetingPoint?[`${meetingLabel}: ${meetingPoint}`,...(mapsUrl?[`Google Maps: ${mapsUrl}`]:[])]:[];
    const details=encodeURIComponent([`${bookingLabel} ${booking?.reference||''}`,...meetingLines].join('\n'));
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
    const copy=root?.querySelector('[data-copy-booking-ref]');if(copy)copy.onclick=async()=>{const copied=await copyBookingReference(booking.reference);if(copied){copy.textContent=t('Reference copied','מספר ההזמנה הועתק');track('booking_reference_copied')}else{copy.textContent=t('Reference: ','מספר הזמנה: ')+String(booking.reference||'')}};
    const cal=root?.querySelector('[data-calendar-booking]');if(cal){cal.href=calendarUrlForBooking(booking);cal.target='_blank';cal.rel='noopener';}
  }

  function setCheckoutSubmissionLock(locked){
    const shell=document.querySelector('#live-checkout-shell');
    const availabilityForm=document.querySelector('#availability-form');
    const controls=[
      ...(shell?.querySelectorAll('#live-checkout-form input,#live-checkout-form select,#live-checkout-form button,[data-checkout-edit]')||[]),
      ...(availabilityForm?.querySelectorAll('input,select,button')||[]),
      ...(shell?.querySelectorAll('[data-ancillary-upsell] button')||[])
    ];
    [...new Set(controls)].forEach(control=>{
      if(locked){
        if(control.dataset.submitLockWasDisabled==null)control.dataset.submitLockWasDisabled=control.disabled?'true':'false';
        control.disabled=true;
      }else if(control.dataset.submitLockWasDisabled!=null){
        control.disabled=control.dataset.submitLockWasDisabled==='true';
        delete control.dataset.submitLockWasDisabled;
      }
    });
    if(shell){
      shell.toggleAttribute('data-submit-locked',locked);
      if(!locked)shell.removeAttribute('data-submit-retry');
    }
  }
  function enableCheckoutRetryActions(){
    const shell=document.querySelector('#live-checkout-shell');
    if(!shell)return;
    const actions=[shell.querySelector('#live-checkout-form button[type="submit"]'),shell.querySelector('[data-checkout-edit]')].filter(Boolean);
    actions.forEach(control=>{
      if(control.dataset.submitLockWasDisabled!=='true')control.disabled=false;
    });
    shell.setAttribute('data-submit-retry','true');
  }

  function checkoutFailureMessage(err,paymentMethod){
    if(err?.code==='HOLD_EXPIRED')
      return t('The hold expired. Please select the departure again.','שמירת המקום פגה. יש לבחור יציאה מחדש.');
    if(err?.code==='STAFF_CONFIRMATION_REQUIRED')
      return t('This booking needs an additional confirmation. Please search again and send a request.','להזמנה הזו נדרש אישור נוסף. יש לחפש מחדש ולשלוח בקשה.');
    // A network failure or server error can happen after a booking/payment
    // request was accepted. Only the server can verify the final outcome.
    if(paymentMethod==='pay_now_card'){
      if(locale==='he')return 'לא הצלחנו לאמת את תוצאת בקשת התשלום. אפשר לנסות שוב את אותה בקשה, עם אותם פרטים, או לפנות לצוות לפני פתיחת הזמנה חדשה. מצב החיוב טרם אומת.';
      if(locale==='hu')return 'Nem tudtuk ellenőrizni a kártyás fizetési kérés eredményét. Próbáld újra ugyanazt a kérést a meglévő adatokkal, vagy egyeztess a csapatunkkal új foglalás indítása előtt. A fizetés állapota nincs megerősítve.';
      return 'We could not verify the outcome of the card payment request. Retry this same request with the same details, or contact our team before starting another booking. Payment status has not been confirmed.';
    }
    if(locale==='he')return 'לא הצלחנו לאמת אם ההזמנה הושלמה. אפשר לנסות שוב את אותה בקשה או לפנות לצוות לפני יצירת הזמנה נוספת.';
    if(locale==='hu')return 'Nem tudtuk ellenőrizni, hogy a foglalás létrejött-e. Próbáld újra ugyanazt a kérést, vagy egyeztess a csapatunkkal új foglalás indítása előtt.';
    return 'We could not verify whether the booking completed. Retry this same request or contact our team before creating another booking.';
  }

  const checkoutForm=document.querySelector('#live-checkout-form');
  if(checkoutForm){checkoutForm.addEventListener('submit',async e=>{
    e.preventDefault();const st=document.querySelector('[data-checkout-status]');
    const ancillary=document.querySelector('[data-ancillary-upsell]');
    if(ancillary?.getAttribute('aria-busy')==='true'){if(st)st.textContent=ancillaryText('updating');return;}
    if(checkoutForm.querySelector('[data-affiliate-coupon-panel]')?.getAttribute('aria-busy')==='true'){if(st)st.textContent=t('Please finish applying your coupon first.','יש להשלים את בדיקת הקופון לפני אישור ההזמנה.');return;}
    const typedCoupon=checkoutForm.querySelector('[data-single-coupon]');
    if(typedCoupon&&!affiliateCode&&String(typedCoupon.value||'').trim().toUpperCase()!==String(bookingState.promoCode||'')){
      if(st)st.textContent=t('Apply or clear the coupon code before confirming the price.','יש להפעיל או לנקות את הקופון לפני אישור המחיר.');
      typedCoupon.focus();return;
    }
    if(checkoutForm.dataset.submitting==='true')return;
    // Only a NEW staff request is blocked when its departure has started.
    // If a submission may already exist, preserve its idempotent retry path.
    if(bookingState.capacityRequest&&!bookingState.submissionSnapshot&&
      bookingState.slot?.starts_at&&Date.parse(bookingState.slot.starts_at)<=Date.now()){
      if(st)st.textContent=t('This departure has already started. Search again for current availability.','היציאה הזו כבר התחילה. בצעו חיפוש חדש לזמינות עדכנית.');
      const button=checkoutForm.querySelector('button[type="submit"]');
      if(button)button.disabled=true;
      return;
    }
    const existingSubmission=bookingState.submissionSnapshot||null;
    let customer=existingSubmission?.customer||null;
    let paymentMethod=existingSubmission?.payment_method||null;
    if(!existingSubmission){
      const f=new FormData(checkoutForm);
      customer={full_name:String(f.get('full_name')||'').trim(),email:String(f.get('email')||'').trim(),phone:String(f.get('phone')||'').trim(),preferred_language:locale};
      if(!customer.full_name||!customer.email||!customer.phone){st.textContent=t('Please complete name, email and phone.','יש להשלים שם, אימייל וטלפון.');return;}
      paymentMethod=String(f.get('payment_method')||'pay_arrival_card');
    }
    checkoutForm.dataset.submitting='true';checkoutForm.setAttribute('aria-busy','true');
    setCheckoutSubmissionLock(true);
    const submitButton=checkoutForm.querySelector('button[type="submit"]');
    const sid=existingSubmission?.session_id||getStore('voy_session_id');
    const idem=existingSubmission?.idempotency_key||bookingState.idempotencyKey||('voy_'+uuid());
    bookingState.idempotencyKey=idem;
    if(!existingSubmission){
      const clone=value=>JSON.parse(JSON.stringify(value??null));
      bookingState.submissionSnapshot={
        idempotency_key:idem,
        session_id:sid,
        destination_id:'budapest',
        experience_id:bookingState.experience?.id||null,
        experience_slug:bookingState.experience?.slug||null,
        experience_title:bookingState.experience?.title||'',
        slot_id:bookingState.slot?.id||null,
        selected_date:bookingState.date,
        slot_time:bookingState.slot?.time||null,
        party_size:Object.values(bookingState.composition||{}).filter(v=>typeof v==='number').reduce((a,b)=>a+b,0),
        group_composition:clone(bookingState.composition)||{},
        is_private:Boolean(bookingState.isPrivate),
        guide_language:bookingState.guideLanguage,
        customer:clone(customer),
        payment_method:paymentMethod,
        hold_id:bookingState.hold?.id||null,
        currency:bookingState.quote?.currency||'EUR',
        extras:clone(bookingState.extras)||[],
        ancillary_details:clone(selectedAncillaryDetails())||[],
        promo_code:effectivePromoCode(),
        attribution:analyticsAllowed()?clone(attr):null,
        capacity_request:Boolean(bookingState.capacityRequest)
      };
    }
    const submission=bookingState.submissionSnapshot;
    customer=submission.customer;
    paymentMethod=submission.payment_method;
    let terminal=false;let recoverExpiredHold=false;
    try{
      if(bookingState.capacityRequest){
        st.textContent=t('Sending request…','שולחים בקשה…');
        const req=await api('/booking-capacity-requests',{method:'POST',headers:{'Idempotency-Key':submission.idempotency_key},body:JSON.stringify({session_id:submission.session_id,destination_id:submission.destination_id,experience_id:submission.experience_id,experience_slug:submission.experience_slug,experience_title:submission.experience_title,slot_id:submission.slot_id,selected_date:submission.selected_date,slot_time:submission.slot_time,party_size:submission.party_size,group_composition:submission.group_composition,is_private:submission.is_private,guide_language:submission.guide_language,customer:submission.customer,promo_code:submission.promo_code,...(submission.attribution?{attribution:submission.attribution}:{})})});
        terminal=true;st.classList.add('success-card');st.innerHTML=`<div class="success-icon" aria-hidden="true">✓</div><h3 tabindex="-1">${t('Request sent','הבקשה נשלחה')}</h3><p>${t('Reference','מספר פנייה')}: <b>${escapeHTML(req.reference)}</b></p><p>${t('The Budapest team will confirm the vehicles and guides needed for your group.','צוות בודפשט יאשר את הצוות והכלים הנדרשים.')}</p><div class="success-actions"><a class="btn alt" href="${whatsAppUrl()}">WhatsApp</a><a class="btn secondary" href="${localeBudapestHome()}">${t('Back to Budapest','חזרה לבודפשט')}</a></div>`;st.querySelector('h3')?.focus({preventScroll:true});checkoutForm.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);track('capacity_request_created',{is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage});patchSession({stage:'capacity_request_created',capacity_request_id:req.id,capacity_request_reference:req.reference});resetBookingStarted();delStore('voy_recovery_state');return;
      }
      if(!bookingState.hold?.id||String(bookingState.hold.id)!==String(submission.hold_id||'')){st.textContent=t('The hold expired. Please select the departure again.','שמירת המקום פגה. יש לבחור את היציאה מחדש.');return;}
      st.textContent=t('Confirming booking…','מאשרים הזמנה…');
      if(paymentMethod==='pay_now_card'){
        st.textContent=t('Opening secure card payment…','פותחים תשלום מאובטח בכרטיס…');
        const payment=await api('/payments/intents',{method:'POST',headers:{'Idempotency-Key':submission.idempotency_key},body:JSON.stringify({payment_type:'online',payment_method:'pay_now_card',hold_id:submission.hold_id,session_id:submission.session_id,customer:submission.customer,selected_date:submission.selected_date,slot_time:submission.slot_time,experience_title:submission.experience_title,is_private:submission.is_private,guide_language:submission.guide_language,currency:submission.currency,extras:submission.extras,promo_code:submission.promo_code})});
        if(!isStripeCheckoutUrl(payment?.checkout_url))throw Object.assign(new Error('Secure card payment could not be started.'),{code:'PAYMENT_START_FAILED'});
        terminal=true;rememberPaymentRetry(payment);patchSession({stage:'payment_redirect',payment_provider:'stripe',payment_checkout_id:payment.id,booking_id:payment.booking_id,booking_reference:payment.booking_reference});
        location.assign(payment.checkout_url);
        return;
      }
      const booking=await api('/bookings',{method:'POST',headers:{'Idempotency-Key':submission.idempotency_key},body:JSON.stringify({hold_id:submission.hold_id,session_id:submission.session_id,customer:submission.customer,payment_method:submission.payment_method,selected_date:submission.selected_date,slot_time:submission.slot_time,experience_title:submission.experience_title,is_private:submission.is_private,guide_language:submission.guide_language,extras:submission.extras,promo_code:submission.promo_code})});
      const confirmed=verifiedBookingConfirmation(booking);
      const confirmedExtras=confirmedAncillaryDetails(booking,submission.extras);
      clearInterval(holdTimer); bookingState.hold=null; delStore('voy_recovery_state');
      const manageToken=confirmed.token;const manageLang=locale==='he'?'?lang=he':locale==='hu'?'?lang=hu':'';const manageUrl='/manage/'+manageLang+'#token='+encodeURIComponent(manageToken);
      const bookingWhatsApp=whatsAppUrl('booking_confirmation',{booking_reference:confirmed.reference,experience_title:localizedBudapestExperienceTitle(bookingState.experience,booking.experience_title),date:confirmationDateLabel(confirmed.date),requested_time:confirmationTimeLabel(confirmed.time),riders:confirmed.composition?.riders_16_plus||0,children:confirmed.composition?.child_passengers_3_15||0,babies:confirmed.composition?.baby_passengers_1_2||0,is_private:confirmed.isPrivate,guide_language:confirmed.guideLanguage,payment_method:paymentMethod,extras:confirmedExtras.items,total:confirmed.total,currency:confirmed.currency});
      const confirmationMeetingLabel=locale==='he'?'נקודת מפגש':locale==='hu'?'Találkozási pont':'Meeting point';
      const confirmationMapsLabel=locale==='he'?'פתיחה ב־Google Maps':locale==='hu'?'Megnyitás a Google Térképen':'Open in Google Maps';
      const confirmationTotal=confirmed.total;
      const confirmationTour=localizedBudapestExperienceTitle(bookingState.experience,booking.experience_title);
      terminal=true;st.classList.add('success-card');st.innerHTML=`<div class="success-icon" aria-hidden="true">✓</div><h3 tabindex="-1">${t('Booking confirmed','ההזמנה אושרה')}</h3><div class="confirmation-reference"><span>${t('Booking reference','מספר הזמנה')}</span><b>${escapeHTML(confirmed.reference)}</b></div>${confirmationTour?`<div class="confirmation-tour"><span>${t('Tour','סיור')}</span><strong>${escapeHTML(confirmationTour)}</strong></div>`:''}${renderPartySummary(confirmed.composition)}${confirmationTotal!=null?`<div class="confirmation-total"><span>${t('Total','סה״כ')}</span><strong>${escapeHTML(money(confirmationTotal,confirmed.currency))}</strong></div>`:''}<div class="party-summary confirmation-meta"><span>${t('Date','תאריך')} · ${escapeHTML(confirmationDateLabel(confirmed.date))}</span><span>${t('Time','שעה')} · ${escapeHTML(confirmationTimeLabel(confirmed.time))}</span>${confirmed.isPrivate?`<span>${t('Private tour','סיור פרטי')}</span>`:''}<span>${requestedGuideLanguageLabel()} · ${escapeHTML(guideLanguageLabel(confirmed.guideLanguage))}</span><span>${t('Payment','תשלום')} · ${paymentMethod==='pay_now_card'?t('Paid online by card','שולם מראש בכרטיס'):paymentMethod==='pay_arrival_cash'?t('Cash on arrival','מזומן במקום'):t('Card on arrival','כרטיס במקום')}</span></div><p class="muted" data-requested-guide-language-note>${escapeHTML(locale==='he'?'שפת ההדרכה המבוקשת נרשמה בהזמנה. צוות בודפשט יאשר את אפשרות ההדרכה בשפה זו מול הצוות המשובץ.':locale==='hu'?'A kért idegenvezetési nyelvet rögzítettük a foglalásban. A budapesti csapat egyezteti a nyelvi teljesíthetőséget a beosztott vezetőkkel.':'Your requested guiding language is saved with the booking. The Budapest team will confirm language coverage with the assigned staff.')}</p>${renderConfirmationAncillarySummary(confirmedExtras.items)}${confirmedExtras.matches?'':`<div class="notice" role="alert">${escapeHTML(locale==='he'?'לא הצלחנו לאמת שכל התוספות שבחרתם מופיעות בהזמנה. הפריטים המוצגים הם אלו שהתקבלו באישור ההזמנה. אנא פנו לצוות לבירור לפני היציאה.':locale==='hu'?'Nem tudtuk megerősíteni, hogy minden kiválasztott kiegészítő szerepel a foglalásban. Csak a foglalás visszaigazolásában szereplő tételek láthatók. Kérjük, indulás előtt egyeztess csapatunkkal.':'We could not verify that all selected extras were included in your booking. Only extras returned in the booking confirmation are shown. Please contact our team before departure.')}</div>`}${(()=>{const meeting=budapestMeetingPoint();if(!meeting?.address)return '';return `<div class="confirmation-meeting-point"><div><small>${escapeHTML(confirmationMeetingLabel)}</small><b>${escapeHTML(meeting.address)}</b></div>${meeting.maps_url?`<a class="btn secondary" href="${escapeHTML(meeting.maps_url)}" target="_blank" rel="noopener">${escapeHTML(confirmationMapsLabel)}</a>`:''}</div>`;})()}<div class="success-actions"><a class="btn" href="${manageUrl}">${t('Manage booking','ניהול הזמנה')}</a><button type="button" class="btn secondary" data-copy-booking-ref>${t('Copy reference','העתקת מספר')}</button><a class="btn secondary" data-calendar-booking href="#">${t('Add to calendar','הוספה ליומן')}</a><a class="btn secondary" href="${bookingWhatsApp}" target="_blank" rel="noopener">WhatsApp</a></div><div class="confirmation-next"><b>${t('What happens next','מה עכשיו')}</b><span>${t('Your booking is confirmed. Use Manage Booking for current details or available changes.','ההזמנה אושרה. בניהול ההזמנה תוכלו לראות את הפרטים העדכניים ואת השינויים הזמינים.')}</span><span>${t('Keep the Manage Booking link private — it gives access to this booking.','שמרו את קישור ניהול ההזמנה פרטי — הוא מעניק גישה להזמנה הזו.')}</span></div>`;
      bindConfirmationActions(st,booking);st.querySelector('h3')?.focus({preventScroll:true});checkoutForm.querySelectorAll('input,select,button:not([data-copy-booking-ref])').forEach(el=>el.disabled=true);document.querySelector('.mobilebook')?.setAttribute('hidden','');
      track('booking_completed',{booking_value:booking.total,value_semantics:'booked_gmv',currency:booking.currency,payment_method:paymentMethod,is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage,promo_code_applied:booking.promo_code_applied||bookingState.promoCode||null,discount:booking.discount||0});patchSession({stage:'booking_completed',booking_id:booking.id,booking_reference:booking.reference,is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage});resetBookingStarted();
    }catch(err){
      const holdExpired=err.code==='HOLD_EXPIRED';
      patchSession({stage:holdExpired?'hold_expired':'booking_failed',error_code:err?.code||String(err?.status||'booking_failed')});
      if(holdExpired){
        terminal=true;
        recoverExpiredHold=true;
      }
      const msg=checkoutFailureMessage(err,paymentMethod);
      st.innerHTML=rescueMarkup(msg);bindInlineWhatsApp(st);
    }
    finally{
      checkoutForm.dataset.submitting='';checkoutForm.removeAttribute('aria-busy');
      const localHoldInvalid=!submission.capacity_request&&(!bookingState.hold?.id||String(bookingState.hold.id)!==String(submission.hold_id||''));
      if(!terminal&&localHoldInvalid){
        setCheckoutSubmissionLock(false);
        bookingState.submissionSnapshot=null;
        lockExpiredCheckout({focusRecovery:true});
      }else if(!terminal)enableCheckoutRetryActions();
      else if(recoverExpiredHold){
        setCheckoutSubmissionLock(false);
        bookingState.submissionSnapshot=null;
        lockExpiredCheckout({focusRecovery:true});
      }
    }
  });}

  function initPaymentReturnNotice(){
    if(qs.get('payment')==='success'){clearPaymentRetry();resetBookingStarted();return;}
    if(!form||qs.get('payment')!=='cancelled')return;
    const retry=paymentRetryState();
    const status=document.querySelector('#availability-status');
    if(status){
      const message=retry
        ?(locale==='he'?'חזרתם ממסך התשלום. לא ניתן לאמת מכאן אם בוצע חיוב. אם לא שילמתם, אפשר לחזור לאותו מסך תשלום מאובטח; אחרת, בדקו עם הצוות לפני ניסיון נוסף.':locale==='hu'?'Visszatértél a kártyás fizetésből. Innen nem ellenőrizhető, történt-e terhelés. Ha nem fizettél, visszatérhetsz ugyanahhoz a biztonságos fizetéshez; egyébként egyeztess a csapattal újabb próbálkozás előtt.':'You returned from card checkout. This page cannot verify whether a charge was processed. If you did not pay, you can return to the same secure checkout; otherwise, contact our team before trying again.')
        :(locale==='he'?'חזרתם ממסך התשלום, אך איננו יכולים לאמת כאן את מצב החיוב. לפני פתיחת הזמנה חדשה, בדקו עם הצוות ב־WhatsApp; ניתן גם לשחזר את הבחירה ולבדוק זמינות.':locale==='hu'?'Visszatértél a kártyás fizetésből, de a terhelés állapota innen nem ellenőrizhető. Új foglalás előtt egyeztess csapatunkkal WhatsAppon; ezután visszaállíthatod a választást és ellenőrizheted az elérhetőséget.':'You returned from card checkout, but the payment status cannot be verified on this page. Contact our team on WhatsApp before starting a new booking; you can also restore your selection to check availability.');
      let markup=rescueMarkup(message);
      if(retry){
        const retryLabel=t('Retry card payment','חזרה לתשלום בכרטיס');
        const retryHref=escapeHTML(retry.checkout_url);
        markup=markup.replace('<div class="status-actions">','<div class="status-actions"><a class="btn" data-payment-retry href="'+retryHref+'">'+escapeHTML(retryLabel)+'</a>');
      }
      status.innerHTML=markup;
      bindInlineWhatsApp(status);
      const retryLink=status.querySelector('[data-payment-retry]');
      if(retryLink)retryLink.addEventListener('click',()=>{patchSession({stage:'payment_retry_redirect',payment_provider:'stripe',payment_checkout_id:retry.payment_checkout_id||null,booking_id:retry.booking_id||null,booking_reference:retry.booking_reference||null});track('payment_retry_clicked',{page,retry_available:true});});
    }
    const clean=new URL(location.href);clean.searchParams.delete('payment');history.replaceState({},'',clean.pathname+(clean.searchParams.toString()?'?'+clean.searchParams.toString():'')+(clean.hash||'#booking'));
    patchSession({stage:'payment_cancelled_return'});track('payment_cancelled_return',{page,retry_available:Boolean(retry)});
  }

  const WEBSITE_VISUAL_COPY={
    en:{
      meeting:'MEETING POINT',budapestTitle:'Start in central Budapest.',budapestBody:'Please arrive about 15 minutes before departure for check-in, equipment fitting and riding instructions.',budapestName:'VOY PRO Budapest',
      portugalTitle:'Start your Marvão experience here.',portugalBody:'Use the Google Maps pin for the exact meeting point before departure. The local experience is operated by Pombais Experience & Villas.',portugalName:'Pombais Experience & Villas',portugalAddress:'Marvão, Portugal',
      maps:'Open in Google Maps',exactPin:'Exact meeting point',pictures:'ROUTE IN PICTURES',schematic:'ROUTE SCHEMATIC',schematicNote:'Illustrative route — the exact sequence can vary.'
    },
    he:{
      meeting:'נקודת מפגש',budapestTitle:'מתחילים במרכז בודפשט.',budapestBody:'נא להגיע כ־15 דקות לפני היציאה לצ׳ק-אין, התאמת ציוד ותדריך רכיבה.',budapestName:'VOY PRO Budapest',
      portugalTitle:'מתחילים את חוויית מרבאו כאן.',portugalBody:'לפני היציאה השתמשו בסימון המדויק ב-Google Maps. החוויה המקומית מופעלת על ידי Pombais Experience & Villas.',portugalName:'Pombais Experience & Villas',portugalAddress:'Marvão, Portugal',
      maps:'פתיחה ב-Google Maps',exactPin:'נקודת המפגש המדויקת',pictures:'המסלול בתמונות',schematic:'תרשים המסלול',schematicNote:'המחשה בלבד — סדר המסלול בפועל עשוי להשתנות.'
    },
    hu:{
      meeting:'TALÁLKOZÁSI PONT',budapestTitle:'Indulás Budapest belvárosából.',budapestBody:'Kérjük, érkezz körülbelül 15 perccel indulás előtt a bejelentkezéshez, felszereléshez és a vezetési oktatáshoz.',budapestName:'VOY PRO Budapest',
      portugalTitle:'Itt kezdődik a marvãói élmény.',portugalBody:'Indulás előtt használd a Google Maps pontos találkozási pontját. A helyi élményt a Pombais Experience & Villas üzemelteti.',portugalName:'Pombais Experience & Villas',portugalAddress:'Marvão, Portugal',
      maps:'Megnyitás a Google Térképen',exactPin:'Pontos találkozási pont',pictures:'AZ ÚTVONAL KÉPEKBEN',schematic:'ÚTVONALVÁZLAT',schematicNote:'Szemléltető útvonal — a pontos sorrend változhat.'
    },
    pt:{
      meeting:'PONTO DE ENCONTRO',budapestTitle:'Partida no centro de Budapeste.',budapestBody:'Chegue cerca de 15 minutos antes da partida para check-in, ajuste do equipamento e instruções de condução.',budapestName:'VOY PRO Budapest',
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
    const meeting=budapest?budapestMeetingPoint():null;
    if(budapest&&(!meeting?.address||!meeting?.maps_url))return;
    // The destination runtime controls the operational address, but the
    // customer-facing Google Maps button should open our business listing,
    // not a generic pin for Városház utca 14.
    const BUDAPEST_BUSINESS_MAPS_URL='https://maps.app.goo.gl/F4DHtcpbWZrVjpqz5?g_st=ac';
    const BUDAPEST_BUSINESS_DISPLAY_NAME='EZRaider Budapest by Voy PRO';
    // A Google Place embed with the business CID and exact coordinates verified
    // against the connected Google Business Profile on 2026-10-24.
    // Registered business: locations/10872060211622121425;
    // Maps URI: https://maps.google.com/maps?cid=13820859235751578037
    // Place ID: ChIJR_q2zJXdQUcRtUmmtT-Ozb8
    // This is an explicit CID-based map, never a free-text Maps search.
    const BUDAPEST_OFFICIAL_GOOGLE_EMBED_SRC='https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1000.385!2d19.0552!3d47.4944!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0xbfcd8e3fb5a649b5!2sEZRaider%20Budapest%20by%20Voy%20PRO!5e0!3m2!1sen!2shu!4v1792838880000!5m2!1sen!2shu';
    let officialGoogleEmbed='';
    if(BUDAPEST_OFFICIAL_GOOGLE_EMBED_SRC){
      try{
        const parsed=new URL(BUDAPEST_OFFICIAL_GOOGLE_EMBED_SRC);
        if(parsed.protocol==='https:'&&parsed.hostname==='www.google.com'&&
            parsed.pathname==='/maps/embed'&&
            (parsed.searchParams.get('pb')||'').includes('0x0:0xbfcd8e3fb5a649b5')&&
            (parsed.searchParams.get('pb')||'').includes('47.4944')&&
            (parsed.searchParams.get('pb')||'').includes('19.0552')){
          officialGoogleEmbed=parsed.toString();
        }
      }catch(_error){/* Leave existing map unchanged if the embed is invalid. */}
    }
    const data=budapest?{
      title:copy.budapestTitle,body:copy.budapestBody,name:copy.budapestName,address:meeting.address,
      maps:BUDAPEST_BUSINESS_MAPS_URL,
      // Fallback map pin from the connected Google Business Profile (not a guessed point).
      mapPreview:'https://www.openstreetmap.org/export/embed.html?bbox=19.053800%2C47.493600%2C19.056600%2C47.495200&layer=mapnik&marker=47.4944%2C19.0552'
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
      ${budapest?(officialGoogleEmbed?`<div class="meeting-map-card meeting-map-card--google">
        <iframe class="meeting-map-frame"
          title="${escapeHTML(BUDAPEST_BUSINESS_DISPLAY_NAME)} — ${escapeHTML(copy.exactPin)}"
          src="${escapeHTML(officialGoogleEmbed)}"
          loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        <div class="meeting-map-label"><small>${escapeHTML(copy.exactPin)}</small><b>${escapeHTML(BUDAPEST_BUSINESS_DISPLAY_NAME)}</b><span>${escapeHTML(data.address)}</span></div>
      </div>`:`<div class="meeting-map-card meeting-map-card--business">
        <iframe class="meeting-map-frame meeting-map-frame--business"
          title="${escapeHTML(BUDAPEST_BUSINESS_DISPLAY_NAME)} — ${escapeHTML(copy.exactPin)}"
          src="${escapeHTML(data.mapPreview)}"
          loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        <a class="meeting-map-open" href="${escapeHTML(data.maps)}"
          target="_blank" rel="noopener noreferrer" data-track="meeting_point_maps"
          aria-label="${escapeHTML(copy.maps)} — ${escapeHTML(BUDAPEST_BUSINESS_DISPLAY_NAME)}">
          ${escapeHTML(copy.maps)} ↗
        </a>
        <a class="meeting-map-business-link" href="${escapeHTML(data.maps)}"
          target="_blank" rel="noopener noreferrer" data-track="meeting_point_maps"
          aria-label="${escapeHTML(BUDAPEST_BUSINESS_DISPLAY_NAME)} — ${escapeHTML(copy.maps)}">
          <span class="meeting-map-label"><small>${escapeHTML(copy.exactPin)}</small><b>${escapeHTML(BUDAPEST_BUSINESS_DISPLAY_NAME)}</b><span>${escapeHTML(data.address)}</span></span>
        </a>
        <span class="meeting-map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></span>
      </div>`):`<div class="meeting-map-card">
        <iframe
          class="meeting-map-frame"
          title="${escapeHTML(data.name)} — ${escapeHTML(copy.exactPin)}"
          src="https://www.google.com/maps?q=${encodeURIComponent(data.mapQuery)}&amp;z=${data.mapZoom||16}&amp;output=embed"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          allowfullscreen></iframe>
        <div class="meeting-map-label"><small>${escapeHTML(copy.exactPin)}</small><b>${escapeHTML(data.name)}</b><span>${escapeHTML(data.address)}</span></div>
      </div>`}
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

  // The homepage Manage Booking CTA must never be covered by the floating
  // WhatsApp shortcut on narrow screens. The in-card contact options remain.
  (()=>{
    if(document.body?.dataset.page!=='/'||!('IntersectionObserver' in window))return;
    const manage=document.querySelector('.network-manage-section .btn');
    const floating=document.querySelector('a.home-whatsapp');
    if(!manage||!floating)return;
    const observer=new IntersectionObserver(entries=>{
      document.body.classList.toggle('home-manage-visible',
        entries.some(entry=>entry.target===manage&&entry.isIntersecting));
    },{threshold:0});
    observer.observe(manage);
  })();

  window.VOYBookingIntelligence={track,createSession,patchSession,api,bookingEnabled};
})();
