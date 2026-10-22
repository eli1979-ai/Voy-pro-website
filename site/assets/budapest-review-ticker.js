/* Displays only 20 fully verified, user-approved reviews; otherwise remains hidden. */
(()=>{'use strict';
  const root=document.querySelector('[data-vp-reviews-root]');
  if(!root)return;
  const track=root.querySelector('[data-vp-reviews-track]');
  const viewport=root.querySelector('[data-vp-reviews-viewport]');
  const pause=root.querySelector('[data-vp-reviews-pause]');
  if(!track||!viewport||!pause)return;
  // Tripadvisor uses regional official review URLs. Explicit allowlist; never accept lookalikes.
  const sourceHosts={google:['google.com'],tripadvisor:['tripadvisor.com','tripadvisor.co.uk','tripadvisor.co.il','tripadvisor.ie'],getyourguide:['getyourguide.com']};
  const sourceLabels={google:'Google Maps',tripadvisor:'Tripadvisor',getyourguide:'GetYourGuide'};
  const locale=(document.documentElement.lang||'en').split('-')[0];
  const texts={
    en:{pause:'Pause reviews',play:'Resume reviews',source:'View original review on ',listing:'Browse reviews on ',translated:'Translated from the original',read:'Full review by ',stars:'out of 5 stars'},
    he:{pause:'השהיית ביקורות',play:'המשך גלילת ביקורות',source:'לביקורת המקורית ב־',listing:'לכל הביקורות באתר ',translated:'תורגם מהמקור',read:'ביקורת מלאה מאת ',stars:'מתוך 5 כוכבים'},
    hu:{pause:'Értékelések megállítása',play:'Értékelések folytatása',source:'Eredeti értékelés itt: ',listing:'További értékelések itt: ',translated:'Az eredetiből fordítva',read:'Teljes értékelés: ',stars:'az 5 csillagból'}
  };
  const t=texts[locale]||texts.en;
  const validUrl=(value,source)=>{
    try{
      const url=new URL(value);
      const hosts=sourceHosts[source];
      return url.protocol==='https:'&&Array.isArray(hosts)&&hosts.some(host=>
        url.hostname===host||url.hostname.endsWith('.'+host));
    }catch{return false;}
  };
  const validReview=(item)=>item&&item.approved===true
    &&typeof item.id==='string'&&item.id.trim().length>=2
    &&typeof item.author==='string'&&item.author.trim().length>=2
    &&typeof item.full_text==='string'&&item.full_text.trim().length>=35
    &&item.translations_approved===true
    &&item.translations&&['en','he','hu'].every(lang=>
      typeof item.translations[lang]==='string'&&item.translations[lang].trim().length>=35)
    &&(!['en','he','hu'].includes(item.language)||item.translations[item.language]===item.full_text)
    &&(item.date===null||(typeof item.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(item.date)))
    &&['review','listing'].includes(item.link_kind)
    &&item.source_verified===true&&item.full_text_verified===true
    &&Number.isInteger(item.rating)&&item.rating>=1&&item.rating<=5
    &&Object.prototype.hasOwnProperty.call(sourceHosts,item.source)
    &&validUrl(item.review_url,item.source);
  const make=(tag,className,text)=>{
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=text;
    return el;
  };
  const pauseForReading=()=>{
    root.classList.add('is-paused');
    pause.setAttribute('aria-pressed','true');
    pause.textContent=t.play;
  };
  const reviewCard=(item,duplicate)=>{
    const card=make('article','vp-review-card');
    card.lang=locale;
    card.dir=locale==='he'?'rtl':'ltr';
    const top=make('div','vp-review-top');
    const stars=make('span','vp-review-stars','★'.repeat(item.rating));
    stars.setAttribute('aria-label',item.rating+' '+t.stars);
    stars.setAttribute('role','img');
    top.append(stars,make('span','vp-review-platform',sourceLabels[item.source]));
    const quote=make('blockquote','vp-review-text',item.translations[locale]);
    quote.dir=locale==='he'?'rtl':'ltr';
    quote.tabIndex=duplicate?-1:0;
    quote.setAttribute('role','group');
    quote.setAttribute('aria-label',t.read+item.author);
    // On touch screens a guest can scroll the *complete* review vertically.
    // Freeze horizontal movement on first touch rather than moving the text
    // while they read; the visible pause/resume control resumes the ribbon.
    quote.addEventListener('touchstart',pauseForReading,{passive:true});
    const bottom=make('div','vp-review-bottom');
    const byline=make('div','vp-review-byline');
    byline.append(make('span','vp-review-author',item.author));
    if(item.date){
      const day=new Date(item.date+'T12:00:00Z');
      const displayDate=new Intl.DateTimeFormat(locale==='he'?'he-IL':locale==='hu'?'hu-HU':'en-GB',
        {timeZone:'UTC',year:'numeric',month:'short',day:'numeric'}).format(day);
      const date=make('time','vp-review-date',displayDate);
      date.dateTime=item.date;
      byline.append(date);
    }
    if(locale!==item.language)byline.append(make('span','vp-review-translated',t.translated));
    bottom.append(byline);
    // The seamless second set is visible after the first set scrolls away.
    // Keep its links clickable by pointer, without adding duplicate tab stops
    // or duplicate announcements to assistive technology.
    const link=make('a','',(item.link_kind==='listing'?t.listing:t.source)+sourceLabels[item.source]);
    link.href=item.review_url;
    link.target='_blank';
    link.rel='noopener noreferrer';
    if(duplicate)link.tabIndex=-1;
    bottom.append(link);
    card.append(top,quote,bottom);
    return card;
  };
  const render=(payload)=>{
    if(!payload||payload.status!=='approved'||payload.schema_version!==1||payload.expected_count!==20||
      !Array.isArray(payload.reviews)||payload.reviews.length!==20)return;
    const reviews=payload.reviews;
    if(!reviews.every(validReview)||new Set(reviews.map(x=>x.id)).size!==20)return;
    const counts={google:0,tripadvisor:0,getyourguide:0};
    for(const review of reviews)counts[review.source]++;
    if(counts.tripadvisor!==10||counts.google!==7||counts.getyourguide!==3)return;
    const first=make('div','vp-review-group');
    const second=make('div','vp-review-group');
    second.setAttribute('aria-hidden','true');
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
