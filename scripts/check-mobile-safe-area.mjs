import fs from 'node:fs';

const css=fs.readFileSync('site/assets/site.css','utf8');
const failures=[];

function requireText(text,label){
  if(!css.includes(text))failures.push(label);
}

requireText('body{padding-bottom:calc(78px + env(safe-area-inset-bottom,0px))}','mobile body reserve must include bottom safe area');
requireText('bottom:calc(88px + env(safe-area-inset-bottom,0px))','mobile WhatsApp control must clear the bottom safe area');
requireText('right:calc(10px + env(safe-area-inset-right,0px))','mobile WhatsApp control must clear the right safe area');
requireText('left:calc(10px + env(safe-area-inset-left,0px))','RTL mobile WhatsApp control must clear the left safe area');
requireText('bottom:calc(7px + env(safe-area-inset-bottom,0px))','mobile booking bar must clear the bottom safe area');
requireText('left:calc(7px + env(safe-area-inset-left,0px))','mobile booking bar must clear the left safe area');
requireText('right:calc(7px + env(safe-area-inset-right,0px))','mobile booking bar must clear the right safe area');
requireText('bottom:calc(82px + env(safe-area-inset-bottom,0px))','mobile consent banner must clear the bottom safe area');
requireText('calc(24px + env(safe-area-inset-bottom,0px))','mobile navigation sheet must pad its bottom safe area');

if(failures.length){
  console.error('Mobile safe-area guard failed.');
  for(const failure of failures)console.error('- '+failure);
  process.exit(1);
}
console.log('Mobile safe-area guard OK: booking, WhatsApp, consent and navigation controls respect device insets.');
