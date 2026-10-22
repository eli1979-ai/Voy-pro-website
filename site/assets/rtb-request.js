/* Budapest special tours: guest request drafting, NOT a direct FBM API client.
 * FBM's /api/public/request-to-book requires a private server-to-server secret.
 * This static website must never send that credential or pretend WhatsApp is CRM.
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
      name:'Contact name',email:'Email',phone:'Phone or WhatsApp',english:'I expressly accept English if my chosen language is unavailable.',
      contact:'Enter an email address or phone number.',advance:'Please choose a future Budapest departure time.',
      submit:'Continue to WhatsApp',note:'WhatsApp opens with a prefilled message. You must send it yourself. No request is stored in our booking system yet; staff will confirm availability, eligibility and price.',
      type:'Tour',none:'Select a language',invalid:'Please check the form before continuing.'},
    he:{title:'בקשת סיור',intro:'ספרו לצוות בודפשט מתי תרצו לצאת. זו פנייה בלבד, לא הזמנה מאושרת.',
      date:'תאריך מועדף',time:'שעת יציאה מועדפת',riders:'רוכבים עצמאיים',language:'שפת הדרכה מבוקשת',
      name:'שם איש קשר',email:'אימייל',phone:'טלפון או WhatsApp',english:'אני מסכים/ה במפורש להדרכה באנגלית אם השפה שבחרתי אינה זמינה.',
      contact:'יש להזין אימייל או מספר טלפון.',advance:'יש לבחור שעת יציאה עתידית לפי שעון בודפשט.',
      submit:'המשך ל־WhatsApp',note:'ייפתח WhatsApp עם הודעה מוכנה. יש לשלוח אותה בעצמכם. הפנייה עדיין לא נשמרת במערכת ההזמנות; הצוות יאשר זמינות, זכאות ומחיר.',
      type:'סיור',none:'בחרו שפה',invalid:'יש לבדוק את פרטי הטופס לפני ההמשך.'},
    hu:{title:'Túraigénylés',intro:'Írd meg a budapesti csapatnak, mikor szeretnél indulni. Ez érdeklődés, nem visszaigazolt foglalás.',
      date:'Kívánt dátum',time:'Kívánt indulási idő',riders:'Önálló vezetők',language:'Kért idegenvezetési nyelv',
      name:'Kapcsolattartó neve',email:'E-mail',phone:'Telefon vagy WhatsApp',english:'Kifejezetten elfogadom az angol nyelvű vezetést, ha a választott nyelv nem érhető el.',
      contact:'Adj meg e-mail-címet vagy telefonszámot.',advance:'Válassz egy jövőbeli indulási időpontot budapesti idő szerint.',
      submit:'Folytatás WhatsAppon',note:'A WhatsApp előre kitöltött üzenettel nyílik meg, amelyet neked kell elküldened. A kérés még nem kerül a foglalási rendszerbe; a csapat igazolja az elérhetőséget, a jogosultságot és az árat.',
      type:'Túra',none:'Válassz nyelvet',invalid:'Ellenőrizd az űrlap adatait.'}
  };
  const labels=strings[locale];
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
  // First-class structured field contract for the future, private server
  // relay. Nothing is transmitted to FBM from this static client.
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
  const budapestToday=()=>{
    const values=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Budapest',
      year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
    return [values.year,values.month,values.day].join('-');
  };
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
  form.addEventListener('submit',event=>{
    event.preventDefault();
    dateField.min=budapestToday();
    const feedback=form.querySelector('.voy-rtb-feedback');
    feedback.textContent='';
    if(!form.reportValidity()){feedback.textContent=labels.invalid;return;}
    const draft=draftFrom(new FormData(form));
    if(!draft.email&&!draft.phone){feedback.textContent=labels.contact;return;}
    if(!/^[a-z]{2,3}$/.test(draft.requestedGuideLanguage)||!Number.isInteger(draft.partySize)
      ||draft.partySize<1||draft.partySize>12){feedback.textContent=labels.invalid;return;}
    if(draft.preferredLocalDate<budapestToday()){feedback.textContent=labels.advance;return;}
    // Do not forge a UTC timestamp from the visitor's timezone: the future
    // server relay must resolve Europe/Budapest DST before calling FBM.
    const lines=[
      labels.title,labels.type+': '+draft.tourSlug,
      labels.date+': '+draft.preferredLocalDate,
      labels.time+': '+draft.preferredLocalTime+' (Europe/Budapest)',
      labels.riders+': '+draft.partySize,
      labels.language+': '+draft.requestedGuideLanguage,
      labels.english+': '+(draft.englishAlternativeAccepted?'yes':'no'),
      labels.name+': '+draft.contactName
    ];
    if(draft.email)lines.push(labels.email+': '+draft.email);
    if(draft.phone)lines.push(labels.phone+': '+draft.phone);
    // WhatsApp is a manual external handoff, never an accepted FBM request.
    location.assign('https://wa.me/36300993099?text='+encodeURIComponent(lines.join('\n')));
  });
  main.appendChild(container);
})();
