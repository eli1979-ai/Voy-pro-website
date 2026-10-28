/* EZRaiderEU footer diagnostic — READ ONLY.
 * Run in the browser console while scrolled to the very bottom of a localized
 * Budapest page. No changes to DOM, URL, localStorage, cookies or network. */
(function () {
  'use strict';
  var roots='footer a[href],#colophon a[href],.site-footer a[href],.footer-navigation a[href],.footer-menu a[href],[id*="menu-footermenu"] a[href],[class*="footermenu"] a[href]';
  var targets=['whyezraider','about','tours','gallery','blog','contact'];
  var homes=['/budapest/','/budapest/fooldal/','/budapest/בית/'];
  function normalizePath(x) { try { x=decodeURIComponent(x); } catch (_) {} return x.replace(/\/+$/,'/')||'/'; }
  function clean(x) { return String(x||'').normalize('NFKC').toLowerCase().replace(/[?:!.,;\u200e\u200f]/g,'').replace(/\s+/g,' ').trim(); }
  var titles={
    whyezraider:['why the ezraider','miért az ezraider','למה איזיריידר','למה ezraider'],
    about:['about ezraider','about the ezraider','az ezraider','על איזיריידר'],
    tours:['the tours','tours','túrák','הסיורים','סיורים'],
    gallery:['gallery','galéria','גלריה / סיורים','גלריה'],
    blog:['blog','בלוג'],
    contact:['contact us','contact','kapcsolat','איש קשר','צור קשר']
  };
  var raw=[].slice.call(document.querySelectorAll(roots));
  var rows=[];
  for(var i=0;i<raw.length;i++){
    var a=raw[i],u;
    try { u=new URL(a.href,document.baseURI); } catch (_) { continue; }
    var section;
    try { section=decodeURIComponent(u.hash.slice(1)).toLowerCase(); } catch (_) { continue; }
    if(!targets.includes(section)||u.protocol!=='https:'||!(/^(www\.)?ezraidereu\.com$/i).test(u.hostname)||!homes.includes(normalizePath(u.pathname)))continue;
    var samePage=normalizePath(u.pathname)===normalizePath(location.pathname)&&u.hostname===location.hostname;
    var sectionNode=samePage?document.getElementById(section):null;
    var fallback=null;
    if(samePage&&!sectionNode){
      var headings=document.querySelectorAll('h1,h2,h3,h4');
      for(var j=0;j<headings.length&&!fallback;j++){
        var heading=clean(headings[j].textContent);
        if((titles[section]||[]).some(function(label){return heading===clean(label);}))fallback=headings[j];
      }
    }
    var style=window.getComputedStyle(a),rect=a.getBoundingClientRect(),hit=null,hitStatus='offscreen';
    var cx=Math.max(0,Math.min(window.innerWidth-1,rect.left+rect.width/2));
    var cy=Math.max(0,Math.min(window.innerHeight-1,rect.top+rect.height/2));
    if(rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<window.innerHeight&&rect.right>0&&rect.left<window.innerWidth){
      hit=document.elementFromPoint(cx,cy);
      hitStatus=(hit&&(hit===a||a.contains(hit)))?'link-receives-hit':(hit?'possibly-occluded':'no-hit-target');
    }
    rows.push({
      text:clean(a.textContent).slice(0,55),hash:section,href:u.href,samePage:samePage,
      idPresent:!!sectionNode,headingFallback:!!fallback,
      hitTest:hitStatus,hitElement:hit?(hit.tagName.toLowerCase()+(hit.id?'#'+hit.id:'')):'',
      pointerEvents:style.pointerEvents,visibility:style.visibility,display:style.display,
      boundingWidth:Math.round(rect.width),boundingHeight:Math.round(rect.height)
    });
  }
  var report={page:location.href,createdAt:new Date().toISOString(),observed:rows.length,expectedFooterLinks:6,rows:rows};
  console.table(rows);
  console.log('EZRaiderEU footer diagnostics (read-only):',JSON.stringify(report,null,2));
  console.warn('Only checks the currently visible viewport. If hitTest=offscreen, scroll to the footer and run again. This does not certify click-event interception.');
  return report;
})();