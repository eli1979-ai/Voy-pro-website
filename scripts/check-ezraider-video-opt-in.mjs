// Isolated test of the actual two-video EZRaider selector. No network traffic,
// browser storage, cookies, external media calls or real guest information.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('site/assets/ezraider-guide.js','utf8');
function simulate(withPlay=true){
  const frames=[];
  const button=(id,title)=>({
    dataset:{ezVideo:id,ezVideoTitle:title},textContent:title,
    attrs:{},events:{},classes:new Set(),
    setAttribute(name,value){this.attrs[name]=String(value);},
    addEventListener(name,fn){this.events[name]=fn;},
    classList:null
  });
  const buttons=[
    button('1i2IQSShkQ8','Tourism clip'),
    button('fMcnMk6gzYA','Safety clip')
  ];
  for(const b of buttons){
    b.classList={toggle(name,enabled){
      if(enabled)b.classes.add(name);else b.classes.delete(name);
    }};
  }
  const label={textContent:'Tourism clip'};
  const play={
    events:{},
    querySelector(selector){return selector==='[data-ez-play-label]'?label:null;},
    addEventListener(name,fn){this.events[name]=fn;}
  };
  const stage={
    current:play,
    querySelector(selector){return selector==='[data-ez-play]'&&withPlay?play:null;},
    replaceChildren(child){this.current=child;}
  };
  const watch={href:'https://www.youtube.com/watch?v=1i2IQSShkQ8'};
  const player={
    querySelectorAll(selector){return selector==='[data-ez-video]'?buttons:[];},
    querySelector(selector){
      if(selector==='[data-ez-video-screen]')return stage;
      if(selector==='[data-ez-watch]')return watch;
      return null;
    }
  };
  const document={
    querySelector(selector){return selector==='[data-ez-video-player]'?player:null;},
    createElement(tag){
      assert.equal(tag,'iframe','only iframe media elements may be created');
      const frame={
        tag,focusCount:0,focusedAfterInsertion:false,preventScroll:false,
        focus(options){
          this.focusCount++;
          this.focusedAfterInsertion=stage.current===this;
          this.preventScroll=options?.preventScroll===true;
        }
      };
      frames.push(frame);return frame;
    }
  };
  vm.runInNewContext(source,{document},{filename:'ezraider-guide.js',timeout:1000});
  return {frames,buttons,stage,watch,play,label};
}

const first=simulate();
assert.equal(first.frames.length,1,'opening the guide must create the muted autoplay frame');
assert.equal(first.stage.current,first.frames[0],'autoplay frame replaces the initial poster');
assert.equal(first.watch.href,'https://www.youtube.com/watch?v=1i2IQSShkQ8');
assert.ok(first.frames[0].src.startsWith('https://www.youtube-nocookie.com/embed/1i2IQSShkQ8?'),
  'use the privacy-enhanced approved manufacturer clip');
assert.ok(first.frames[0].src.includes('autoplay=1&mute=1&playsinline=1'),
  'autoplay must be muted and mobile-inline');
assert.equal(first.frames[0].loading,'eager','the player loads immediately');
assert.equal(first.frames[0].referrerPolicy,'strict-origin-when-cross-origin');
assert.equal(first.frames[0].tabIndex,0,'player remains keyboard reachable');
assert.equal(first.frames[0].focusCount,0,'autoplay must not steal page focus');
first.buttons[1].events.click();
assert.equal(first.frames.length,2,'choosing another clip after autoplay starts it muted');
assert.equal(first.stage.current,first.frames[1]);
assert.equal(first.label.textContent,'Safety clip');
assert.equal(first.watch.href,'https://www.youtube.com/watch?v=fMcnMk6gzYA');
assert.equal(first.buttons[1].attrs['aria-pressed'],'true');
assert.equal(first.buttons[0].attrs['aria-pressed'],'false');
assert.equal(first.buttons[1].classes.has('is-active'),true);
assert.ok(first.frames[1].src.startsWith('https://www.youtube-nocookie.com/embed/fMcnMk6gzYA?'));
assert.equal(first.frames[1].focusCount,0,'switching clips must not steal focus');
first.buttons[0].events.click();
assert.equal(first.frames.length,3,'switching back loads the approved tourism clip');
assert.equal(first.watch.href,'https://www.youtube.com/watch?v=1i2IQSShkQ8');
first.buttons[1].dataset.ezVideo='javascript:alert(1)';
first.buttons[1].events.click();
assert.equal(first.frames.length,3,'unallowlisted clip IDs must never load');
assert.equal(first.watch.href,'https://www.youtube.com/watch?v=1i2IQSShkQ8');
const noPlay=simulate(false);
assert.equal(noPlay.frames.length,0,'malformed guide without a fallback Play button fails closed');

const guides=[
 ['site/ezraider/index.html','The YouTube video loads automatically'],
 ['site/he/ezraider/index.html','סרטון היוטיוב נטען ומתחיל להתנגן אוטומטית'],
 ['site/hu/ezraider/index.html','A YouTube-videó automatikusan betöltődik'],
 ['site/pt/ezraider/index.html','O vídeo do YouTube carrega e começa automaticamente']
];
for(const [path,copy] of guides){
  const html=readFileSync(path,'utf8');
  assert.ok(html.includes(copy),path+' must explain muted autoplay');
  assert.ok(html.includes('data-ez-video-screen')&&html.includes('data-ez-play')&&
    html.includes('data-ez-play-label')&&html.includes('data-ez-watch'),
    path+' must preserve accessible first-party preview and official link');
  assert.equal((html.match(/data-ez-video="/g)||[]).length,2,
    path+' must preserve both original manufacturer clips');
  assert.ok(!/<iframe\b[^>]*youtube-nocookie/i.test(html),
    path+' must not hard-code a third-party iframe into initial HTML');
}
console.log('EZRaider EN/HE/HU/PT: muted autoplay, switching, focus, link and allowlist QA passed.');
