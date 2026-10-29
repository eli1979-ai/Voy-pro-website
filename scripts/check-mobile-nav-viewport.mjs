import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const css=fs.readFileSync('site/assets/site.css','utf8');
const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];

const requiredCss=[
  'max-height:calc(100vh - 12px)',
  'max-height:calc(100dvh - max(12px,env(safe-area-inset-top,0px)))',
  'overflow-y:auto',
  'overscroll-behavior:contain'
];
for(const token of requiredCss){
  if(!css.includes(token)) failures.push('mobile navigation card missing '+token);
}
const budapestStart=js.indexOf("sheet.innerHTML=`<div class=\"mobile-nav-card\"");
const portugalStart=js.indexOf("else if(isPortugalPage)");
if(budapestStart<0 || portugalStart<0) failures.push('mobile navigation fixtures missing');
if(!css.includes('.nav-open{overflow:hidden}')) failures.push('expected body scroll lock while mobile navigation is open');

// Behavioral regression of the actual mobile-navigation initializer with a
// minimal fake DOM. The old implementation kept a modal and body scroll lock
// when CSS hid its Menu button at desktop widths. No network/browser needed.
const begin=js.indexOf('  function enhanceMobileNavigation(){');
const end=js.indexOf("  document.querySelectorAll('a.brand')",begin);
assert.ok(begin>=0&&end>begin,'mobile menu implementation not found');
const initializer=js.slice(begin,end);
for(const route of [
  {name:'home EN',isBudapestPage:false,isPortugalPage:false,locale:'en'},
  {name:'Budapest HE',isBudapestPage:true,isPortugalPage:false,locale:'he'},
  {name:'Budapest HU',isBudapestPage:true,isPortugalPage:false,locale:'hu'},
  {name:'Portugal PT',isBudapestPage:false,isPortugalPage:true,locale:'pt'}
]){
  let opener,sheet,closeButton,waLink,menuLink,desktopListener,bodyLocked=false;
  const create=(tag)=>({
    tag,attrs:{},events:{},hidden:false,textContent:'',className:'',
    setAttribute(key,value){this.attrs[key]=value;},
    addEventListener(type,fn){this.events[type]=fn;},
    focus(options){this.focusOptions=options;document.activeElement=this;},
    contains(node){return this===sheet&&(node===closeButton||node===waLink);},
    querySelector(selector){
      if(selector==='.mobile-nav-close')return closeButton;
      if(selector==='[data-mobile-nav-wa]')return waLink;
      return null;
    },
    querySelectorAll(selector){return this===sheet&&selector==='a'?[menuLink]:[];}
  });
  const nav={firstChild:null,insertBefore(node){opener=node;}};
  closeButton=create('button');waLink=create('a');menuLink=create('a');
  menuLink.href='/portugal/#tours';
  const desktopBrand=create('a');
  const document={
    body:{
      appendChild(node){sheet=node;},
      classList:{
        add(value){if(value==='nav-open')bodyLocked=true;},
        remove(value){if(value==='nav-open')bodyLocked=false;}
      }
    },
    querySelector(selector){
      if(selector==='.navlinks')return nav;
      if(selector==='header a.brand')return desktopBrand;
      if(selector==='.nav-menu-toggle')return opener||null;
      return null;
    },
    querySelectorAll(){return [];},
    createElement:create
  };
  const media={
    matches:false,
    addEventListener(type,callback){
      assert.equal(type,'change');
      desktopListener=callback;
    }
  };
  const window={matchMedia(query){
    assert.equal(query,'(min-width:1181px)');
    return media;
  }};
  vm.runInNewContext(initializer+'\nenhanceMobileNavigation();',{
    document,window,...route,
    t:(en)=>en,
    localeBudapestCore:(slug)=>'/budapest/'+slug,
    localeBudapestBooking:()=>'/budapest/#booking',
    whatsAppUrl:()=> 'https://wa.me/36300993099',
    track:()=>{}
  },{filename:'site/assets/site.js mobile navigation'});
  assert.ok(opener&&sheet&&desktopListener,route.name+' must register responsive menu close');
  assert.equal(sheet.hidden,true);
  opener.onclick();
  assert.equal(sheet.hidden,false,route.name+' opens the modal');
  assert.equal(bodyLocked,true,route.name+' locks background scroll');
  assert.equal(opener.attrs['aria-expanded'],'true');
  assert.equal(document.activeElement,closeButton,route.name+' must place keyboard focus inside the open menu');
  desktopListener({matches:false});
  assert.equal(sheet.hidden,false,route.name+' stays open on narrow layouts');
  media.matches=true;
  desktopListener({matches:true});
  assert.equal(sheet.hidden,true,route.name+' must close at desktop breakpoint');
  assert.equal(bodyLocked,false,route.name+' must restore page scroll');
  assert.equal(opener.attrs['aria-expanded'],'false',route.name+' must reset aria-expanded');
  assert.equal(document.activeElement,desktopBrand,
    route.name+' must restore focus to the visible header rather than a hidden modal');

  // Do not steal focus if the active element was already outside the sheet.
  media.matches=false;
  opener.onclick();
  desktopBrand.focus();
  media.matches=true;
  desktopListener({matches:true});
  assert.equal(sheet.hidden,true);
  assert.equal(bodyLocked,false);
  assert.equal(document.activeElement,desktopBrand,
    route.name+' must not steal focus when it is already outside the sheet');

  // Clicking a link may keep the visitor in this document (hash navigation),
  // or navigation may be intercepted. Never leave focus on hidden menu content.
  media.matches=false;
  opener.onclick();
  menuLink.focus();
  assert.equal(document.activeElement,menuLink);
  const originalHref=menuLink.href;
  let defaultPrevented=false;
  assert.equal(typeof menuLink.events.click,'function',route.name+' links must have close handler');
  menuLink.events.click({preventDefault(){defaultPrevented=true;}});
  assert.equal(sheet.hidden,true,route.name+' link click closes the mobile sheet');
  assert.equal(bodyLocked,false,route.name+' link click releases scroll lock');
  assert.equal(opener.attrs['aria-expanded'],'false',route.name+' link click resets aria-expanded');
  assert.equal(document.activeElement,opener,
    route.name+' link click must restore focus to the visible mobile toggle');
  assert.equal(opener.focusOptions?.preventScroll,true,
    route.name+' returning focus must avoid unwanted scroll jumps');
  assert.equal(menuLink.href,originalHref,route.name+' must retain the actual link destination');
  assert.equal(defaultPrevented,false,route.name+' link click must not intercept navigation');
  opener.onclick();
  assert.equal(sheet.hidden,false,route.name+' navigation remains reopenable after link click');
  closeButton.onclick();
  assert.equal(sheet.hidden,true,route.name+' close control still works');
  assert.equal(document.activeElement,opener,route.name+' close control returns keyboard focus');
}

if(failures.length){
  console.error('Mobile navigation viewport guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Mobile navigation viewport guard OK: tall navigation sheets remain scrollable within short/landscape viewports.');
