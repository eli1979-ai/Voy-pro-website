#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../docs/legacy-wordpress/ezraidereu_wpcode_sitewide_v6_1_map_failclosed.html',import.meta.url),'utf8');
const scripts=[...source.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length,1,'One inline script in one existing-snippet candidate');
new vm.Script(scripts[0][1],{filename:'ezraidereu-wpcode-v6-1.js'});
assert.match(source,/function rewrite\(\)/,'preserve FareHarbor-to-WhatsApp candidate');
assert.match(source,/function repairTourNavigation\(\)/,'preserve tour-detail links');
assert.match(source,/function correctBudapestEmail\(\)/,'preserve email repair');
assert.match(source,/ezre-wa-float-v1/,'preserve WhatsApp widget');
assert.match(source,/getyourguide.com\/ezraider-budapest-by-voy-pro-s269621/,'preserve supplier identity');
assert.doesNotMatch(source,/\.src\s*=\s*['"]https:\/\/www\.google\.com\/maps\?q=/,'no guessed iframe position');
assert.doesNotMatch(source,/Pilvax\s*\\s\*/,'no speculative Pilvax text replacement');
assert.doesNotMatch(source,/info\.appendChild\(label\)/,'no unverified meeting-point UI');
assert.match(source,/SECURITY HOLD: Never silently rewrite/,'visible hold rationale');
console.log('10 WPCode v6.1 map-safety source checks PASS.');
