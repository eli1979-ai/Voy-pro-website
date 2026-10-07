import fs from 'node:fs';

const file='dist/manage/index.html';
let html=fs.readFileSync(file,'utf8');

const before="const api=async(path,opt={})=>{const r=await fetch(c.apiRoot+path,{...opt,headers:{...h,...(opt.headers||{})}});let x={};try{x=await r.json()}catch(e){}if(!r.ok){const er=new Error(x.error||'Request failed');er.code=x.code;throw er}return x};";
const after="const api=async(path,opt={})=>{const timeoutMs=Math.max(1000,Number(opt.timeoutMs||8000)),externalSignal=opt.signal,controller=externalSignal?null:new AbortController(),timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null,{timeoutMs:_timeoutMs,...fetchOpt}=opt;try{const r=await fetch(c.apiRoot+path,{...fetchOpt,headers:{...h,...(fetchOpt.headers||{})},signal:externalSignal||controller?.signal});let x={};try{x=await r.json()}catch(e){}if(!r.ok){const er=new Error(x.error||'Request failed');er.code=x.code;throw er}return x}catch(e){if(e?.name==='AbortError'){const er=new Error('Request timed out');er.code='REQUEST_TIMEOUT';throw er}throw e}finally{if(timer)clearTimeout(timer)}};";

if(!html.includes(before)){
  console.error('Manage API timeout renderer: expected API wrapper not found.');
  process.exit(1);
}
html=html.replace(before,after);
fs.writeFileSync(file,html);
console.log('Rendered bounded FBM request timeout into Manage Booking.');
