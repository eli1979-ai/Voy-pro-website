import fs from 'node:fs';
import path from 'node:path';

const dist=path.join(process.cwd(),'dist');
const jsPath=path.join(dist,'assets','site.js');
let js=fs.readFileSync(jsPath,'utf8');

const needle="    const detailLines=[];";
const replacement=`    const detailLines=[];
    const affiliateRef=qs.get('ref')||qs.get('affiliate')||null;
    const sourceLabel=[attr.source,attr.medium].filter(Boolean).join('/');
    if(sourceLabel&&attr.source!=='direct')detailLines.push(t(\`Source: \${sourceLabel}\`,\`מקור הפניה: \${sourceLabel}\`));
    if(attr.campaign)detailLines.push(t(\`Campaign: \${attr.campaign}\`,\`קמפיין: \${attr.campaign}\`));
    if(affiliateRef)detailLines.push(t(\`Referral: \${affiliateRef}\`,\`קוד הפניה: \${affiliateRef}\`));`;
if(!js.includes(needle)) throw new Error('v1.32.8: WhatsApp detail block not found');
js=js.replace(needle,replacement);

fs.writeFileSync(jsPath,js);

const releasePath=path.join(dist,'release.json');
const release=JSON.parse(fs.readFileSync(releasePath,'utf8'));
release.version='1.32.8';
fs.writeFileSync(releasePath,JSON.stringify(release,null,2)+'\n');
console.log('Applied VOY PRO v1.32.8 WhatsApp referral attribution.');
