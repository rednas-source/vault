'use strict';

const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const files = fs.readdirSync(publicDir).filter((name) => name.endsWith('.html'));
let checked = 0;
for (const name of files) {
  const html = fs.readFileSync(path.join(publicDir, name), 'utf8');
  const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());
  for (const source of inline) {
    try { new Function(source); } // syntax check only
    catch (error) { throw new Error(`${name}: ${error.message}`); }
    checked++;
  }
  for (const match of html.matchAll(/<script\s+src="(\/[^\"]+\.js)(?:\?[^\"]*)?"/g)) {
    const local = path.join(publicDir, match[1].replace(/^\//, ''));
    if (!fs.existsSync(local)) continue; // dependency-backed route, checked by its package
    try { new Function(fs.readFileSync(local, 'utf8')); }
    catch (error) { throw new Error(`${match[1]}: ${error.message}`); }
    checked++;
  }
}
if (!checked) throw new Error('No client scripts found');
console.log(`Client syntax OK (${checked} script block${checked === 1 ? '' : 's'} across ${files.length} HTML files).`);
