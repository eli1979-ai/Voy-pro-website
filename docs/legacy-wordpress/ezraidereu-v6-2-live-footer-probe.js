/* EZRaiderEU v6.2 footer post-install probe (READ ONLY).
 * Paste into the browser console on an EN/HU/HE Budapest page.
 * No clicks, navigation, fetch, network calls, storage, or DOM mutations. */
(function () {
  'use strict';
  var homes=['/budapest/','/budapest/fooldal/','/budapest/בית/'];
  var hashes=['whyezraider','about','tours','gallery','blog','contact'];
  var selector='footer a[href],#colophon a[href],.site-footer a[href],.footer-navigation a[href],.footer-menu a[href],[id*="menu-footermenu"] a[href],[class*="footermenu"] a[href]';
  function path(x){try{x=decodeURIComponent(x);}catch(_){}return x.replace(/\/+$/,'/')||'/';}
  var here=path(location.pathname),rows=[],seen=new Set();
  Array.prototype.forEach.call(document.querySelectorAll(selector),function(a){
    var u,hash;
    try{u=new URL(a.href,document.baseURI);hash=decodeURIComponent(u.hash.slice(1)).toLowerCase();}
    catch(_){return;}
    if(u.protocol!=='https:'||!(/^(www\.)?ezraidereu\.com$/i).test(u.hostname)||!homes.includes(path(u.pathname))||!hashes.includes(hash))return;
    var samePage=path(u.pathname)===here&&u.hostname===location.hostname;
    var rect=a.getBoundingClientRect();
    var visible=rect.width>1&&rect.height>1&&rect.bottom>0&&rect.right>0&&rect.top<innerHeight&&rect.left<innerWidth;
    var hit='offscreen';
    if(visible){
      var el=document.elementFromPoint(Math.max(0,Math.min(innerWidth-1,rect.left+rect.width/2)),Math.max(0,Math.min(innerHeight-1,rect.top+rect.height/2)));
      hit=el&&(el===a||a.contains(el))?'link-hit':el?'possible-overlay':'no-element';
    }
    var st=getComputedStyle(a);
    seen.add(hash);
    rows.push({label:(a.textContent||'').trim().slice(0,50),hash:'#'+hash,
      destination:path(u.pathname),samePage:samePage,anchorId:samePage?!!document.getElementById(hash):'cross-page',
      hitTest:hit,pointerEvents:st.pointerEvents,visibility:st.visibility});
  });
  var report={pagePath:here,footerMatches:rows.length,missing:hashes.filter(function(h){return !seen.has(h);}),
    greenWhatsAppCount:document.querySelectorAll('#ezre-wa-float-v1').length,
    convertedFareHarborAnchors:document.querySelectorAll('a[data-ezre-wa-converted="1"]').length,
    oldBudapestMailtoPresent:!!document.querySelector('a[href^="mailto:voy.pro.eu@gmail.com"]'),
    mapAndActualClickBehaviorNotVerified:true,rows:rows};
  console.table(rows);console.log('EZRaiderEU read-only footer report:',report);
  if(report.missing.length)console.warn('Missing footer destinations:',report.missing);
  console.warn('Offscreen means: scroll to footer and run again. This does not certify actual clicks.');
  return report;
})();