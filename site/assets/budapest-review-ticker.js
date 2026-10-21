/* Full-text authentic reviews only. No quotes are synthesized or shortened here. */
(()=>{'use strict';
  const sections=[...document.querySelectorAll('[data-review-ticker]')];
  if(!sections.length)return;
  const sourceLabels={google_maps:'Google',tripadvisor:'Tripadvisor',getyourguide:'GetYourGuide'};
  const validUrl=(source,raw)=>{
    try{
      const url=new URL(raw);
      if(url.protocol!=='https:'||url.username||url.password)return false;
      const host=url.hostname.toLowerCase();
      if(source==='google_maps')return host==='google.com'||host.endsWith('.google.com')||host==='maps.app.goo.gl';
      if(source==='tripadvisor')return host==='tripadvisor.com'||host.endsWith('.tripadvisor.com');
      if(source==='getyourguide')return host==='getyourguide.com'||host.endsWith('.getyourguide.com');
    }catch(e){}
    return false;
  };
  const validRegistry=data=>{
    if(!data||data.approved_for_publication!==true||!Array.isArray(data.reviews)||data.reviews.length!==20)return false;
    const seen=new Set(),platforms=new Set();
    for(const r of data.reviews){
      if(!r||typeof r!=='object'||typeof r.id!=='string'||!r.id.trim()||seen.has(r.id))return false;
      if(!Object.hasOwn(sourceLabels,r.source)||typeof r.author!=='string'||!r.author.trim())return false;
      if(typeof r.text!=='string'||r.text.trim().length<12||/(\.\.\.|…)\s*$/.test(r.text.trim()))return false;
      if(!Number.isInteger(r.rating)||r.rating<1||r.rating>5)return false;
      if(typeof r.review_url!=='string'||!validUrl(r.source,r.review_url))return false;
      if(r.date!==undefined&&(typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)))return false;
      seen.add(r.id);platforms.add(r.source);
    }
    return platforms.size===3;
  };
  const el=(name,className,text)=>{
    const node=document.createElement(name);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  };
  const renderCard=(r,t)=>{
    const article=el('article','voy-review-card');
    article.dir='auto';
    article.dataset.reviewId=r.id;
    const top=el('div','voy-review-card-top');
    const source=el('span','voy-review-source',sourceLabels[r.source]);
    const stars=el('span','voy-review-stars','★'.repeat(r.rating));
    stars.setAttribute('aria-label',String(r.rating)+'/5');
    top.append(source,stars);
    const quote=el('blockquote','voy-review-full-text',r.text);
    if(r.language)quote.lang=r.language;
    const footer=el('div','voy-review-card-footer');
    const author=el('strong','voy-review-author',r.author);
    const meta=el('div','voy-review-card-meta');
    meta.append(author);
    if(r.date)meta.append(el('span','voy-review-date',r.date));
    const sourceLink=el('a','voy-review-original',t.readOriginal);
    sourceLink.href=r.review_url;
    sourceLink.target='_blank';
    sourceLink.rel='noopener noreferrer';
    sourceLink.setAttribute('aria-label',t.readOriginal+' · '+sourceLabels[r.source]+' · '+r.author);
    footer.append(meta,sourceLink);
    article.append(top,quote,footer);
    return article;
  };
  const render=(section,reviews)=>{
    const locale=section.dataset.reviewLocale||'en';
    const dictionaries={
      en:{readOriginal:'Read original review',count:'of'},
      he:{readOriginal:'לצפייה בביקורת המקורית',count:'מתוך'},
      hu:{readOriginal:'Eredeti vélemény megtekintése',count:'/'}
    };
    const t=dictionaries[locale]||dictionaries.en;
    const track=section.querySelector('[data-review-track]');
    const prev=section.querySelector('[data-review-prev]');
    const next=section.querySelector('[data-review-next]');
    const counter=section.querySelector('[data-review-counter]');
    if(!track||!prev||!next||!counter)return;
    const cards=reviews.map(r=>renderCard(r,t));
    track.replaceChildren(...cards);
    section.hidden=false;
    let index=0,paused=false,timeout=null;
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
    const update=()=>{
      counter.textContent=(index+1)+' '+t.count+' '+cards.length;
      const target=cards[index];
      if(target)track.scrollTo({left:target.offsetLeft-cards[0].offsetLeft,behavior:reduced?'instant':'smooth'});
    };
    const cancel=()=>{if(timeout!==null){window.clearTimeout(timeout);timeout=null;}};
    const duration=()=>Math.min(48000,Math.max(15000,Math.ceil(cards[index].querySelector('blockquote').textContent.trim().split(/\s+/u).length/180*60000)+4500));
    const schedule=()=>{
      cancel();
      if(paused||reduced||document.hidden)return;
      timeout=window.setTimeout(()=>{
        index=(index+1)%cards.length;
        update();
        schedule();
      },duration());
    };
    const go=step=>{index=(index+step+cards.length)%cards.length;update();schedule();};
    prev.addEventListener('click',()=>go(-1));
    next.addEventListener('click',()=>go(1));
    section.addEventListener('mouseenter',()=>{paused=true;cancel();});
    section.addEventListener('mouseleave',()=>{paused=false;schedule();});
    section.addEventListener('focusin',()=>{paused=true;cancel();});
    section.addEventListener('focusout',e=>{
      if(e.relatedTarget&&section.contains(e.relatedTarget))return;
      paused=false;schedule();
    });
    section.addEventListener('touchstart',()=>{paused=true;cancel();},{passive:true});
    section.addEventListener('touchend',()=>{paused=false;schedule();},{passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();else schedule();});
    track.addEventListener('scroll',()=>{
      if(!paused)return;
      const first=cards[0].offsetLeft;
      let best=index,distance=Infinity;
      cards.forEach((card,i)=>{const delta=Math.abs(card.offsetLeft-first-track.scrollLeft);if(delta<distance){distance=delta;best=i;}});
      index=best;
      counter.textContent=(index+1)+' '+t.count+' '+cards.length;
    },{passive:true});
    update();
    schedule();
  };
  fetch('/assets/budapest-approved-reviews.json',{credentials:'omit',cache:'no-store'})
    .then(response=>{if(!response.ok)throw new Error('Review registry unavailable');return response.json();})
    .then(data=>{if(!validRegistry(data))return;sections.forEach(section=>render(section,data.reviews));})
    .catch(()=>{/* Fail closed: incomplete or unavailable testimonials are never shown. */});
})();
