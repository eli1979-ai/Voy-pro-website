import fs from 'node:fs';
import path from 'node:path';

const dist=path.join(process.cwd(),'dist');
const siteJsPath=path.join(dist,'assets','site.js');
let js=fs.readFileSync(siteJsPath,'utf8');

const oldApi=`  async function api(path,options={}){
    if(!bookingEnabled) throw new Error('BOOKING_NOT_CONFIGURED');
    const headers=authHeaders(options.headers||{});
    const r=await fetch(apiRoot+path,{...options,headers});
    const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch(e){data={error:text||r.statusText};}
    if(!r.ok){const err=new Error(data?.error||('HTTP '+r.status));err.status=r.status;err.code=data?.code;err.data=data;throw err;}
    return data;
  }`;

const newApi=`  async function api(path,options={}){
    if(!bookingEnabled) throw new Error('BOOKING_NOT_CONFIGURED');
    const headers=authHeaders(options.headers||{});
    const timeoutMs=Math.max(1000,Number(options.timeoutMs||8000));
    const externalSignal=options.signal;
    const controller=externalSignal?null:new AbortController();
    const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
    const {timeoutMs:_timeoutMs,...fetchOptions}=options;
    try{
      const r=await fetch(apiRoot+path,{...fetchOptions,headers,signal:externalSignal||controller?.signal});
      const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch(e){data={error:text||r.statusText};}
      if(!r.ok){const err=new Error(data?.error||('HTTP '+r.status));err.status=r.status;err.code=data?.code;err.data=data;throw err;}
      return data;
    }catch(e){
      if(e?.name==='AbortError'){const err=new Error('Request timed out');err.code='REQUEST_TIMEOUT';throw err;}
      throw e;
    }finally{if(timer)clearTimeout(timer);}
  }`;

if(!js.includes(oldApi)) throw new Error('v1.32.5: api() patch target not found');
js=js.replace(oldApi,newApi);

const marker='  async function hydrateCatalog(){';
if(!js.includes(marker)) throw new Error('v1.32.5: hydrateCatalog marker not found');

const fallbackFn=`  function fallbackBudapestProducts(){
    const title=(en,he,hu)=>locale==='he'?he:locale==='hu'?hu:en;
    return [
      {id:'exp_bud_buda',slug:'buda-highlights',title:title('Buda Highlights by EZRaider','סיור בודה על EZRaider','Budai városnézés EZRaiderrel'),durationMinutes:120,basePrice:70,priceFrom:70,currency:'EUR',maxIndependentRiders:12,bookingEnabled:true,privateAllowed:true,privateSurchargePerRider:30,privateMinRiders:2,flexibleDepartureWhenPrivate:true,guideLanguages:['en','he','hu','es']},
      {id:'exp_bud_margaret',slug:'margaret-island',title:title('Margaret Island by EZRaider','סיור אי מרגיט על EZRaider','Margitsziget EZRaiderrel'),durationMinutes:120,basePrice:70,priceFrom:70,currency:'EUR',maxIndependentRiders:12,bookingEnabled:true,privateAllowed:true,privateSurchargePerRider:30,privateMinRiders:2,flexibleDepartureWhenPrivate:true,guideLanguages:['en','he','hu','es']}
    ];
  }
  function seedExperienceSelects(selects,products){
    (products||[]).forEach(p=>{productCache.bySlug[p.slug]=p;productCache.byId[p.id]=p;});
    selects.forEach(s=>{
      const before=s.value;
      s.innerHTML='';
      (products||[]).forEach(p=>{const o=document.createElement('option');o.value=p.id;o.dataset.slug=p.slug;o.textContent=p.title;s.appendChild(o);});
      if(before&&(products||[]).some(p=>p.id===before))s.value=before;
    });
  }

`;
js=js.replace(marker,fallbackFn+marker);

const hydrateStart=`  async function hydrateCatalog(){
    const selects=[...document.querySelectorAll('select[name="experience"]')];
    if(!bookingEnabled){`;
const hydrateStartNew=`  async function hydrateCatalog(){
    const selects=[...document.querySelectorAll('select[name="experience"]')];
    const provisional=fallbackBudapestProducts();
    seedExperienceSelects(selects,provisional);
    if(!bookingEnabled){`;
if(!js.includes(hydrateStart)) throw new Error('v1.32.5: hydrate start patch target not found');
js=js.replace(hydrateStart,hydrateStartNew);

const loadLine=`      const products=await api('/experiences',{method:'GET'});`;
const loadReplacement=`      let catalogFallback=false;
      let products=[];
      try{products=await api('/experiences',{method:'GET',timeoutMs:5000});}
      catch(catalogError){catalogFallback=true;products=fallbackBudapestProducts();}
      if(!Array.isArray(products)||!products.length){catalogFallback=true;products=fallbackBudapestProducts();}`;
if(!js.includes(loadLine)) throw new Error('v1.32.5: catalog load patch target not found');
js=js.replace(loadLine,loadReplacement);

const selectBlock=`      selects.forEach(s=>{
        s.innerHTML=''; s.disabled=false;
        bookable.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.dataset.slug=p.slug;o.textContent=p.title;s.appendChild(o);});
        if(intended)s.value=intended.id;
      });`;
const selectBlockNew=`      selects.forEach(s=>{
        const before=s.value;
        s.innerHTML=''; s.disabled=false;
        bookable.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.dataset.slug=p.slug;o.textContent=p.title;s.appendChild(o);});
        if(before&&bookable.some(p=>p.id===before))s.value=before;
        else if(intended)s.value=intended.id;
      });`;
if(!js.includes(selectBlock)) throw new Error('v1.32.5: select preservation patch target not found');
js=js.replace(selectBlock,selectBlockNew);

const activeLine=`      const active=intended||(!isSpecialPage?bookable[0]:null);`;
const activeLineNew=`      const selectedId=selects.find(s=>s.value)?.value||null;
      const active=(selectedId?bookable.find(p=>p.id===selectedId):null)||intended||(!isSpecialPage?bookable[0]:null);
      if(catalogFallback){
        const st=document.querySelector('#availability-status');
        if(st)st.textContent=locale==='he'?'בחרו סיור, תאריך וקבוצה. הזמינות העדכנית תיבדק בעת החיפוש.':locale==='hu'?'Válassz túrát, dátumot és létszámot. Az aktuális elérhetőséget a kereséskor ellenőrizzük.':'Choose a tour, date and group. Live availability will be checked when you search.';
      }`;
if(!js.includes(activeLine)) throw new Error('v1.32.5: active product patch target not found');
js=js.replace(activeLine,activeLineNew);

fs.writeFileSync(siteJsPath,js);

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of walk(dist).filter(f=>f.endsWith('.html'))){
  const rel=path.relative(dist,file).replaceAll('\\','/');
  if(!/^(?:he\/|hu\/)?budapest\//.test(rel))continue;
  let html=fs.readFileSync(file,'utf8');
  let labels={buda:'Buda Highlights by EZRaider',margaret:'Margaret Island by EZRaider'};
  if(rel.startsWith('he/'))labels={buda:'סיור בודה על EZRaider',margaret:'סיור אי מרגיט על EZRaider'};
  if(rel.startsWith('hu/'))labels={buda:'Budai városnézés EZRaiderrel',margaret:'Margitsziget EZRaiderrel'};
  html=html.replace(/<select name="experience"><option value="">Loading tours…<\/option><\/select>/g,
    `<select name="experience"><option value="exp_bud_buda">${labels.buda}</option><option value="exp_bud_margaret">${labels.margaret}</option></select>`);
  fs.writeFileSync(file,html);
}

const releasePath=path.join(dist,'release.json');
const release=JSON.parse(fs.readFileSync(releasePath,'utf8'));
release.version='1.32.5';
fs.writeFileSync(releasePath,JSON.stringify(release,null,2)+'\n');
console.log('Applied VOY PRO v1.32.5 resilient booking catalog.');
