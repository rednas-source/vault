'use strict';

const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const path = require('node:path');
const fs = require('node:fs/promises');

const TEXT = new Set(['md','markdown','tex','latex','txt','text','log','csv','tsv','json','yaml','yml','xml','bib','rst']);
const WORD = new Set(['doc','docx']);
const MAX_TEXT = 2 * 1024 * 1024;
const MAX_WORD = 20 * 1024 * 1024;
let active = 0;
const failure = (message, status = 422) => Object.assign(new Error(message), { status });

function sanitizeDocument(html) {
  const sanitize = require('sanitize-html');
  return sanitize(html, {
    allowedTags: [...sanitize.defaults.allowedTags, 'img'],
    allowedAttributes: { a: ['href','id','name'], '*': ['id'], img: ['src','alt'], th: ['colspan','rowspan'], td: ['colspan','rowspan'] },
    allowedSchemes: ['data'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attrs) => ({ tagName, attribs: { ...attrs, href: attrs.href?.startsWith('#') ? attrs.href : undefined } }),
    },
    // No remote images, file URLs, or SVG payloads from uploaded documents.
    exclusiveFilter: frame => frame.tag === 'img' && !/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(frame.attribs.src || ''),
  });
}

async function convertDocument(full, ext, limit) {
  // Read a bounded snapshot; a file replaced after validation cannot bypass limits.
  const handle = await fs.open(full, 'r');
  let input;
  try {
    const buffer = Buffer.alloc(limit + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > limit) throw failure('This document is too large to preview. Please download it.', 413);
    input = buffer.subarray(0, size);
  } finally { await handle.close(); }
  let result;
  if (ext === 'docx') {
    const mammoth = require('mammoth');
    const converted = await mammoth.convertToHtml({ buffer: input }, { externalFileAccess: false });
    result = { kind: 'html', label: 'Word document · reading view', content: sanitizeDocument(converted.value) };
  } else if (ext === 'doc') {
    const WordExtractor = require('word-extractor');
    const document = await new WordExtractor().extract(input);
    result = { kind: 'text', label: 'Word document · text view', content: document.getBody() };
  } else {
    let content = input[0] === 0xff && input[1] === 0xfe ? input.subarray(2).toString('utf16le') : input.toString('utf8').replace(/^\uFEFF/, '');
    if (content.includes('\0')) throw failure('This file does not contain readable text. Please download it.');
    if (ext === 'md' || ext === 'markdown') {
      const { marked } = require('marked');
      result = { kind: 'html', label: 'Markdown · reading view', content: sanitizeDocument(marked.parse(content)) };
    } else {
      result = { kind: 'text', label: ['tex','latex','bib'].includes(ext) ? 'LaTeX source' : 'Text preview', content };
    }
  }
  if (Buffer.byteLength(result.content) > 4 * 1024 * 1024) throw failure('This document is too large to preview. Please download it.', 413);
  return result;
}

function previewDocument(entry, { signal, timeout = 15000 } = {}) {
  const ext = path.extname(entry.full).slice(1).toLowerCase();
  const limit = WORD.has(ext) ? MAX_WORD : MAX_TEXT;
  if (!entry.stat.isFile() || (!TEXT.has(ext) && !WORD.has(ext))) return Promise.reject(failure('No document preview is available for this format.', 415));
  if (entry.stat.size > limit) return Promise.reject(failure(`Preview supports ${WORD.has(ext) ? 'Word documents up to 20 MB' : 'text files up to 2 MB'}. Please download this file.`, 413));
  if (signal?.aborted) return Promise.reject(failure('Preview cancelled.', 499));
  if (active >= 4) return Promise.reject(failure('Other documents are loading. Please try again shortly.', 429));
  active++;
  return new Promise((resolve, reject) => {
    let worker;
    try { worker = new Worker(__filename, { workerData: { full: entry.full, ext, limit }, resourceLimits: { maxOldGenerationSizeMb: 128 } }); }
    catch (error) { active--; reject(error); return; }
    let finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      // Keep the concurrency slot until the parser has actually stopped.
      worker.terminate().finally(() => { active--; });
      error ? reject(error) : resolve(result);
    };
    const abort = () => finish(failure('Preview cancelled.', 499));
    const timer = setTimeout(() => finish(failure('This document took too long to preview. Please download it.')), timeout);
    signal?.addEventListener('abort', abort, { once: true });
    worker.once('message', message => message.error ? finish(failure(message.error, message.status)) : finish(null, message));
    worker.once('error', () => finish(failure('This document could not be read. It may be damaged, encrypted, or too complex. You can still download it.')));
    worker.once('exit', () => { if (!finished) finish(failure('The document reader stopped. Please download this file.')); });
  });
}

if (!isMainThread) {
  convertDocument(workerData.full, workerData.ext, workerData.limit)
    .then(result => parentPort.postMessage(result))
    .catch(error => parentPort.postMessage({ error: error.status ? error.message : 'This document could not be read. It may be damaged or encrypted. You can still download it.', status: error.status || 422 }));
}

module.exports = { previewDocument, sanitizeDocument };
