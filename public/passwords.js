/* Presentation only. Passwords, keys and sessions remain in the separate-origin client. */
window.VaultPasswords = (() => {
  const vaultUrl = 'https://passwords.sornes.cc/';
  let workspace = null;
  let loadTimer = null;

  function close() {
    clearTimeout(loadTimer);
    workspace?.remove();
    workspace = null;
  }

  function sync() {
    const active = state.mode === 'passwords' && !!state.user;
    document.body.classList.toggle('passwords-mode', active);
    if (!active) close();
  }

  function render() {
    if (!state.user || state.mode !== 'passwords') return;
    const scroll = document.getElementById('scroll');
    if (!window.isSecureContext) {
      scroll.innerHTML = '<section class="passwords-intro"><i class="ph ph-lock-key" aria-hidden="true"></i><h1>Passwords</h1><p>Open Vault over HTTPS to use your password manager.</p><a class="passwords-action" href="https://vault.sornes.cc/?section=passwords">Open secure Vault</a></section>';
      return;
    }
    if (workspace?.isConnected) return;
    scroll.innerHTML = '<div class="passwords-heading"><div><h1>Passwords</h1><p>Your private logins, cards and secure notes.</p></div><a class="passwords-action" href="' + vaultUrl + '" target="_blank" rel="noopener noreferrer"><i class="ph ph-arrow-square-out" aria-hidden="true"></i><span>Open separately</span></a></div><p class="passwords-help">Sign in with your password-manager account. Use <strong>Lock now</strong> in its account menu when you finish. <a href="' + vaultUrl + '#/register" target="_blank" rel="noopener noreferrer">Finish account setup</a></p>';
    workspace = document.createElement('section');
    workspace.id = 'passwordsWorkspace';
    workspace.setAttribute('aria-label', 'Password manager');
    const status = document.createElement('p');
    status.className = 'passwords-loading';
    status.setAttribute('role', 'status');
    status.textContent = 'Opening your password manager…';
    const frame = document.createElement('iframe');
    frame.title = 'Private password manager';
    frame.referrerPolicy = 'no-referrer';
    frame.allow = 'clipboard-write';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox');
    frame.src = vaultUrl;
    frame.addEventListener('load', () => {
      clearTimeout(loadTimer);
      status.remove();
    });
    loadTimer = setTimeout(() => {
      status.textContent = 'Taking longer than usual. Use Open separately if the sign-in page cannot load here.';
    }, 15000);
    workspace.append(status, frame);
    document.querySelector('.library-workspace').append(workspace);
    // No frame DOM access or postMessage bridge: the parent never handles vault data.
  }
  window.addEventListener('pagehide', close);
  return Object.freeze({ sync, render, close });
})();
