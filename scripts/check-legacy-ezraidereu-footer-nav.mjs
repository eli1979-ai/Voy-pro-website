#!/usr/bin/env node
/** Dependency-free synthetic tests; does not certify live WordPress rendering. */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const source=readFileSync(new URL('../docs/legacy-wordpress/ezraidereu-footer-nav-patch-v1.html',import.meta.url),'utf8');
const js=source.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
assert.ok(js,'Inline patch exists');
new vm.Script(js,{filename:'ezraidereu-footer-nav-patch-v1'});
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
console.log('Legacy footer fallback: 12 synthetic tests passed');
