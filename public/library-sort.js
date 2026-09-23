(function(root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.LibrarySort = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const options = { az: ['name', 'ascending'], za: ['name', 'descending'], small: ['size', 'ascending'], big: ['size', 'descending'], shelf: ['shelf', 'ascending'], shelfDesc: ['shelf', 'descending'], old: ['modified', 'ascending'], new: ['modified', 'descending'] };
  const compareText = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
  function sort(items, order = 'az', labels = {}) {
    const [field, direction] = options[order] || options.az, sign = direction === 'ascending' ? 1 : -1;
    return [...items].sort((a, b) => {
      const folders = Number(b.kind === 'folder') - Number(a.kind === 'folder');
      const value = field === 'name' ? compareText(a.name, b.name) : field === 'shelf' ? compareText(labels[a.shelf] || a.shelf, labels[b.shelf] || b.shelf) : (Number(a[field]) || 0) - (Number(b[field]) || 0);
      return folders || sign * value || compareText(a.name, b.name) || compareText(a.rel, b.rel);
    });
  }
  function toggle(order, field) {
    const ascending = Object.keys(options).find(key => options[key][0] === field && options[key][1] === 'ascending');
    const descending = Object.keys(options).find(key => options[key][0] === field && options[key][1] === 'descending');
    return order === ascending ? descending : ascending || 'az';
  }
  return { sort, toggle, options };
});
