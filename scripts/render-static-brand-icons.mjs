import fs from 'node:fs';
import path from 'node:path';

const root='dist';
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const full=path.join(dir,entry.name);
  return entry.isDirectory()?walk(full):[full];
});
const files=walk(root).filter(file=>file.endsWith('.html'));
const favicon='<link rel="icon" type="image/png" href="/assets/brand/voy-pro-symbol.png" data-voy-brand-icon="favicon"/>';
const apple='<link rel="apple-touch-icon" href="/assets/brand/voy-pro-symbol.png" data-voy-brand-icon="apple-touch"/>';
let updated=0;

for(const file of files){
  let html=fs.readFileSync(file,'utf8');
  let insert='';
  if(!html.includes('data-voy-brand-icon="favicon"'))insert+=favicon;
  if(!html.includes('data-voy-brand-icon="apple-touch"'))insert+=apple;
  if(!insert)continue;
  if(!html.includes('</head>'))throw new Error('Missing </head> in '+file);
  html=html.replace('</head>',insert+'</head>');
  fs.writeFileSync(file,html);
  updated++;
}
console.log('Rendered static VOY PRO brand icons into '+updated+' of '+files.length+' built HTML files.');
