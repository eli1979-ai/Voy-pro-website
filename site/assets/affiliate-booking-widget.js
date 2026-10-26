/* VOY PRO partner booking widget v1.
 * Install on an approved partner origin with public (not secret) booking key.
 * Business rules, affiliate attribution and prices are always resolved by FBM.
 * Does not use iframe or modify partner cookies, storage or global CSS.
 */
(()=>{
  'use strict';
  const scripts=[...document.querySelectorAll('script[data-voy-affiliate-widget]')];
  const VALID_CODE=/^[A-Z0-9][A-Z0-9_-]{1,39}$/;
  // Preparation only: impossible to enable through partner HTML/runtime.
  // Activation must be a later reviewed source change with owner approval.
  const ENGLISH_ALT_PILOT_ENABLED=false;
  const money=(amount,currency='EUR')=>new Intl.NumberFormat('en',{style:'currency',currency}).format(Number(amount)||0);
  const todayBudapest=()=>{
    const parts=new Intl.DateTimeFormat('en-GB',{
      timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit',
    }).formatToParts(new Date());
    const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return [v.year,v.month,v.day].join('-');
  };
  function install(script){
    if(script.dataset.voyMounted==='true')return;
    const target=document.getElementById(script.dataset.target||'voy-affiliate-booking');
    if(!target){
      // Some partners load the standalone script in <head> before the target
      // container has been parsed. Retry once at DOM readiness rather than
      // falsely marking a missing target as successfully mounted.
      if(document.readyState==='loading')
        document.addEventListener('DOMContentLoaded',()=>install(script),{once:true});
      return;
    }
    // CMS templates sometimes include the same partner embed script twice.
    // Only the first script may attach the closed shadow root and own this
    // container; a duplicate must not throw or create a second booking form.
    if(target.dataset.voyAffiliateMounted==='true'){
      script.dataset.voyMounted='true';
      return;
    }
    const root=target.attachShadow({mode:'closed'});
    target.dataset.voyAffiliateMounted='true';
    script.dataset.voyMounted='true';
    const affiliate=String(script.dataset.affiliate||'').trim().toUpperCase();
    const clientKey=String(script.dataset.clientKey||'').trim();
    let apiRoot;
    try{
      apiRoot=new URL(String(script.dataset.apiRoot||'').trim());
      if(apiRoot.protocol!=='https:'||apiRoot.username||apiRoot.password||
         apiRoot.search||apiRoot.hash||apiRoot.pathname!=='/')throw new Error('Invalid API origin');
      apiRoot=apiRoot.origin+apiRoot.pathname.replace(/\/$/,'');
    }catch{apiRoot=null;}
    const valid=Boolean(apiRoot&&clientKey&&VALID_CODE.test(affiliate));

    // The template is static. User-, partner-, or API-supplied values are never
    // injected into HTML; all dynamic text uses textContent/createElement.
    root.innerHTML=`
      <style>
        :host{display:block;direction:ltr;--accent:#125789;--ink:#1b2934;--line:#cddae5;font:16px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ink)}
        *{box-sizing:border-box}
        .card{border:1px solid var(--line);border-radius:16px;padding:clamp(14px,3vw,24px);max-width:760px;background:#fff;box-shadow:0 8px 30px #102a4014}
        h2{font-size:1.3rem;margin:0 0 4px}h3{font-size:1.08rem;margin:4px 0 12px}
        .muted,.hint{font-size:.86rem;color:#586a78}.muted{margin:0 0 18px}
        .fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        label{display:flex;flex-direction:column;gap:5px;font-size:.91rem;font-weight:600}
        input,select,button{font:inherit}input,select{background:#fff;color:var(--ink);padding:10px;border:1px solid #aabfcc;border-radius:8px;width:100%;min-height:42px}
        input[type=checkbox]{width:auto;min-height:0;accent-color:var(--accent)}
        .check{flex-direction:row;align-items:center;gap:8px;margin:12px 0}
        .actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
        button{background:var(--accent);color:#fff;border:0;border-radius:9px;padding:11px 18px;min-height:44px;cursor:pointer}
        button.secondary{background:#f0f5fa;color:var(--accent);border:1px solid #b5c9da}
        button:disabled{opacity:.57;cursor:not-allowed}
        .slots{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
        .slots button{background:#f0f5fa;color:var(--accent);border:1px solid var(--line)}
        .slots button[aria-pressed=true]{background:#d8ecf8;border:2px solid var(--accent)}
        .slots .unavailable{color:#647584;background:#f5f5f5;cursor:not-allowed}
        .box{background:#f1f7fb;border-radius:10px;padding:12px 14px;margin:12px 0}
        .status{font-size:.91rem;margin:12px 0;min-height:22px}
        .status.error{color:#9b281e}.status.success{color:#206b38}
        .extra{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding:9px 0}
        .extra input{width:72px}.price{font-size:1.15rem;font-weight:700}
        .lines{list-style:none;padding:0;margin:8px 0}.lines li{display:flex;justify-content:space-between;gap:20px;padding:4px 0}
        .checkout{margin-top:14px;border-top:1px solid var(--line);padding-top:16px}
        .hidden{display:none!important}.partner{font-size:.82rem;font-weight:700;letter-spacing:.02em;color:var(--accent)}
        a{color:var(--accent);text-decoration:underline;overflow-wrap:anywhere}
        @media(max-width:520px){.fields{grid-template-columns:1fr}.card{padding:14px}.actions button{width:100%}}
      </style>
      <section class="card" aria-label="VOY PRO partner booking">
        <div class="partner">VOY PRO · Partner booking</div>
        <h2>Book your Budapest EZRaider tour</h2>
        <p class="muted">Choose your experience and see your partner price. VOY PRO handles booking confirmations; some departure requests need staff approval.</p>
        <form id="search">
          <div class="fields">
            <label>Tour <select name="experience" required><option value="">Loading tours…</option></select></label>
            <label>Date <input name="date" type="date" required></label>
            <label>Independent riders (16+) <input name="riders" type="number" min="1" max="12" value="2" required></label>
            <label>Child passengers (3–15) <input name="children" type="number" min="0" max="12" value="0" required></label>
            <label>Baby passengers (1–2) <input name="babies" type="number" min="0" max="12" value="0" required></label>
            <label>Requested guiding language <select name="language" required aria-required="true" aria-describedby="voy-partner-guide-language-help" disabled><option value="">Choose guiding language</option></select><small class="hint" id="voy-partner-guide-language-help">Choose the language you would like for your tour. No language is selected automatically. Our team will verify that an assigned guide can provide it; it is not confirmed simply by selecting it.</small></label>
          </div>
          <label id="englishAltRow" class="hidden">If guiding in <span id="englishAltPreferred">your chosen language</span> is unavailable, would English also be comfortable for your entire group?
            <select name="englishAlternative" aria-describedby="englishAltHelp" disabled>
              <option value="">No answer (optional)</option>
              <option value="yes">Yes, English is also fine</option>
              <option value="no">No, requested language only</option>
            </select>
            <small id="englishAltHelp" class="hint">Your requested guiding language remains unchanged. VOY PRO must verify any possible alternative.</small>
          </label>
          <label class="check"><input name="private" type="checkbox"> Private tour (additional charge)</label>
          <div class="actions"><button type="submit" id="searchButton">Check availability</button></div>
        </form>
        <section id="results" class="hidden" aria-label="Available departures">
          <h3>Available times</h3><div id="slots" class="slots"></div>
          <p class="hint">Some departure times require staff confirmation. Requests are not bookings, do not reserve a place, and do not collect payment.</p>
        </section>
        <section id="checkout" class="checkout hidden" aria-label="Complete your booking">
          <h3>Your price and options</h3>
          <div id="extras"></div>
          <div id="price" class="box" aria-live="polite"></div>
          <form id="customer">
            <div class="fields">
              <label>Full name <input name="name" autocomplete="name" maxlength="150" required></label>
              <label>Email <input name="email" type="email" autocomplete="email" maxlength="200" required></label>
              <label>Phone with country code <input name="phone" type="tel" autocomplete="tel" maxlength="35" required></label>
              <label>Payment method <select name="payment" required>
                <option value="pay_arrival_card">Card on arrival</option>
                <option value="pay_arrival_cash">Cash on arrival</option>
              </select></label>
            </div>
            <label class="check"><input type="checkbox" name="terms" required> I accept VOY PRO's <a href="https://voy-pro.com/legal/terms/" target="_blank" rel="noopener noreferrer">Terms</a> and acknowledge the <a href="https://voy-pro.com/legal/privacy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</label>
            <p class="hint" id="holdExpiry"></p>
            <div class="actions">
              <button type="submit" id="confirmButton">Confirm booking</button>
              <button class="secondary" type="button" id="changeButton">Change selection</button>
            </div>
          </form>
        </section>
        <section id="success" class="box hidden" role="status" aria-live="polite"></section>
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <p class="hint">Booking, customer information and payment processing are handled by VOY PRO.</p>
      </section>`;
    const $=(selector)=>root.querySelector(selector);
    const form=$('#search'),customer=$('#customer'),status=$('#status');
    const experienceSelect=form.elements.experience;
    const dateField=form.elements.date;
    const languageSelect=form.elements.language;
    const englishAltSelect=form.elements.englishAlternative;
    const languageNames={en:'English',he:'Hebrew',hu:'Hungarian',es:'Spanish',pt:'Portuguese'};
    const guideLabel=()=>languageNames[selectedGuideLanguage()]||
      String(selectedGuideLanguage()||'').toUpperCase();
    // The shared Budapest catalog is authoritative for guiding languages.
    // Do not infer from the partner page's language, or silently accept NULL.
    function selectedGuideLanguage(){
      const code=String(languageSelect.value||'').trim().toLowerCase();
      const product=experiences.find(x=>x.id===experienceSelect.value);
      const offered=Array.isArray(product?.guideLanguages)?product.guideLanguages:[];
      return code&&offered.some(value=>String(value).toLowerCase()===code)?code:null;
    }
    function englishAlternativeAccepted(){
      if(!ENGLISH_ALT_PILOT_ENABLED||!selectedGuideLanguage()||
        selectedGuideLanguage()==='en')return null;
      return englishAltSelect.value==='yes'?true:
        englishAltSelect.value==='no'?false:null;
    }
    const englishAltFields=()=>ENGLISH_ALT_PILOT_ENABLED&&selectedGuideLanguage()!=='en'
      ?{english_alternative_accepted:englishAlternativeAccepted()}:{};
    function refreshEnglishAlternative(){
      const lang=selectedGuideLanguage();
      const shown=ENGLISH_ALT_PILOT_ENABLED&&Boolean(lang)&&lang!=='en';
      $('#englishAltRow').classList[shown?'remove':'add']('hidden');
      englishAltSelect.disabled=!shown;
      $('#englishAltPreferred').textContent=languageNames[lang]||'your chosen language';
      if(!shown)englishAltSelect.value='';
    }
    function requireSelectedGuideLanguage(){
      if(selectedGuideLanguage())return true;
      setStatus('Choose a guiding language offered for this tour before checking availability.','error');
      languageSelect.focus();
      return false;
    }
    // A WordPress partner tab can stay open overnight. Refresh local Budapest
    // date limits at each search; never silently change the guest's selected
    // date or invent a booking horizon when destination configuration is absent.
    let bookingHorizonDays=null;
    const refreshBookingDateBounds=()=>{
      const budapestToday=todayBudapest();
      dateField.min=budapestToday;
      if(Number.isSafeInteger(bookingHorizonDays)&&bookingHorizonDays>0){
        const end=new Date(budapestToday+'T12:00:00Z');
        end.setUTCDate(end.getUTCDate()+bookingHorizonDays);
        if(Number.isFinite(end.getTime()))dateField.max=end.toISOString().slice(0,10);
        else dateField.max='';
      }else dateField.max='';
      return budapestToday;
    };
    dateField.value=refreshBookingDateBounds();
    // Opening an old WordPress tab's calendar must show the current local
    // range before the guest selects a date, not only on availability search.
    dateField.addEventListener('focus',refreshBookingDateBounds);
    // FBM owns the Budapest booking horizon, including its day-to-day shift.
    const applyDestinationHorizon=(destination)=>{
      const days=destination?.booking_horizon_days;
      if(!Number.isSafeInteger(days)||days<=0)return;
      bookingHorizonDays=days;
      refreshBookingDateBounds();
    };
    let experiences=[],chosenSlot=null,hold=null,quote=null,offers=[],extras=[],generation=0,loading=false;
    let offerWarning=false;
    let retryKey=null,submittedIntent=null,expiryTimer=null,readyForOnline=false;
    let submissionLock=null;
    const selectedExtras=new Map();
    // A retry with an existing idempotency key must repeat the exact same
    // commercial request. The first POST might have committed despite an
    // upstream error, so never reuse its key with changed customer/price data.
    const keepOriginalRetryIntent=(endpoint,payload)=>{
      const intent=JSON.stringify({endpoint,payload});
      if(submittedIntent!==null&&submittedIntent!==intent){
        setStatus('Booking details changed after the previous submission. To avoid a duplicate or mismatched booking, restore the original details or contact VOY PRO before making another attempt.','error');
        return false;
      }
      submittedIntent=intent;
      return true;
    };
    const setStatus=(message='',kind='')=>{status.textContent=message;status.className='status '+kind;};
    const setBusy=(value)=>{
      loading=value;
      $('#searchButton').disabled=Boolean(value||submissionLock);
      $('#confirmButton').disabled=Boolean(value||submissionLock||
        (!requiresStaffRequest()&&!quote));
    };
    // Final POST can succeed after the user changes an in-flight selection.
    // Freeze the original intent until the server responds, preserving previous
    // disabled states (e.g. a tour without private booking).
    const lockFinalSubmission=()=>{
      if(submissionLock)return;
      const controls=[...form.querySelectorAll('input,select'),
        ...customer.querySelectorAll('input,select'),
        ...$('#extras').querySelectorAll('input,select'),$('#changeButton')];
      submissionLock=controls.map(control=>[control,control.disabled]);
      controls.forEach(control=>{control.disabled=true;});
    };
    const unlockFinalSubmission=()=>{
      if(!submissionLock)return;
      const locked=submissionLock;submissionLock=null;
      locked.forEach(([control,disabled])=>{control.disabled=disabled;});
    };
    // An attempted commercial POST may have committed even when the response
    // was 503/network failure. Permit only the exact same-key retry; never
    // release the possibly converted hold or start a second departure.
    const freezeNewSelectionAfterSubmission=()=>{
      if(submittedIntent===null)return;
      const controls=[...form.querySelectorAll('input,select'),
        ...$('#extras').querySelectorAll('input,select'),
        ...$('#slots').querySelectorAll('button'),
        $('#searchButton'),$('#changeButton')];
      controls.forEach(control=>{control.disabled=true;});
    };
    const textNode=(name,value)=>{const el=document.createElement(name);el.textContent=String(value);return el;};
    const composition=()=>({
      riders_16_plus:Number(form.elements.riders.value),
      child_passengers_3_15:Number(form.elements.children.value),
      baby_passengers_1_2:Number(form.elements.babies.value),
      request_15yo_independent_assessment:false,
    });
    const isPrivate=()=>form.elements.private.checked;
    const requiresStaffRequest=()=>Boolean(
      chosenSlot?.requestable&&!chosenSlot?.sellable&&!isPrivate()
    );
    async function api(path,{method='GET',body,headers={}}={}){
      const response=await fetch(apiRoot+'/api/v1'+path,{
        method,mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',
        headers:{'x-voy-client-key':clientKey,...(body?{'content-type':'application/json'}:{}),...headers},
        ...(body?{body:JSON.stringify(body)}:{}),
      });
      const result=response.status===204?null:await response.json().catch(()=>null);
      if(!response.ok)throw new Error(result?.error||result?.message||'Booking service unavailable ('+response.status+').');
      return result;
    }
    const offerPrice=(item)=>money(item.price_minor/100,item.currency);
    // FBM is the source of truth for optional extras. An incomplete/invalid
    // ancillary record must never appear as a free item or an unlimited
    // quantity. Valid offers still work; unverified rows are not selectable.
    const verifyAvailableOffers=(raw,currency)=>{
      if(!Array.isArray(raw))return {items:[],hadInvalid:true};
      const seen=new Set();
      let hadInvalid=false;
      const items=raw.filter(item=>{
        const valid=item&&typeof item==='object'&&
          typeof item.product_id==='string'&&item.product_id.trim().length>0&&
          !seen.has(item.product_id)&&
          typeof item.name==='string'&&item.name.trim().length>0&&
          Number.isSafeInteger(item.price_minor)&&item.price_minor>=0&&
          typeof item.currency==='string'&&item.currency===currency&&
          (item.max_per_booking==null||
            (Number.isSafeInteger(item.max_per_booking)&&item.max_per_booking>0))&&
          (item.available_quantity==null||
            (Number.isSafeInteger(item.available_quantity)&&item.available_quantity>=0));
        if(!valid){hadInvalid=true;return false;}
        seen.add(item.product_id);
        return true;
      });
      return {items,hadInvalid};
    };
    // Departure schedules can cross their start time while a partner is
    // looking at an availability result. The backend remains authoritative,
    // but an already-started (or malformed) timestamp must not be actionable.
    const expiredDeparture=(slot)=>{
      if(!slot?.starts_at)return false;
      const start=new Date(slot.starts_at).getTime();
      return !Number.isFinite(start)||start<=Date.now();
    };
    function invalidate(){
      if(submissionLock)return;
      if(submittedIntent!==null){
        freezeNewSelectionAfterSubmission();
        setStatus('A previous booking or staff request may already have been received. Retry only the same request or contact VOY PRO before changing your selection.','error');
        return;
      }
      generation++;
      if(expiryTimer)clearInterval(expiryTimer);
      expiryTimer=null;
      const old=hold;
      hold=null;quote=null;chosenSlot=null;extras=[];offers=[];offerWarning=false;retryKey=null;submittedIntent=null;
      selectedExtras.clear();setBusy(false);
      $('#results').classList.add('hidden');$('#checkout').classList.add('hidden');
      $('#slots').replaceChildren();$('#extras').replaceChildren();$('#price').replaceChildren();
      if(old?.id)api('/holds/'+encodeURIComponent(old.id),{method:'DELETE'}).catch(()=>{});
    }
    // The public FBM quote contract requires monetary totals and ISO
    // currency. A missing/invalid amount must never be rendered as €0.00
    // or treated as an accepted final price for booking.
    function requireVerifiableQuote(candidate){
      const quoteDeadline=typeof candidate?.expiresAt==='string'
        ?Date.parse(candidate.expiresAt):NaN;
      if(!candidate||typeof candidate.total!=='number'||
        !Number.isFinite(candidate.total)||candidate.total<0||
        typeof candidate.discount!=='number'||!Number.isFinite(candidate.discount)||
        candidate.discount<0||typeof candidate.currency!=='string'||
        !/^[A-Z]{3}$/.test(candidate.currency)||!Array.isArray(candidate.lines)||
        !Number.isFinite(quoteDeadline)||quoteDeadline<=Date.now())
        throw new Error('The booking price could not be verified. Please check your selection or contact VOY PRO.');
      return candidate;
    }
    function renderQuote(){
      if(!quote)return;
      const parent=$('#price');parent.replaceChildren();
      parent.appendChild(textNode('div','Your partner price'));
      const list=document.createElement('ul');list.className='lines';
      for(const line of quote.lines||[]){
        const li=document.createElement('li');
        const label=textNode('span',line.label||line.type||'Item');
        const amount=textNode('strong',money(Number(line.line_total_minor||0)/100,quote.currency||'EUR'));
        li.append(label,amount);list.appendChild(li);
      }
      parent.appendChild(list);
      parent.appendChild(textNode('div','Partner discount: '+money(quote.discount,quote.currency||'EUR')));
      const p=textNode('p','Total: '+money(quote.total,quote.currency||'EUR'));p.className='price';parent.appendChild(p);
    }
    async function refreshQuote({preserveGeneration=false}={}){
      if(!chosenSlot)return;
      const version=preserveGeneration?generation:++generation;
      setBusy(true);
      try{
        const updated=await api('/quotes',{method:'POST',body:{
          slot_id:chosenSlot.id,group_composition:composition(),is_private:isPrivate(),
          ...(isPrivate()&&hold?.id?{hold_id:hold.id}:{}),
          extras,promo_code:affiliate,
        }});
        if(version!==generation)return;
        if(String(updated.promo_code_applied||'').toUpperCase()!==affiliate)
          throw new Error('Partner attribution could not be verified. Please contact VOY PRO.');
        quote=requireVerifiableQuote(updated);renderQuote();setStatus('');
      }catch(error){
        if(version===generation){quote=null;$('#price').replaceChildren();setStatus(error.message,'error');}
      }finally{if(version===generation)setBusy(false);}
    }
    function renderOffers(){
      const panel=$('#extras');panel.replaceChildren();
      if(offerWarning){
        const warning=textNode('p','Some optional extras could not be verified and are not displayed. VOY PRO calculates your final booking price.');
        warning.className='hint';
        warning.setAttribute('role','status');
        panel.appendChild(warning);
      }
      if(!offers.length)return;
      panel.appendChild(textNode('h3','Optional extras'));
      for(const offer of offers){
        const wrap=document.createElement('label');wrap.className='extra';
        const info=textNode('span',offer.name+' · '+offerPrice(offer));
        const qty=document.createElement('input');
        qty.type='number';qty.min='0';
        qty.max=String(Math.max(0,Math.min(12,Number(offer.max_per_booking??12),Number(offer.available_quantity??12))));
        qty.value='0';qty.setAttribute('aria-label',offer.name+' quantity');
        qty.addEventListener('change',()=>{
          if(submittedIntent!==null){
            qty.value=String(selectedExtras.get(offer.product_id)||0);
            freezeNewSelectionAfterSubmission();
            setStatus('A previous booking attempt may already have been received. Do not change paid extras before checking with VOY PRO.','error');
            return;
          }
          if(submissionLock){
            qty.value=String(selectedExtras.get(offer.product_id)||0);
            return;
          }
          const quantity=Number(qty.value);
          if(qty.value.trim()===''||!Number.isInteger(quantity)||quantity<0||quantity>Number(qty.max)){
            setStatus('Please enter a valid quantity.','error');qty.value=String(selectedExtras.get(offer.product_id)||0);return;
          }
          selectedExtras.set(offer.product_id,quantity);
          extras=offers.map(o=>({product_id:o.product_id,quantity:selectedExtras.get(o.product_id)||0}))
            .filter(x=>x.quantity>0);
          return refreshQuote();
        });
        qty.dataset.productId=offer.product_id;
        wrap.append(info,qty);panel.appendChild(wrap);
      }
    }
    async function releaseHold(){
      if(!hold)return;
      const current=hold;hold=null;
      if(expiryTimer)clearInterval(expiryTimer);
      expiryTimer=null;
      if(current.id)await api('/holds/'+encodeURIComponent(current.id),{method:'DELETE'}).catch(()=>{});
    }
    function watchExpiry(){
      if(expiryTimer)clearInterval(expiryTimer);
      expiryTimer=setInterval(()=>{
        if(!hold)return;
        const seconds=Math.max(0,Math.floor((new Date(hold.expires_at).getTime()-Date.now())/1000));
        if(seconds===0&&submissionLock){
          // Do not discard a server response already in flight: it may contain
          // a confirmed booking even after the local hold deadline passes.
          $('#holdExpiry').textContent='Hold time reached; awaiting your booking confirmation.';
          return;
        }
        $('#holdExpiry').textContent=seconds?'Your booking is held for '+Math.ceil(seconds/60)+' more minute(s).':'Your hold has expired; please choose a time again.';
        if(seconds===0){
          ++generation;
          quote=null;hold=null;$('#confirmButton').disabled=true;$('#checkout').classList.add('hidden');
          setStatus('This hold has expired. Please check availability again.','error');
          clearInterval(expiryTimer);expiryTimer=null;
        }
      },1000);
    }
    async function selectSlot(slot){
      if(submittedIntent!==null){
        freezeNewSelectionAfterSubmission();
        setStatus('Your previous request may already be recorded. Retry the identical request or contact VOY PRO before choosing another departure.','error');
        return;
      }
      if(loading||!requireSelectedGuideLanguage())return;
      // Choosing a different departure must also discard extras from the
      // previous hold. The re-rendered quantities start at zero; retaining the
      // old payload would silently book extras no longer shown to the guest.
      setBusy(true);
      const version=++generation;
      await releaseHold();
      // Network cleanup can take time. If tour, guide language or party size
      // changed while deleting the prior hold, do not revive the stale slot.
      if(version!==generation)return;
      selectedExtras.clear();extras=[];offers=[];offerWarning=false;
      chosenSlot=slot;
      $('#checkout').classList.add('hidden');
      $('#extras').replaceChildren();$('#price').replaceChildren();
      setStatus('Checking your partner discount…');
      try{
        const promo=await api('/promotions/validate',{method:'POST',body:{code:affiliate,slot_id:slot.id}});
        if(version!==generation)return;
        if(!promo.valid||String(promo.code||'').toUpperCase()!==affiliate)
          throw new Error('This partner code is not currently valid for the selected tour.');
        if(slot.requestable&&!slot.sellable){
          // Non-private groups needing staff/extra vehicles enter the existing
          // canonical Request to Book workflow. Never create a hold or claim
          // final availability, price, payment or confirmation here.
          if(isPrivate())throw new Error('Private confirmations need direct help from VOY PRO.');
          quote=null;offers=[];extras=[];offerWarning=false;renderOffers();
          $('#price').replaceChildren(
            textNode('p','Staff will confirm the available equipment and your affiliate-adjusted final price before booking.')
          );
          $('#holdExpiry').textContent='No place is reserved and no payment is collected for this request.';
          $('#confirmButton').textContent='Send confirmation request';
          customer.elements.payment.disabled=true;
          $('#checkout').classList.remove('hidden');
          setStatus('Approval needed: the request is not yet a confirmed booking.');
          $('#checkout').scrollIntoView({behavior:'smooth',block:'nearest'});
          return;
        }
        $('#confirmButton').textContent='Confirm booking';
        customer.elements.payment.disabled=false;
        const initialQuote=await api('/quotes',{method:'POST',body:{
          slot_id:slot.id,group_composition:composition(),is_private:isPrivate(),extras:[],promo_code:affiliate,
        }});
        if(version!==generation)return;
        quote=requireVerifiableQuote(initialQuote);
        if(String(quote.promo_code_applied||'').toUpperCase()!==affiliate)
          throw new Error('The booking price was not attributed to your partner.');
        const held=await api('/holds',{method:'POST',body:{
          slot_id:slot.id,group_composition:composition(),is_private:isPrivate(),
          guide_language:selectedGuideLanguage(),
          ...englishAltFields(),
        }});
        if(version!==generation){await api('/holds/'+encodeURIComponent(held.id),{method:'DELETE'}).catch(()=>{});return;}
        hold=held;
        const expiresAt=new Date(held?.expires_at).getTime();
        // FBM may allocate a different physical departure under the shared
        // inventory policy. requested_slot_id, not departure_id, must match
        // the customer's selected slot; preserve the original guide-language
        // preference rather than silently accepting a lost/mismatched request.
        if(typeof held?.id!=='string'||!held.id.trim()||
          typeof held?.requested_slot_id!=='string'||held.requested_slot_id!==slot.id||
          typeof held?.departure_id!=='string'||!held.departure_id.trim()||
          String(held?.guide_language||'').trim().toLowerCase()!==selectedGuideLanguage()||
          (ENGLISH_ALT_PILOT_ENABLED&&
            held?.english_alternative_accepted!==englishAlternativeAccepted())||
          !Number.isFinite(expiresAt)||expiresAt<=Date.now())
          throw new Error('The booking hold could not be verified. Please choose another departure.');
        if(held.requires_staff_confirmation)throw new Error('This departure requires staff confirmation.');
        // Empty offer list means "none available". A failed request is
        // different: surface a warning instead of silently hiding upsells.
        const rawOffers=await api('/ancillary/offers',{method:'POST',body:{slot_id:held.departure_id||slot.id}}).catch(()=>null);
        if(version!==generation)return;
        const verifiedOffers=verifyAvailableOffers(rawOffers,quote.currency);
        offers=verifiedOffers.items;
        offerWarning=verifiedOffers.hadInvalid;
        renderOffers();
        if(isPrivate())await refreshQuote({preserveGeneration:true});else renderQuote();
        if(version!==generation)return;
        if(!quote)throw new Error('The held private price could not be confirmed.');
        $('#checkout').classList.remove('hidden');
        setStatus('Your partner discount has been applied.','success');
        watchExpiry();
        $('#checkout').scrollIntoView({behavior:'smooth',block:'nearest'});
      }catch(error){
        if(version===generation){setStatus(error.message||'Could not reserve this departure.','error');await releaseHold();quote=null;}
      }finally{if(version===generation)setBusy(false);}
    }
    async function loadAvailability(event){
      event.preventDefault();
      if(submittedIntent!==null){
        freezeNewSelectionAfterSubmission();
        setStatus('The previous submission may already have been received. Please retry the original request or contact VOY PRO before searching again.','error');
        return;
      }
      if(loading||!requireSelectedGuideLanguage())return;
      const today=refreshBookingDateBounds();
      invalidate();
      if(dateField.value&&dateField.value<today){
        setStatus('Your selected date is now in the past in Budapest. Choose a new date and check availability again.','error');
        dateField.focus();
        return;
      }
      const version=generation;
      const exp=experiences.find(x=>x.id===experienceSelect.value);
      const c=composition();
      if(!exp||!/^\d{4}-\d{2}-\d{2}$/.test(dateField.value)||dateField.value<today||
        (dateField.max&&dateField.value>dateField.max)||
        !Number.isInteger(c.riders_16_plus)||c.riders_16_plus<1||
        c.riders_16_plus>Number(exp.maxIndependentRiders||12)||
        ![c.child_passengers_3_15,c.baby_passengers_1_2].every(v=>Number.isInteger(v)&&v>=0&&v<=12)||
        isPrivate()&&(!exp.privateAllowed||c.riders_16_plus<Number(exp.privateMinRiders||2))){
        setStatus('Check the date, group size and private tour requirements.','error');return;
      }
      setBusy(true);setStatus('Checking live availability…');
      try{
        const query=new URLSearchParams({
          date:dateField.value,riders_16_plus:String(c.riders_16_plus),
          child_passengers_3_15:String(c.child_passengers_3_15),
          baby_passengers_1_2:String(c.baby_passengers_1_2),
          is_private:String(isPrivate()),
          // Request preference only. FBM availability does not yet attest
          // staff language coverage; booking/dispatch remains authoritative.
          guide_language:selectedGuideLanguage(),
        });
        const avail=await api('/experiences/'+encodeURIComponent(exp.id)+'/availability?'+query.toString());
        if(version!==generation)return;
        // A 200 response may still be stale, routed to a different product,
        // or carry a different group/private composition. Check the exact
        // canonical FBM availability response BEFORE presenting any slot.
        const returnedGroup=avail?.group_composition;
        const matchingGroup=returnedGroup&&typeof returnedGroup==='object'&&
          ['riders_16_plus','child_passengers_3_15','baby_passengers_1_2'].every(
            k=>Number.isSafeInteger(returnedGroup[k])&&returnedGroup[k]===c[k])&&
          returnedGroup.request_15yo_independent_assessment===false;
        const expectedPrivate=isPrivate();
        const validSlots=Array.isArray(avail?.slots)&&(()=>{
          const seen=new Set();
          return avail.slots.every(slot=>{
            if(!slot||typeof slot!=='object'||
               typeof slot.id!=='string'||!slot.id.trim()||seen.has(slot.id)||
               typeof slot.time!=='string'||!slot.time.trim()||
               typeof slot.sellable!=='boolean'||typeof slot.requestable!=='boolean'||
               slot.is_private!==expectedPrivate)return false;
            seen.add(slot.id);
            return true;
          });
        })();
        if(avail?.experience_id!==exp.id||avail?.date!==dateField.value||
           typeof avail?.is_private!=='boolean'||avail.is_private!==expectedPrivate||
           !matchingGroup||!Number.isSafeInteger(avail.party_size)||
           avail.party_size!==c.riders_16_plus+
             c.child_passengers_3_15+c.baby_passengers_1_2||!validSlots){
          throw new Error('The booking availability details could not be verified. Please check the selected tour, date and group again.');
        }
        $('#results').classList.remove('hidden');
        const panel=$('#slots');panel.replaceChildren();
        let sellable=0;
        for(const slot of avail.slots||[]){
          if(expiredDeparture(slot))continue;
          const button=document.createElement('button');button.type='button';
          const allowed=Boolean(slot.sellable);
          const canRequest=Boolean(slot.requestable&&!allowed&&!isPrivate());
          button.textContent=String(slot.time||'Time')+(!allowed?' · '+(canRequest?'Request staff confirmation':slot.requestable?'Contact us for private confirmation':'Unavailable'):'');
          button.disabled=!allowed&&!canRequest;
          button.className=allowed||canRequest?'':'unavailable';
          button.setAttribute('aria-pressed','false');
          button.addEventListener('click',()=>{
            if(expiredDeparture(slot)){
              invalidate();
              setStatus('This departure is no longer available. Please check availability again.','error');
              return;
            }
            for(const node of panel.querySelectorAll('button'))node.setAttribute('aria-pressed','false');
            button.setAttribute('aria-pressed','true');return selectSlot(slot);
          });
          if(allowed||canRequest)sellable++;
          panel.appendChild(button);
        }
        if(!sellable)panel.appendChild(textNode('p','No instant-bookable or staff-requestable departures for this selection.'));
        setStatus(sellable?'Choose a departure time. Requests needing staff approval are not confirmed bookings.':'Try another date or group size.');
      }catch(error){if(version===generation)setStatus(error.message||'Could not retrieve departures.','error');}
      finally{if(version===generation)setBusy(false);}
    }
    async function confirm(event){
      event.preventDefault();
      if(!requireSelectedGuideLanguage())return;
      const staffRequest=requiresStaffRequest();
      if(loading||!chosenSlot||(!staffRequest&&(!hold||!quote)))return;
      // A departure can start after availability was loaded and after the
      // guest opened checkout. Check again at the last actionable moment,
      // for both booked departures and staff-review requests.
      if(expiredDeparture(chosenSlot)){
        invalidate();
        setStatus('This departure has already started. Choose a future departure and check availability again.','error');
        return;
      }
      if(!staffRequest&&new Date(hold.expires_at).getTime()<=Date.now()){
        setStatus('Your hold expired. Please check availability again.','error');return;
      }
      if(!staffRequest&&
        (!Number.isFinite(Date.parse(String(quote.expiresAt||'')))||
          Date.parse(String(quote.expiresAt||''))<=Date.now())){
        // A previous final POST may already have committed despite a 503.
        // After its quote expires, do NOT suggest a fresh booking or delete
        // the hold, which may have been converted by the original request.
        if(submittedIntent!==null){
          showPreviouslySubmittedQuoteExpiredResponse();
          return;
        }
        // FBM issues separate quote and hold deadlines. A valid hold does not
        // authorize silently submitting a quote that has already expired.
        quote=null;chosenSlot=null;
        $('#checkout').classList.add('hidden');
        setBusy(true);
        await releaseHold();
        setBusy(false);
        setStatus('Your quoted price expired. Choose a departure again to get a fresh price.','error');
        return;
      }
      const name=String(customer.elements.name.value||'').trim();
      const email=String(customer.elements.email.value||'').trim();
      const phone=String(customer.elements.phone.value||'').trim();
      if(!name||!email||!phone||!customer.elements.terms.checked)return;
      const method=customer.elements.payment.value;
      if(!staffRequest&&method==='pay_now_card'&&!readyForOnline)return;
      if(!staffRequest&&!['pay_arrival_card','pay_arrival_cash','pay_now_card'].includes(method))return;
      if(staffRequest){
        const requestBody={
          slot_id:chosenSlot.id,group_composition:composition(),
          is_private:false,guide_language:selectedGuideLanguage(),
          ...englishAltFields(),
          promo_code:affiliate,
          customer:{full_name:name,email,phone,preferred_language:'en'},
        };
        if(!keepOriginalRetryIntent('/booking-capacity-requests',requestBody))return;
        if(!retryKey)retryKey=crypto.randomUUID();
        const version=generation;
        let completed=false;
        lockFinalSubmission();setBusy(true);setStatus('Sending your staff-confirmation request…');
        try{
          const request=await api('/booking-capacity-requests',{
            method:'POST',headers:{'idempotency-key':retryKey},body:requestBody,
          });
          if(version!==generation)return;
          // A 2xx response with no verifiable pending reference may still
          // represent a saved staff request. Do not retry or fabricate success.
          if(request?.type!=='booking_capacity_request'||request?.status!=='pending'||
            typeof request?.reference!=='string'||!request.reference.trim()){
            showUnverifiedStaffRequestResponse();
            completed=true;
            return;
          }
          // FBM might persist a staff request with a different or missing
          // guiding language; keep the reference for human reconciliation.
          if(String(request.guide_language||'').trim().toLowerCase()!==selectedGuideLanguage()){
            showGuideLanguageReviewResponse(request);
            completed=true;
            return;
          }
          if(ENGLISH_ALT_PILOT_ENABLED&&
             request.english_alternative_accepted!==englishAlternativeAccepted()){
            showEnglishAlternativeReviewResponse(request);
            completed=true;
            return;
          }
          // An accepted staff request still has no fixed final price.
          // But the FBM response must preserve this partner coupon in its
          // server-calculated pricing attribution.
          if(String(request.pricing?.promo_code_applied||'').trim().toUpperCase()!==affiliate){
            showStaffAffiliateAttributionReviewResponse(request);
            completed=true;
            return;
          }
          showRequestSuccess(request.reference);
          completed=true;
        }catch(error){
          if(version===generation)setStatus(error.message||'Request could not be submitted. Please retry.','error');
        }finally{
          if(version===generation){
            if(!completed)unlockFinalSubmission();
            setBusy(false);
            if(!completed)freezeNewSelectionAfterSubmission();
          }
        }
        return;
      }
      const submission={
        hold_id:hold.id,
        promo_code:affiliate,
        extras,
        customer:{full_name:name,email,phone,preferred_language:'en'},
      };
      const online=method==='pay_now_card';
      const endpoint=online?'/payments/intents':'/bookings';
      const finalBody=online
        ?{...submission,payment_type:'online',payment_method:'pay_now_card'}
        :{...submission,payment_method:method};
      if(!keepOriginalRetryIntent(endpoint,finalBody))return;
      if(!retryKey)retryKey=crypto.randomUUID();
      const version=generation;
      let completed=false;
      lockFinalSubmission();setBusy(true);setStatus('Confirming your booking securely…');
      try{
        if(online){
          const pay=await api('/payments/intents',{method:'POST',headers:{'idempotency-key':retryKey},
            body:finalBody});
          if(version!==generation)return;
          const referenceOk=typeof pay?.booking_reference==='string'&&
            Boolean(pay.booking_reference.trim());
          const bookingIdOk=typeof pay?.booking_id==='string'&&
            Boolean(pay.booking_id.trim());
          // Both FBM payment-intent branches have a canonical online-card
          // identity. Never confuse a stale/mixed payment method with an
          // authenticated online checkout or a completed charge.
          const paymentContractOk=typeof pay?.id==='string'&&
            Boolean(pay.id.trim())&&pay.payment_type==='online'&&
            pay.payment_method==='pay_now_card';
          if(pay?.status==='completed'){
            // A replay may represent a real charge. Never invent a receipt or
            // submit again if its booking identity cannot be verified.
            if(!referenceOk||!bookingIdOk||!paymentContractOk||
               pay.ui_mode!=='none'||pay.amount!==0||
               pay.currency!==quote.currency){
              showUnverifiedOnlinePaymentResponse(pay);
              completed=true;
              return;
            }
            showSuccess(pay.booking_reference,'Payment confirmed',null);
            completed=true;
            return;
          }
          const quoteMatches=typeof pay?.amount==='number'&&
            Number.isFinite(pay.amount)&&
            Math.round(pay.amount*100)===Math.round(quote.total*100)&&
            pay.currency===quote.currency;
          let address;
          try{address=new URL(pay?.checkout_url||'',location.href);}catch{}
          const redirectExpiry=new Date(pay?.expires_at).getTime();
          const checkoutRecordOk=typeof pay?.payment_link_request_id==='string'&&
            Boolean(pay.payment_link_request_id.trim())&&
            Number.isFinite(redirectExpiry)&&redirectExpiry>Date.now();
          if(pay?.status!=='requires_action'||pay?.ui_mode!=='redirect'||
             !referenceOk||!bookingIdOk||!paymentContractOk||
             !quoteMatches||!checkoutRecordOk||
             address?.protocol!=='https:'||address?.hostname!=='checkout.stripe.com'||
             address.username!==''||address.password!==''||address.port!==''){
            // FBM may have prepared a booking/session even though the
            // redirect is unsafe. Keep the original result for staff review;
            // do not release the hold or start another payment attempt.
            showUnverifiedOnlinePaymentResponse(pay);
            completed=true;
            return;
          }
          // Stripe is the only allowed external checkout. No payment card
          // details are ever collected in the partner page or this widget.
          completed=true;
          location.assign(address.href);
          return;
        }
        const booking=await api('/bookings',{method:'POST',headers:{'idempotency-key':retryKey},
          body:finalBody});
        if(version!==generation)return;
        // HTTP 2xx alone is not a verified booking. FBM's canonical public
        // booking contract requires a non-empty reference and status. When
        // either is missing, the server may still have committed a booking:
        // never invent a receipt or offer another unverified final POST.
        if(typeof booking?.reference!=='string'||!booking.reference.trim()||
          typeof booking?.status!=='string'||!booking.status.trim()){
          showUnverifiedBookingResponse();
          completed=true;
          return;
        }
        // A successful booking may still have an unexpected final price
        // or an omitted affiliate attribution. The server may already have
        // committed it, so show its reference and require staff reconciliation
        // instead of claiming the partner's quoted price was honored or retrying.
        const sameMoney=(actual,expected)=>typeof actual==='number'&&
          Number.isFinite(actual)&&Math.round(actual*100)===Math.round(expected*100);
        if(!sameMoney(booking.total,quote.total)||
          !sameMoney(booking.discount,quote.discount)||
          booking.currency!==quote.currency||
          String(booking.promo_code_applied||'').trim().toUpperCase()!==affiliate){
          showAffiliatePriceReviewResponse(booking);
          completed=true;
          return;
        }
        // The public FBM contract permits arbitrary non-empty status strings.
        // A cancelled/refunded/unknown reply must not be presented as a
        // successful tour booking, even when HTTP 2xx and prices match.
        // A booking may already exist: retain its reference and lock retries.
        if(!['confirmed','paid','partially_paid'].includes(booking.status)){
          showUnexpectedBookingStatusResponse(booking);
          completed=true;
          return;
        }
        // A verified booking must preserve the explicit language choice;
        // never silently accept a null or different persisted language.
        if(String(booking.guide_language||'').trim().toLowerCase()!==selectedGuideLanguage()){
          showGuideLanguageReviewResponse(booking);
          completed=true;
          return;
        }
        if(ENGLISH_ALT_PILOT_ENABLED&&
           booking.english_alternative_accepted!==englishAlternativeAccepted()){
          showEnglishAlternativeReviewResponse(booking);
          completed=true;
          return;
        }
        // The hold is server-authoritative and may be reallocated to another
        // physical departure. However the sold EXPERIENCE, selected DATE,
        // passenger composition and private mode must match the customer's
        // original contract; never accept a different product/group merely
        // because price and affiliate code match.
        const expectedGroup=composition();
        const bookedGroup=booking.group_composition;
        const sameGroup=bookedGroup&&typeof bookedGroup==='object'&&
          ['riders_16_plus','child_passengers_3_15','baby_passengers_1_2'].every(
            key=>Number.isSafeInteger(bookedGroup[key])&&
              bookedGroup[key]===expectedGroup[key]);
        if(booking.experience_id!==experienceSelect.value||
          booking.selected_date!==dateField.value||
          !sameGroup||typeof booking.is_private!=='boolean'||
          booking.is_private!==isPrivate()){
          showBookedSelectionReviewResponse(booking);
          completed=true;
          return;
        }
        showSuccess(booking.reference,booking.status,booking.manage_token||booking.secure_token||null);
        completed=true;
      }catch(error){if(version===generation)setStatus(error.message||'Booking could not be confirmed. Please retry.','error');}
      finally{
        if(version===generation){
          if(!completed)unlockFinalSubmission();
          setBusy(false);
          if(!completed)freezeNewSelectionAfterSubmission();
          // A failed/ambiguous server response after the hold deadline must
          // not offer the now-invalid hold as an ordinary retry. The customer
          // may have been booked server-side, so explicitly request staff help
          // instead of silently issuing a new booking or releasing the hold.
          const expires=hold?new Date(hold.expires_at).getTime():NaN;
          if(!completed&&hold&&(!Number.isFinite(expires)||expires<=Date.now())){
            ++generation;
            if(expiryTimer)clearInterval(expiryTimer);
            expiryTimer=null;hold=null;quote=null;chosenSlot=null;
            $('#checkout').classList.add('hidden');
            $('#confirmButton').disabled=true;
            setStatus('The hold expired while confirmation was pending. The booking outcome may be uncertain. Please contact VOY PRO before trying again.','error');
          }
        }
      }
    }
    function showEnglishAlternativeReviewResponse(record){
      if(expiryTimer)clearInterval(expiryTimer);expiryTimer=null;
      // The server might already have committed a booking/staff request.
      hold=null;quote=null;chosenSlot=null;
      $('#search').classList.add('hidden');$('#results').classList.add('hidden');
      $('#checkout').classList.add('hidden');
      const box=$('#success');box.replaceChildren();box.classList.remove('hidden');
      box.append(textNode('h3','English alternative needs verification'));
      box.append(textNode('p','Reference: '+record.reference));
      box.append(textNode('p','Requested guiding language: '+guideLabel()));
      box.append(textNode('p','Your English-alternative answer could not be verified in FBM. A booking or staff request may already exist. Contact VOY PRO with this reference before submitting again.'));
      setStatus('English-alternative preference needs staff verification. Do not submit again.','error');
    }
    function showBookedSelectionReviewResponse(booking){
      if(expiryTimer)clearInterval(expiryTimer);expiryTimer=null;
      // The server may have already committed the booking. Preserve the
      // reference, never release a possibly converted hold or retry a POST.
      hold=null;quote=null;chosenSlot=null;
      $('#search').classList.add('hidden');$('#results').classList.add('hidden');
      $('#checkout').classList.add('hidden');
      const box=$('#success');box.replaceChildren();box.classList.remove('hidden');
      box.append(textNode('h3','Booking selection needs verification'));
      box.append(textNode('p','Booking reference: '+booking.reference));
      box.append(textNode('p','The tour, date or group recorded by FBM does not match your selected booking. A booking may already exist. Contact VOY PRO with this reference before trying again.'));
      setStatus('Booking details require staff verification. Do not submit again.','error');
    }
    function showGuideLanguageReviewResponse(record){
      if(expiryTimer)clearInterval(expiryTimer);expiryTimer=null;
      // FBM may already have created a booking or pending staff request.
      // Avoid a second final POST or deleting a potentially converted hold.
      hold=null;quote=null;chosenSlot=null;
      $('#search').classList.add('hidden');$('#results').classList.add('hidden');
      $('#checkout').classList.add('hidden');
      const box=$('#success');box.replaceChildren();box.classList.remove('hidden');
      box.append(textNode('h3','Guiding language needs verification'));
      box.append(textNode('p','Reference: '+record.reference));
      box.append(textNode('p','Requested guiding language: '+guideLabel()));
      box.append(textNode('p','FBM did not verify that this language was recorded for your booking or staff request. Your request may already exist. Contact VOY PRO with the reference before submitting again.'));
      setStatus('Guiding language requires staff verification. Do not submit again.','error');
    }
    function showStaffAffiliateAttributionReviewResponse(request){
      // Staff may have already received the request. Never send a second
      // request or claim the partner discount/commission was recorded.
      chosenSlot=null;quote=null;
      $('#search').classList.add('hidden');$('#results').classList.add('hidden');
      $('#checkout').classList.add('hidden');
      const box=$('#success');box.replaceChildren();box.classList.remove('hidden');
      box.append(textNode('h3','Partner attribution needs verification'));
      box.append(textNode('p','Request reference: '+request.reference));
      box.append(textNode('p','Requested guiding language: '+guideLabel()));
      box.append(textNode('p','Your request may already be with our team, but FBM did not confirm this partner offer was applied. No price or reservation is confirmed. Please contact VOY PRO with the reference before sending another request.'));
      setStatus('Partner discount attribution needs staff review. Do not submit again.','error');
    }
    function showUnverifiedStaffRequestResponse(){
      // Staff requests reserve no vehicles and collect no payment, but a
      // malformed 2xx reply can still represent a saved CRM request.
      chosenSlot=null;quote=null;
      $('#search').classList.add('hidden');$('#results').classList.add('hidden');
      $('#checkout').classList.add('hidden');
      const box=$('#success');box.replaceChildren();box.classList.remove('hidden');
      box.append(textNode('h3','Staff request status needs verification'));
      box.append(textNode('p','The service did not return a verifiable staff request reference. Your request may already have been received. Please contact VOY PRO before sending another request.'));
      setStatus('Staff request outcome is uncertain. Contact VOY PRO before retrying.','error');
    }
    function showRequestSuccess(reference){
      // A capacity request creates no customer booking, payment or hold.
      $('#search').classList.add('hidden');$('#results').classList.add('hidden');
      $('#checkout').classList.add('hidden');
      const box=$('#success');box.replaceChildren();box.classList.remove('hidden');
      box.append(textNode('h3','Your confirmation request was received'));
      box.append(textNode('p','Request reference: '+reference));
      box.append(textNode('p','Requested guiding language: '+guideLabel()));
      if(ENGLISH_ALT_PILOT_ENABLED){
        const alt=englishAlternativeAccepted();
        box.append(textNode('p','English alternative: '+(alt===true?'Accepted':alt===false?'Declined':'Not answered')));
      }
      box.append(textNode('p','This is not a confirmed booking. VOY PRO staff will review your requested time and contact you before any payment or reservation is confirmed.'));
      setStatus('Request sent for human review.','success');
    }
    function showAffiliatePriceReviewResponse(booking){
      if(expiryTimer)clearInterval(expiryTimer);expiryTimer=null;
      // Keep the server-issued reference; never DELETE a hold that may have
      // converted to a completed booking or issue a duplicate final POST.
      hold=null;quote=null;chosenSlot=null;
      $('#search').classList.add('hidden');$('#results').classList.add('hidden');
      $('#checkout').classList.add('hidden');
      const box=$('#success');box.replaceChildren();box.classList.remove('hidden');
      box.append(textNode('h3','Booking price needs verification'));
      box.append(textNode('p','Booking reference: '+booking.reference));
      box.append(textNode('p','Reported status: '+booking.status));
      box.append(textNode('p','The confirmed price or partner discount could not be matched to the amount quoted. Your booking may already exist. Please contact VOY PRO with the reference above before making another booking attempt.'));
      setStatus('Final booking price or partner discount needs staff verification. Do not submit again.','error');
    }
    function showUnverifiedOnlinePaymentResponse(pay){
      if(expiryTimer)clearInterval(expiryTimer);expiryTimer=null;
      // Payment preparation might have created a booking or provider session.
      // Never DELETE its hold or offer an unrelated second checkout.
      hold=null;quote=null;chosenSlot=null;
      $('#search').classList.add('hidden');$('#results').classList.add('hidden');
      $('#checkout').classList.add('hidden');
      const box=$('#success');box.replaceChildren();box.classList.remove('hidden');
      box.append(textNode('h3','Online payment needs verification'));
      if(typeof pay?.booking_reference==='string'&&pay.booking_reference.trim())
        box.append(textNode('p','Booking reference: '+pay.booking_reference.trim()));
      box.append(textNode('p','The payment service returned incomplete, unexpected or mismatched checkout details. A booking or payment may already exist. Contact VOY PRO before attempting payment or booking again.'));
      setStatus('Online payment request needs staff verification. Do not submit again.','error');
    }
    function showUnexpectedBookingStatusResponse(booking){
      if(expiryTimer)clearInterval(expiryTimer);expiryTimer=null;
      // Never delete a hold possibly converted by the server, and never
      // offer a fresh final POST after an ambiguous booking response.
      hold=null;quote=null;chosenSlot=null;
      $('#search').classList.add('hidden');$('#results').classList.add('hidden');
      $('#checkout').classList.add('hidden');
      const box=$('#success');box.replaceChildren();box.classList.remove('hidden');
      box.append(textNode('h3','Booking needs staff review'));
      box.append(textNode('p','Booking reference: '+booking.reference));
      box.append(textNode('p','Reported status: '+booking.status));
      box.append(textNode('p','This status does not verify an active tour booking. Please contact VOY PRO with this reference before trying to book again.'));
      setStatus('Booking status requires staff verification. Do not submit again.','error');
    }
    function showPreviouslySubmittedQuoteExpiredResponse(){
      if(expiryTimer)clearInterval(expiryTimer);expiryTimer=null;
      // The first request may have been accepted. Keep the possibly converted
      // hold untouched and do not create a new idempotency key or booking.
      hold=null;quote=null;chosenSlot=null;
      $('#confirmButton').disabled=true;
      $('#search').classList.add('hidden');$('#results').classList.add('hidden');
      $('#checkout').classList.add('hidden');
      const box=$('#success');box.replaceChildren();box.classList.remove('hidden');
      box.append(textNode('h3','Previous booking attempt needs verification'));
      box.append(textNode('p','Your earlier confirmation attempt may already have created a booking, but its quoted price has now expired. Please contact VOY PRO to confirm the booking outcome before making another attempt.'));
      setStatus('Earlier booking attempt may have succeeded. Do not submit a new booking before checking with VOY PRO.','error');
    }
    function showUnverifiedBookingResponse(){
      if(expiryTimer)clearInterval(expiryTimer);expiryTimer=null;
      // A malformed successful HTTP response can follow a committed booking.
      // Do not release the possibly converted hold or allow another POST.
      hold=null;quote=null;chosenSlot=null;
      $('#search').classList.add('hidden');$('#results').classList.add('hidden');
      $('#checkout').classList.add('hidden');
      const box=$('#success');box.replaceChildren();box.classList.remove('hidden');
      box.append(textNode('h3','Booking status needs verification'));
      box.append(textNode('p','The booking service did not provide a verifiable booking reference and status. Your booking may have been created. Please contact VOY PRO before making another booking attempt.'));
      setStatus('Booking outcome could not be verified. Contact VOY PRO before retrying.','error');
    }
    function showSuccess(reference,result,token){
      if(expiryTimer)clearInterval(expiryTimer);expiryTimer=null;
      // Booking is already finalized; do not DELETE its converted hold.
      hold=null;quote=null;
      $('#search').classList.add('hidden');$('#results').classList.add('hidden');
      $('#checkout').classList.add('hidden');
      const box=$('#success');box.replaceChildren();box.classList.remove('hidden');
      box.append(textNode('h3','Your booking has been received'));
      box.append(textNode('p','Reference: '+(reference||'Your confirmation')));
      box.append(textNode('p','Status: '+(result||'confirmed')));
      box.append(textNode('p','Requested guiding language: '+guideLabel()));
      if(ENGLISH_ALT_PILOT_ENABLED){
        const alt=englishAlternativeAccepted();
        box.append(textNode('p','English alternative: '+(alt===true?'Accepted':alt===false?'Declined':'Not answered')));
      }
      box.append(textNode('p','Language coverage will be confirmed with the assigned guide and staff; this request is not a guarantee of a particular guide.'));
      if(token){
        const a=document.createElement('a');a.href='https://voy-pro.com/manage/#token='+encodeURIComponent(token);
        a.textContent='Manage your booking securely';a.rel='noopener noreferrer';a.target='_blank';box.append(a);
      }
      setStatus('Booking received by VOY PRO.','success');
    }
    refreshEnglishAlternative();
    englishAltSelect.addEventListener('change',()=>{
      invalidate();setStatus('English-alternative answer changed. Check availability again.');
    });
    languageSelect.addEventListener('change',()=>{
      englishAltSelect.value='';refreshEnglishAlternative();
    });
    form.addEventListener('submit',loadAvailability);
    customer.addEventListener('submit',confirm);
    $('#changeButton').addEventListener('click',()=>{invalidate();setStatus('Choose another date or departure.');});
    for(const el of [experienceSelect,dateField,form.elements.riders,form.elements.children,
      form.elements.babies,form.elements.private,languageSelect]){
      el.addEventListener('change',()=>{invalidate();setStatus('Selection changed. Check availability again.');});
    }
    experienceSelect.addEventListener('change',()=>{
      const p=experiences.find(x=>x.id===experienceSelect.value);
      form.elements.private.disabled=!p?.privateAllowed;
      if(!p?.privateAllowed)form.elements.private.checked=false;
      languageSelect.replaceChildren();
      const offered=Array.isArray(p?.guideLanguages)
        ?[...new Set(p.guideLanguages.map(value=>String(value).toLowerCase()).filter(value=>/^[a-z]{2}$/.test(value)))]
        :[];
      const empty=document.createElement('option');empty.value='';
      empty.textContent=offered.length?'Choose guiding language':'Guide languages unavailable — contact VOY PRO';
      languageSelect.append(empty);
      for(const lang of offered){
        const opt=document.createElement('option');opt.value=lang;opt.textContent=languageNames[lang]||lang.toUpperCase();
        languageSelect.append(opt);
      }
      languageSelect.value='';
      languageSelect.disabled=!offered.length;
      englishAltSelect.value='';refreshEnglishAlternative();
    });
    if(!valid){setStatus('Partner booking is not configured. Ask VOY PRO for your approved embed code.','error');
      $('#searchButton').disabled=true;return;}
    (async()=>{
      setBusy(true);setStatus('Loading live tours…');
      // Date-horizon lookup must not hold up catalog or payment capability
      // rendering. An unavailable config leaves the backend authoritative.
      api('/destinations/budapest').then(applyDestinationHorizon).catch(()=>{});
      try{
        const [catalog,capabilities]=await Promise.all([
          api('/experiences?destination=budapest'),
          api('/payments/capabilities').catch(()=>({online_card:false})),
        ]);
        experiences=Array.isArray(catalog)?catalog.filter(x=>x.bookingEnabled!==false):[];
        experienceSelect.replaceChildren();
        const placeholder=document.createElement('option');placeholder.value='';
        placeholder.textContent='Select a tour';experienceSelect.append(placeholder);
        for(const exp of experiences){
          const option=document.createElement('option');option.value=exp.id;
          option.textContent=exp.title+' · from '+money(exp.priceFrom,exp.currency);
          experienceSelect.append(option);
        }
        // FBM may report a capability advertisement before Stripe secrets,
        // webhooks or mode are fully configured. Offer online card only on a
        // complete ready contract, never on a partial/stale 200 response.
        readyForOnline=Boolean(capabilities?.online_card===true&&
          capabilities?.provider==='stripe'&&
          (capabilities?.mode==='test'||capabilities?.mode==='live')&&
          capabilities?.readiness?.status==='ready'&&
          capabilities.readiness.reason===null);
        if(readyForOnline){
          const choice=document.createElement('option');choice.value='pay_now_card';
          choice.textContent='Pay now securely by card';customer.elements.payment.append(choice);
        }
        setStatus(experiences.length?'Select a tour to begin.':'No tours are currently available.');
      }catch(error){setStatus(error.message||'Cannot load booking options. Verify partner domain access.','error');}
      finally{setBusy(false);}
    })();
  }
  for(const script of scripts)install(script);
})();
