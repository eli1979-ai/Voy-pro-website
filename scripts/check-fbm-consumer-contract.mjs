import {readFile} from 'node:fs/promises';

const manifest=JSON.parse(await readFile('contracts/fbm-consumer-contract.json','utf8'));
const failures=[];
const ids=new Set();

function getPath(value,path){
  let current=value;
  for(const part of String(path).split('.')){
    if(current===null||current===undefined)return undefined;
    const key=/^\d+$/.test(part)?Number(part):part;
    current=current[key];
  }
  return current;
}

if(manifest.version!==1)failures.push('consumer contract version must be 1');
if(manifest.consumer!=='eli1979-ai/Voy-pro-website')failures.push('consumer repository identity changed');
if(manifest.producer!=='eli1979-ai/Ezraider-os')failures.push('producer repository identity changed');

for(const contract of manifest.contracts||[]){
  if(!contract.id||!contract.path||!Array.isArray(contract.methods)||!contract.methods.length){
    failures.push('contract entry missing id/path/methods');
    continue;
  }
  if(ids.has(contract.id))failures.push('duplicate contract id: '+contract.id);
  ids.add(contract.id);
  if(!contract.path.startsWith('/api/v1/'))failures.push(contract.id+': path must stay under /api/v1');
  if(!Array.isArray(contract.consumer_refs)||!contract.consumer_refs.length){
    failures.push(contract.id+': consumer_refs missing');
  }else{
    for(const ref of contract.consumer_refs){
      try{
        const source=await readFile(ref.file,'utf8');
        if(!source.includes(ref.marker)){
          failures.push(contract.id+': consumer marker missing from '+ref.file+': '+ref.marker);
        }
      }catch{
        failures.push(contract.id+': consumer source missing: '+ref.file);
      }
    }
  }

  for(const family of ['request_cases','response_cases']){
    for(const item of contract[family]||[]){
      if(!item?.name||!Object.prototype.hasOwnProperty.call(item,'sample')){
        failures.push(contract.id+': invalid '+family+' item');
        continue;
      }
      for(const field of item.required_fields||[]){
        if(getPath(item.sample,field)===undefined){
          failures.push(contract.id+': '+item.name+' required field absent from sample: '+field);
        }
      }
    }
  }
}

if(ids.size<18)failures.push('consumer manifest coverage unexpectedly low: '+ids.size);

if(failures.length){
  console.error('FBM consumer contract manifest check failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('FBM consumer contract manifest OK: '+ids.size+' website-consumed contracts are tied to live source markers.');
