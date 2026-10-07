import fs from 'node:fs';

const html=fs.readFileSync('site/manage/index.html','utf8');
const failures=[];

const required=[
  'data-contact-status role="status" aria-live="polite"',
  'id="manage-change-status" role="status" aria-live="polite"',
  'id="manage-cancel-status" role="status" aria-live="polite"',
  'class="manage-error" role="alert"'
];
for(const token of required){
  if(!html.includes(token)) failures.push('missing '+token);
}
const riderStatuses=(html.match(/data-rider-status/g)||[]).length;
const liveRiderStatuses=(html.match(/data-rider-status role="status" aria-live="polite"/g)||[]).length;
if(riderStatuses && riderStatuses!==liveRiderStatuses){
  failures.push('all dynamic rider status regions must be polite live regions');
}
if(failures.length){
  console.error('Manage live-status accessibility guard failed.');
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('Manage live-status accessibility guard OK: operational updates are announced and fatal load errors use alert semantics.');
