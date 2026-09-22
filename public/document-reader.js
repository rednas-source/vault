/* Read-only document previews. Uploaded HTML is isolated from the application. */
let previewAbort = null;
async function openDocumentPreview(file) {
  const controller = new AbortController();
  previewAbort = controller;
  $('#viewer').classList.add('reading');
  const body = $('#vBody');
  body.innerHTML = '<div class="viewer-note" role="status">Opening document…</div>';
  if (file.ext === 'pdf') {
    body.innerHTML = '<div class="document-caption">PDF · Use Download if your browser cannot display this document.</div>';
    const frame = document.createElement('iframe');
    frame.className = 'document-frame'; frame.title = file.name;
    frame.src = url('stream', file.rel);
    body.append(frame);
    return;
  }
  try {
    const response = await fetch(url('preview', file.rel), { signal: controller.signal, cache: 'no-store' });
    const preview = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(preview.error || (response.status === 401 ? 'Your session expired. Sign in again to read this document.' : 'Could not open this document. You can still download it.'));
    if (controller.signal.aborted) return;
    body.innerHTML = `<div class="document-caption">${esc(preview.label)} · Read only</div>`;
    const frame = document.createElement('iframe');
    frame.className = 'document-frame'; frame.title = file.name;
    frame.setAttribute('sandbox', '');
    frame.referrerPolicy = 'no-referrer';
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>
      *{box-sizing:border-box}html{background:#e9e8e4;color:#242722;color-scheme:light}body{margin:28px auto;padding:48px 56px;max-width:900px;min-height:calc(100vh - 56px);background:#fffefa;font:16px/1.7 Georgia,serif;overflow-wrap:anywhere;box-shadow:0 2px 12px #0000000a}h1,h2,h3,h4{font-family:system-ui,sans-serif;line-height:1.25;margin:1.4em 0 .65em}h1:first-child,h2:first-child,p:first-child{margin-top:0}img{max-width:100%;height:auto}table{border-collapse:collapse;display:block;overflow:auto;max-width:100%}td,th{border:1px solid #d6d6d0;padding:8px 12px}blockquote{border-left:3px solid #aaa;padding-left:20px;margin-left:0;color:#53564e}pre,code{font:13px/1.65 ui-monospace,Consolas,monospace}pre{white-space:pre-wrap;tab-size:4}pre.source{margin:0}code{background:#f0f0eb;padding:2px 4px}pre code{display:block;padding:16px}a{color:#485d8a}hr{border:0;border-top:1px solid #ddd;margin:28px 0}@media(max-width:640px){body{margin:0;padding:24px 20px;min-height:100vh;font-size:15px}}
      </style></head><body>${preview.kind === 'html' ? preview.content : `<pre class="source">${esc(preview.content)}</pre>`}</body></html>`;
    body.append(frame);
  } catch (error) {
    if (controller.signal.aborted) return;
    body.innerHTML = `<div class="viewer-note" role="alert"><p>${esc(error.message)}</p><p>Use Download above to open the original file on your device.</p><button class="ghost" id="retryPreview">Try again</button></div>`;
    $('#retryPreview').onclick = () => openViewer(file);
  }
}
