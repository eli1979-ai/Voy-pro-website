// Static first-party asset budget audit for the built website.
// No external network, no customer/FBM/payment API, no image transcoding.
import {readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';

const root=resolve('dist/assets');
const output=resolve('visual-qa-output/performance-budget');
const thresholds={
  imageFile:700*1024,
  allImages:6*1024*1024,
  javaScriptFile:320*1024,
  cssFile:160*1024
};
const images=new Set(['.jpg','.jpeg','.png','.webp','.avif','.gif']);
const files=[];
async function traverse(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const full=join(dir,entry.name);
    if(entry.isDirectory())await traverse(full);
    else if(entry.isFile()){
      const details=await stat(full);
      files.push({path:relative(root,full).replaceAll('\\','/'),bytes:details.size});
    }
  }
}
await traverse(root);
const violations=[];
let imageBytes=0,imageCount=0;
for(const file of files){
  const ext=file.path.slice(file.path.lastIndexOf('.')).toLowerCase();
  const kind=images.has(ext)?'imageFile':ext==='.js'?'javaScriptFile':ext==='.css'?'cssFile':null;
  if(kind==='imageFile'){imageBytes+=file.bytes;imageCount++;}
  if(kind&&file.bytes>thresholds[kind]){
    violations.push({path:file.path,bytes:file.bytes,budget:thresholds[kind],rule:kind});
  }
}
if(imageBytes>thresholds.allImages)violations.push({
  path:'<all first-party images>',bytes:imageBytes,
  budget:thresholds.allImages,rule:'allImages'
});
if(imageCount<10)violations.push({path:'<image inventory>',bytes:imageCount,budget:10,rule:'unexpectedly sparse assets'});
const ordered=files.sort((a,b)=>b.bytes-a.bytes);
const data={checkedFiles:files.length,imageCount,imageBytes,
  thresholds,violations,largestAssets:ordered.slice(0,20)};
await mkdir(output,{recursive:true});
await writeFile(join(output,'results.json'),JSON.stringify(data,null,2));
await writeFile(join(output,'report.md'),[
  '# VOY PRO static asset performance budgets',
  '',
  'Built first-party assets only; excludes third-party Google Maps, reviews and manufacturer media.',
  '',
  'Image count: '+imageCount,
  'Image total: '+(imageBytes/1048576).toFixed(2)+' MiB',
  'Max image: '+(thresholds.imageFile/1024).toFixed(0)+' KiB',
  'Max single JS: '+(thresholds.javaScriptFile/1024).toFixed(0)+' KiB',
  'Max single CSS: '+(thresholds.cssFile/1024).toFixed(0)+' KiB',
  'Failures: '+violations.length,
  '',
  '| Asset | Size (KiB) |',
  '|---|---:|',
  ...ordered.slice(0,20).map(x=>'| '+x.path+' | '+(x.bytes/1024).toFixed(0)+' |'),
  '',
  '## Violations',
  ...(violations.length?violations.map(x=>'- '+x.path+': '+x.bytes+' > '+x.budget+' ('+x.rule+')'):['- None']),
  '',
  'Budgets provide a regression safety net; they are not measured Core Web Vitals.',
  ''
].join('\n'));
console.log('Asset budget:',files.length,'files,',imageCount,'images,',
  (imageBytes/1048576).toFixed(2),'MiB images,',violations.length,'violations');
if(violations.length)process.exitCode=1;
