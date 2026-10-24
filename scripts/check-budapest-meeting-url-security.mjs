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
requireText("mapQuery:'EZRaider Budapest by Voy PRO, Városház u. 14, 1052 Budapest, Hungary',",
  'embedded Budapest map should search the named business, not the address');
if(js.includes('mapQuery:meeting.address,'))failures.push('Budapest embedded map is still address-only');
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
   const query=encodeURIComponent('EZRaider Budapest by Voy PRO, Városház u. 14, 1052 Budapest, Hungary');
   if(!html.includes('maps?q='+query))failures.push(path+' embedded map lacks business query');
   if(!html.includes(meeting.address))failures.push(path+' dropped FBM-sourced meeting address');
 }
 if(render('/budapest/',{address:meeting.address,maps_url:''})!=='')
   failures.push('Invalid FBM Google Maps URL must still fail closed');
 const portugal=render('/portugal/',null);
 if(!portugal.includes('https://maps.app.goo.gl/tfkNvDZNgaq3vN9LA?g_st=ac'))
   failures.push('Marvão business map route changed unexpectedly');
}

if(failures.length){
  console.error('Budapest meeting-point URL security guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Budapest meeting-point URL security guard OK: FBM map links require HTTPS before confirmation or destination UI rendering.');
