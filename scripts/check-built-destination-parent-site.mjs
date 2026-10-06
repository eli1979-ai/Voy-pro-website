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
const failures=[];

for(const page of pages){
  const file=path.join('dist',page.path);
  const html=fs.readFileSync(file,'utf8');
  const required=[
    '"@type":"WebPage"',
    '"@id":"'+page.url+'#webpage"',
    '"url":"'+page.url+'"',
    '"isPartOf":{"@id":"https://voy-pro.com/#website"}',
    '"about":{"@type":"Place","name":"'+page.place+'"}',
    '"inLanguage":"'+page.lang+'"'
  ];
  for(const token of required){
    if(!html.includes(token))failures.push(file+': missing '+token);
  }
}
if(failures.length){
  console.error('Built destination parent-site graph guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Built destination parent-site graph guard OK: 6 destination homes link to the VOY PRO parent WebSite.');
