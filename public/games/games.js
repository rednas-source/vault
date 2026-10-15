/* Shared by the private Vault section and public /games. */
const VaultGames = (() => {
 const categories=[{id:'daily',name:"Daily’s"},{id:'games',name:'Games'}];
 const games = [
  {id:'wordle',category:'daily',name:'Wordle',description:'The daily five-letter word puzzle from The New York Times.',url:'https://www.nytimes.com/games/wordle/index.html',embed:false,reason:'Wordle blocks embedding. Play on its website; Vault stays open in this tab.'},
  {id:'globle',category:'daily',name:'Globle',description:'Find the mystery country with distance and colour clues.',url:'https://globle-game.com/',embed:true},
  {id:'globle-capitals',category:'daily',name:'Globle Capitals',description:'Find the mystery capital city. A separate daily Globle challenge.',url:'https://globle-capitals.com/',embed:true},
  {id:'loldle',category:'daily',name:'LoLdle',description:'Daily League of Legends champion puzzles.',url:'https://loldle.net/',embed:false,reason:'LoLdle does not work reliably inside another website. Play on its website; Vault stays open in this tab.'},
  {id:'krillion',category:'daily',name:'Krillion',description:'The Daily Dive: seven trivia prompts where rare answers score more.',url:'https://krillion.io/',embed:false,reason:'Krillion blocks embedding. Play on its website; Vault stays open in this tab.'},
  {id:'pokedle',category:'daily',name:'Pokédle',description:'A daily Pokémon guessing challenge.',url:'https://pokedle.com/',embed:true},
  {id:'wow',category:'games',name:'WoW browser project',description:'Explore a browser-based World of Warcraft project.',url:'https://wow.aethus.pl/',embed:true},
  {id:'pokerogue',category:'games',name:'PokéRogue',description:'A Pokémon-inspired roguelite. Build a team and keep your run going.',url:'https://pokerogue.net/',embed:true}
 ];
 function mount(root,privateView=false){
  root.innerHTML=`<div class="games-page"><div class="games-heading"><div><h1>Games</h1><p>Daily puzzles and longer adventures, all in one place.</p></div>${privateView?'<a href="/games/" target="_blank" rel="noopener noreferrer">Public games page</a>':'<a href="/">Private Vault</a>'}</div><nav class="games-categories" aria-label="Game categories">${categories.map(c=>`<button type="button" data-category="${c.id}" aria-pressed="${c.id==='daily'}">${c.name}</button>`).join('')}</nav><section class="games-player" hidden aria-label="Game player"><div class="games-player-bar"><h2 tabindex="-1"></h2><div class="games-player-tools"><button type="button" data-theater aria-pressed="false">Theater mode</button><button type="button" data-fullscreen>Fullscreen</button><button type="button" data-close>Close game</button></div></div><div class="games-player-navigation"><label>Switch game<select data-switch>${categories.map(c=>`<optgroup label="${c.name}">${games.filter(g=>g.category===c.id).map(g=>`<option value="${g.id}">${g.name}${g.embed?'':' · website only'}</option>`).join('')}</optgroup>`).join('')}</select></label><button type="button" data-switch-go>Switch</button><a data-website target="_blank" rel="noopener noreferrer">Open website<span class="games-sr"> (new tab)</span></a></div><p class="games-note games-player-status" role="status"></p><div class="games-player-content"></div><p class="games-note games-switch-note">Switching games reloads the player. Save your progress in the game first.</p></section><div class="games-list">${games.map(g=>`<article data-game-category="${g.category}" ${g.category==='daily'?'':'hidden'}><div><h2>${g.name}</h2><p>${g.description}</p></div><div class="games-actions">${g.embed?`<button type="button" data-game="${g.id}">Play here<span class="games-sr">: ${g.name}</span></button>`:'<span class="games-note">Play on its website</span>'}<a href="${g.url}" target="_blank" rel="noopener noreferrer">Open website<span class="games-sr">: ${g.name} (new tab)</span></a></div></article>`).join('')}</div><p class="games-note games-footer">Games run on their publishers’ sites. Sign-in and saved progress depend on each game and your browser’s cookie settings. Website-only games open in a new tab, keeping Vault here.</p></div>`;
  const page=root.querySelector('.games-page'),player=root.querySelector('.games-player'),content=player.querySelector('.games-player-content'),status=player.querySelector('[role=status]'),switcher=player.querySelector('[data-switch]'),theater=player.querySelector('[data-theater]'),fullscreen=player.querySelector('[data-fullscreen]');
  let current=null,returnFocus=null;
  function category(id){root.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===id)));root.querySelectorAll('[data-game-category]').forEach(row=>row.hidden=row.dataset.gameCategory!==id);}
  function syncFullscreen(){const active=document.fullscreenElement===player;fullscreen.textContent=active?'Exit fullscreen':'Fullscreen';theater.disabled=active;}
  function setTheater(active){page.classList.toggle('is-theater',active);theater.setAttribute('aria-pressed',String(active));theater.textContent=active?'Exit theater':'Theater mode';if(active){root.scrollTop=0;if(!privateView)window.scrollTo(0,0);}}
  function play(id,button){const g=games.find(g=>g.id===id);if(!g||current===id)return;
   current=id;returnFocus=button||root.querySelector(`[data-category="${g.category}"]`);category(g.category);player.hidden=false;player.querySelector('h2').textContent=g.name;switcher.value=g.id;player.querySelector('[data-website]').href=g.url;content.replaceChildren();
   status.textContent=g.embed?'Loading from '+new URL(g.url).hostname+'. If play or sign-in is unavailable here, use Open website.':g.reason;
   if(g.embed){const frame=document.createElement('iframe');frame.title=g.name+' game';frame.src=g.url;
    // User-opened links may create a separate tab; the game cannot navigate Vault's top frame.
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups allow-popups-to-escape-sandbox');frame.setAttribute('allow','fullscreen; gamepad');frame.setAttribute('allowfullscreen','');frame.referrerPolicy='no-referrer';
    frame.onload=()=>{if(current===g.id)status.textContent='If the game is blank or sign-in does not work, use Open website.';};content.append(frame);
   }else{const message=document.createElement('div');message.className='games-external';const title=document.createElement('h3');title.textContent='Play '+g.name+' on its website';const link=document.createElement('a');link.href=g.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open '+g.name+' in a new tab';message.append(title,link);content.append(message);}
   if(!page.classList.contains('is-theater')&&document.fullscreenElement!==player){if(privateView)root.scrollTop=player.offsetTop-root.offsetTop;else player.scrollIntoView({block:'start'});}player.querySelector('h2').focus({preventScroll:true});
  }
  root.querySelectorAll('[data-category]').forEach(button=>button.onclick=()=>category(button.dataset.category));
  root.querySelectorAll('[data-game]').forEach(button=>button.onclick=()=>play(button.dataset.game,button));
  player.querySelector('[data-switch-go]').onclick=()=>play(switcher.value);
  theater.onclick=()=>setTheater(!page.classList.contains('is-theater'));
  fullscreen.onclick=async()=>{try{if(document.fullscreenElement===player)await document.exitFullscreen();else await player.requestFullscreen();}catch{status.textContent='Fullscreen is unavailable in this browser. Theater mode still expands the player inside Vault.';}syncFullscreen();};
  player.onfullscreenchange=syncFullscreen;
  player.querySelector('[data-close]').onclick=async()=>{if(document.fullscreenElement===player){try{await document.exitFullscreen();}catch{status.textContent='Exit fullscreen with your browser before closing the game.';return;}}setTheater(false);category(games.find(g=>g.id===current).category);content.replaceChildren();player.hidden=true;current=null;returnFocus?.focus();};
  player.onkeydown=event=>{if(event.key==='Escape'&&page.classList.contains('is-theater')&&!document.fullscreenElement){setTheater(false);theater.focus();}};
 }
 return {mount};
})();
if(document.querySelector('#publicGames'))VaultGames.mount(document.querySelector('#publicGames'));
