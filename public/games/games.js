/* Shared by the private Vault section and public /games. */
const VaultGames = (() => {
 const categories=[{id:'daily',name:"Daily’s"},{id:'games',name:'Games'}];
 const games = [
  {id:'wordle',category:'daily',name:'Wordle',description:'The daily five-letter word puzzle from The New York Times.',url:'https://www.nytimes.com/games/wordle/index.html',embed:false,reason:'Wordle blocks embedding. Play on its website; Vault stays open in this tab.'},
  {id:'globle',category:'daily',name:'Globle',description:'Find the mystery country with distance and colour clues.',url:'https://globle-game.com/',embed:true},
  {id:'globle-capitals',category:'daily',name:'Globle Capitals',description:'Find the mystery capital city. A separate daily Globle challenge.',url:'https://globle-capitals.com/',embed:true},
  {id:'loldle',category:'daily',name:'LoLdle',description:'Daily League of Legends champion puzzles.',url:'https://loldle.net/',embed:false,reason:'LoLdle refuses to run inside another website. Play in its own browser window; Vault stays open here.'},
  {id:'krillion',category:'daily',name:'Krillion',description:'The Daily Dive: seven trivia prompts where rare answers score more.',url:'https://krillion.io/',embed:false,reason:'Krillion blocks embedding. Play on its website; Vault stays open in this tab.'},
  {id:'pokedle',category:'daily',name:'Pokédle',description:'A daily Pokémon guessing challenge.',url:'https://pokedle.com/',embed:true},
  {id:'wow',category:'games',name:'WoW browser project',description:'Explore a browser-based World of Warcraft project.',url:'https://wow.aethus.pl/',embed:true},
  {id:'pokerogue',category:'games',name:'PokéRogue',description:'A Pokémon-inspired roguelite. Build a team and keep your run going.',url:'https://pokerogue.net/',embed:true},
  {id:'pokelike',category:'games',name:'PokéLike',description:'A Pokémon roguelike adventure playable in your browser.',url:'https://pokelike.xyz/',embed:false,reason:'PokéLike blocks embedding on other websites. Play in its own browser window; Vault stays open here.'}
 ];
 function mount(root,privateView=false){
  root.innerHTML=`<div class="games-page"><div class="games-heading"><div><h1>Games</h1><p>Daily puzzles and longer adventures, all in one place.</p></div>${privateView?'<a href="/games/" target="_blank" rel="noopener noreferrer">Public games page</a>':'<a href="/">Private Vault</a>'}</div><nav class="games-categories" aria-label="Game categories">${categories.map(c=>`<button type="button" data-category="${c.id}" aria-pressed="${c.id==='daily'}">${c.name}</button>`).join('')}</nav><section class="games-player" hidden aria-label="Game player"><div class="games-player-bar"><label><span class="games-sr">Switch game (reloads the player; save first)</span><select data-switch>${categories.map(c=>`<optgroup label="${c.name}">${games.filter(g=>g.category===c.id).map(g=>`<option value="${g.id}">${g.name}${g.embed?'':' · separate window'}</option>`).join('')}</optgroup>`).join('')}</select></label><h2 class="games-sr"></h2><div class="games-player-tools"><button type="button" data-theater aria-pressed="false">Theater mode</button><button type="button" data-fullscreen>Fullscreen</button><details class="games-player-help"><summary>More</summary><div class="games-help-panel"><button type="button" data-window>Open in window</button><a data-website target="_blank" rel="noopener noreferrer">Open website<span class="games-sr"> (new tab)</span></a><button type="button" data-reload>Reload game</button><p class="games-note games-player-status" role="status"></p><p class="games-note">Switching games reloads the player. Save your progress in the game first.</p></div></details><button type="button" data-close aria-label="Close game">Close</button></div></div><div class="games-player-content"></div></section><div class="games-list">${games.map(g=>`<article data-game-category="${g.category}" ${g.category==='daily'?'':'hidden'}><div><h2>${g.name}</h2><p>${g.description}</p></div><div class="games-actions"><button type="button" data-game="${g.id}">${g.embed?'Play here':'Play in window'}<span class="games-sr">: ${g.name}</span></button><a href="${g.url}" target="_blank" rel="noopener noreferrer">Open website<span class="games-sr">: ${g.name} (new tab)</span></a></div></article>`).join('')}</div><p class="games-note games-footer">Games run on their publishers’ sites. Sign-in and saved progress depend on each game and your browser’s cookie settings. Games that block embedding open in a separate window or tab, keeping Vault here.</p></div>`;
  const page=root.querySelector('.games-page'),player=root.querySelector('.games-player'),content=player.querySelector('.games-player-content'),status=player.querySelector('[role=status]'),switcher=player.querySelector('[data-switch]'),theater=player.querySelector('[data-theater]'),fullscreen=player.querySelector('[data-fullscreen]');
  const help=player.querySelector('details'),windowButton=player.querySelector('[data-window]'),reload=player.querySelector('[data-reload]');
  let current=null,returnFocus=null;
  function openWindow(g){
   // Open directly on the publisher origin, without access back to Vault.
   let failed=false;try{window.open(g.url,'_blank','popup,width=1100,height=850,noopener,noreferrer');}catch{failed=true;}
   const message=failed?'The browser could not open the game. Use the link below.':'Game window requested. If it did not appear, use Open website or allow popups for Vault.';
   const notice=content.querySelector('[data-window-status]');if(notice)notice.textContent=message;status.textContent=message;if(!notice)help.open=true;
   if(document.fullscreenElement===player)document.exitFullscreen().catch(()=>{});
  }
  function category(id){root.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===id)));root.querySelectorAll('[data-game-category]').forEach(row=>row.hidden=row.dataset.gameCategory!==id);}
  function syncFullscreen(){const active=document.fullscreenElement===player;fullscreen.textContent=active?'Exit fullscreen':'Fullscreen';theater.disabled=active;}
  function setTheater(active){page.classList.toggle('is-theater',active);theater.setAttribute('aria-pressed',String(active));theater.textContent=active?'Exit theater':'Theater mode';if(active){root.scrollTop=0;if(!privateView)window.scrollTo(0,0);}}
  function play(id,button,{force=false}={}){const g=games.find(g=>g.id===id);if(!g||(current===id&&!force))return;
   help.open=false;
   current=id;returnFocus=button||root.querySelector(`[data-category="${g.category}"]`);category(g.category);player.hidden=false;player.querySelector('h2').textContent=g.name;switcher.value=g.id;player.querySelector('[data-website]').href=g.url;content.replaceChildren();
   status.textContent=g.embed?'Loading from '+new URL(g.url).hostname+'. If play or sign-in is unavailable here, use Open website.':g.reason;
   if(g.embed){
    const frame=document.createElement('iframe');frame.title=g.name+' game';frame.src=g.url;
    // User-opened links may create a separate tab; the game cannot navigate Vault's top frame.
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups allow-popups-to-escape-sandbox');frame.setAttribute('allow','fullscreen; gamepad');frame.setAttribute('allowfullscreen','');frame.referrerPolicy='no-referrer';
    frame.onload=()=>{if(current===g.id)status.textContent='If the game is blank or sign-in does not work, use Open website.';};content.append(frame);
   }else{const message=document.createElement('div');message.className='games-external';const title=document.createElement('h3');title.textContent=g.name+' plays in a separate window';const reason=document.createElement('p');reason.textContent=g.reason;const notice=document.createElement('p');notice.dataset.windowStatus='';notice.setAttribute('role','status');const link=document.createElement('a');link.href=g.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open '+g.name+' in a new tab';const retry=document.createElement('button');retry.type='button';retry.textContent='Open game window';retry.onclick=()=>openWindow(g);const actions=document.createElement('div');actions.className='games-actions';actions.append(retry,link);message.append(title,reason,notice,actions);content.append(message);openWindow(g);}
   if(!page.classList.contains('is-theater')&&document.fullscreenElement!==player){if(privateView)root.scrollTop=player.offsetTop-root.offsetTop;else player.scrollIntoView({block:'start'});}switcher.focus({preventScroll:true});
  }
  root.querySelectorAll('[data-category]').forEach(button=>button.onclick=()=>category(button.dataset.category));
  root.querySelectorAll('[data-game]').forEach(button=>button.onclick=()=>play(button.dataset.game,button));
  switcher.onchange=()=>play(switcher.value);
  windowButton.onclick=()=>{help.open=false;openWindow(games.find(g=>g.id===current));};
  reload.onclick=()=>play(current,null,{force:true});
  theater.onclick=()=>setTheater(!page.classList.contains('is-theater'));
  fullscreen.onclick=async()=>{help.open=false;try{if(document.fullscreenElement===player)await document.exitFullscreen();else await player.requestFullscreen();}catch{status.textContent='Fullscreen is unavailable in this browser. Theater mode still expands the player inside Vault.';help.open=true;}syncFullscreen();};
  player.onfullscreenchange=syncFullscreen;
  player.querySelector('[data-close]').onclick=async()=>{if(document.fullscreenElement===player){try{await document.exitFullscreen();}catch{status.textContent='Exit fullscreen with your browser before closing the game.';help.open=true;return;}}setTheater(false);category(games.find(g=>g.id===current).category);content.replaceChildren();player.hidden=true;current=null;returnFocus?.focus();};
  player.onkeydown=event=>{if(event.key==='Escape'){if(help.open){help.open=false;help.querySelector('summary').focus();}else if(page.classList.contains('is-theater')&&!document.fullscreenElement){setTheater(false);theater.focus();}}};
 }
 return {mount};
})();
if(document.querySelector('#publicGames'))VaultGames.mount(document.querySelector('#publicGames'));
