/* Shared by the private Vault section and public /games. */
const VaultGames = (() => {
 const games = [
  {id:'wow',name:'WoW browser project',description:'Explore a browser-based World of Warcraft project.',url:'https://wow.aethus.pl/',embed:true},
  {id:'pokerogue',name:'PokéRogue',description:'A Pokémon-inspired roguelite. Build a team and keep your run going.',url:'https://pokerogue.net/',embed:true},
  {id:'pokedle',name:'Pokédle',description:'A daily Pokémon guessing challenge.',url:'https://pokedle.com/',embed:true},
  {id:'wordle',name:'Wordle',description:'The daily five-letter word puzzle from The New York Times.',url:'https://www.nytimes.com/games/wordle/index.html',embed:false},
  {id:'globle',name:'Globle',description:'Find the mystery country with distance and colour clues.',url:'https://globle-game.com/',embed:true},
  {id:'loldle',name:'LoLdle',description:'Daily League of Legends champion puzzles.',url:'https://loldle.net/',embed:true}
 ];
 function mount(root,privateView=false){
  root.innerHTML=`<div class="games-page"><div class="games-heading"><div><h1>Games</h1><p>Pick a game. Keep your place in Vault.</p></div>${privateView?'<a href="/games/" target="_blank" rel="noopener noreferrer">Public games page</a>':'<a href="/">Private Vault</a>'}</div><section class="games-player" hidden aria-label="Game player"></section><div class="games-list">${games.map(g=>`<article><div><h2>${g.name}</h2><p>${g.description}</p></div><div class="games-actions">${g.embed?`<button type="button" data-game="${g.id}">Play here</button>`:'<span class="games-note">Embedding blocked by publisher</span>'}<a href="${g.url}" target="_blank" rel="noopener noreferrer">Open website<span class="games-sr">: ${g.name} (new tab)</span></a></div></article>`).join('')}</div><p class="games-note">Games run on their publishers’ sites. Sign-in and saved progress depend on each game and your browser’s cookie settings. If a player stays blank, use Open website.</p></div>`;
  const player=root.querySelector('.games-player');
  root.querySelectorAll('[data-game]').forEach(button=>button.onclick=()=>{
   const g=games.find(g=>g.id===button.dataset.game);player.hidden=false;
   player.innerHTML=`<div class="games-player-bar"><h2 tabindex="-1">${g.name}</h2><div class="games-actions"><a href="${g.url}" target="_blank" rel="noopener noreferrer">Open website<span class="games-sr"> (new tab)</span></a><button type="button" data-fullscreen>Fullscreen</button><button type="button" data-close>Close game</button></div></div><p class="games-note" role="status">Loading from ${new URL(g.url).hostname}. If play or sign-in is unavailable here, open the website.</p><iframe title="${g.name} game" src="${g.url}" sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock" allow="fullscreen; gamepad" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
   player.querySelector('[data-close]').onclick=()=>{player.replaceChildren();player.hidden=true;button.focus();};
   player.querySelector('[data-fullscreen]').onclick=async()=>{try{await player.requestFullscreen();}catch{player.querySelector('[role=status]').textContent='Fullscreen is unavailable in this browser. You can keep playing here.';}};
   player.querySelector('iframe').onload=()=>{player.querySelector('[role=status]').textContent='If the game is blank or sign-in does not work, use Open website.';};
   if(privateView)root.scrollTop=player.offsetTop-root.offsetTop;else player.scrollIntoView({block:'start'});player.querySelector('h2').focus({preventScroll:true});
  });
 }
 return {mount};
})();
if(document.querySelector('#publicGames'))VaultGames.mount(document.querySelector('#publicGames'));
