/* Displays only 20 fully verified, user-approved reviews; otherwise remains hidden. */
(()=>{'use strict';
  const root=document.querySelector('[data-vp-reviews-root]');
  if(!root)return;
  const track=root.querySelector('[data-vp-reviews-track]');
  const viewport=root.querySelector('[data-vp-reviews-viewport]');
  const pause=root.querySelector('[data-vp-reviews-pause]');
  const left=root.querySelector('[data-vp-reviews-left]');
  const right=root.querySelector('[data-vp-reviews-right]');
  if(!track||!viewport||!pause||!left||!right)return;
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
    // Three equal-width copies with the accessible/original set in the middle.
    // An actual scroll container replaces the direction-sensitive -50% CSS
    // animation: this allows manual left/right movement even when paused.
    const first=make('div','vp-review-group');
    const before=make('div','vp-review-group vp-review-group--before');
    const after=make('div','vp-review-group vp-review-group--after');
    before.setAttribute('aria-hidden','true');
    after.setAttribute('aria-hidden','true');
    for(const review of reviews){
      first.append(reviewCard(review,false));
      before.append(reviewCard(review,true));
      after.append(reviewCard(review,true));
    }
    // The unhidden, keyboard-accessible group MUST occupy the same middle
    // segment that the viewport displays at its initial scroll position.
    // The repeated left/right groups remain pointer-clickable but aria-hidden.
    track.replaceChildren(before,first,after);
    root.hidden=false;
    const groupWidth=()=>first.getBoundingClientRect?.().width||first.offsetWidth||0;
    let inReset=false;
    const normalize=()=>{
      if(inReset)return;
      const width=groupWidth();
      if(width<=0)return;
      const position=viewport.scrollLeft;
      let next=position;
      // Keep a full group of content on *both* sides of the visible cards.
      // This works identically with Hungarian, English and Hebrew pages.
      if(position<width*0.5)next=position+width;
      else if(position>width*2.5)next=position-width;
      if(next!==position){
        inReset=true;
        viewport.scrollLeft=next;
        inReset=false;
      }
    };
    viewport.scrollLeft=groupWidth();
    viewport.addEventListener('scroll',normalize,{passive:true});
    const moveManually=(delta)=>{
      pauseForReading();
      viewport.scrollLeft+=delta;
      normalize();
    };
    const stepSize=()=>Math.max(210,Math.min(340,viewport.clientWidth*.72||270));
    left.addEventListener('click',()=>moveManually(-stepSize()));
    right.addEventListener('click',()=>moveManually(stepSize()));
    // Mouse dragging and native touch/trackpad scrolling remain usable while paused.
    let dragging=false,previousX=0;
    viewport.addEventListener('pointerdown',event=>{
      if(event.pointerType!=='mouse'||event.button!==0||event.target?.closest?.('a,button'))return;
      dragging=true;
      previousX=event.clientX;
      pauseForReading();
      viewport.classList.add('is-dragging');
      viewport.setPointerCapture?.(event.pointerId);
    });
    viewport.addEventListener('pointermove',event=>{
      if(!dragging)return;
      const delta=event.clientX-previousX;
      previousX=event.clientX;
      viewport.scrollLeft-=delta;
      normalize();
      if(delta!==0)event.preventDefault?.();
    });
    const endDrag=()=>{
      dragging=false;
      viewport.classList.remove('is-dragging');
    };
    viewport.addEventListener('pointerup',endDrag);
    viewport.addEventListener('pointercancel',endDrag);
    viewport.addEventListener('lostpointercapture',endDrag);
    // Mobile: a review has its own vertical scroller. Decide the gesture's
    // axis once, so a horizontal swipe *starting inside any card* moves the
    // ribbon while vertical swipes still scroll the complete review naturally.
    // Only horizontal movement is canceled; taps (including source links)
    // and vertical scrolling retain their normal browser behavior.
    let touchSwipe=null;
    const findTouch=(event,id)=>Array.from(event.touches||[]).find(t=>t.identifier===id);
    viewport.addEventListener('touchstart',event=>{
      pauseForReading();
      if(event.touches?.length!==1||!event.target?.closest?.('.vp-review-card')){
        touchSwipe=null;
        return;
      }
      const touch=event.touches[0];
      touchSwipe={id:touch.identifier,x:touch.clientX,y:touch.clientY,
        lastX:touch.clientX,axis:null};
    },{passive:true});
    viewport.addEventListener('touchmove',event=>{
      if(!touchSwipe||event.touches?.length!==1)return;
      const touch=findTouch(event,touchSwipe.id);
      if(!touch)return;
      const distanceX=touch.clientX-touchSwipe.x;
      const distanceY=touch.clientY-touchSwipe.y;
      if(!touchSwipe.axis&&Math.hypot(distanceX,distanceY)>=8){
        touchSwipe.axis=Math.abs(distanceX)>Math.abs(distanceY)*1.2?'horizontal':'vertical';
      }
      if(touchSwipe.axis==='horizontal'){
        if(event.cancelable)event.preventDefault();
        viewport.scrollLeft-=touch.clientX-touchSwipe.lastX;
        normalize();
      }
      touchSwipe.lastX=touch.clientX;
    },{passive:false});
    viewport.addEventListener('touchend',event=>{
      if(touchSwipe&&Array.from(event.changedTouches||[])
        .some(t=>t.identifier===touchSwipe.id))touchSwipe=null;
    },{passive:true});
    viewport.addEventListener('touchcancel',()=>{touchSwipe=null;},{passive:true});
    viewport.addEventListener('wheel',event=>{
      if(!event.shiftKey||!event.deltaY)return;
      moveManually(event.deltaY);
      event.preventDefault?.();
    },{passive:false});
    pause.addEventListener('click',()=>{
      if(!root.classList.contains('is-paused')){
        pauseForReading();
        return;
      }
      // Resume is explicit user intent: release any unfinished drag, update
      // the pressed state and make a small immediately visible move even when
      // the next animation frame is delayed by a mobile browser.
      endDrag();
      root.classList.remove('is-paused');
      pause.setAttribute('aria-pressed','false');
      pause.textContent=t.pause;
      viewport.scrollLeft+=10;
      normalize();
    });
    pause.textContent=t.pause;
    pause.setAttribute('aria-pressed','false');
    const reduced=Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    if(reduced){
      pauseForReading();
      pause.hidden=true;
    }
    // Time-based speed, independent of locale / row width. Rebase into the
    // middle group continuously to avoid blank space at the end of a cycle.
    let lastFrame=null;
    const advance=timestamp=>{
      if(lastFrame!==null){
        const elapsed=Math.max(0,Math.min(80,timestamp-lastFrame));
        // Resume must actually restart motion even while the pointer hovers
        // over the carousel or the resume button retains keyboard focus.
        // Pause is controlled explicitly by is-paused (button, touch, drag),
        // not by hover/focus-within which would silently override Resume.
        if(!reduced&&!dragging&&!root.classList.contains('is-paused')&&
            document.visibilityState!=='hidden'){
          viewport.scrollLeft+=elapsed*.048;
          normalize();
        }
      }
      lastFrame=timestamp;
      window.requestAnimationFrame?.(advance);
    };
    // Guests asking the OS for reduced motion may read and navigate the
    // complete quotes manually; never spin a useless animation-frame loop.
    if(!reduced)window.requestAnimationFrame?.(advance);
    window.addEventListener?.('resize',()=>{
      const width=groupWidth();
      if(width>0&&(viewport.scrollLeft<width*.3||viewport.scrollLeft>width*2.7))
        viewport.scrollLeft=width;
      normalize();
    });
  };
  fetch('/assets/budapest-approved-reviews.json',{cache:'no-store'})
    .then(response=>response.ok?response.json():null)
    .then(render)
    .catch(()=>{ /* No unverified reviews are ever displayed. */ });
})();
