import fs from 'node:fs';
import path from 'node:path';

const dist=path.join(process.cwd(),'dist');
const jsPath=path.join(dist,'assets','site.js');
let js=fs.readFileSync(jsPath,'utf8');

function replaceOnce(from,to,label){
  if(!js.includes(from))throw new Error('v1.32.9 patch target missing: '+label);
  js=js.replace(from,to);
}

replaceOnce(
  "const lines=[context==='private_flexible'?privateFlexible:context==='extended'?extended:generic];",
  "const bookingConfirmed=t(\`Hi, I have a confirmed VOY PRO Budapest booking and I’d like help with it.\`,\`היי, יש לי הזמנה מאושרת ל־VOY PRO Budapest ואני רוצה עזרה בנוגע להזמנה.\`);\n    const lines=[context==='booking_confirmation'?bookingConfirmed:context==='private_flexible'?privateFlexible:context==='extended'?extended:generic];",
  'booking WhatsApp intro'
);

replaceOnce(
  "    if(details.experience_title)detailLines.push(t(\`Tour: \${details.experience_title}\`,\`סיור: \${details.experience_title}\`));",
  "    if(details.booking_reference)detailLines.push(t(\`Booking reference: \${details.booking_reference}\`,\`מספר הזמנה: \${details.booking_reference}\`));\n    if(details.experience_title)detailLines.push(t(\`Tour: \${details.experience_title}\`,\`סיור: \${details.experience_title}\`));",
  'booking reference in WhatsApp'
);

replaceOnce(
  "    if(details.is_private)detailLines.push(t('Private tour: yes','סיור פרטי: כן'));",
  "    if(details.is_private)detailLines.push(t('Private tour: yes','סיור פרטי: כן'));\n    if(details.payment_method){const paymentName=details.payment_method==='pay_now_card'?t('Paid online by card','שולם מראש בכרטיס'):details.payment_method==='pay_arrival_cash'?t('Cash on arrival','מזומן במקום'):t('Card on arrival','כרטיס במקום');detailLines.push(t(\`Payment: \${paymentName}\`,\`תשלום: \${paymentName}\`));}\n    if(details.total!=null)detailLines.push(t(\`Total: \${money(details.total,details.currency||'EUR')}\`,\`סה״כ: \${money(details.total,details.currency||'EUR')}\`));",
  'payment details in WhatsApp'
);

replaceOnce(
  "  ensureCheckoutShell();\n\n  let bookingState=",
  "  ensureCheckoutShell();\n\n  let paymentCapabilities={online_card:false};\n  async function hydratePaymentMethods(){\n    const select=document.querySelector('#live-checkout-form [name=\\\"payment_method\\\"]');\n    if(!select||!bookingEnabled)return;\n    try{\n      const caps=await api('/payments/capabilities',{method:'GET',timeoutMs:5000});\n      paymentCapabilities=caps||paymentCapabilities;\n      if(caps?.online_card&&!select.querySelector('option[value=\\\"pay_now_card\\\"]')){\n        const option=document.createElement('option');\n        option.value='pay_now_card';\n        option.textContent=t('Pay now by card','תשלום מיידי בכרטיס');\n        select.insertBefore(option,select.firstChild);\n      }\n      const submit=document.querySelector('#live-checkout-form button[type=\\\"submit\\\"]');\n      const sync=()=>{if(!submit)return;submit.textContent=select.value==='pay_now_card'?t('Continue to secure card payment','המשך לתשלום מאובטח בכרטיס'):t('Confirm booking','אישור הזמנה');};\n      select.addEventListener('change',sync);sync();\n    }catch{}\n  }\n  hydratePaymentMethods();\n\n  let bookingState=",
  'payment capability hydration'
);

replaceOnce(
  "      const paymentMethod=String(f.get('payment_method')||'pay_arrival_card');\n      const booking=await api('/bookings',{method:'POST',headers:{'Idempotency-Key':idem},body:JSON.stringify({hold_id:bookingState.hold.id,session_id:sid,customer,payment_method:paymentMethod,selected_date:bookingState.date,slot_time:bookingState.slot.time,experience_title:bookingState.experience.title,is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage,extras:[]})});",
  "      const paymentMethod=String(f.get('payment_method')||'pay_arrival_card');\n      if(paymentMethod==='pay_now_card'){\n        st.textContent=t('Opening secure card payment…','פותחים תשלום מאובטח בכרטיס…');\n        const payment=await api('/payments/intents',{method:'POST',headers:{'Idempotency-Key':idem},body:JSON.stringify({payment_type:'online',payment_method:'pay_now_card',hold_id:bookingState.hold.id,session_id:sid,customer,selected_date:bookingState.date,slot_time:bookingState.slot.time,experience_title:bookingState.experience.title,is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage,currency:bookingState.quote?.currency||'EUR'})});\n        if(!payment?.checkout_url)throw Object.assign(new Error('Secure card payment could not be started.'),{code:'PAYMENT_START_FAILED'});\n        patchSession({stage:'payment_redirect',payment_provider:'stripe',payment_checkout_id:payment.id,booking_id:payment.booking_id,booking_reference:payment.booking_reference});\n        location.assign(payment.checkout_url);\n        return;\n      }\n      const booking=await api('/bookings',{method:'POST',headers:{'Idempotency-Key':idem},body:JSON.stringify({hold_id:bookingState.hold.id,session_id:sid,customer,payment_method:paymentMethod,selected_date:bookingState.date,slot_time:bookingState.slot.time,experience_title:bookingState.experience.title,is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage,extras:[]})});",
  'pay now checkout branch'
);

replaceOnce(
  "      const manageToken=booking.manage_token||booking.secure_token||'';const manageUrl='/manage/?token='+encodeURIComponent(manageToken)+(locale==='he'?'&lang=he':locale==='hu'?'&lang=hu':'');",
  "      const manageToken=booking.manage_token||booking.secure_token||'';const manageUrl='/manage/?token='+encodeURIComponent(manageToken)+(locale==='he'?'&lang=he':locale==='hu'?'&lang=hu':'');\n      const bookingWhatsApp=whatsAppUrl('booking_confirmation',{booking_reference:booking.reference,experience_title:bookingState.experience?.title||booking.experience_title,date:bookingState.date||booking.selected_date,requested_time:bookingState.slot?.time||booking.slot_time,riders:bookingState.composition?.riders_16_plus||0,children:bookingState.composition?.child_passengers_3_15||0,babies:bookingState.composition?.baby_passengers_1_2||0,is_private:Boolean(bookingState.isPrivate),guide_language:bookingState.guideLanguage||booking.guide_language,payment_method:paymentMethod,total:booking.total,currency:booking.currency||'EUR'});",
  'booking confirmation WhatsApp payload'
);

replaceOnce(
  '<a class="btn secondary" href="\${whatsAppUrl()}">WhatsApp</a>',
  '<a class="btn secondary" href="\${bookingWhatsApp}">WhatsApp</a>',
  'confirmation WhatsApp button'
);

const releasePath=path.join(dist,'release.json');
const release=JSON.parse(fs.readFileSync(releasePath,'utf8'));
release.version='1.32.9';
fs.writeFileSync(releasePath,JSON.stringify(release,null,2)+'\n');
fs.writeFileSync(jsPath,js);

console.log('Applied VOY PRO v1.32.9 booking confirmation WhatsApp + pay-now UI.');
