/* Budapest advanced tours: same-origin request submission via a server-only relay.
 * The relay is deployed in a SEPARATE, owner-gated draft PR and is disabled
 * by default. Never send a secret or an upstream FBM URL to the browser.
 */
(()=>{
  'use strict';
  const matched=location.pathname.match(/^\/(?:(he|hu)\/)?budapest\/tours\/(heroes-square-city-ezraider-tour|citadella-advanced-ezraider-tour|buda-margaret-extended-tour)\/?$/);
  if(!matched)return;
  const locale=matched[1]||'en';
  const slugByPage={
    'heroes-square-city-ezraider-tour':'heroes-square',
    'citadella-advanced-ezraider-tour':'citadella-advanced',
    'buda-margaret-extended-tour':'buda-margaret-extended'
  };
  const tourSlug=slugByPage[matched[2]];
  const strings={
    en:{title:'Request this tour',intro:'Tell our Budapest team when you would like to go. This is an enquiry, not a reservation.',
      date:'Preferred date',time:'Preferred start time',riders:'Independent riders',language:'Preferred guiding language',
      name:'Contact name',email:'Email',phone:'Phone or WhatsApp',english:'If the requested guiding language is unavailable, English would also work for everyone in our group.',whatsappEnglish:'English as an alternative',yes:'Explicitly accepted for everyone in the group',unanswered:'Not answered (no acceptance recorded)',
      contact:'Enter an email address or phone number.',advance:'Please choose a Budapest departure at least one hour from now.',dst:'This local time does not exist or occurs twice during a Budapest clock change. Choose a different time.',
      horizon:'Please choose a date and time within the next 180 days (Budapest time).',
      submit:'Request availability',note:'We will try to send your enquiry securely. If request intake is unavailable, WhatsApp opens with a prefilled message that you must send yourself. Only a reference shown here means the enquiry was received; it is never a reservation.',
      sending:'Sending enquiry…',success:'Enquiry received for human review. This is not a confirmed booking or availability guarantee.',reference:'Request reference',
      unavailable:'Request delivery could not be verified. Retry without editing your details, or contact our team manually. Do not assume an enquiry was received.',
      rateLimited:'Too many enquiries were sent recently. Please wait a few minutes before retrying with the same details. Delivery is unverified; this is not a booking.',
      conflict:'This enquiry ID belongs to different details. Change your request details to send a new enquiry, or contact our team. Nothing has been accepted.',
      rejected:'The date, time or other details were rejected. Review your selection and try again.',
      needsWhatsApp:'Secure enquiry intake is disabled. WhatsApp is opening with your prefilled enquiry; you must send it yourself.',
      retry:'Retry enquiry',manual:'Contact us on WhatsApp',
      type:'Tour',none:'Select a language',invalid:'Please check the form before continuing.'},
    he:{title:'בקשת סיור',intro:'ספרו לצוות בודפשט מתי תרצו לצאת. זו פנייה בלבד, לא הזמנה מאושרת.',
      date:'תאריך מועדף',time:'שעת יציאה מועדפת',riders:'רוכבים עצמאיים',language:'שפת הדרכה מבוקשת',
      name:'שם איש קשר',email:'אימייל',phone:'טלפון או WhatsApp',english:'אם שפת ההדרכה המבוקשת אינה זמינה, אנגלית מתאימה גם לכל חברי הקבוצה.',whatsappEnglish:'אנגלית כשפה חלופית',yes:'אושרה במפורש עבור כל חברי הקבוצה',unanswered:'לא נענתה השאלה (לא ניתנה הסכמה)',
      contact:'יש להזין אימייל או מספר טלפון.',advance:'יש לבחור מועד יציאה לפי שעון בודפשט, לפחות שעה מהעכשיו.',dst:'השעה המקומית שבחרתם אינה קיימת או מופיעה פעמיים בשל מעבר שעון בבודפשט. בחרו שעה אחרת.',
      horizon:'יש לבחור תאריך ושעה בטווח של 180 הימים הקרובים, לפי שעון בודפשט.',
      submit:'בקשת זמינות',note:'ננסה לשלוח את הפנייה באופן מאובטח. אם קליטת הפניות אינה פעילה, ייפתח WhatsApp עם הודעה מוכנה שתצטרכו לשלוח בעצמכם. רק מספר פנייה שיוצג כאן מעיד על קליטה, ואינו הזמנה.',
      sending:'שולחים פנייה…',success:'הפנייה התקבלה לבדיקה אנושית. זו אינה הזמנה מאושרת או הבטחה לזמינות.',reference:'מספר פנייה',
      unavailable:'לא ניתן לאמת שהפנייה נמסרה. נסו שוב בלי לשנות את הפרטים או צרו קשר ידנית. אין להניח שהפנייה נקלטה.',
      rateLimited:'נשלחו יותר מדי בקשות בזמן קצר. המתינו מספר דקות ונסו שוב בלי לשנות את הפרטים. לא ניתן לאמת את קליטת הפנייה; זו אינה הזמנה.',
      conflict:'מספר הפנייה כבר קשור לפרטים אחרים. שנו את פרטי הבקשה כדי לשלוח פנייה חדשה, או פנו לצוות. לא התקבלה פנייה חדשה.',
      rejected:'התאריך, השעה או פרטים אחרים נדחו. בדקו את הפרטים ונסו שוב.',
      needsWhatsApp:'קליטה מאובטחת אינה פעילה. WhatsApp ייפתח עם פנייה מוכנה — יש לשלוח אותה בעצמכם.',
      retry:'ניסיון שליחה חוזר',manual:'יצירת קשר ב־WhatsApp',
      type:'סיור',none:'בחרו שפה',invalid:'יש לבדוק את פרטי הטופס לפני ההמשך.'},
    hu:{title:'Túraigénylés',intro:'Írd meg a budapesti csapatnak, mikor szeretnél indulni. Ez érdeklődés, nem visszaigazolt foglalás.',
      date:'Kívánt dátum',time:'Kívánt indulási idő',riders:'Önálló vezetők',language:'Kért idegenvezetési nyelv',
      name:'Kapcsolattartó neve',email:'E-mail',phone:'Telefon vagy WhatsApp',english:'Ha a kért idegenvezetési nyelv nem érhető el, az angol az egész csoportunknak megfelelő.',whatsappEnglish:'Angol mint alternatíva',yes:'Kifejezetten elfogadva az egész csoport számára',unanswered:'Nincs válasz (nincs rögzített beleegyezés)',
      contact:'Adj meg e-mail-címet vagy telefonszámot.',advance:'Válassz legalább egy órával későbbi indulási időpontot budapesti idő szerint.',dst:'A kiválasztott helyi időpont nem létezik, vagy kétszer fordul elő az óraátállításkor Budapesten. Válassz másik időpontot.',
      horizon:'Válassz indulási dátumot és időpontot a következő 180 napon belül, budapesti idő szerint.',
      submit:'Elérhetőség kérése',note:'Megpróbáljuk biztonságosan elküldeni a kérést. Ha a fogadása nem aktív, a WhatsApp nyílik meg előre kitöltött üzenettel, amelyet neked kell elküldened. Csak az itt megjelenő hivatkozási szám jelzi a fogadást, ez nem foglalás.',
      sending:'Kérés küldése…',success:'A kérés emberi elbírálásra megérkezett. Ez nem visszaigazolt foglalás vagy elérhetőség.',reference:'Kérés azonosítója',
      unavailable:'Nem sikerült ellenőrizni a kézbesítést. Próbáld újra az adatok módosítása nélkül, vagy keresd fel a csapatot. Nem biztos, hogy a kérés beérkezett.',
      rateLimited:'Túl sok kérés érkezett rövid időn belül. Várj néhány percet, majd próbáld újra ugyanazokkal az adatokkal. A beérkezés nem ellenőrzött; ez nem foglalás.',
      conflict:'Ez a kérésazonosító más adatokhoz tartozik. Módosítsd a kérés adatait egy új érdeklődéshez, vagy keresd a csapatot. Új kérés nem érkezett.',
      rejected:'A dátum, az időpont vagy más adat nem fogadható el. Ellenőrizd az adatokat és próbáld újra.',
      needsWhatsApp:'A biztonságos kérések fogadása nem aktív. Megnyílik a WhatsApp üzenete, amelyet neked kell elküldened.',
      retry:'Kérés újrapróbálása',manual:'Kapcsolat WhatsAppon',
      type:'Túra',none:'Válassz nyelvet',invalid:'Ellenőrizd az űrlap adatait.'}
  };
  const labels=strings[locale];
  // Names in the manual WhatsApp handoff are localized to the request
  // language. The canonical API still receives the original language code.
  const guideNames={
    en:{en:'English',he:'Hebrew',hu:'Hungarian',es:'Spanish',pt:'Portuguese'},
    he:{en:'אנגלית',he:'עברית',hu:'הונגרית',es:'ספרדית',pt:'פורטוגזית'},
    hu:{en:'Angol',he:'Héber',hu:'Magyar',es:'Spanyol',pt:'Portugál'}
  };
  const main=document.querySelector('main');
  if(!main)return;
  // The legacy extended-tour WhatsApp builder did not collect an explicit
  // English alternative choice; replace that builder, preserve page CTAs.
  document.querySelector('[data-special-request-builder]')?.remove();
  const oldPanel=document.querySelector('.special-request-panel');
  if(oldPanel)oldPanel.classList.remove('has-builder');
  const container=document.createElement('section');
  container.className='section';
  container.dataset.requestToBookEnquiry='';
  const wrap=document.createElement('div');
  wrap.className='wrap';
  container.appendChild(wrap);
  const heading=document.createElement('h2');
  heading.textContent=labels.title;
  wrap.appendChild(heading);
  const intro=document.createElement('p');
  intro.textContent=labels.intro;
  wrap.appendChild(intro);
  const form=document.createElement('form');
  form.className='voy-rtb-enquiry';
  form.setAttribute('aria-label',labels.title);
  form.noValidate=false;
  const languages=[['en','English'],['he','עברית'],['hu','Magyar'],['es','Español'],['pt','Português']];
  const languageOptions=languages.map(([code,title])=>'<option value="'+code+'">'+title+'</option>').join('');
  form.innerHTML='<div class="voy-rtb-grid">'+
    '<label>'+labels.date+'<input name="requested_date" type="date" required></label>'+
    '<label>'+labels.time+'<input name="requested_time" type="time" required></label>'+
    '<label>'+labels.riders+'<input name="party_size" type="number" required min="1" max="12" step="1" value="2"></label>'+
    '<label>'+labels.language+'<select name="requested_guide_language" required><option value="">'+labels.none+'</option>'+languageOptions+'</select></label>'+
    '<label>'+labels.name+'<input name="contact_name" type="text" required maxlength="200" autocomplete="name"></label>'+
    '<label>'+labels.email+'<input name="contact_email" type="email" maxlength="254" autocomplete="email"></label>'+
    '<label>'+labels.phone+'<input name="contact_phone" type="tel" maxlength="40" autocomplete="tel"></label>'+
    '</div><label class="voy-rtb-checkbox"><input type="checkbox" name="english_alternative_accepted" value="yes"><span>'+labels.english+'</span></label>'+
    '<p class="voy-rtb-feedback" role="status" aria-live="polite"></p>'+
    '<button class="btn alt" type="submit">'+labels.submit+'</button>'+
    '<p class="voy-rtb-explanation">'+labels.note+'</p>';
  wrap.appendChild(form);
  // FBM never accepts a browser-held secret. The website sends only the
  // canonical guest choice to the same-origin relay, if it is enabled.
  const draftFrom=(data)=>({
    tourSlug,
    requestedGuideLanguage:String(data.get('requested_guide_language')||'').trim().toLowerCase(),
    // English is already the primary request in this case; it cannot be a
    // second, explicitly consented alternative to itself.
    englishAlternativeAccepted:data.get('requested_guide_language')!=='en'&&
      data.get('english_alternative_accepted')==='yes',
    partySize:Number(data.get('party_size')||0),
    contactName:String(data.get('contact_name')||'').trim(),
    email:String(data.get('contact_email')||'').trim(),
    phone:String(data.get('contact_phone')||'').trim(),
    preferredLocalDate:String(data.get('requested_date')||''),
    preferredLocalTime:String(data.get('requested_time')||''),
    preferredTimezone:'Europe/Budapest'
  });
  const budapestLocalAt=(timestamp)=>{
    const values=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Budapest',
      year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
      .formatToParts(new Date(timestamp)).map(x=>[x.type,x.value]));
    return [values.year,values.month,values.day].join('-')+'T'+values.hour+':'+values.minute;
  };
  // Resolve a guest-entered Budapest wall minute using the same uniqueness
  // rule as the server: DST spring gaps have zero instants, autumn folds have
  // two. A local date/time alone cannot identify either ambiguous departure.
  // No visitor-local Date.parse(), timezone assumption or external API.
  const resolveBudapestWallMinute=(day,time)=>{
    if(!/^\d{4}-\d\d-\d\d$/.test(day)||
       !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))return null;
    const [year,month,date]=day.split('-').map(Number);
    const [hour,minute]=time.split(':').map(Number);
    const asUtc=Date.UTC(year,month-1,date,hour,minute);
    if(new Date(asUtc).toISOString().slice(0,16)!==day+'T'+time)return null;
    let unique=null;
    for(let offset=-180;offset<=180;offset+=15){
      const candidate=asUtc-offset*60000;
      if(budapestLocalAt(candidate)===day+'T'+time){
        if(unique!==null)return null;
        unique=candidate;
      }
    }
    return unique;
  };
  const budapestToday=()=>budapestLocalAt(Date.now()).slice(0,10);
  // The website relay and FBM both reject requests > 180 exact days ahead.
  const budapestLastRequestDate=()=>budapestLocalAt(Date.now()+180*86400000).slice(0,10);
  const languageField=form.querySelector('[name="requested_guide_language"]');
  const englishChoice=form.querySelector('[name="english_alternative_accepted"]');
  const englishChoiceRow=englishChoice.closest('.voy-rtb-checkbox');
  const updateEnglishAlternative=()=>{
    // A previously accepted English fallback must never carry across a
    // changed primary guiding-language choice without renewed guest consent.
    englishChoice.checked=false;
    englishChoiceRow.hidden=!languageField.value||languageField.value==='en';
  };
  languageField.addEventListener('change',updateEnglishAlternative);
  updateEnglishAlternative();
  const dateField=form.querySelector('[name="requested_date"]');
  dateField.min=budapestToday();
  dateField.max=budapestLastRequestDate();
  const submitButton=form.querySelector('button[type="submit"]');
  const feedback=form.querySelector('.voy-rtb-feedback');
  // Keep visible guest details fixed while the exact immutable POST is in
  // flight. Without this, a 202 could acknowledge an earlier form state.
  const editableControls=Array.from(form.querySelectorAll('input,select,textarea'));
  let inFlight=false;
  let pendingPayload=null;
  let pendingFingerprint='';
  let successful=false;
  // Once an upstream idempotency mismatch is confirmed, its exact guest
  // payload must NEVER be retried with the same or a fresh request ID.
  // A genuinely changed enquiry may use a new ID after guest edits.
  const conflictedFingerprints=new Set();
  const clearPending=()=>{
    // Changing any guest field means a NEW inquiry, never mutate a prior
    // request under the same idempotency key.
    if(inFlight||successful)return;
    const fingerprint=JSON.stringify(draftFrom(new FormData(form)));
    if(fingerprint!==pendingFingerprint){
      pendingPayload=null;
      pendingFingerprint='';
      // An old manual WhatsApp link contains a snapshot of the PREVIOUS
      // request. Remove it when details change to avoid sending stale PII.
      form.querySelector('[data-rtb-manual]')?.remove();
      const isConflicted=conflictedFingerprints.has(fingerprint);
      feedback.textContent=isConflicted?labels.conflict:'';
      submitButton.disabled=isConflicted;
      submitButton.textContent=labels.submit;
    }
  };
  form.addEventListener('input',clearPending);
  form.addEventListener('change',clearPending);
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(inFlight||successful)return;
    dateField.min=budapestToday();
    dateField.max=budapestLastRequestDate();
    feedback.textContent='';
    feedback.classList.remove('voy-rtb-success');
    form.querySelector('[data-rtb-manual]')?.remove();
    if(!form.reportValidity()){
      feedback.textContent=dateField.value&&dateField.value>dateField.max?labels.horizon:labels.invalid;
      return;
    }
    const draft=draftFrom(new FormData(form));
    if(!draft.email&&!draft.phone){feedback.textContent=labels.contact;return;}
    if(!/^[a-z]{2,3}$/.test(draft.requestedGuideLanguage)||!Number.isInteger(draft.partySize)
      ||draft.partySize<1||draft.partySize>12){feedback.textContent=labels.invalid;return;}
    // Reject absent/repeated wall minutes before sending guest contact
    // details. The server independently verifies the same DST uniqueness
    // rule and remains authoritative for all submission decisions.
    const selectedInstant=resolveBudapestWallMinute(
      draft.preferredLocalDate,draft.preferredLocalTime);
    if(selectedInstant===null){feedback.textContent=labels.dst;return;}
    // Compare instants, not local clock strings: the Budapest UTC offset
    // can change inside the 60-minute lead or the 180-day horizon.
    // User inputs are minute-precision; never round the required lead down.
    if(selectedInstant<Date.now()+3600000){
      feedback.textContent=labels.advance;return;
    }
    if(selectedInstant>Date.now()+180*86400000){
      feedback.textContent=labels.horizon;return;
    }
    // Send only the selected local date and time; the server performs its
    // own Europe/Budapest resolution, including gap/fold rejection.
    const lines=[
      labels.title,labels.type+': '+draft.tourSlug,
      labels.date+': '+draft.preferredLocalDate,
      labels.time+': '+draft.preferredLocalTime+' (Europe/Budapest)',
      labels.riders+': '+draft.partySize,
      labels.language+': '+(guideNames[locale]?.[draft.requestedGuideLanguage]||draft.requestedGuideLanguage),
      ...(draft.requestedGuideLanguage!=='en'
        ?[labels.whatsappEnglish+': '+(draft.englishAlternativeAccepted?labels.yes:labels.unanswered)]
        :[]),
      labels.name+': '+draft.contactName
    ];
    if(draft.email)lines.push(labels.email+': '+draft.email);
    if(draft.phone)lines.push(labels.phone+': '+draft.phone);
    const whatsappUrl='https://wa.me/36300993099?text='+encodeURIComponent(lines.join('\n'));
    const manualLink=()=>{
      const link=document.createElement('a');
      link.href=whatsappUrl;
      link.target='_blank';
      link.rel='noopener noreferrer';
      link.textContent=labels.manual;
      link.dataset.rtbManual='';
      link.className='btn secondary';
      feedback.insertAdjacentElement('afterend',link);
    };
    // One immutable request key per exact submission. A 503, timeout or
    // lost acknowledgement retains both key AND payload on retry.
    const fingerprint=JSON.stringify(draft);
    if(conflictedFingerprints.has(fingerprint)){
      // Editing and later reverting must not bypass the terminal conflict.
      // The guest can still contact the team manually if necessary.
      feedback.textContent=labels.conflict;
      submitButton.disabled=true;
      return;
    }
    if(!pendingPayload||fingerprint!==pendingFingerprint){
      const newId=globalThis.crypto?.randomUUID?.();
      if(!newId){
        feedback.textContent=labels.unavailable;
        manualLink();
        return;
      }
      const {preferredTimezone,...relayFields}=draft;
      pendingPayload={...relayFields,requestId:newId};
      pendingFingerprint=fingerprint;
    }
    inFlight=true;
    submitButton.disabled=true;
    submitButton.textContent=labels.sending;
    const priorDisabled=editableControls.map(control=>control.disabled);
    editableControls.forEach(control=>{control.disabled=true;});
    let acceptedByCRM=false;
    try{
      const response=await fetch('/api/request-to-book',{
        method:'POST',
        headers:{'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify(pendingPayload),
        credentials:'omit',cache:'no-store',redirect:'error',
        signal:AbortSignal.timeout(10000)
      });
      if(response.status===202){
        const outcome=await response.json();
        // FBM acknowledges a persisted tour_booking_requests row with a UUID.
        // A malformed 202 body is unverified delivery, never a successful enquiry.
        if(outcome?.status!=='pending_review'||typeof outcome.requestId!=='string'||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(outcome.requestId))
          throw new Error('invalid_request_acknowledgement');
        successful=true;
        acceptedByCRM=true;
        feedback.classList.add('voy-rtb-success');
        feedback.textContent=labels.success+' '+labels.reference+': '+outcome.requestId;
        submitButton.textContent=labels.success;
        return;
      }
      if(response.status===429){
        // Ingress may throttle before the relay responds. A prior attempt
        // could still have reached CRM, so keep the identical request key
        // for an explicit later retry. Never auto-send via WhatsApp.
        feedback.textContent=labels.rateLimited;
        manualLink();
        return;
      }
      if(response.status===404){
        // The relay has not been activated. The user must SEND the WhatsApp
        // message personally. Never portray this as a CRM acknowledgement.
        feedback.textContent=labels.needsWhatsApp;
        location.assign(whatsappUrl);
        return;
      }
      if(response.status===400||response.status===409){
        feedback.textContent=response.status===409?labels.conflict:labels.rejected;
        // Conflict is not safely retryable with the same key.
        if(response.status===409){
          conflictedFingerprints.add(pendingFingerprint);
          manualLink();
        }
        return;
      }
      // 503 and other server/network failures can occur AFTER an upstream
      // CRM write. Keep the idempotency key. Never auto-send WhatsApp.
      feedback.textContent=labels.unavailable;
      manualLink();
    }catch(err){
      feedback.textContent=labels.unavailable;
      manualLink();
    }finally{
      inFlight=false;
      // Keep accepted enquiry fields frozen alongside the accepted reference.
      // Unlock 409 and all unverified deliveries for edits. A verified 202
      // stays frozen; a terminal 409 remains blocked for its exact payload.
      if(!acceptedByCRM)editableControls.forEach((control,i)=>{
        control.disabled=priorDisabled[i];
      });
      if(!successful){
        submitButton.disabled=conflictedFingerprints.has(pendingFingerprint);
        submitButton.textContent=submitButton.disabled?labels.submit:labels.retry;
      }
    }
  });
  main.appendChild(container);
})();
