// Source/build integrity and negative security fixtures for the pinned
// affiliate distribution. Fully offline. The SHA path is not an SRI policy:
// cross-origin SRI requires additional CORS configuration and verification.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const digest=buf=>createHash('sha256').update(buf).digest('hex');
function verify(source,mutable,pinned,manifest){
  assert.ok(Buffer.isBuffer(source)&&source.length>5000,'Expected complete widget source');
  assert.ok(source.equals(mutable),'Mutable asset drifted from reviewed source');
  assert.ok(source.equals(pinned),'Pinned asset bytes drifted from reviewed source');
  const sha=digest(source);
  const file='/assets/affiliate-booking-widget.'+sha.slice(0,24)+'.js';
  assert.deepEqual(Object.keys(manifest).sort(),
    ['artifact','bytes','public_path','release_status','schema_version','sha256'].sort());
  assert.equal(manifest.schema_version,1);
  assert.equal(manifest.artifact,'voy-pro-affiliate-booking-widget');
  assert.equal(manifest.public_path,file,'Hash path mismatch or unsafe path');
  assert.equal(manifest.sha256,sha,'Digest mismatch');
  assert.equal(manifest.bytes,source.length,'Length mismatch');
  assert.equal(manifest.release_status,'NOT_APPROVED_FOR_WORDPRESS_INSTALLATION');
  assert.ok(!JSON.stringify(manifest).match(/client.key|service.role|sk_live|testpartner/i),
    'Do not expose partner credentials or private material in public manifest');
  return file;
}
const source=fs.readFileSync('site/assets/affiliate-booking-widget.js');
const mutable=fs.readFileSync('dist/assets/affiliate-booking-widget.js');
const manifest=JSON.parse(fs.readFileSync('dist/assets/affiliate-booking-widget-manifest.json','utf8'));
const path=verify(source,mutable,fs.readFileSync('dist'+manifest.public_path),manifest);
assert.throws(()=>verify(source,mutable,Buffer.concat([source,Buffer.from('mutation')]),manifest),
  'Unexpected pinned-asset mutation must fail');
assert.throws(()=>verify(source,Buffer.from('bad mutable asset'),source,manifest),
  'Unexpected mutable-asset mutation must fail');
assert.throws(()=>verify(source,mutable,source,{...manifest,sha256:'0'.repeat(64)}),
  'Wrong digest must fail');
assert.throws(()=>verify(source,mutable,source,{...manifest,public_path:'/assets/other.js'}),
  'Unreviewed public asset path must fail');
assert.throws(()=>verify(source,mutable,source,{...manifest,release_status:'APPROVED'}),
  'The build alone must never grant WordPress installation approval');
console.log('Pinned affiliate distribution integrity: PASS ('+path+
  '); mutation, wrong digest, unapproved path and false approval rejected.');
