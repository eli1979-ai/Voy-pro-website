#!/usr/bin/env node
/**
 * EZRaiderEU legacy Budapest home-source content guard.
 * Read only. Never changes WordPress/ACF, never fetches production, and never
 * evaluates page JavaScript. A clean post-release check must be performed on
 * fresh server-rendered HTML, not the text after WPCode DOM replacement.
 *
 * CLI:
 *   node scripts/audit-legacy-ezraidereu-home-copy.mjs \
 *     --locale he --input path/to/fresh-server-response.html --mode post
 *   node scripts/audit-legacy-ezraidereu-home-copy.mjs --self-test
 */
import { readFileSync } from 'node:fs';
const manifestURL=new URL('../docs/legacy-wordpress/ezraidereu-acf-home-copy-replacement-manifest-20261028.json',import.meta.url);
export const manifest=JSON.parse(readFileSync(manifestURL,'utf8'));
const decodeEntities=s=>String(s)
  .replace(/&#(x[0-9a-f]+|[0-9]+);?/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):parseInt(v,10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):' ';})
  .replace(/&(nbsp|amp|lt|gt|quot|apos|rsquo|ndash|mdash);/gi,(_,x)=>({nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",rsquo:'’',ndash:'–',mdash:'—'})[x.toLowerCase()]||' ');
export function normalizeSource(value){
  return decodeEntities(String(value)
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
    .replace(/<[^>]+>/g,' '))
    .normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
}
export function auditSource(text,locale){
  if(!['en','hu','he'].includes(locale))throw new Error('Required locale: en, hu or he');
  const normalized=normalizeSource(text);
  const rules=manifest.rules.filter(r=>r.locale===locale);
  if(normalized.length<250 || !normalized.includes(locale==='he'?'בודפשט':'budapest')){
    return {status:'inconclusive',locale,reason:'Not a substantive Budapest homepage server response. Could be a challenge/cache/error page.',matches:[],replacementsFound:[],missing:rules.map(r=>r.id)};
  }
  const matches=rules.filter(r=>normalized.includes(normalizeSource(r.oldText))).map(r=>({id:r.id,risk:r.risk,key:r.key}));
  const replacementsFound=rules.filter(r=>normalized.includes(normalizeSource(r.replacement))).map(r=>r.id);
  let status=matches.length?'risk-present':replacementsFound.length>=3?'candidate-clean':'inconclusive';
  return {status,locale,oldRiskCount:matches.length,expectedRules:rules.length,
    replacementsPresent:replacementsFound.length,matches,replacementsFound};
}
function main(){
  const args=process.argv.slice(2);
  if(args.includes('--self-test')){
    for(const locale of ['en','hu','he']){
      const rules=manifest.rules.filter(r=>r.locale===locale);
      if(rules.length!==8)throw new Error('Expected 8 rules for '+locale);
      const title=locale==='he'?'סיורי בודפשט':'Budapest guided tours';
      const before=title+' '.repeat(300)+' '+rules.map(r=>r.oldText).join(' ');
      const after=title+' '.repeat(300)+' '+rules.map(r=>r.replacement).join(' ');
      const b=auditSource(before,locale),a=auditSource(after,locale);
      if(b.status!=='risk-present'||b.oldRiskCount!==8)throw new Error('Baseline detection failed '+locale+': '+JSON.stringify(b));
      if(a.status!=='candidate-clean'||a.oldRiskCount!==0||a.replacementsPresent!==8)throw new Error('Post baseline failed '+locale+': '+JSON.stringify(a));
      if(auditSource('Just a challenge',locale).status!=='inconclusive')throw new Error('Challenge detection failed');
    }
    console.log('PASS: EN/HU/HE x baseline, corrected copy, and short challenge = 9 assertions');
    return;
  }
  const get=flag=>{const idx=args.indexOf(flag);return idx===-1?null:args[idx+1]};
  const locale=get('--locale'),input=get('--input'),mode=get('--mode')||'post';
  if(!locale||!input||!['post','baseline'].includes(mode)){
    console.error('Usage: node scripts/audit-legacy-ezraidereu-home-copy.mjs --locale en|hu|he --input server.html --mode baseline|post');
    process.exitCode=2;return;
  }
  const result=auditSource(readFileSync(input,'utf8'),locale);
  console.log(JSON.stringify(result,null,2));
  if(result.status==='inconclusive'){process.exitCode=2;return;}
  if(mode==='post'&&result.status==='risk-present')process.exitCode=1;
  if(mode==='baseline'&&result.status!=='risk-present')process.exitCode=1;
}
if(process.argv[1] && import.meta.url.endsWith('/'+process.argv[1].split(/[\\/]/).pop()))main();
