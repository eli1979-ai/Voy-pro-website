/* Displays only 20 fully verified, user-approved reviews; otherwise remains hidden. */
(()=>{'use strict';
  const root=document.querySelector('[data-vp-reviews-root]');
  if(!root)return;
  const track=root.querySelector('[data-vp-reviews-track]');
  const viewport=root.querySelector('[data-vp-reviews-viewport]');
  const pause=root.querySelector('[data-vp-reviews-pause]');
  if(!track||!viewport||!pause)return;
  const sourceHosts={google:'google.com',tripadvisor:'tripadvisor.com',getyourguide:'getyourguide.com'};
  const sourceLabels={google:'Google Maps',tripadvisor:'Tripadvisor',getyourguide:'GetYourGuide'};
  const locale=document.documentElement.lang||'en';
  const texts={
    en:{pause:'Pause reviews',play:'Resume reviews',source:'Read original review',stars:'out of 5 stars'},
    he:{pause:'השהיית ביקורות',play:'המשך גלילת ביקורות',source:'לביקורת המקורית',stars:'מתוך 5 כוכבים'},
    hu:{pause:'Értékelések megállítása',play:'Értékelések folytatása',source:'Eredeti értékelés',stars:'az 5 csillagból'}
  };
  const t=texts[locale]||texts.en;
  const validUrl=(value,source)=>{
    try{
      const url=new URL(value);
      const host=sourceHosts[source];
      return url.protocol==='https:'&&host&&(url.hostname===host||url.hostname.endsWith('.'+host));
    }catch{return false;}
  };
  const validReview=(item)=>item&&item.approved===true
    &&typeof item.id==='string'&&item.id.trim().length>=2
    &&typeof item.author==='string'&&item.author.trim().length>=2
    &&typeof item.full_text==='string'&&item.full_text.trim().length>=35
    &&typeof item.date==='string'&&/^\\d{4}-\\d{2}-\\d{2}$/.test(item.date)
    &&Number.isInteger(item.rating)&&item.rating>=1&&item.rating<=5
    &&Object.prototype.hasOwnProperty.call(sourceHosts,item.source)
    &&validUrl(item.review_url,item.source);
  const make=(tag,className,text)=>{
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=text;
    return el;
  };
  const reviewCard=(item,duplicate)=>{
    const card=make('article','vp-review-card');
    card.lang=item.language||'';
    card.dir='auto';
    const top=make('div','vp-review-top');
    const stars=make('span','vp-review-stars','★'.repeat(item.rating));
    stars.setAttribute('aria-label',item.rating+' '+t.stars);
    stars.setAttribute('role','img');
    top.append(stars,make('span','vp-review-platform',sourceLabels[item.source]));
    const quote=make('blockquote','vp-review-text',item.full_text);
    quote.dir='auto';
    const bottom=make('div','vp-review-bottom');
    const byline=make('div','vp-review-byline');
    byline.append(make('span','vp-review-author',item.author),make('time','vp-review-date',item.date));
    byline.lastChild.dateTime=item.date;
    bottom.append(byline);
    if(!duplicate){
      const link=make('a','',t.source);
      link.href=item.review_url;
      link.target='_blank';
      link.rel='noopener noreferrer';
      bottom.append(link);
    }
    card.append(top,quote,bottom);
    return card;
  };
  const render=(payload)=>{
    if(!payload||payload.status!=='approved'||payload.schema_version!==1||payload.expected_count!==20||
      !Array.isArray(payload.reviews)||payload.reviews.length!==20)return;
    const reviews=payload.reviews;
    if(!reviews.every(validReview)||new Set(reviews.map(x=>x.id)).size!==20)return;
    const first=make('div','vp-review-group');
    const second=make('div','vp-review-group');
    second.setAttribute('aria-hidden','true');
    second.setAttribute('inert','');
    for(const review of reviews){
      first.append(reviewCard(review,false));
      second.append(reviewCard(review,true));
    }
    track.replaceChildren(first,second);
    root.hidden=false;
    pause.addEventListener('click',()=>{
      const stopped=root.classList.toggle('is-paused');
      pause.setAttribute('aria-pressed',String(stopped));
      pause.textContent=stopped?t.play:t.pause;
    });
    pause.textContent=t.pause;
    pause.setAttribute('aria-pressed','false');
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      root.classList.add('is-paused');
      pause.hidden=true;
    }
  };
  fetch('/assets/budapest-approved-reviews.json',{cache:'no-store'})
    .then(response=>response.ok?response.json():null)
    .then(render)
    .catch(()=>{ /* No unverified reviews are ever displayed. */ });
})();
