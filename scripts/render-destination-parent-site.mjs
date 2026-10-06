import fs from 'node:fs';
import path from 'node:path';

const pages=[
  {
    "path": "budapest/index.html",
    "url": "https://voy-pro.com/budapest/",
    "lang": "en",
    "name": "Budapest EZRaider Tours | Guided Electric City Tours | VOY PRO",
    "place": "Budapest, Hungary"
  },
  {
    "path": "he/budapest/index.html",
    "url": "https://voy-pro.com/he/budapest/",
    "lang": "he",
    "name": "סיורי EZRaider בבודפשט | סיור מודרך וחווייתי | VOY PRO",
    "place": "Budapest, Hungary"
  },
  {
    "path": "hu/budapest/index.html",
    "url": "https://voy-pro.com/hu/budapest/",
    "lang": "hu",
    "name": "Budapesti EZRaider túrák | Vezetett városnézés | VOY PRO",
    "place": "Budapest, Hungary"
  },
  {
    "path": "portugal/index.html",
    "url": "https://voy-pro.com/portugal/",
    "lang": "en",
    "name": "EZRaider Tours in Marvão, Portugal | VOY PRO",
    "place": "Marvão, Portugal"
  },
  {
    "path": "he/portugal/index.html",
    "url": "https://voy-pro.com/he/portugal/",
    "lang": "he",
    "name": "סיורי EZRaider במרבאו, פורטוגל | VOY PRO",
    "place": "Marvão, Portugal"
  },
  {
    "path": "pt/portugal/index.html",
    "url": "https://voy-pro.com/pt/portugal/",
    "lang": "pt",
    "name": "Passeios de EZRaider em Marvão, Portugal | VOY PRO",
    "place": "Marvão, Portugal"
  }
];

for(const page of pages){
  const file=path.join('dist',page.path);
  let html=fs.readFileSync(file,'utf8');
  if(html.includes('"isPartOf":{"@id":"https://voy-pro.com/#website"}'))continue;
  const graph={
    "@context":"https://schema.org",
    "@type":"WebPage",
    "@id":page.url+"#webpage",
    "url":page.url,
    "name":page.name,
    "isPartOf":{"@id":"https://voy-pro.com/#website"},
    "about":{"@type":"Place","name":page.place},
    "inLanguage":page.lang
  };
  const schema='<script type="application/ld+json">'+JSON.stringify(graph)+'</script>';
  if(!html.includes('</head>'))throw new Error('Missing </head> in '+file);
  html=html.replace('</head>',schema+'</head>');
  fs.writeFileSync(file,html);
}
console.log('Rendered destination parent-site graph into '+pages.length+' built destination homes.');
