/* Full-text testimonials only. Never publish unverified, abbreviated or fabricated review content. */
(()=>{'use strict';
  const host=document.querySelector('[data-budapest-review-ticker]');
  if(!host)return;
  const track=host.querySelector('[data-review-track]');
  const previous=host.querySelector('[data-review-previous]');
  const next=host.querySelector('[data-review-next]');
  const toggle=host.querySelector('[data-review-pause]');
  if(!track||!previous||!next||!toggle)return;
  const language=document.documentElement.lang||'en';
  const labels={
    en:{source:'Read original review',pause:'Pause automatic scrolling',resume:'Resume automatic scrolling',of:'of'},
    he:{source:'לקריאת הביקורת במקור',pause:'עצירת התנועה האוטומטית',resume:'חידוש התנועה האוטומטית',of:'מתוך'},
    hu:{source:'Eredeti értékelés megnyitása',pause:'Automatikus váltás szüneteltetése',resume:'Automatikus váltás folytatása',of:'/'}
  };
  const t=labels[language]||labels.en;
  const allowedHosts={
    google:['google.com','www.google.com','maps.google.com','maps.app.goo.gl'],
    tripadvisor:['tripadvisor.com','www.tripadvisor.com'],
    getyourguide:['getyourguide.com','www.getyourguide.com']
  };
  const sourceName={google:'Google Maps',tripadvisor:'Tripadvisor',getyourguide:'GetYourGuide'};
  const safeUrl=(url,platform)=>{
    try{
      const parsed=new URL(url);
      return parsed.protocol==='https:'&&(allowedHosts[platform]||[]).includes(parsed.hostname);
    }catch{return false;}
  };
  const reviewIsPublishable=(r)=>r&&r.approved===true&&r.verified===true&&
    typeof r.reviewer==='string'&&r.reviewer.trim().length>1&&
    typeof r.original_full_text==='string'&&r.original_full_text.trim().length>15&&
    r.rating===5&&typeof r.review_date==='string'&&/^\\d{4}-\\d{2}-\\d{2}$/.test(r.review_date)&&
    safeUrl(r.verified_review_url,r.platform);
  const node=(tag,className,text)=>{
    const element=document.createElement(tag);
    if(className)element.className=className;
    if(text!==undefined)element.textContent=text;
    return element;
  };
  const load=async()=>{
    try{
      const response=await fetch('/assets/budapest-review-candidates.json',{cache:'no-store'});
      if(!response.ok)return;
      const data=await response.json();
      if(!data||data.schema!=='voy-pro.review-strip-candidates.v1'||
        !Array.isArray(data.reviews)||data.reviews.length!==20||
        new Set(data.reviews.map(r=>r.id)).size!==20||
        !data.reviews.every(reviewIsPublishable))return;
      for(const [i,review] of data.reviews.entries()){
        const card=node('article','voy-review-card');
        card.setAttribute('aria-label',(i+1)+' '+t.of+' '+data.reviews.length);
        const top=node('div','voy-review-card-top');
        const platform=node('span','voy-review-platform',sourceName[review.platform]);
        const stars=node('span','voy-review-stars','★★★★★');
        stars.setAttribute('aria-label','5 / 5');
        top.append(platform,stars);
        const quote=node('blockquote','voy-review-full-text',review.original_full_text);
        quote.dir='auto';
        const attribution=node('div','voy-review-byline');
        const reviewer=node('strong','voy-review-author',review.reviewer);
        const date=node('time','voy-review-date',review.review_date);
        date.dateTime=review.review_date;
        attribution.append(reviewer,date);
        const link=node('a','voy-review-source-link',t.source+' ↗');
        link.href=review.verified_review_url;
        link.target='_blank';
        link.rel='noopener noreferrer';
        card.append(top,quote,attribution,link);
        track.append(card);
      }
      host.hidden=false;
      const cards=[...track.children];
      let index=0,paused=false,engaged=false,timer;
      const jump=(n)=>{
        index=(n+cards.length)%cards.length;
        cards[index].scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',inline:'start',block:'nearest'});
      };
      previous.addEventListener('click',()=>jump(index-1));
      next.addEventListener('click',()=>jump(index+1));
      toggle.addEventListener('click',()=>{
        paused=!paused;
        toggle.setAttribute('aria-pressed',String(paused));
        toggle.setAttribute('aria-label',paused?t.resume:t.pause);
        toggle.textContent=paused?'▶':'Ⅱ';
      });
      host.addEventListener('pointerenter',()=>{engaged=true;});
      host.addEventListener('pointerleave',()=>{engaged=false;});
      host.addEventListener('focusin',()=>{engaged=true;});
      host.addEventListener('focusout',(event)=>{if(!host.contains(event.relatedTarget))engaged=false;});
      host.addEventListener('touchstart',()=>{engaged=true;},{passive:true});
      host.addEventListener('touchend',()=>{engaged=false;},{passive:true});
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
      const tick=()=>{if(!paused&&!engaged&&!document.hidden&&!reduced.matches)jump(index+1);};
      timer=window.setInterval(tick,15000);
      window.addEventListener('pagehide',()=>window.clearInterval(timer),{once:true});
    }catch{
      // A missing, incomplete or unverified collection must never become a fake testimonial.
      host.hidden=true;
    }
  };
  load();
})();
