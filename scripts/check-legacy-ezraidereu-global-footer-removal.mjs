#!/usr/bin/env node
/**
 * Private, offline-only exact-diff verifier for legacy Budapest WPCode
 * Header & Footer GLOBAL FOOTER injector. This is NOT WPCode snippet #488.
 *
 * Work may provide PRIVATE files under /private, never commit/export these:
 *   node scripts/check-legacy-ezraidereu-global-footer-removal.mjs --self-test
 *   node scripts/check-legacy-ezraidereu-global-footer-removal.mjs \
 *     --before /private/footer-original.html \
 *     --after /private/footer-candidate.html \
 *     --removals /private/footer-exact-removals.json
 *
 * JSON: {"schemaVersion":1,"target":"global-header-footer-footer",
 *   "removals":[{"kind":"red-floater-anchor","text":"EXACT ORIGINAL SPAN"},
 *   {"kind":"red-floater-label-handler","text":"EXACT ORIGINAL SPAN"},
 *   {"kind":"fareharbor-cta-rewriter","text":"EXACT ORIGINAL SPAN"}]}
 *
 * Never outputs raw HTML, user data, before/after text or private paths.
 * Does not access WordPress, verify a restore, deploy or approve live writes.
 */
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import assert from 'node:assert/strict';
const KINDS=['red-floater-anchor','red-floater-label-handler','fareharbor-cta-rewriter'];
const provider=/fareharbor(?:\.com|\/|\\\/|%2f)/i;
function count(source,sub){return sub?source.split(sub).length-1:0;}
export function inspectGlobalFooterRemoval(before,after,request,{syntaxCheck=true}={}){
 const findings=[];
 const add=(code)=>{if(!findings.includes(code))findings.push(code);};
 if(typeof before!=='string'||typeof after!=='string'||!request||typeof request!=='object'||
   Array.isArray(request)||before.length>2000000||after.length>2000000)
  return {status:'blocked',findings:['INVALID_OR_OVERSIZED_INPUT'],mayDeploy:false};
 if(request.schemaVersion!==1||request.target!=='global-header-footer-footer'||
    !Array.isArray(request.removals)||request.removals.length!==3)
  return {status:'blocked',findings:['BAD_TARGET_OR_REMOVAL_SHAPE'],mayDeploy:false};
 const kinds=request.removals.map(r=>r?.kind);
 if(new Set(kinds).size!==3||KINDS.some(k=>!kinds.includes(k)))add('MISSING_OR_DUPLICATE_REMOVAL_KIND');
 const parsed={};
 for(const r of request.removals){
  if(!r||typeof r.text!=='string'||r.text.length<15||r.text.length>100000){
   add('INVALID_REMOVAL_TEXT');continue;
  }
  if(typeof r.kind!=='string'||!KINDS.includes(r.kind)){add('UNEXPECTED_REMOVAL_KIND');continue;}
  const t=r.text;
  parsed[r.kind]=t;
  if(count(before,t)!==1)add('REMOVAL_MUST_APPEAR_EXACTLY_ONCE_IN_BEFORE:'+r.kind);
  if(after.includes(t))add('PROPOSED_REMOVAL_STILL_PRESENT:'+r.kind);
  if(/<script\b[^>]*\bsrc\s*=/i.test(t)||/wpcode.{0,20}488|ezre-wa-float-v1/i.test(t))
    add('REMOVAL_TOUCHES_UNRELATED_JQUERY_OR_WPCODE:'+r.kind);
  if(r.kind==='red-floater-anchor'){
   if(!/<a\b[^>]*\bfh-fixed--bottom\b/i.test(t)||
      !/fh-button-true-flat-red/i.test(t)||!provider.test(t)||
      !/<\/a\s*>/i.test(t))add('RED_FLOATER_SIGNATURE_NOT_MATCHED');
  }
  if(r.kind==='red-floater-label-handler'&&
    (!/Időpontot foglalok|Érdeklődés WhatsAppon/i.test(t)||
     !/fh-fixed--bottom|fh-button-true-flat-red/i.test(t)))
    add('LABEL_HANDLER_SIGNATURE_NOT_MATCHED');
  if(r.kind==='fareharbor-cta-rewriter'&&
    (!/hero__cta/.test(t)||!/button-cta/.test(t)||!provider.test(t)))
    add('CTA_REWRITER_SIGNATURE_NOT_MATCHED');
 }
 if(findings.length===0){
  // Source must be byte-for-byte identical outside these three approved spans.
  // This also protects any existing jQuery dependency and unrelated/footer code.
  let expected=before;
  for(const kind of KINDS)expected=expected.replace(parsed[kind],'');
  if(expected!==after)add('UNRELATED_SOURCE_CHANGED');
 }
 if(before.includes('ezre-wa-float-v1')||after.includes('ezre-wa-float-v1'))
   add('WRONG_SURFACE_WPCODE_488_MAY_BE_PRESENT');
 if(!provider.test(before))add('NO_LEGACY_PROVIDER_SIGNATURE_IN_BEFORE');
 if(provider.test(after))add('LEGACY_PROVIDER_REFERENCE_REMAINS_IN_AFTER');
 if(/fh-fixed--bottom|fh-button-true-flat-red/i.test(after))
   add('RED_FLOATER_SELECTOR_REMAINS_IN_AFTER');
 if(syntaxCheck){
  // Parse HTML inline scripts as syntax only; never execute any visitor code.
  // src imports (including jQuery) are skipped, preserved by byte-exact diff.
  const scripts=[...after.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  for(const [,attrs,code] of scripts){
   if(/\bsrc\s*=/i.test(attrs)||!code.trim())continue;
   try{new Script(code)}catch{add('AFTER_INLINE_SCRIPT_SYNTAX_ERROR');break;}
  }
 }
 return {status:findings.length?'blocked':'candidate-diff-structure-only',
   findings,removalsExpected:3,mayDeploy:false,
   note:'Private source span identity only, not verified installed footer, staging restore, execution order, external provider state or WordPress release approval.'};
}
function selfTest(){
 const anchor='<a href="https://fareharbor.com/book/" class="fh-fixed--bottom fh-button-true-flat-red">BOOK NOW</a>';
 const label='<script>document.querySelector(".fh-fixed--bottom").textContent="Időpontot foglalok";</script>';
 const rewrite='<script>document.querySelector(".hero__cta").href="https://fareharbor.com/book";document.querySelector(".button-cta").href="https://fareharbor.com/book";</script>';
 const jquery='<script src="https://cdn.example.org/jquery.min.js"></script>';
 const harmless='<script>window.ezraiderFooterReady=true;</script>';
 const before=jquery+anchor+label+rewrite+harmless,after=jquery+harmless;
 const request={schemaVersion:1,target:'global-header-footer-footer',removals:[
  {kind:'red-floater-anchor',text:anchor},
  {kind:'red-floater-label-handler',text:label},
  {kind:'fareharbor-cta-rewriter',text:rewrite}
 ]};
 const good=inspectGlobalFooterRemoval(before,after,request);
 assert.equal(good.status,'candidate-diff-structure-only');
 assert.equal(good.mayDeploy,false);
 const clone=x=>JSON.parse(JSON.stringify(x));
 function bad(b,a,r,needle){
  const result=inspectGlobalFooterRemoval(b,a,r);
  assert.equal(result.status,'blocked');
  assert.ok(result.findings.some(x=>x.includes(needle)),needle+': '+result.findings);
  assert.equal(result.mayDeploy,false);
 }
 bad(before,after.replace(jquery,''),request,'UNRELATED_SOURCE_CHANGED');
 bad(before,after+anchor,request,'PROPOSED_REMOVAL_STILL_PRESENT');
 bad(before,after+'<a href="https://fareharbor.com/">reserve</a>',request,'LEGACY_PROVIDER_REFERENCE_REMAINS');
 bad(before+anchor,after,request,'REMOVAL_MUST_APPEAR_EXACTLY_ONCE');
 bad(before,after,{...request,target:'wpcode-488'},'BAD_TARGET');
 const duplicate=clone(request);duplicate.removals[2].kind=duplicate.removals[1].kind;
 bad(before,after,duplicate,'MISSING_OR_DUPLICATE');
 const unlinked=clone(request);unlinked.removals[2].text=anchor;
 bad(before,after,unlinked,'CTA_REWRITER_SIGNATURE_NOT_MATCHED');
 const badJq=clone(request);badJq.removals[0].text=jquery;
 bad(before,after,badJq,'REMOVAL_TOUCHES_UNRELATED_JQUERY_OR_WPCODE');
 const noTranslation=clone(request);noTranslation.removals[1].text='<script>document.querySelector(".fh-fixed--bottom").remove();</script>';
 bad(before,after,noTranslation,'LABEL_HANDLER_SIGNATURE_NOT_MATCHED');
 bad(before,after+'<script>let = ;</script>',request,'AFTER_INLINE_SCRIPT_SYNTAX_ERROR');
 bad(before,after+'<div class="fh-fixed--bottom"></div>',request,'RED_FLOATER_SELECTOR_REMAINS');
 bad(before+'<script>console.log("ezre-wa-float-v1")</script>',after,request,'WRONG_SURFACE_WPCODE_488');
 bad(before,after,{},'BAD_TARGET_OR_REMOVAL_SHAPE');
 console.log('PASS: 14 private-global-footer exact-diff guard scenarios; no live writes');
}
if(process.argv.includes('--self-test'))selfTest();
else{
 const args=process.argv.slice(2),value=(name)=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
 if(!value('--before')||!value('--after')||!value('--removals')){
  console.error('Use --self-test or all of --before, --after, --removals (private local paths).');
  process.exitCode=2;
 }else{
  try{
   const result=inspectGlobalFooterRemoval(readFileSync(value('--before'),'utf8'),
     readFileSync(value('--after'),'utf8'),JSON.parse(readFileSync(value('--removals'),'utf8')));
   console.log(JSON.stringify(result,null,2));
   process.exitCode=result.status==='candidate-diff-structure-only'?0:2;
  }catch(error){
   // Avoid printing raw user paths, exception details or private content.
   console.error(JSON.stringify({status:'inconclusive',reason:'PRIVATE_FILE_OR_JSON_READ_FAILURE',mayDeploy:false}));
   process.exitCode=2;
  }
 }
}
