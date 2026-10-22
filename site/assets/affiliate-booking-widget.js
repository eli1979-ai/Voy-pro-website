/* VOY PRO partner booking widget v1.
 * Install on an approved partner origin with public (not secret) booking key.
 * Business rules, affiliate attribution and prices are always resolved by FBM.
 * Does not use iframe or modify partner cookies, storage or global CSS.
 */
(()=>{
  'use strict';
  const scripts=[...document.querySelectorAll('script[data-voy-affiliate-widget]')];
  const VALID_CODE=/^[A-Z0-9][A-Z0-9_-]{1,39}$/;
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
    script.dataset.voyMounted='true';
    const target=document.getElementById(script.dataset.target||'voy-affiliate-booking');
    if(!target)return;
    const root=target.attachShadow({mode:'closed'});
    const affiliate=String(script.dataset.affiliate||'').trim().toUpperCase();
    const clientKey=String(script.dataset.clientKey||'').trim();
    let apiRoot;
    try{
      apiRoot=new URL(String(script.dataset.apiRoot||'').trim());
      if(apiRoot.protocol!=='https:'||apiRoot.username||apiRoot.password||
         apiRoot.search||apiRoot.hash)throw new Error('Invalid API origin');
      apiRoot=apiRoot.origin+apiRoot.pathname.replace(/\/$/,'');
    }catch{apiRoot=null;}
    const valid=Boolean(apiRoot&&clientKey&&VALID_CODE.test(affiliate));

    // The template is static. User-, partner-, or API-supplied values are never
    // injected into HTML; all dynamic text uses textContent/createElement.
    root.innerHTML=`
      <style>
        :host{display:block;--accent:#125789;--ink:#1b2934;--line:#cddae5;font:16px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ink)}
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
        <p class="muted">Choose your experience and see your partner price. All bookings are confirmed by VOY PRO.</p>
        <form id="search">
          <div class="fields">
            <label>Tour <select name="experience" required><option value="">Loading tours…</option></select></label>
            <label>Date <input name="date" type="date" required></label>
            <label>Independent riders (16+) <input name="riders" type="number" min="1" max="12" value="2" required></label>
            <label>Child passengers (3–15) <input name="children" type="number" min="0" max="12" value="0" required></label>
            <label>Baby passengers (1–2) <input name="babies" type="number" min="0" max="12" value="0" required></label>
            <label>Guide language <select name="language"><option value="">No preference</option></select></label>
          </div>
          <label class="check"><input name="private" type="checkbox"> Private tour (additional charge)</label>
          <div class="actions"><button type="submit" id="searchButton">Check availability</button></div>
        </form>
        <section id="results" class="hidden" aria-label="Available departures">
          <h3>Available times</h3><div id="slots" class="slots"></div>
          <p class="hint">Times requiring staff confirmation cannot be booked instantly in this widget.</p>
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
    dateField.min=todayBudapest();
    dateField.value=dateField.min;
    let experiences=[],chosenSlot=null,hold=null,quote=null,offers=[],extras=[],generation=0,loading=false;
    let retryKey=null,expiryTimer=null,readyForOnline=false;
    const selectedExtras=new Map();
    const setStatus=(message='',kind='')=>{status.textContent=message;status.className='status '+kind;};
    const setBusy=(value)=>{loading=value;$('#searchButton').disabled=value;$('#confirmButton').disabled=value;};
    const textNode=(name,value)=>{const el=document.createElement(name);el.textContent=String(value);return el;};
    const composition=()=>({
      riders_16_plus:Number(form.elements.riders.value),
      child_passengers_3_15:Number(form.elements.children.value),
      baby_passengers_1_2:Number(form.elements.babies.value),
      request_15yo_independent_assessment:false,
    });
    const isPrivate=()=>form.elements.private.checked;
    async function api(path,{method='GET',body,headers={}}={}){
      const response=await fetch(apiRoot+'/api/v1'+path,{
        method,mode:'cors',credentials:'omit',cache:'no-store',
        headers:{'x-voy-client-key':clientKey,...(body?{'content-type':'application/json'}:{}),...headers},
        ...(body?{body:JSON.stringify(body)}:{}),
      });
      const result=response.status===204?null:await response.json().catch(()=>null);
      if(!response.ok)throw new Error(result?.error||result?.message||'Booking service unavailable ('+response.status+').');
      return result;
    }
    const offerPrice=(item)=>money(Number(item.price_minor||0)/100,item.currency||'EUR');
    function invalidate(){
      generation++;
      if(expiryTimer)clearInterval(expiryTimer);
      expiryTimer=null;
      const old=hold;
      hold=null;quote=null;chosenSlot=null;extras=[];offers=[];retryKey=null;
      selectedExtras.clear();setBusy(false);
      $('#results').classList.add('hidden');$('#checkout').classList.add('hidden');
      $('#slots').replaceChildren();$('#extras').replaceChildren();$('#price').replaceChildren();
      if(old?.id)api('/holds/'+encodeURIComponent(old.id),{method:'DELETE'}).catch(()=>{});
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
        quote=updated;renderQuote();setStatus('');
      }catch(error){
        if(version===generation){quote=null;$('#price').replaceChildren();setStatus(error.message,'error');}
      }finally{if(version===generation)setBusy(false);}
    }
    function renderOffers(){
      const panel=$('#extras');panel.replaceChildren();
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
      if(loading)return;
      await releaseHold();
      const version=++generation;
      chosenSlot=slot;setBusy(true);$('#checkout').classList.add('hidden');setStatus('Checking your partner discount…');
      try{
        const promo=await api('/promotions/validate',{method:'POST',body:{code:affiliate,slot_id:slot.id}});
        if(version!==generation)return;
        if(!promo.valid||String(promo.code||'').toUpperCase()!==affiliate)
          throw new Error('This partner code is not currently valid for the selected tour.');
        quote=await api('/quotes',{method:'POST',body:{
          slot_id:slot.id,group_composition:composition(),is_private:isPrivate(),extras:[],promo_code:affiliate,
        }});
        if(version!==generation)return;
        if(String(quote.promo_code_applied||'').toUpperCase()!==affiliate)
          throw new Error('The booking price was not attributed to your partner.');
        const held=await api('/holds',{method:'POST',body:{
          slot_id:slot.id,group_composition:composition(),is_private:isPrivate(),
          guide_language:languageSelect.value||null,
        }});
        if(version!==generation){await api('/holds/'+encodeURIComponent(held.id),{method:'DELETE'}).catch(()=>{});return;}
        hold=held;
        if(held.requires_staff_confirmation)throw new Error('This departure requires staff confirmation.');
        offers=await api('/ancillary/offers',{method:'POST',body:{slot_id:held.departure_id||slot.id}}).catch(()=>[]);
        if(version!==generation)return;
        if(!Array.isArray(offers))offers=[];
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
      if(loading)return;
      invalidate();
      const version=generation;
      const exp=experiences.find(x=>x.id===experienceSelect.value);
      const c=composition();
      if(!exp||!/^\d{4}-\d{2}-\d{2}$/.test(dateField.value)||dateField.value<todayBudapest()||
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
        });
        const avail=await api('/experiences/'+encodeURIComponent(exp.id)+'/availability?'+query.toString());
        if(version!==generation)return;
        $('#results').classList.remove('hidden');
        const panel=$('#slots');panel.replaceChildren();
        let sellable=0;
        for(const slot of avail.slots||[]){
          const button=document.createElement('button');button.type='button';
          const allowed=Boolean(slot.sellable);
          button.textContent=String(slot.time||'Time')+(!allowed?' · '+(slot.requestable?'Staff check required':'Unavailable'):'');
          button.disabled=!allowed;button.className=allowed?'':'unavailable';
          button.setAttribute('aria-pressed','false');
          button.addEventListener('click',()=>{
            for(const node of panel.querySelectorAll('button'))node.setAttribute('aria-pressed','false');
            button.setAttribute('aria-pressed','true');return selectSlot(slot);
          });
          if(allowed)sellable++;
          panel.appendChild(button);
        }
        if(!sellable)panel.appendChild(textNode('p','No instant-bookable departures for this selection.'));
        setStatus(sellable?'Choose a departure time to see your exact partner price.':'Try another date or group size.');
      }catch(error){if(version===generation)setStatus(error.message||'Could not retrieve departures.','error');}
      finally{if(version===generation)setBusy(false);}
    }
    async function confirm(event){
      event.preventDefault();
      if(loading||!hold||!quote)return;
      if(new Date(hold.expires_at).getTime()<=Date.now()){
        setStatus('Your hold expired. Please check availability again.','error');return;
      }
      const name=String(customer.elements.name.value||'').trim();
      const email=String(customer.elements.email.value||'').trim();
      const phone=String(customer.elements.phone.value||'').trim();
      if(!name||!email||!phone||!customer.elements.terms.checked)return;
      const method=customer.elements.payment.value;
      if(method==='pay_now_card'&&!readyForOnline)return;
      if(!['pay_arrival_card','pay_arrival_cash','pay_now_card'].includes(method))return;
      if(!retryKey)retryKey=crypto.randomUUID();
      const submission={
        hold_id:hold.id,
        promo_code:affiliate,
        extras,
        customer:{full_name:name,email,phone,preferred_language:'en'},
      };
      const version=generation;setBusy(true);setStatus('Confirming your booking securely…');
      try{
        if(method==='pay_now_card'){
          const pay=await api('/payments/intents',{method:'POST',headers:{'idempotency-key':retryKey},
            body:{...submission,payment_type:'online',payment_method:'pay_now_card'}});
          if(version!==generation)return;
          if(pay.status==='completed'){
            showSuccess(pay.booking_reference||pay.booking_id,'Payment confirmed',null);
            return;
          }
          const address=new URL(pay.checkout_url||'',location.href);
          if(pay.status!=='requires_action'||address.protocol!=='https:'||address.hostname!=='checkout.stripe.com')
            throw new Error('Secure card checkout is not currently available.');
          // Stripe is the only allowed external checkout. No payment card
          // details are ever collected in the partner page or this widget.
          location.assign(address.href);
          return;
        }
        const booking=await api('/bookings',{method:'POST',headers:{'idempotency-key':retryKey},
          body:{...submission,payment_method:method}});
        if(version!==generation)return;
        showSuccess(booking.reference,booking.status,booking.manage_token||booking.secure_token||null);
      }catch(error){if(version===generation)setStatus(error.message||'Booking could not be confirmed. Please retry.','error');}
      finally{if(version===generation)setBusy(false);}
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
      if(token){
        const a=document.createElement('a');a.href='https://voy-pro.com/manage/#token='+encodeURIComponent(token);
        a.textContent='Manage your booking securely';a.rel='noopener noreferrer';a.target='_blank';box.append(a);
      }
      setStatus('Booking received by VOY PRO.','success');
    }
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
      const empty=document.createElement('option');empty.value='';empty.textContent='No preference';
      languageSelect.append(empty);
      for(const lang of p?.guideLanguages||[]){
        const opt=document.createElement('option');opt.value=lang;opt.textContent=lang.toUpperCase();
        languageSelect.append(opt);
      }
    });
    if(!valid){setStatus('Partner booking is not configured. Ask VOY PRO for your approved embed code.','error');
      $('#searchButton').disabled=true;return;}
    (async()=>{
      setBusy(true);setStatus('Loading live tours…');
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
        readyForOnline=Boolean(capabilities?.online_card&&capabilities?.provider==='stripe');
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
