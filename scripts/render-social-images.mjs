import fs from 'node:fs';
import path from 'node:path';

const sitemap=fs.readFileSync('site/sitemap.xml','utf8');
const urls=[...sitemap.matchAll(/<loc>https:\/\/voy-pro\.com\/([^<]*)<\/loc>/g)].map(m=>m[1]);
let updated=0;

function pagePath(rel){
  const clean=String(rel||'').replace(/^\/+|\/+$/g,'');
  return path.join('dist',clean,'index.html');
}
function hasMeta(html,key,kind){
  const a=new RegExp('<meta[^>]+(?:'+kind+')="'+key+'"[^>]+content="[^"]+"','i');
  const b=new RegExp('<meta[^>]+content="[^"]+"[^>]+(?:'+kind+')="'+key+'"','i');
  return a.test(html)||b.test(html);
}
function localImage(html){
  const matches=[...html.matchAll(/<img[^>]+src="([^"]+)"/gi)].map(m=>m[1]);
  const src=matches.find(v=>v.startsWith('/assets/'))||matches.find(v=>v.startsWith('https://voy-pro.com/assets/'));
  if(!src)return null;
  return src.startsWith('/')?'https://voy-pro.com'+src:src;
}
for(const rel of urls){
  const file=pagePath(rel);
  let html=fs.readFileSync(file,'utf8');
  const needOg=!hasMeta(html,'og:image','property');
  const needTw=!hasMeta(html,'twitter:image','name');
  if(!needOg&&!needTw)continue;
  const image=localImage(html);
  if(!image)throw new Error('No local VOY PRO image available for '+file);
  let insert='';
  if(needOg)insert+='<meta content="'+image+'" property="og:image"/>';
  if(needTw)insert+='<meta content="'+image+'" name="twitter:image"/>';
  if(!html.includes('</head>'))throw new Error('Missing </head> in '+file);
  html=html.replace('</head>',insert+'</head>');
  fs.writeFileSync(file,html);
  updated++;
}
console.log('Rendered missing OG/Twitter images into '+updated+' sitemap pages using existing local page imagery.');
