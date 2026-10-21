(()=>{'use strict';
const section=document.querySelector('[data-review-ticker]');
if(!section)return;
const track=section.querySelector('[data-review-track]');
const next=section.querySelector('[data-review-next]');
const prev=section.querySelector('[data-review-prev]');
const pause=section.querySelector('[data-review-pause]');
const counter=section.querySelector('[data-review-counter]');
const domains={google:'google.com',tripadvisor:'tripadvisor.',getyourguide:'getyourguide.'};
const valid=item=>{
 if(!item||!domains[item.platform]||item.rating!==5)return false;
 if(typeof item.reviewer!=='string'||!item.reviewer.trim())return false;
 if(typeof item.text!=='string'||item.text.trim().length<20)return false;
 try {
  const url=new URL(item.review_url);
  const host=url.hostname.toLowerCase();
  return url.protocol==='https:'&&(
   item.platform==='google'?(host==='google.com'||host.endsWith('.google.com')||host==='maps.app.goo.gl'):
   host.includes(domains[item.platform])
  );
 }catch{return false;}
};
const el=(tag,cls,value)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(value!==undefined)node.textContent=value;
 return node;
};
fetch('/assets/budapest-approved-reviews.json',{cache:'no-store'})
.then(r=>r.ok?r.json():null).then(data=>{
 if(data?.schema_version!==1||data?.publication_status!=='approved'||!Array.isArray(data.reviews))return;
 const reviews=data.reviews;
 if(reviews.length!==20||!reviews.every(valid))return;
 if(new Set(reviews.map(r=>r.platform+'|'+r.reviewer+'|'+(r.date||''))).size!==20)return;
 const labels={google:'Google Maps',tripadvisor:'Tripadvisor',getyourguide:'GetYourGuide'};
 for(const r of reviews){
  const card=el('article','voy-review-card');
  const top=el('div','voy-review-top');
  const stars=el('span','voy-review-stars','★★★★★');
  stars.setAttribute('aria-label','5 / 5');
  top.append(stars,el('span','voy-review-platform',labels[r.platform]));
  const quote=el('blockquote','voy-review-quote',r.text.trim());
  quote.dir='auto';
  const byline=el('div','voy-review-byline');
  byline.append(el('strong','',r.reviewer.trim()));
  if(r.date&&/^\\d{4}-\\d{2}-\\d{2}$/.test(r.date)){
   const date=el('time','',r.date);date.dateTime=r.date;byline.append(date);
  }
  const link=el('a','voy-review-link',section.dataset.sourceLabel);
  link.href=r.review_url;link.rel='noopener noreferrer';link.target='_blank';
  card.append(top,quote,byline,link);track.append(card);
 }
 section.hidden=false;
 setupTicker();
}).catch(()=>{});
function setupTicker(){
 const cards=[...track.children];let active=0,timer=null,paused=false;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
 const show=i=>{
  active=(i+cards.length)%cards.length;
  counter.textContent=(active+1)+' / '+cards.length;
  cards[active].scrollIntoView({block:'nearest',inline:'start',behavior:reduced?'instant':'smooth'});
 };
 const stop=()=>{if(timer!==null)clearInterval(timer);timer=null;};
 const start=()=>{stop();if(!paused&&!reduced&&!document.hidden)timer=setInterval(()=>show(active+1),9500);};
 next.addEventListener('click',()=>{show(active+1);start();});
 prev.addEventListener('click',()=>{show(active-1);start();});
 pause.addEventListener('click',()=>{
  paused=!paused;pause.setAttribute('aria-pressed',String(paused));
  pause.textContent=paused?section.dataset.resumeLabel:section.dataset.pauseLabel;
  start();
 });
 section.addEventListener('mouseenter',stop);
 section.addEventListener('mouseleave',start);
 section.addEventListener('focusin',stop);
 section.addEventListener('focusout',()=>start());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start();});
 counter.textContent='1 / '+cards.length;start();
}
})();
