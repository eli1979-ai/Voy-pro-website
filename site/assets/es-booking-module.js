/* Spanish booking UI only. Never calculate prices, inventory, holds or payments here.
 * The existing site.js is the only FBM booking client and is gated separately. */
(function(){
  'use strict';
  if(!/^\/es\/budapest(?:\/|$)/.test(location.pathname))return;
  window.VOY_ES_BOOKING_TRANSLATIONS=Object.freeze({"Choose guide language":"Seleccionar idioma del guía","Guide language":"Idioma del guía","Choose the guiding language that works for your group. We do not select a language automatically.":"Elige el idioma de guía de tu grupo. No se selecciona automáticamente.","Guide languages unavailable – contact our team":"Idiomas no disponibles; contacta con nuestro equipo.","Online booking is temporarily unavailable":"Las reservas en línea no están disponibles temporalmente","Search availability":"Consultar disponibilidad","Check availability":"Consultar disponibilidad","From ":"Desde ","Contact the local team":"Contacta con el equipo local","Online booking":"Reserva en línea","TOUR STYLE":"TIPO DE TOUR","Choose how you want to ride":"Elige cómo quieres participar","Final price is shown after you choose a departure.":"El precio final se muestra después de elegir la salida.","Join a scheduled tour":"Unirse a un tour programado","Current rider price":"Precio actual por conductor","Private tour · your group only":"Tour privado · solo tu grupo","Private upgrade shown before confirmation":"Suplemento privado antes de confirmar","Private availability requires an empty departure.":"El tour privado requiere una salida sin otras reservas.","Scheduled tour selected. Search availability for your group.":"Tour programado seleccionado. Consulta las salidas disponibles.","MORE BUDAPEST":"MÁS BUDAPEST","See extended tour":"Ver tour ampliado","Selection changed. Search again to refresh availability.":"La selección ha cambiado. Vuelve a consultar la disponibilidad.","Group composition":"Composición del grupo","Live availability · Final price before confirmation · Local support":"Disponibilidad actual · Precio final antes de confirmar · Asistencia local","Tell us what you need":"Cuéntanos qué necesitas","Preferred date":"Fecha preferida","Independent riders":"Conductores independientes","Private?":"¿Privado?","Preferred start time":"Hora preferida","(optional)":"(opcional)","Send request on WhatsApp":"Consultar por WhatsApp","Reference copied":"Referencia copiada","Opening secure card payment…":"Abriendo el pago seguro con tarjeta…","Payment":"Pago","Places":"Plazas","Price":"Precio","Tour":"Recorrido","Date":"Fecha"});
  function start(){
    const section=document.querySelector('section.es-inquiry#consulta');
    const panel=section&&section.querySelector('.es-inquiry-panel');
    if(!panel||document.querySelector('#availability-form'))return;
    const cfg=window.VOY_CONFIG||window.VOY_RUNTIME_CONFIG||{};
    const allowed=cfg.bookingEnabled===true&&cfg.esBookingEnabled===true
      &&cfg.esBookingLocaleCertified===true&&typeof cfg.apiRoot==='string'
      &&/^https:\/\//.test(cfg.apiRoot)&&typeof cfg.clientKey==='string'
      &&cfg.clientKey.trim().length>0;
    const options=(a,b)=>Array.from({length:b-a+1},(_,i)=>{
      const n=a+i;return '<option value="'+n+'">'+n+'</option>';
    }).join('');
    const root=document.createElement('div');
    root.id='booking';root.className='es-booking-module';
    root.dataset.esBookingMode=allowed?'opted-in':'preview-inert';
    root.innerHTML='<div class="notice" data-es-booking-gate>'+
      (allowed?'Consulta los horarios y precios reales antes de confirmar.':
      'Módulo de reservas en preparación. Solicita disponibilidad por WhatsApp. Este formulario no envía datos ni acepta pagos.')+
      '</div><form id="availability-form" class="es-booking-form" novalidate>'+
      '<div class="booking-steps" aria-label="Pasos de la reserva">'+
      '<div class="booking-step is-active" data-booking-step="1"><small>Paso 1</small><b>Fecha y grupo</b></div>'+
      '<div class="booking-step" data-booking-step="2"><small>Paso 2</small><b>Elegir horario</b></div>'+
      '<div class="booking-step" data-booking-step="3"><small>Paso 3</small><b>Datos y confirmación</b></div></div>'+
      '<div class="selected-tour-hint" data-selected-tour-hint>Elige el recorrido y la fecha para empezar.</div>'+
      '<fieldset data-es-booking-fields disabled>'+
      '<div class="field"><label for="es-booking-experience">Recorrido</label><select id="es-booking-experience" name="experience" required>'+
      '<option value="exp_bud_buda">Lo mejor de Buda en EZRaider</option>'+
      '<option value="exp_bud_margaret">Isla Margarita en EZRaider</option></select></div>'+
      '<div class="field"><label for="es-booking-date">Fecha</label><input id="es-booking-date" name="date" type="date" required></div>'+
      '<div class="field"><label for="es-booking-adults">Conductores independientes (16+)</label><select id="es-booking-adults" name="adults">'+options(1,12)+'</select></div>'+
      '<div class="field"><label for="es-booking-children">Niños pasajeros (3–15 años)</label><select id="es-booking-children" name="children">'+options(0,6)+'</select></div>'+
      '<div class="field"><label for="es-booking-babies">Bebés pasajeros (1–2 años)</label><select id="es-booking-babies" name="babies">'+options(0,4)+'</select></div>'+
      '<button class="btn" type="submit" data-track="availability_search">Consultar disponibilidad</button>'+
      '</fieldset><div class="status" id="availability-status" role="status" aria-live="polite">'+
      'Esta función todavía no admite reservas en español.</div><div id="slotlist" class="slotlist"></div></form>';
    const contact=panel.querySelector('.es-inquiry-whatsapp');
    if(contact)panel.insertBefore(root,contact);else panel.appendChild(root);
    const form=root.querySelector('form');
    form.addEventListener('submit',event=>{
      if(root.dataset.esBookingMode!=='opted-in'){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    if(!allowed)return;
    for(const p of panel.querySelectorAll('p')){
      if(p.textContent.includes('En español no hay reserva ni pago en línea.')||
         p.textContent.includes('Vista previa: no se aceptan reservas reales ni pagos desde estas páginas.'))p.hidden=true;
    }
    section.dataset.esBookingEnabled='true';
    root.querySelector('fieldset').disabled=false;
    // Reuse the shared canonical FBM client; never add a second booking writer.
    const script=document.createElement('script');
    script.src='/assets/site.js';script.async=true;
    script.onerror=()=>{
      root.dataset.esBookingMode='preview-inert';root.querySelector('fieldset').disabled=true;
      root.querySelector('[data-es-booking-gate]').textContent='Reservas no disponibles. Contacta por WhatsApp.';
    };
    document.body.appendChild(script);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
