import fs from 'node:fs';
import path from 'node:path';

const root='dist';
const files=[];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(entry.isFile()&&entry.name.endsWith('.html'))files.push(full);
  }
}
walk(root);

function decode(text){
  return String(text||'')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>');
}
function textOnly(html){
  return decode(String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
}

let renderedPages=0;
let renderedQuestions=0;

for(const file of files){
  let html=fs.readFileSync(file,'utf8');
  if(!/<details\b[^>]*data-faq=/i.test(html))continue;
  if(/"@type"\s*:\s*"FAQPage"/i.test(html))continue;

  const entries=[];
  for(const match of html.matchAll(/<details\b[^>]*data-faq="[^"]+"[^>]*>([\s\S]*?)<\/details>/gi)){
    const body=match[1];
    const summary=(body.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)||[])[1]||'';
    const answer=body.replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/i,'');
    const question=textOnly(summary);
    const response=textOnly(answer);
    if(question&&response)entries.push({
      '@type':'Question',
      name:question,
      acceptedAnswer:{'@type':'Answer',text:response}
    });
  }
  if(!entries.length)continue;

  const schema={'@context':'https://schema.org','@type':'FAQPage',mainEntity:entries};
  if(!html.includes('</head>'))throw new Error('Missing </head> in '+file);
  html=html.replace('</head>','<script type="application/ld+json">'+JSON.stringify(schema)+'</script></head>');
  fs.writeFileSync(file,html);
  renderedPages++;
  renderedQuestions+=entries.length;
}

console.log('Rendered FAQPage schema into '+renderedPages+' built pages from '+renderedQuestions+' visible data-faq answers.');
