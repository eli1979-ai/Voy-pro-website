(()=>{'use strict';
  if(document.body?.dataset.intent!=='vehicle')return;
  const locale=['he','hu'].includes(document.documentElement.lang)?document.documentElement.lang:'en';
  const raw=new URLSearchParams(location.search).get('from');
  const source=['budapest','marvao','marvao-pt','home'].includes(raw)?raw:'home';
  const prefix=locale==='en'?'/':'/'+locale+'/';
  const translations={
    en:{backHome:'Back to homepage',backBudapest:'Back to Budapest',backMarvao:'Back to Marvão',booking:'Check availability',request:'Request Marvão availability',choose:'Choose destination',contact:'Contact the local team',statusHome:'Select a destination to continue.',statusBudapest:'Continue with the Budapest team.',statusMarvao:'Continue with the Marvão team.'},
    he:{backHome:'חזרה לעמוד הראשי',backBudapest:'חזרה לבודפשט',backMarvao:'חזרה למרבאו',booking:'בדיקת זמינות',request:'בקשת זמינות במרבאו',choose:'בחירת יעד',contact:'יצירת קשר עם הצוות המקומי',statusHome:'בחרו יעד להמשך.',statusBudapest:'המשיכו לסניף בודפשט.',statusMarvao:'המשיכו לסניף מרבאו.'},
    hu:{backHome:'Vissza a főoldalra',backBudapest:'Vissza Budapestre',backMarvao:'Vissza Marvãóba',booking:'Időpontok ellenőrzése',request:'Marvão: időpontkérés',choose:'Úti cél választása',contact:'Kapcsolat a helyi csapattal',statusHome:'Válassz úti célt.',statusBudapest:'Folytatás a budapesti csapattal.',statusMarvao:'Folytatás a marvãói csapattal.'}
  }[locale];
  const isMarvao=source==='marvao'||source==='marvao-pt';
  const back=source==='budapest'?prefix+'budapest/':isMarvao?(source==='marvao-pt'?'/pt/portugal/':locale==='he'?'/he/portugal/':'/portugal/'):'/';
  const booking=source==='budapest'?prefix+'budapest/#booking':isMarvao?back+'#request':'#choose-destination';
  const family=source==='budapest'?prefix+'budapest/with-kids/':booking;
  const contact=source==='budapest'?'https://wa.me/36300993099':isMarvao?'https://wa.me/351935695004':'#choose-destination';
  document.body.dataset.vehicleOrigin=source;
  for(const link of document.querySelectorAll('[data-ez-context]')){
    const action=link.getAttribute('data-ez-context');
    if(action==='back'){link.setAttribute('href',back);link.textContent=source==='budapest'?translations.backBudapest:isMarvao?translations.backMarvao:translations.backHome;}
    else if(action==='booking'){link.setAttribute('href',booking);link.textContent=source==='budapest'?translations.booking:isMarvao?translations.request:translations.choose;}
    else if(action==='family'){link.setAttribute('href',family);if(source!=='budapest')link.textContent=translations.choose;}
    else if(action==='contact'){link.setAttribute('href',contact);link.textContent=source==='home'?translations.choose:translations.contact;}
  }
  for(const link of document.querySelectorAll('[data-ez-language]')){
    const url=new URL(link.getAttribute('href'),location.origin);
    if(url.origin!==location.origin||!/^\/(?:he\/|hu\/)?ezraider\/$/.test(url.pathname))continue;
    url.searchParams.set('from',source);
    link.setAttribute('href',url.pathname+url.search);
  }
  const status=document.querySelector('[data-ez-context-status]');
  if(status)status.textContent=source==='budapest'?translations.statusBudapest:isMarvao?translations.statusMarvao:translations.statusHome;
})();
