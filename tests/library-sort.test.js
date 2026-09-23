'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sort, toggle, options } = require('../public/library-sort');
const files = [
  { name: 'File 10', size: 30, shelf: 'a', modified: 3 },
  { name: 'file 2', size: 20, shelf: 'b', modified: 1 },
  { name: 'Alpha', size: 10, shelf: 'a', modified: 2 },
];
test('default name order is natural and case-insensitive; every column toggles both directions', () => {
  assert.deepEqual(sort(files).map(f => f.name), ['Alpha', 'file 2', 'File 10']);
  assert.deepEqual(sort(files, 'za').map(f => f.name), ['File 10', 'file 2', 'Alpha']);
  for (const field of ['name', 'size', 'shelf', 'modified']) {
    const ascending = toggle('unselected', field), descending = toggle(ascending, field);
    assert.deepEqual(options[ascending], [field, 'ascending']);
    assert.deepEqual(options[descending], [field, 'descending']);
    assert.equal(toggle(descending, field), ascending);
  }
  assert.deepEqual(sort(files, 'big').map(f => f.size), [30, 20, 10]);
  assert.deepEqual(sort(files, 'old').map(f => f.modified), [1, 2, 3]);
  assert.deepEqual(sort(files, 'shelf', { a: 'Zebra', b: 'Books' }).map(f => f.shelf), ['b', 'a', 'a']);
});
test('folders stay first in both directions, ties are stable, and input is not mutated', () => {
  const items = [...files, { kind: 'folder', name: 'Z folder', size: 0 }], snapshot = JSON.stringify(items);
  for (const order of Object.keys(options)) assert.equal(sort(items, order)[0].kind, 'folder');
  assert.equal(JSON.stringify(items), snapshot);
  assert.deepEqual(sort([...files].reverse(), 'shelf').map(f => f.name), sort(files, 'shelf').map(f => f.name));
});
