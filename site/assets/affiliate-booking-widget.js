/* VOY PRO affiliate checkout embed — hosted UI, no booking API or secrets
 * are exposed to the partner. Requires explicit allowlisted framing policy
 * before embedding can be enabled on public production deployments.
 */
(()=>{
  'use strict';
  const script=document.currentScript;
  if(!script)return;
  const code=String(script.dataset.affiliate||'').trim().toUpperCase();
  // Fail closed on malformed/absent partner codes.
  if(!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code)){
    console.error('VOY PRO affiliate widget: valid data-affiliate is required.');
    return;
  }
  const locale=String(script.dataset.lang||'en').trim().toLowerCase();
  const path=locale==='he'?'/he/budapest/':locale==='hu'?'/hu/budapest/':'/budapest/';
  const scriptUrl=new URL(script.src,document.baseURI);
  const providerOrigin=scriptUrl.origin;
  const bookingUrl=new URL(path,providerOrigin);
  bookingUrl.searchParams.set('affiliate',code);
  bookingUrl.searchParams.set('embed','booking');

  const wrapper=document.createElement('section');
  wrapper.className='voy-pro-affiliate-booking-widget';
  wrapper.style.cssText='display:block;width:100%;max-width:860px;margin:0 auto;min-width:0;';
  const iframe=document.createElement('iframe');
  iframe.src=bookingUrl.href;
  iframe.title=locale==='he'?'הזמנת סיור EZRaider בבודפשט':'Book a Budapest EZRaider tour';
  iframe.setAttribute('loading','lazy');
  iframe.setAttribute('allow','payment');
  iframe.referrerPolicy='strict-origin-when-cross-origin';
  iframe.style.cssText='display:block;border:0;width:100%;height:1120px;background:#f6f8fa;';
  const fallback=document.createElement('p');
  fallback.style.cssText='font:14px/1.5 system-ui,sans-serif;margin:8px 2px;color:#475569;';
  const link=document.createElement('a');
  link.href=bookingUrl.href;
  link.target='_blank';
  link.rel='noopener noreferrer';
  link.textContent=locale==='he'?'פתיחת ההזמנה באתר VOY PRO':locale==='hu'?'Foglalás megnyitása a VOY PRO oldalán':'Open secure booking on VOY PRO';
  fallback.appendChild(link);
  wrapper.appendChild(iframe);
  wrapper.appendChild(fallback);
  script.parentNode?.insertBefore(wrapper,script);

  // Only accept layout messages from this exact iframe and provider origin.
  // The child reports no personal information or booking/payment details.
  window.addEventListener('message',event=>{
    if(event.source!==iframe.contentWindow||event.origin!==providerOrigin)return;
    const data=event.data;
    if(!data||data.type!=='voy-pro:affiliate-booking:height')return;
    const height=Number(data.height);
    if(!Number.isFinite(height))return;
    iframe.style.height=Math.max(620,Math.min(7000,Math.ceil(height)))+'px';
  });
})();
