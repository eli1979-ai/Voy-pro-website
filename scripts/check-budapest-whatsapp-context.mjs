import fs from 'node:fs';
const failures=[];
let checked=0;
for(const locale of ['', 'he/', 'hu/']){
  for(const type of ['group-tours','corporate-events','private-tours']){
    const file=`site/${locale}budapest/${type}/index.html`;
    const html=fs.readFileSync(file,'utf8');
    const tags=[...html.matchAll(/<a\b[^>]*href="(https:\/\/wa\.me\/36300993099(?:\?text=[^"]*)?)"[^>]*>/g)];
    if(tags.length<3) failures.push(file+': expected at least three WhatsApp links');
    for(const [tag,url] of tags){
      if(/\bhidden(?:\s|=|>)/.test(tag)||/aria-hidden="true"/.test(tag)) continue;
      checked++;
      if(!url.includes('?text=')){failures.push(file+': visible WhatsApp link has no message');continue;}
      let message='';
      try{message=decodeURIComponent(url.split('?text=')[1]);}
      catch{failures.push(file+': invalid percent encoding');continue;}
      if(message.trim().length<30) failures.push(file+': WhatsApp message too short');
      if(/booking confirmed|ההזמנה אושרה|foglalás visszaigazolva/i.test(message)) failures.push(file+': false confirmation');
    }
  }
}
const sharedJs=fs.readFileSync('site/assets/site.js','utf8');
if(!sharedJs.includes('const authoredInquiryPage=')||
   !sharedJs.includes("if(hasAuthoredInquiry){")||
   !sharedJs.includes("link.searchParams.set('text',message+")||
   !sharedJs.includes("sourceLabel+': '+location.pathname")||
   !sharedJs.includes("if(authoredInquiryPage&&/^https:"))
  failures.push('Browser runtime may replace page-authored group/private/corporate WhatsApp messages');
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log(`Budapest WhatsApp context guard OK: ${checked} visible links across 9 pages.`);
