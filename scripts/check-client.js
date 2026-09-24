'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const blocks = [...html.matchAll(/<script(?![^>]*type="(?:importmap|application\/json)")(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((source) => source.trim());

for (const match of html.matchAll(/<script\s+src="(\/[^"]+\.js)(?:\?[^"]*)?"/g)) {
  const local=path.join(__dirname,'..','public',match[1]);
  if(fs.existsSync(local)) blocks.push(fs.readFileSync(local,'utf8'));
}
if (!blocks.length) throw new Error('No inline client script found');
for (const source of blocks) new Function(source); // syntax check only
console.log(`Client syntax OK (${blocks.length} script block${blocks.length === 1 ? '' : 's'}).`);

