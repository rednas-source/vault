'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const blocks = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((source) => source.trim());

if (!blocks.length) throw new Error('No inline client script found');
for (const source of blocks) new Function(source); // syntax check only
console.log(`Client syntax OK (${blocks.length} inline script block${blocks.length === 1 ? '' : 's'}).`);

