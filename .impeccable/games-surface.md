# Games player refinement

Mode: Operate. Preserve the existing Vault theme, sans typography, flat divided directory, native controls and mobile icon navigation. No new visual world or comp round.

THESIS: Choose a daily puzzle or longer game, expand the player, and switch games without losing Vault navigation.
OWN-WORLD: Existing dark/light theme, restrained accent, 44px controls, 6px corners and quiet dividers.
STORY: Daily’s / Games filter and Find a game search → Play here or publisher window → theater/fullscreen with a persistent grouped game switcher → close and return to directory.
FIRST VIEWPORT: Existing shared header and Games heading above two category buttons, a labelled search field and a two-column directory; phones stack entries. Empty search results are explicit. The active player precedes the directory. Theater fills available workspace below the Vault header; fullscreen contains both game and its controls.
FORM: Bounded extension of the incumbent interface; no concept seed or replacement composition required.
FINISH: Desktop/mobile captures, functional switching and mode checks, fresh finish review and scoped documentation.

Publisher truth: Wordle, Krillion and PokéLike block cross-site frames; LoLdle visibly refuses cross-site embedding. These entries request a dedicated browser window immediately and show a retry/link fallback. Globle Capitals has a direct player entry. Sandbox allows user-opened popup links but no top-navigation permission. No proxy or header stripping. Switching games unloads the current frame; changing display mode or category does not.

Compact refinement: one 44px toolbar row on desktop and two on phones, with 4px theater/fullscreen padding and an 8px gap before the game. The grouped native select switches immediately. More contains help, reload and external launch actions. Keep publisher restrictions explicit and do not mistake a frame load or popup request for successful gameplay.

Directory expansion: 20 entries, seven Daily’s and thirteen Games. Distinguish Pokédle .com from the new website-only pokedle.net entry, whose frame explicitly refuses embedding. Added Games are Black Ops Zombies at vel.gg/bo1z (embedded setup observed), Contemporary Conflict (external, DENY), Taipei Rush (external, SAMEORIGIN), Redcoats (embedded loading page), Salty Seas (external, embedding unverified after local network block), Park Baron (external, DENY), SandStorm (external, embedding unverified after local network block), Seedbed and Surfd (embedded menus), and Tweetcraft (external, restricted multiplayer-world embeds). Observed setup/loading/menu states are not complete gameplay verification. Open Fastfile remains a separate source/setup disclosure requiring a server and owned game assets, not a playable BO2 entry. No remote browser, installation or verified top-ten/popularity/AI-authorship claim.

Current evidence: `.impeccable/review/global-markets/games-desktop.png` and `games-mobile.png` show the actual shared public surface. Finish review found only stale documentation blocking and no visual/material defects; this update corrects it without asserting a follow-up ship verdict. Preserve all prior compact-player behavior and incumbent visual tokens. This documentation pass performs no source edits or retests.
