import fs from 'node:fs';

const failures=[];
const css=fs.readFileSync('site/assets/site.css','utf8');
const js=fs.readFileSync('site/assets/site.js','utf8');
const tails=['','buda-castle-without-walking/','corporate-events/','first-day/','group-tours/','private-tours/','tours/buda-castle-ezraider-tour/','tours/buda-margaret-extended-tour/','tours/margaret-island-ezraider-tour/','unique-things-to-do/','where-to-stay/','with-kids/'];
const locales=[
 {prefix:'',title:'Tours',heroes:'Heroes’ Square',citadella:'Citadella Advanced'},
 {prefix:'he/',title:'סיורים',heroes:'כיכר הגיבורים',citadella:'סיטדלה – סיור מתקדם'},
 {prefix:'hu/',title:'Túrák',heroes:'Hősök tere',citadella:'Citadella – haladó túra'}
];
for(const {prefix,title,heroes,citadella} of locales) {
  for(const tail of tails) {
    const file='site/'+prefix+'budapest/'+tail+'index.html';
    const html=fs.readFileSync(file,'utf8');
    const footer=html.slice(html.indexOf('<footer'));
    const match=footer.match(new RegExp('<b>'+title+'</b><p>([\\s\\S]*?)</p>'));
    if(!match) {failures.push(file+': missing localized Tours footer');continue}
    for(const [slug,label] of [['heroes-square-city-ezraider-tour',heroes],['citadella-advanced-ezraider-tour',citadella]]) {
      const link='<a href="/'+prefix+'budapest/tours/'+slug+'/">'+label+'</a>';
      const count=match[1].split(link).length-1;
      if(count!==1)failures.push(file+': expected exactly one '+slug+' footer link, got '+count);
      const target='site/'+prefix+'budapest/tours/'+slug+'/index.html';
      if(!fs.existsSync(target))failures.push(file+': missing link target '+target);
    }
    if(match[1].indexOf('heroes-square-city-ezraider-tour')>match[1].indexOf('citadella-advanced-ezraider-tour'))failures.push(file+': new tour order changed');
  }
}
for(const slug of ['heroes-square-city-ezraider-tour/','citadella-advanced-ezraider-tour/']) {
  if(!js.includes("localeBudapestCore('tours/"+slug+"')"))failures.push('Mobile menu missing '+slug);
}
for(const label of ['Hősök tere','Citadella – haladó túra','כיכר הגיבורים','סיטדלה – סיור מתקדם']) {
  if(!js.includes(label))failures.push('Mobile navigation localization missing '+label);
}
if(!css.includes('.tour-choice-card[data-tour-image="citadella"]'))failures.push('Citadella-only photo styling missing');
if(!css.includes('rgba(7,16,23,.25)')||!css.includes('rgba(7,16,23,.30)'))failures.push('Citadella lighter desktop/mobile overlays missing');
if(!css.includes('--tour-card-position:center 64%'))failures.push('Citadella mobile image focus missing');
if(failures.length){console.error('Citadella/footer/navigation regression FAIL:\n'+failures.map(x=>'- '+x).join('\n'));process.exit(1)}
console.log('Citadella overlay + EN/HE/HU mobile nav + 36 localized footer link pairs OK.');
