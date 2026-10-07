import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('dist/manage/index.html','utf8');
const failures=[];
const requireText=(text,label)=>{if(!html.includes(text))failures.push(label);};
const forbidText=(text,label)=>{if(html.includes(text))failures.push(label);};

requireText("timeZone:'Europe/Budapest'",'Manage date helper is not Budapest-local');
requireText('min="${manageBudapestDate(0)}"','Manage change-date input does not use Budapest-local minimum');
forbidText('min="${new Date().toISOString().slice(0,10)}"','UTC-based Manage minimum date remains');

let inlineScripts=0;
for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
  const code=match[1].trim();
  if(!code)continue;
  inlineScripts++;
  try{new vm.Script(code,{filename:'manage-budapest-date-inline-'+inlineScripts+'.js'});}
  catch(error){failures.push('inline Manage script '+inlineScripts+' failed to compile: '+error.message);}
}

if(failures.length){
  console.error('Manage Budapest-date guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Manage Budapest-date guard OK: booking changes use the Budapest operating date and final inline scripts compile.');
