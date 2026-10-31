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
assert.equal(first.frames.length,0,'page load must not create or fetch a YouTube iframe');
assert.equal(first.stage.current,first.play,'original focusable first-party Play button remains');
assert.equal(first.watch.href,'https://www.youtube.com/watch?v=1i2IQSShkQ8');
first.buttons[1].events.click();
assert.equal(first.frames.length,0,'switching clips before Play must not create an iframe');
assert.equal(first.stage.current,first.play,'Play button must stay visible after selection');
assert.equal(first.label.textContent,'Safety clip','Play poster label tracks selected clip');
assert.equal(first.watch.href,'https://www.youtube.com/watch?v=fMcnMk6gzYA',
  'official YouTube link must track selected clip before Play');
assert.equal(first.buttons[1].attrs['aria-pressed'],'true');
assert.equal(first.buttons[0].attrs['aria-pressed'],'false');
assert.equal(first.buttons[1].classes.has('is-active'),true);

first.play.events.click();
assert.equal(first.frames.length,1,'only a direct Play click creates a media iframe');
assert.equal(first.stage.current,first.frames[0],'iframe replaces poster after interaction');
assert.ok(first.frames[0].src.startsWith('https://www.youtube-nocookie.com/embed/fMcnMk6gzYA?'));
assert.ok(first.frames[0].src.includes('autoplay=1&mute=1'),
  'the explicitly selected video begins muted with native player controls');
assert.equal(first.frames[0].loading,'eager');
assert.equal(first.frames[0].referrerPolicy,'strict-origin-when-cross-origin');
assert.equal(first.frames[0].tabIndex,0,'new video iframe must be keyboard focusable');
assert.equal(first.frames[0].focusCount,1,'Play should explicitly focus the replacement player');
assert.equal(first.frames[0].focusedAfterInsertion,true,
  'focus the iframe only after replacing the Play button in the DOM');
assert.equal(first.frames[0].preventScroll,true,
  'focusing the video must not unexpectedly scroll away from the hero');

first.buttons[0].events.click();
assert.equal(first.frames.length,2,'after Play, switching clips replaces the existing video');
assert.equal(first.stage.current,first.frames[1]);
assert.ok(first.frames[1].src.startsWith('https://www.youtube-nocookie.com/embed/1i2IQSShkQ8?'));
assert.equal(first.watch.href,'https://www.youtube.com/watch?v=1i2IQSShkQ8');
assert.equal(first.buttons[0].attrs['aria-pressed'],'true');
assert.equal(first.frames[1].tabIndex,0,'new clip iframe stays keyboard reachable');
assert.equal(first.frames[1].focusCount,0,
  'selecting another clip after playback must not steal focus from the selection button');

first.buttons[1].dataset.ezVideo='javascript:alert(1)';
first.buttons[1].events.click();
assert.equal(first.frames.length,2,'unallowlisted clip ID must not create an iframe');
assert.equal(first.watch.href,'https://www.youtube.com/watch?v=1i2IQSShkQ8',
  'unallowlisted clip ID must not change the outbound video link');
assert.equal(first.buttons[0].attrs['aria-pressed'],'true',
  'unallowlisted clip must not change button selection');

const noPlay=simulate(false);
assert.equal(noPlay.frames.length,0,'missing Play button must fail closed');

const guides=[
 ['site/ezraider/index.html','Choose a video and press Play to load it.'],
 ['site/he/ezraider/index.html','בחרו סרטון ולחצו על כפתור הצפייה'],
 ['site/hu/ezraider/index.html','Válassz ki egy videót'],
 ['site/pt/ezraider/index.html','Escolha um vídeo e prima Reproduzir']
];
for(const [path,copy] of guides){
  const html=readFileSync(path,'utf8');
  assert.ok(html.includes(copy),path+' must explain explicit Play behavior');
  assert.ok(html.includes('data-ez-video-screen')&&html.includes('data-ez-play')&&
    html.includes('data-ez-play-label')&&html.includes('data-ez-watch'),
    path+' must preserve accessible first-party preview and official link');
  assert.equal((html.match(/data-ez-video="/g)||[]).length,2,
    path+' must preserve both original manufacturer clips');
  assert.ok(!/<iframe\b[^>]*youtube-nocookie/i.test(html),
    path+' must not hard-code a third-party iframe into initial HTML');
}
console.log('EZRaider EN/HE/HU/PT: explicit Play, deferred media, switching, links and allowlist QA passed.');
