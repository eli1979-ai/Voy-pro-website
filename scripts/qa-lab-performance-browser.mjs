// Repeatable, free, first-party laboratory performance and media audit.
// Not a field Core Web Vitals measurement. All external services, customer APIs,
// Google Maps, analytics, booking and payment endpoints are explicitly blocked.
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
import {chromium} from 'playwright';

const root=resolve('dist'),output=resolve('visual-qa-output/lab-performance');
const formats={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml',
  '.avif':'image/avif','.woff':'font/woff','.woff2':'font/woff2',
  '.json':'application/json'};
const paths=['/','/budapest/','/he/budapest/','/hu/budapest/',
  '/portugal/','/he/portugal/','/pt/portugal/','/ezraider/','/he/ezraider/'];
const widths=[390,1365];
await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const full=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
    if(!full.startsWith(root+sep)||(await stat(full)).isDirectory())
      throw Error('missing or unsafe asset');
    const body=await readFile(full);
    res.writeHead(200,{'Content-Type':formats[extname(full)]||'application/octet-stream',
      'Cache-Control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const local='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{})});
const samples=[],failures=[];
try{
  for(const width of widths){
    const page=await browser.newPage({
      viewport:{width,height:844},deviceScaleFactor:1,reducedMotion:'reduce',
      serviceWorkers:'block'});
    const lostLocal=[];
    page.on('requestfailed',req=>{
      if(req.url().startsWith(local+'/'))lostLocal.push(req.url().slice(local.length));
    });
    // Observe layout shifts without user interaction. LCP is advisory only.
    await page.addInitScript(()=>{
      window.__voyPerf={cls:0,lcpMs:null,lcpUrl:null,shifts:[]};
      try{
        new PerformanceObserver(list=>{
          for(const entry of list.getEntries()){
            if(entry.hadRecentInput)continue;
            window.__voyPerf.cls+=entry.value;
            // Layout Instability API sources identify the *moving* elements,
            // not necessarily what caused the movement. Keep diagnostics
            // bounded and never read user input, private text or form data.
            if(window.__voyPerf.shifts.length>=16)continue;
            const moved=(entry.sources||[]).slice(0,6).map(source=>{
              const node=source.node;
              const selector=node?[
                node.tagName?.toLowerCase(),
                node.id?'#'+node.id:'',
                ...[...node.classList||[]].slice(0,3).map(cls=>'.'+cls)
              ].join(''):'unknown';
              const old=source.previousRect||{},next=source.currentRect||{};
              return {selector,from:[Math.round(old.x||0),Math.round(old.y||0)],
                to:[Math.round(next.x||0),Math.round(next.y||0)],
                size:[Math.round(next.width||0),Math.round(next.height||0)]};
            });
            window.__voyPerf.shifts.push({time:Math.round(entry.startTime),
              score:Number(entry.value.toFixed(6)),moved});
          }
        }).observe({type:'layout-shift',buffered:true});
        new PerformanceObserver(list=>{
          const entries=list.getEntries(),last=entries[entries.length-1];
          if(last){
            window.__voyPerf.lcpMs=last.startTime;
            window.__voyPerf.lcpUrl=last.url||null;
          }
        }).observe({type:'largest-contentful-paint',buffered:true});
      }catch{/* Older browser variants do not expose these observations. */}
    });
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===local)return route.continue();
      // Existing pages refer to owned media via absolute HTTPS URLs. Fulfill
      // exclusively from the same local static snapshot to avoid live traffic.
      if(['voy-pro.com','www.voy-pro.com'].includes(url.hostname)&&
          url.protocol==='https:'&&url.pathname.startsWith('/assets/')){
        try{
          const file=resolve(root,'.'+decodeURIComponent(url.pathname));
          if(!file.startsWith(root+sep)||(await stat(file)).isDirectory())
            throw Error('not an asset');
          const content=await readFile(file);
          return route.fulfill({status:200,body:content,
            contentType:formats[extname(file)]||'application/octet-stream'});
        }catch{return route.fulfill({status:404,body:'Not found'});}
      }
      return route.abort();
    });
    try{
      for(const path of paths){
        lostLocal.length=0;
        let problem='';
        try{
          const response=await page.goto(local+path,{waitUntil:'load',timeout:18000});
          await page.evaluate(()=>document.fonts.ready);
          await page.waitForTimeout(700);
          const data=await page.evaluate(()=>{
            const result={metrics:window.__voyPerf||{},resources:[],images:[],
              domNodes:document.getElementsByTagName('*').length,
              scrollWidth:document.documentElement.scrollWidth};
            const navigation=performance.getEntriesByType('navigation')[0];
            if(navigation)result.metrics.navigationCompleteMs=Math.round(navigation.loadEventEnd);
            for(const resource of performance.getEntriesByType('resource')){
              if(!resource.name.startsWith(location.origin+'/'))continue;
              result.resources.push({path:new URL(resource.name).pathname,
                durationMs:Math.round(resource.duration),
                transferBytes:resource.transferSize||0,
                decodedBytes:resource.decodedBodySize||0});
            }
            for(const img of document.querySelectorAll('img')){
              const rect=img.getBoundingClientRect(),style=getComputedStyle(img);
              const aboveFold=rect.width>0&&rect.height>0&&rect.bottom>0&&
                rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth&&
                style.display!=='none'&&style.visibility!=='hidden';
              if(!aboveFold)continue;
              result.images.push({src:(img.currentSrc||img.src||'').slice(0,250),
                alt:img.alt||'',naturalWidth:img.naturalWidth,
                naturalHeight:img.naturalHeight,
                intrinsicDimensions:img.hasAttribute('width')&&img.hasAttribute('height'),
                cssAspectRatio:style.aspectRatio,
                loading:img.loading||'auto'});
            }
            return result;
          });
          const missingImages=data.images.filter(x=>x.naturalWidth===0);
          const missingHeroDimensions=data.images.filter(x=>
            !x.intrinsicDimensions&&
            (path.includes('/budapest/')||path.includes('/portugal/'))&&
            /(?:img12\.jpg|marvao-01\.jpg)/.test(x.src));
          const critical=lostLocal.filter(x=>/\.(js|css|svg|png|jpe?g|webp|woff2?)$/i.test(x));
          if(response?.status()!==200)problem='Page HTTP '+response?.status();
          else if(missingImages.length)problem='Missing above-fold images: '+missingImages.map(x=>x.src).join(', ');
          else if(missingHeroDimensions.length)problem='Hero image missing verified native dimensions';
          else if(critical.length)problem='Local asset requests failed: '+critical.join(', ');
          if(problem)failures.push({path,width,problem});
          const example={path,width,status:response?.status(),problem,...data,
            missingIntrinsicDimensions:data.images.filter(x=>!x.intrinsicDimensions&&x.cssAspectRatio==='auto').length};
          samples.push(example);
          if(width===390&&['/','/budapest/','/portugal/','/ezraider/'].includes(path)){
            const slug=path==='/'?'home':path.split('/')[1];
            await page.screenshot({path:join(output,'above-fold-'+slug+'.png'),
              fullPage:false}).catch(()=>{});
          }
        }catch(error){
          problem='Page error: '+String(error).slice(0,300);
          failures.push({path,width,problem});
          samples.push({path,width,problem});
        }
      }
    }finally{await page.close();}
  }
}finally{
  await browser.close();
  await new Promise(done=>server.close(done));
}
const lines=[
  '# VOY PRO first-party laboratory performance and imagery report','',
  'Measured against locally built static pages in Chrome with external services blocked.',
  'This is **not** real-user Core Web Vitals, a simulated slow-phone score, or a production LCP claim.',
  'Times, resource transfers and layout shifts can vary by CI machine. They are diagnostic, not release thresholds.',
  '',
  'Page/viewport cases: '+samples.length+'; failures: '+failures.length,'',
  '| Page | Width | Navigation load (lab ms) | Observed LCP (lab ms) | Observed CLS | Above-fold images | Missing image dimensions* |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...samples.map(s=>'| '+s.path+' | '+s.width+' | '+
    (s.metrics?.navigationCompleteMs??'—')+' | '+
    (s.metrics?.lcpMs==null?'—':Math.round(s.metrics.lcpMs))+' | '+
    (s.metrics?.cls==null?'—':s.metrics.cls.toFixed(3))+' | '+
    (s.images?.length??'—')+' | '+(s.missingIntrinsicDimensions??'—')+' |'),
  '',
  '* Advisory only: HTML dimensions and CSS aspect-ratio both help reserve layout space.',
  'Unloaded hidden/lazy images and externally hosted third-party assets are deliberately out of scope.',
  '',
  '## Largest observed layout shifts (diagnostic only)',
  ...samples.filter(s=>(s.metrics?.shifts||[]).length).flatMap(s=>
    (s.metrics.shifts||[]).sort((a,b)=>b.score-a.score).slice(0,3).map(shift=>
      '- '+s.path+' @ '+s.width+'px, '+shift.time+'ms, impact '+shift.score+
      ': '+shift.moved.map(m=>m.selector+' '+m.from.join(',')+' → '+m.to.join(',')).join('; '))),
  '',
  'Note: shift sources are impacted elements and may not be the root cause.',
  '',
  '## Failures',
  ...(failures.length?failures.map(f=>'- '+f.width+'px '+f.path+': '+f.problem):['- None']),
  '',
  '## Representative screenshots',
  'Stored alongside this report in the Actions artifact (home, Budapest, Marvão and EZRaider).',
  ''
];
await writeFile(join(output,'report.md'),lines.join('\n'));
await writeFile(join(output,'results.json'),JSON.stringify({samples,failures},null,2));
console.log('Lab performance: '+samples.length+' page-width scenarios; '+failures.length+' failures.');
console.log('Diagnostic no-dimension counts: '+samples.map(s=>s.path+'@'+s.width+'='+s.missingIntrinsicDimensions).join('; '));
if(failures.length)process.exitCode=1;
