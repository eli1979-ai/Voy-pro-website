import fs from 'node:fs';
import path from 'node:path';

const dist=path.join(process.cwd(),'dist');
const jsPath=path.join(dist,'assets','site.js');
let js=fs.readFileSync(jsPath,'utf8');

const oldWa="  document.querySelectorAll('[data-wa]').forEach(a=>a.addEventListener('click',()=>{a.href=whatsAppUrl();}));";
const newWa="  document.querySelectorAll('[data-wa]').forEach(a=>{a.href=whatsAppUrl();const refresh=()=>{a.href=whatsAppUrl();};a.addEventListener('pointerdown',refresh);a.addEventListener('click',refresh);});";
if(!js.includes(oldWa)) throw new Error('v1.32.7: WhatsApp binding target not found');
js=js.replace(oldWa,newWa);

const oldSubmit="      e.preventDefault();releaseHold();setBookingStep(1);document.querySelector('#live-checkout-shell')?.setAttribute('hidden','');slots.innerHTML='';";
const newSubmit="      e.preventDefault();releaseHold();document.querySelector('#live-checkout-shell')?.setAttribute('hidden','');slots.innerHTML='';";
if(!js.includes(oldSubmit)) throw new Error('v1.32.7: availability submit reset target not found');
js=js.replace(oldSubmit,newSubmit);

const checkingNeedle="status.textContent=t('Checking";
const checkingAt=js.indexOf(checkingNeedle);
if(checkingAt<0) throw new Error('v1.32.7: availability checking state not found');
js=js.slice(0,checkingAt)+"setBookingStep(2);"+js.slice(checkingAt);

fs.writeFileSync(jsPath,js);

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of walk(dist).filter(f=>f.endsWith('.html'))){
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/(<a\b[^>]*data-wa=""[^>]*href=)"#"/g,'$1"https://wa.me/36300993099"');
  html=html.replace(/(<a\b[^>]*href=)"#"([^>]*data-wa="")/g,'$1"https://wa.me/36300993099"$2');
  fs.writeFileSync(file,html);
}

const releasePath=path.join(dist,'release.json');
const release=JSON.parse(fs.readFileSync(releasePath,'utf8'));
release.version='1.32.7';
fs.writeFileSync(releasePath,JSON.stringify(release,null,2)+'\n');
console.log('Applied VOY PRO v1.32.7 WhatsApp and booking-step fixes.');
