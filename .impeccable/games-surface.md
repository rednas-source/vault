# Games player refinement

Mode: Operate. Preserve the existing Vault theme, sans typography, flat divided directory, native controls and mobile icon navigation. No new visual world or comp round.

THESIS: Choose a daily puzzle or longer game, expand the player, and switch games without losing Vault navigation.
OWN-WORLD: Existing dark/light theme, restrained accent, 44px controls, 6px corners and quiet dividers.
STORY: Daily’s / Games filter → Play here or publisher website → theater/fullscreen with a persistent grouped game switcher → close and return to directory.
FIRST VIEWPORT: Existing shared header and Games heading above two category buttons and a two-column directory; phones stack entries. The active player precedes the directory. Theater fills available workspace below the Vault header; fullscreen contains both game and its controls.
FORM: Bounded extension of the incumbent interface; no concept seed or replacement composition required.
FINISH: Desktop/mobile captures, functional switching and mode checks, fresh finish review and scoped documentation.

Publisher truth: Wordle, Krillion and PokéLike block cross-site frames; LoLdle visibly refuses cross-site embedding. These entries request a dedicated browser window immediately and show a retry/link fallback. Globle Capitals has a direct player entry. Sandbox allows user-opened popup links but no top-navigation permission. No proxy or header stripping. Switching games unloads the current frame; changing display mode or category does not.

Compact refinement: one 44px toolbar row on desktop and two on phones, with 4px theater/fullscreen padding and an 8px gap before the game. The grouped native select switches immediately. More contains help, reload and external launch actions. Keep publisher restrictions explicit and do not mistake a frame load or popup request for successful gameplay.
