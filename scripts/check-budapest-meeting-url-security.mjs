import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
const requireText=(text,label)=>{if(!js.includes(text))failures.push(label);};

requireText("function safeHttpsUrl(value)",'shared Budapest HTTPS URL sanitizer missing');
requireText("return u.protocol==='https:'?u.toString():''",'Budapest maps URL sanitizer must allow HTTPS only');
requireText("maps_url:safeHttpsUrl(meeting.maps_url)",'FBM Budapest maps URL is not sanitized');
requireText("meeting.maps_url?",'booking confirmation map link must depend on sanitized URL');
requireText("escapeHTML(meeting.maps_url)",'booking confirmation map link must HTML-escape the sanitized URL');
requireText("if(budapest&&(!meeting?.address||!meeting?.maps_url))return;",'destination meeting-point section must fail closed when maps URL is invalid');

// Public Budapest home: the opening action must use the owner-supplied
// *business* listing, not the address-only Google Maps URL from destination
// metadata. FBM continues to own the meeting address and security checks.
const businessUrl='https://maps.app.goo.gl/F4DHtcpbWZrVjpqz5?g_st=ac';
requireText("const BUDAPEST_BUSINESS_MAPS_URL='"+businessUrl+"'",
  'Budapest verified Google Business listing link is missing');
requireText('maps:BUDAPEST_BUSINESS_MAPS_URL,',
  'Budapest map CTA must use the business profile URL');
requireText("mapPreview:'https://www.openstreetmap.org/export/embed.html?bbox=",
  'Budapest fixed-marker location preview is missing');
requireText('marker=47.494133%2C19.055124',
  'Budapest map marker must stay pinned to the verified location');
requireText('class="meeting-map-business-link"',
  'Budapest in-map click must use an owned full-map business link');
requireText('href="${escapeHTML(data.maps)}"',
  'In-map link must use the exact business URL');
if(js.includes("mapQuery:'EZRaider Budapest by Voy PRO"))failures.push('Ambiguous name search must not return to Budapest map');
requireText("maps:'https://maps.app.goo.gl/tfkNvDZNgaq3vN9LA?g_st=ac'",
  'Portugal maps must remain unchanged');

// Exercise the real branch meeting point renderer in isolation with a mock
// destination record (no real Google/FBM/network calls or paid resources).
import vm from 'node:vm';
const from=js.indexOf('  function injectBranchMeetingPoint(){');
const to=js.indexOf('  function routeVisualCoords(',from);
if(from<0||to<from)failures.push('Cannot locate branch meeting-point renderer');
else{
 const source=js.slice(from,to)+'\ninjectBranchMeetingPoint();';
 function render(path,meeting){
   let output='';
   const document={
     querySelector(sel){return sel==='main'?{appendChild(el){output=el.innerHTML;}}:null;},
     createElement(){return {dataset:{},innerHTML:''};}
   };
   const labels={meeting:'Meeting point',budapestTitle:'Budapest',budapestBody:'Meet here',
     budapestName:'VOY PRO Budapest',maps:'Open in Google Maps',exactPin:'Exact meeting point',
     portugalTitle:'Marvão',portugalBody:'Meet here',portugalName:'Pombais Experience & Villas',
     portugalAddress:'Marvão, Portugal'};
   vm.runInNewContext(source,{
     document,routePath:path,locale:'en',WEBSITE_VISUAL_COPY:{en:labels},
     budapestMeetingPoint:()=>meeting,
     escapeHTML:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
     encodeURIComponent,Set
   },{timeout:1000});
   return output;
 }
 const meeting={address:'Városház utca 14, 1052 Budapest, Hungary',
   maps_url:'https://www.google.com/maps/search/?api=1&query=old-address'};
 for(const path of ['/budapest/','/he/budapest/','/hu/budapest/']){
   const html=render(path,meeting);
   if(!html.includes(businessUrl))failures.push(path+' business Google Maps link absent');
   if(html.includes('query=old-address'))failures.push(path+' still links to the generic address');
   if(!html.includes('www.openstreetmap.org/export/embed.html?bbox='))
     failures.push(path+' fixed-coordinate map preview is missing');
   if(!html.includes('marker=47.494133%2C19.055124'))
     failures.push(path+' business marker is misplaced');
   if(html.includes('www.google.com/maps?q='))
     failures.push(path+' still embeds Google results that can include competitors');
   if(!html.includes('class="meeting-map-business-link"'))
     failures.push(path+' clickable map link is missing');
   if(html.split('maps.app.goo.gl/F4DHtcpbWZrVjpqz5').length-1!==2)
     failures.push(path+' both external and in-map buttons must open identical business URLs');
   if(!html.includes('OpenStreetMap contributors'))
     failures.push(path+' required map attribution is missing');
   if(!html.includes(meeting.address))failures.push(path+' dropped live meeting address');
 }
 if(render('/budapest/',{address:meeting.address,maps_url:''})!=='')
   failures.push('Invalid FBM Google Maps URL must still fail closed');
 const portugal=render('/portugal/',null);
 if(!portugal.includes('https://maps.app.goo.gl/tfkNvDZNgaq3vN9LA?g_st=ac'))
   failures.push('Marvão business map route changed unexpectedly');
}

const css=fs.readFileSync('site/assets/site.css','utf8');
if(!css.includes('.meeting-map-card--business .meeting-map-frame--business{pointer-events:none}'))
 failures.push('Business map iframe must not swallow user clicks');
if(!css.includes('.meeting-map-business-link{position:absolute;inset:0;z-index:4;'))
 failures.push('Entire map must open the business link');
if(!css.includes('.meeting-map-attribution a'))
 failures.push('OpenStreetMap attribution link must remain accessible');

if(failures.length){
  console.error('Budapest meeting-point URL security guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Budapest meeting-point URL security guard OK: FBM map links require HTTPS before confirmation or destination UI rendering.');
