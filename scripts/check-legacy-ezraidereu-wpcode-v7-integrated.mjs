#!/usr/bin/env node
/** Dependency-free synthetic tests; does not certify live WordPress rendering. */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const source=readFileSync(new URL('../docs/legacy-wordpress/ezraidereu-wpcode-488-v7-integrated-map-hold.html',import.meta.url),'utf8');
const scripts=[...source.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length,2,'v7 main plus one preserved v6.2 footer handler');
const js=scripts[1]?.[1];
assert.ok(js,'Footer script exists');
const preservedMain=createHash('sha256').update(scripts[0][1]).digest('hex');
assert.equal(preservedMain,'5cac99523bb800e610cdedbd30abd6ebc548a4a0e6b25484c84e683a2227325c','exact reviewed v7 main script without speculative map rewrite');
new vm.Script(scripts[0][1],{filename:'ezraidereu-wpcode-v7-map-hold'});
new vm.Script(js,{filename:'ezraidereu-footer-nav-patch-v1'});
assert.equal(createHash('sha256').update(js).digest('hex'),
 'fc2c9e2d6ce17f13c27ffbd9abf094e2e68153b01ecdc3af1bd6f8b47b810080',
 'identical owner-installed v6.2 footer navigation handler');
assert.equal((source.match(/function rewrite\(\)/g)||[]).length,1,'one existing FareHarbor-to-WhatsApp rewrite');
assert.equal((source.match(/ezre-wa-float-v1\x27\)\)/g)||[]).length>=1,true,'green WhatsApp control retained');
assert.ok(scripts[0][1].includes('function correctBudapestEmail()'),'Budapest email repair retained');
assert.ok(scripts[0][1].includes('function repairTourNavigation()'),'tour navigation retained');
assert.ok(!scripts[0][1].includes("m.src='https://www.google.com/maps?q="),'no arbitrary map iframe rewrite');
assert.ok(!scripts[0][1].includes('info.appendChild(label)'),'no unverified guest meeting-point card');
assert.ok(!scripts[0][1].includes("n.nodeValue=n.nodeValue.replace("),'no blind Pilvax-to-address substitution');
assert.ok(scripts[0][1].includes('Verified release hold:'),'explicit map source hold retained');

function environment({path='/budapest/',id='tours',heading='The Tours',inFooter=true,href='https://ezraidereu.com/budapest/#tours'}={}){
 let handler,scrolled=false,assigned=null,historyUrl=null,prevented=false,stopped=false,unresolved=null;
 const section={style:{},scrollIntoView(){scrolled=true;},textContent:heading};
 const anchor={href,target:'',hasAttribute(){return false;},setAttribute(k,v){if(k==='data-ezre-footer-unresolved')unresolved=v;},closest(sel){return sel==='a[href]'||(inFooter&&sel.includes('footer'))?this:null;}};
 const document={baseURI:'https://ezraidereu.com'+path,addEventListener(type,fn,capture){assert.equal(type,'click');assert.equal(capture,true);handler=fn;},getElementById(x){return x===id?section:null;},querySelectorAll(){return [section];}};
 const location={pathname:path,hostname:'ezraidereu.com',assign(x){assigned=x;}};
 const window={location,history:{state:null,replaceState(_s,_t,x){historyUrl=x;}},matchMedia(){return {matches:false}}};
 vm.runInNewContext(js,{document,window,URL,decodeURIComponent,Object,String});
 return {click(extra={}){const ev={target:{closest:()=>anchor},button:0,defaultPrevented:false,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;},...extra};handler(ev);return {scrolled,assigned,historyUrl,prevented,stopped,unresolved};}};
}
const direct=environment().click();assert.equal(direct.scrolled,true);assert.equal(direct.historyUrl,'/budapest/#tours');assert.equal(direct.prevented,true);
const fallback=environment({id:'none',heading:'Contact Us',href:'https://ezraidereu.com/budapest/#contact'}).click();assert.equal(fallback.scrolled,true);
const cross=environment({path:'/budapest/tours/buda-castle-tour/',href:'https://ezraidereu.com/budapest/fooldal/#gallery'}).click();assert.equal(cross.assigned,'https://ezraidereu.com/budapest/fooldal/#gallery');assert.equal(cross.prevented,true);
assert.equal(environment({inFooter:false}).click().prevented,false);
assert.equal(environment().click({ctrlKey:true}).prevented,false);
assert.equal(environment({href:'https://elsewhere.example/budapest/#tours'}).click().prevented,false);
assert.equal(environment({href:'https://ezraidereu.com/budapest/#garbage'}).click().prevented,false);
const missing=environment({id:'none',heading:'Completely Different',href:'https://ezraidereu.com/budapest/#about'}).click();assert.equal(missing.unresolved,'about');assert.equal(missing.prevented,false);
// Verify Hebrew encoded path, Hungarian heading and rejection of malformed link hashes.
const hebrew=environment({path:'/budapest/בית/',id:'none',heading:'הסיורים:',href:'https://ezraidereu.com/budapest/%D7%91%D7%99%D7%AA/#tours'}).click();
assert.equal(hebrew.scrolled,true);assert.equal(hebrew.assigned,null);
const hungarian=environment({path:'/budapest/fooldal/',id:'none',heading:'Miért az EZRaider?',href:'https://ezraidereu.com/budapest/fooldal/#whyezraider'}).click();
assert.equal(hungarian.scrolled,true);
assert.equal(environment({href:'http://ezraidereu.com/budapest/#tours'}).click().prevented,false);
assert.equal(environment({href:'https://ezraidereu.com/budapest/#%invalid'}).click().prevented,false);
console.log('Legacy integrated v7: 12 footer cases plus 9 source/invariance checks passed');
