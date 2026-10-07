import fs from 'node:fs';

const js=fs.readFileSync('site/assets/site.js','utf8');
const failures=[];
if(!js.includes("locale==='hu'?'/hu/budapest/with-kids/'")){
  failures.push('Hungarian mobile family destination is not the localized family page');
}
if(js.includes("locale==='hu'?'/hu/budapest/#tours'")){
  failures.push('Hungarian mobile family link still falls back to the Budapest tours anchor');
}
if(!fs.existsSync('site/hu/budapest/with-kids/index.html')){
  failures.push('Hungarian family page is missing');
}
if(failures.length){
  console.error('Hungarian mobile family-link guard failed.');
  failures.forEach(f=>console.error('- '+f));
  process.exit(1);
}
console.log('Hungarian mobile family-link guard OK: mobile navigation reaches /hu/budapest/with-kids/.');
