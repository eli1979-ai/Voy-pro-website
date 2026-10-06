import fs from 'node:fs';
import path from 'node:path';

const sitemap=fs.readFileSync('site/sitemap.xml','utf8');
const urls=[...sitemap.matchAll(/<loc>https:\/\/voy-pro\.com\/([^<]*)<\/loc>/g)].map(m=>m[1]);
let updated=0;

function pagePath(rel){
  const clean=String(rel||'').replace(/^\/+|\/+$/g,'');
  return path.join('dist',clean,'index.html');
}
function attr(html,key,kind='name'){
  const a=new RegExp('<meta[^>]+(?:'+kind+')="'+key+'"[^>]+content="([^"]+)"','i');
  const b=new RegExp('<meta[^>]+content="([^"]+)"[^>]+(?:'+kind+')="'+key+'"','i');
  return (html.match(a)||html.match(b)||[])[1]||null;
}
for(const rel of urls){
  const file=pagePath(rel);
  let html=fs.readFileSync(file,'utf8');
  const title=(html.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]?.trim()||attr(html,'og:title','property');
  const description=attr(html,'description','name')||attr(html,'og:description','property');
  if(!title||!description)throw new Error('Missing base title/description for '+file);
  let insert='';
  if(!/name="twitter:title"/i.test(html))insert+='<meta content="'+title.replace(/"/g,'&quot;')+'" name="twitter:title"/>';
  if(!/name="twitter:description"/i.test(html))insert+='<meta content="'+description.replace(/"/g,'&quot;')+'" name="twitter:description"/>';
  if(insert){
    if(!html.includes('</head>'))throw new Error('Missing </head> in '+file);
    html=html.replace('</head>',insert+'</head>');
    fs.writeFileSync(file,html);
    updated++;
  }
}
console.log('Rendered Twitter title/description into '+updated+' of '+urls.length+' sitemap pages.');
