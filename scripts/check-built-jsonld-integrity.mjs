import fs from 'node:fs';
import path from 'node:path';

const sitemap=fs.readFileSync('site/sitemap.xml','utf8');
const urls=[...sitemap.matchAll(/<loc>https:\/\/voy-pro\.com\/([^<]*)<\/loc>/g)].map(m=>m[1]);
const failures=[];
let blocks=0;

function pagePath(rel){
  const clean=String(rel||'').replace(/^\/+|\/+$/g,'');
  return path.join('dist',clean,'index.html');
}

for(const rel of urls){
  const file=pagePath(rel);
  const html=fs.readFileSync(file,'utf8');
  const scripts=[...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  if(!scripts.length){
    failures.push(file+': no JSON-LD block found');
    continue;
  }
  for(let i=0;i<scripts.length;i++){
    blocks++;
    const raw=scripts[i][1].trim();
    try{
      const value=JSON.parse(raw);
      const roots=Array.isArray(value)?value:[value];
      if(!roots.length)failures.push(file+': JSON-LD block '+(i+1)+' is empty');
      for(const root of roots){
        if(!root||typeof root!=='object')failures.push(file+': JSON-LD block '+(i+1)+' root is not an object');
        if(root&&typeof root==='object'&&!root['@context'])failures.push(file+': JSON-LD block '+(i+1)+' is missing @context');
      }
    }catch(error){
      failures.push(file+': invalid JSON-LD block '+(i+1)+' — '+error.message);
    }
  }
}

if(failures.length){
  console.error('Built JSON-LD integrity guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}

console.log('Built JSON-LD integrity guard OK: '+blocks+' blocks parsed across '+urls.length+' sitemap pages.');
