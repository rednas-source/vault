'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const archiver = require('archiver');
const { previewDocument, sanitizeDocument } = require('../lib/document-preview');

async function wordFixture() {
  const archive = archiver('zip');
  const chunks = [];
  archive.on('data', chunk => chunks.push(chunk));
  const completed = new Promise((resolve, reject) => { archive.on('end', resolve); archive.on('error', reject); });
  archive.append('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>', { name: '[Content_Types].xml' });
  archive.append('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>', { name: '_rels/.rels' });
  archive.append('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Readable Word document</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph.</w:t></w:r></w:p></w:body></w:document>', { name: 'word/document.xml' });
  await archive.finalize(); await completed;
  return Buffer.concat(chunks);
}

test('reads Word, Markdown, LaTeX and UTF-16 text without changing originals', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-reader-'));
  try {
    const docx = await wordFixture();
    for (const [name, content, kind, expected] of [
      ['sample.docx', docx, 'html', '<strong>Readable Word document</strong>'],
      ['sample.doc', docx, 'text', 'Readable Word document'],
      ['notes.md', '# Project notes\n\n**Readable** text.\n<script>alert(1)</script>\n![tracking](https://example.com/track)', 'html', '<h1>Project notes</h1>'],
      ['paper.tex', '\\documentclass{article}\n\\begin{document}Hello\\end{document}', 'text', '\\documentclass{article}'],
      ['notes.txt', Buffer.concat([Buffer.from([0xff,0xfe]), Buffer.from('Norwegian: æøå', 'utf16le')]), 'text', 'Norwegian: æøå'],
    ]) {
      const full = path.join(root, name); await fs.writeFile(full, content);
      const preview = await previewDocument({ full, stat: await fs.stat(full) });
      assert.equal(preview.kind, kind); assert(preview.content.includes(expected));
      assert(!preview.content.includes('<script')); assert(!preview.content.includes('https://example.com'));
      assert.deepEqual(await fs.readFile(full), Buffer.isBuffer(content) ? content : Buffer.from(content));
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('sanitizes uploaded HTML, remote media, links, forms and active content', () => {
  const html = sanitizeDocument('<h1 onclick="alert(1)">Title</h1><script>alert(1)</script><iframe src="/api/files"></iframe><form action="/api/files"><input></form><a href="javascript:alert(1)">Bad</a><a href="https://example.com">Remote</a><img src="https://example.com/track"><img src="data:image/svg+xml;base64,PHN2Zz4="><img src="data:image/png;base64,YQ==" onerror="alert(1)"><a href="#section">Jump</a>');
  assert(html.includes('<h1>Title</h1>')); assert(html.includes('href="#section"'));
  assert(html.includes('data:image/png;base64,YQ=='));
  for (const forbidden of ['onclick','script','iframe','<form','<input','javascript:','https:','svg+xml','onerror']) assert(!html.includes(forbidden), forbidden);
});

test('handles oversized, unsupported, corrupt, cancelled and timed-out previews', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-reader-errors-'));
  try {
    const full = path.join(root, 'broken.docx'); await fs.writeFile(full, 'not a Word file');
    const entry = { full, stat: await fs.stat(full) };
    await assert.rejects(previewDocument(entry), /could not be read/);
    await assert.rejects(previewDocument({ full, stat: { isFile: () => true, size: 21 * 1024 * 1024 } }), error => error.status === 413);
    await assert.rejects(previewDocument({ ...entry, full: path.join(root, 'file.exe') }), error => error.status === 415);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(previewDocument(entry, { signal: controller.signal }), /cancelled/);
    await assert.rejects(previewDocument(entry, { timeout: 1 }), /too long/);
    const running = new AbortController(); const result = previewDocument(entry, { signal: running.signal }); running.abort();
    await assert.rejects(result, /cancelled/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
