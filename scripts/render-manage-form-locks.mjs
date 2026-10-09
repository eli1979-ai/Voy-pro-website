import fs from 'node:fs';

const file='dist/manage/index.html';
let html=fs.readFileSync(file,'utf8');

function mutateBlock(startMarker,endMarker,mutate,label){
  const start=html.indexOf(startMarker);
  const end=start>=0?html.indexOf(endMarker,start):-1;
  if(start<0||end<0){console.error('Manage form-lock renderer: '+label+' block boundary not found.');process.exit(1);}
  const before=html.slice(start,end);
  const after=mutate(before);
  if(after===before){console.error('Manage form-lock renderer: '+label+' block was not changed.');process.exit(1);}
  html=html.slice(0,start)+after+html.slice(end);
}

mutateBlock(
  "const cf=document.getElementById('manage-contact');if(cf)cf.addEventListener('submit',async e=>{",
  "const riderForm=document.getElementById('waiver-riders-form')",
  block=>{
    const prevent='e.preventDefault();';
    const close='}});';
    const closeAt=block.lastIndexOf(close);
    if(!block.includes(prevent)||closeAt<0){console.error('Manage form-lock renderer: contact anchors not found.');process.exit(1);}
    block=block.replace(prevent,prevent+"if(cf.dataset.busy==='true')return;cf.dataset.busy='true';const submit=cf.querySelector('button[type=\"submit\"]');if(submit)submit.disabled=true;");
    const finallyCode="finally{delete cf.dataset.busy;if(submit)submit.disabled=false}";
    return block.slice(0,closeAt)+"}"+finallyCode+"});"+block.slice(closeAt+close.length);
  },
  'contact'
);

mutateBlock(
  "riderForm.addEventListener('submit',async e=>{",
  "const search=document.getElementById('manage-search')",
  block=>{
    const prevent='e.preventDefault();';
    const tail='\n    }\n   });\n  }\n  ';
    if(!block.includes(prevent)||!block.includes(tail)){console.error('Manage form-lock renderer: rider anchors not found.');process.exit(1);}
    block=block.replace(prevent,prevent+"if(riderForm.dataset.busy==='true')return;riderForm.dataset.busy='true';const submit=riderForm.querySelector('button[type=\"submit\"]');if(submit)submit.disabled=true;");
    return block.replace(tail,"\n    }finally{if(riderForm.dataset.riderSaveUnverified!=='true'){delete riderForm.dataset.busy;if(submit)submit.disabled=false}}\n   });\n  }\n  ");
  },
  'rider/waiver'
);

fs.writeFileSync(file,html);
console.log('Rendered single-flight locks for Manage contact and rider/waiver saves.');
