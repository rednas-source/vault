/* Browser-local appearance preferences shared by all Vault surfaces. */
const vaultPalettes={
  orange:{label:'Orange',dark:'255,107,60',light:'174,57,22'},
  blue:{label:'Light blue',dark:'105,187,255',light:'15,103,173'},
  purple:{label:'Purple',dark:'184,150,255',light:'114,66,181'},
  green:{label:'Green',dark:'97,209,151',light:'24,120,72'},
  rose:{label:'Rose',dark:'255,145,180',light:'172,49,97'},
  gold:{label:'Gold',dark:'238,194,93',light:'136,96,12'},
};
let vaultAppearance={accent:'default',icons:false};
try{const saved=JSON.parse(localStorage.getItem('vault-appearance')||'{}');vaultAppearance={accent:vaultPalettes[saved.accent]?saved.accent:'default',icons:saved.icons===true};}catch{}
function applyAppearance(){
  const listen=document.body.classList.contains('listen-mode'),watch=document.body.classList.contains('watch-mode');
  const light=document.documentElement.dataset.theme==='light'&&!listen&&!watch;
  const name=vaultAppearance.accent==='default'?(listen?'blue':'orange'):vaultAppearance.accent;
  const rgb=vaultPalettes[name][light?'light':'dark'],root=document.documentElement;
  for(const [key,value] of Object.entries({'accent-rgb':rgb,accent:`rgb(${rgb})`,'accent-soft':`rgb(${rgb})`,star:`rgb(${rgb})`,'star-soft':`rgba(${rgb},.12)`,'star-edge':`rgba(${rgb},.42)`,flare:`rgb(${rgb})`,'flare-edge':`rgba(${rgb},.42)`,sky:`rgba(${rgb},.09)`,select:`rgba(${rgb},.3)`}))root.style.setProperty('--'+key,value);
  root.style.setProperty('--player-accent-rgb',vaultPalettes[vaultAppearance.accent==='default'?'orange':name].dark);
  root.classList.toggle('icon-navigation',vaultAppearance.icons);
  try{localStorage.setItem('vault-appearance',JSON.stringify(vaultAppearance));}catch{}
  if(!document.getElementById('appearancePanel')?.hidden)renderAppearance();
}
function renderAppearance(){
  const panel=document.getElementById('appearancePanel');if(!panel)return;
  panel.innerHTML=`<div class="appearance-heading"><h2>Appearance</h2><button id="closeAppearance" aria-label="Close appearance"><i class="ph ph-x" aria-hidden="true"></i></button></div><fieldset><legend>Accent color</legend><div class="appearance-colors">${Object.entries(vaultPalettes).map(([key,palette])=>`<button data-palette="${key}" aria-pressed="${vaultAppearance.accent===key}" style="--swatch:rgb(${palette.dark})"><i aria-hidden="true" class="ph ph-check"></i><span>${palette.label}</span></button>`).join('')}</div><button class="appearance-reset" id="resetPalette" aria-pressed="${vaultAppearance.accent==='default'}">Default colors <span>Orange in Library · Blue in Listen</span></button></fieldset><fieldset><legend>Navigation</legend><label class="appearance-switch"><span>Use icons for section tabs</span><input type="checkbox" id="iconNavigation" ${vaultAppearance.icons?'checked':''}></label></fieldset><fieldset><legend>Library theme</legend><div class="appearance-themes"><button data-appearance-theme="dark" aria-pressed="${currentTheme()==='dark'}">Dark</button><button data-appearance-theme="light" aria-pressed="${currentTheme()==='light'}">Light</button></div><p>Watch and Listen keep their dark backgrounds.</p></fieldset>`;
  panel.querySelectorAll('[data-palette]').forEach(button=>button.onclick=()=>{vaultAppearance.accent=button.dataset.palette;applyAppearance();panel.querySelector(`[data-palette="${vaultAppearance.accent}"]`)?.focus();});
  document.getElementById('resetPalette').onclick=()=>{vaultAppearance.accent='default';applyAppearance();document.getElementById('resetPalette').focus();};
  document.getElementById('iconNavigation').onchange=event=>{vaultAppearance.icons=event.target.checked;applyAppearance();document.getElementById('iconNavigation').focus();};
  panel.querySelectorAll('[data-appearance-theme]').forEach(button=>button.onclick=()=>{applyTheme(button.dataset.appearanceTheme);panel.querySelector(`[data-appearance-theme="${currentTheme()}"]`)?.focus();});
  document.getElementById('closeAppearance').onclick=()=>closeAppearance(true);
}
function closeAppearance(focus=false){const panel=document.getElementById('appearancePanel');if(!panel||panel.hidden)return;panel.hidden=true;document.getElementById('btnAppearance').setAttribute('aria-expanded','false');if(focus)document.getElementById('btnAppearance').focus();}
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('btnAppearance').onclick=()=>{const panel=document.getElementById('appearancePanel');if(!panel.hidden){closeAppearance();return;}renderAppearance();panel.hidden=false;document.getElementById('btnAppearance').setAttribute('aria-expanded','true');panel.querySelector('button').focus();};
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('#appearancePanel,#btnAppearance'))closeAppearance();});
  document.getElementById('appearancePanel').addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();closeAppearance(true);}});
});
