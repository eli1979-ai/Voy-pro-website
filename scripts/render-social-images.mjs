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

function spanishBudapestImage(rel){
  if(!rel.startsWith('es/budapest/'))return null;
  const en=fs.readFileSync(pagePath(rel.slice(3)),'utf8');
  const og=[...en.matchAll(/<meta\b[^>]*>/gi)]
    .map(x=>x[0])
    .find(x=>/property="og:image"/i.test(x));
  const canonical=og?.match(/content="([^"]+)"/i)?.[1]||null;
  const candidate=canonical||localImage(en);
  if(!candidate)return null;
  const uri=new URL(candidate,'https://voy-pro.com');
  // No external vendor image URLs may enter Spanish social cards.
  if(uri.origin!=='https://voy-pro.com'||!uri.pathname.startsWith('/assets/'))
    throw new Error('Spanish social image must be a local VOY PRO asset: '+rel);
  return uri.href;
}
for(const rel of urls){
  const file=pagePath(rel);
  let html=fs.readFileSync(file,'utf8');

  if(rel.startsWith('es/budapest/')){
    const title=(html.match(/<title>([^<]+)<[/]title>/i)||[])[1]||'';
    const desc=(html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)||[])[1]||'';
    const canonical='https://voy-pro.com/'+rel;
    if(!title||!desc||!html.includes('href="'+canonical+'"'))
      throw new Error('Spanish social metadata missing canonical/title/description: '+rel);
    const encode=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;')
      .replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const fields=[
      ['og:title','property',title],
      ['og:description','property',desc],
      ['og:url','property',canonical],
      ['og:site_name','property','VOY PRO'],
      ['twitter:card','name','summary_large_image']
    ];
    let tags='';
    for(const [key,kind,value] of fields)
      if(!hasMeta(html,key,kind))
        tags+='<meta '+kind+'="'+key+'" content="'+encode(value)+'"/>';
    if(tags)html=html.replace('</head>',tags+'</head>');
    if(!html.includes('type="application/ld+json"')){
      const structured={
        '@context':'https://schema.org','@type':'WebPage',
        name:title,description:desc,url:canonical,inLanguage:'es',
        isPartOf:{'@type':'WebSite',name:'VOY PRO',url:'https://voy-pro.com/'}
      };
      html=html.replace('</head>','<script type="application/ld+json">'+
        JSON.stringify(structured).replace(/</g,'\\u003c')+'</script></head>');
    }
  }
  const needOg=!hasMeta(html,'og:image','property');
  const needTw=!hasMeta(html,'twitter:image','name');
  if(!needOg&&!needTw)continue;
  const image=localImage(html)||spanishBudapestImage(rel);
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
