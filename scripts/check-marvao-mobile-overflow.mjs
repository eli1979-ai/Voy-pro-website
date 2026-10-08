import fs from 'node:fs';
const css=fs.readFileSync('site/assets/site.css','utf8');
const failures=[];
const checks=[
  ['mobile Marvao grid must use a shrinkable track',/\.portugal-page \.marvao-route-grid\{grid-template-columns:minmax\(0,1fr\)\}/],
  ['route cards must fit their container',/\.portugal-page \.marvao-route-card\{min-width:0;max-width:100%;box-sizing:border-box\}/],
  ['photo carousel must scroll inside its card',/\.portugal-page \.marvao-route-card \.route-photo-strip\{min-width:0;max-width:100%;width:100%;box-sizing:border-box\}/],
  ['schematic must not widen the viewport',/\.portugal-page \.marvao-route-card \.route-schematic-canvas\{min-width:0;max-width:100%\}/]
];
for(const [label,pattern] of checks)if(!pattern.test(css))failures.push(label);
for(const path of ['site/portugal/index.html','site/he/portugal/index.html','site/pt/portugal/index.html']){
  const html=fs.readFileSync(path,'utf8');
  if(!/class="marvao-route-grid"/.test(html)||!/class="marvao-route-card/.test(html))failures.push(path+': Marvao route layout missing');
  if(!/href="\/assets\/site\.css"/.test(html))failures.push(path+': shared stylesheet missing');
}
if(failures.length){console.error('Marvao mobile overflow regression guard failed:\n'+failures.join('\n'));process.exit(1);}
console.log('Marvao mobile overflow guard OK for EN/HE/PT.');
