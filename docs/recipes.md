# Recipes in Vault

Open **Recipes** in the top navigation. Each Vault account has its own cookbook and shopping list. Data is stored in `<storagePath>/.recipes`, including locally saved photos and videos; include this directory in backups.

## Appearance and sample recipes

Recipes follows Vault's **Appearance → Light / Dark** setting immediately, including the cookbook, ingredients, nutrition, editor, cooking view and shopping list. The cream-and-green light palette is preserved; dark mode uses warm charcoal and sage. The preference remains Vault's browser-wide `vault-theme` setting, with no separate recipe toggle.

On the first cookbook load after this update, an empty cookbook receives three editable test recipes: tomato & basil pasta, blueberry & almond porridge, and fluffy weekend pancakes. Each includes a bundled local cover photo, ingredients, servings and cooking steps. Nutrition is left unreported. The descriptions identify these as samples and their photos as serving suggestions.

Existing nonempty cookbooks and shopping lists are preserved. A persistent `samplesInitialized` flag in the account's `recipes.json` prevents duplicates and prevents deleted samples from returning after refresh or restart. Delete any sample through **Edit → Delete recipe**. Photos are copied into the account's normal media directory and use the same authenticated media and deletion routes as user uploads. No external network request is needed to initialize or display the samples.

## Import and cook

1. Paste a recipe URL into **Found something good?**, or choose **Add recipe**.
2. For websites exposing Recipe structured data, Vault extracts the ingredients, instructions, photo, original serving count, source link and available nutrition. Public Instagram reels use the public page's media data to import captions, covers and MP4 video without a login, cookies, API key or downloader dependency. Instagram may restrict anonymous access; paste the caption and upload a saved video when it does. Vault does not bypass private-post access controls.
3. Review the draft. Each ingredient and each cooking step gets its own line. Headings such as `Ingredients:` and `Instructions:` (also `Ingredienser:` and `Slik gjør du:`) help caption imports. Check quantities, ambiguous ranges, temperatures and original serving count before saving. This is deterministic text/structured-data import, not an AI transcription or invented recipe.
4. Save the draft to download the Instagram cover and video into your private cookbook. Automatic video downloads are limited to 150 MB, two concurrent transfers and a 60-second timeout; manual uploads support up to 512 MB in 4 MB chunks. Images support JPG/PNG/WebP/GIF up to 15 MB. Failures leave the recipe saved and offer a retry in the Video tab. H.264 MP4 is the most portable video choice. A manually uploaded browser-readable video supplies a cover frame if the recipe has no photo.
5. Use **Start cooking** for large, one-step-at-a-time instructions. On supported HTTPS browsers, the screen remains awake while that cooking view is active. Ingredients stay available below the current step.

### Requested reel collection

**Import the 7 requested reels** imports the collection from the October 13 request into the current account, sequentially, with visible progress. Tracking-query variants are deduplicated. Repeating the action preserves existing recipes and retries missing media. It does not populate other accounts or silently restore deleted recipes. Keep the page open during import; saved recipes survive an interruption.

The seven recipes include title, servings, ingredients, creator-reported macros and paraphrased steps verified against the captions, local speech transcription and on-screen temperatures. The repeated chicken fajita link appears once. Media is downloaded at import time into private storage, not committed to Git. These seven verified methods are included in `lib/recipe-reel-collection.js`; arbitrary future reels still need manual step review when their captions omit the method. There is no automatic video understanding service configured on the production server. Missing steps may be saved as a draft so the attached video can be watched and the method added in Edit.

The steak fajita recipe flags a discrepancy between creator-reported calories and macros rather than silently changing them. Cooking-duration fields distinguish cooking, resting/marinating and unspecified preparation time.

## Quantities and portions

**Make** accepts the desired number of burritos, rolls or portions: enter **3** on a recipe originally making 12 burritos to use one quarter of its ingredients. **Batch size** retains the presets, with a **Custom multiplier** for other amounts. These controls update each other and initially divide the batch into the selected number of portions. Adjust **Divide into** separately if you want a different meal size; it changes nutrition per meal without changing ingredient or shopping quantities.

Each cooking step has a **For this step** ingredient list with scaled quantities, beside the instruction on wide screens and below it on narrow screens. The ten included recipes have checked ingredient links. Future captions use conservative ingredient-name matching; repeated mentions and unspecified splits are labeled as recipe totals rather than inventing how much belongs in each step. Editing the method clears obsolete links. Temperatures and cooking times do not scale. Review cooking times and pan sizes when changing a batch substantially.

## Photos and language

Choose **Original photo** or **AI photo** underneath a recipe's cover. The choice is saved for that recipe and used by its card and shared page. Both files remain available; a shared-page visitor can try either locally without changing the owner's choice. AI images are labeled as serving suggestions. The seven requested reels and three samples include individually generated food photos in `lib/recipe-ai/`; they are copied into private recipe media on first use. [Photo briefs](recipe-ai-photos.md) document the assets.

New recipes automatically queue an image after saving. Set `OPENAI_API_KEY` in the server environment, or `openaiApiKey` in the private `config.json`, then restart Vault. No key is included in Git or sent to the browser. The recipe title, description and ingredient names are sent to the OpenAI image service; account details, source video and shopping list are not sent. The default is `gpt-image-2`, configurable through `recipeImageModel`. Generation is limited to two concurrent requests and 20 attempts per user per UTC day (configurable through `recipeImageDailyLimit`, capped at 100). `recipeAutoImages: false` disables automatic generation. Existing bundled photos use no API calls.

The recipe remains usable while generation runs or fails. Missing configuration, interrupted jobs and failures offer **Generate AI photo** or **Retry AI photo**. Server restarts do not silently retry billed jobs. A changed recipe is not assigned an image generated for its old title/ingredients. The ten bundled images were generated with Codex's built-in image tool; the runtime API path is tested with simulated provider responses, not a live paid request.

The **English / Norsk** selector changes only the cookbook's presentation and remembers the preference in that browser. Norsk uses Bokmål. It is available in the owner and shared reader, including cooking, quantity controls and shopping. The ten included recipes have translated titles, descriptions, ingredients and methods. Original stored recipe text and edit fields are preserved; arbitrary new recipe text is displayed in its original language rather than silently machine-translated. Searches match both original and displayed recipe text.

Switch between **Metric**, **US** or **As written**. An ingredient’s unit selector also offers explicit units. `oz` means mass; `fl oz` means US fluid volume. Cups and spoons use US customary definitions. Mass-to-volume conversion requires an ingredient-specific density, so Vault does not assume that a cup of flour weighs the same as a cup of water. Matching a volume ingredient and entering its gram weight enables those conversions. Counts such as eggs and ambiguous ranges remain reviewable as written.

## Nutrition

The Nutrition tab shows calories, protein, carbohydrate, fat, fiber, sugars, fat subtypes, cholesterol, minerals, and available vitamins. Toggle **Per meal** and **Whole batch** without changing the underlying recipe.

Imports and saves automatically match unambiguous ingredients to **Matvaretabellen** and a small set of verified **USDA FoodData Central** foods for common US ingredients. Automatic matches are labeled estimates. The [Matvaretabellen API](https://www.matvaretabellen.no/en/api/) requires no key; Vault caches the data and includes a dated offline snapshot. The Norwegian catalog refreshes at most once per week per server process. The US supplement is a dated API snapshot, not a brand-label database.

Use an ingredient’s nutrition row to search the Norwegian catalog plus saved USDA foods, or choose **USDA extended search**. Select the correct food/raw-or-cooked state and confirm grams used in the original recipe. Weight measurements convert to grams automatically. Official volume weights are used when available; pieces and unspecified quantities need an entered edible weight. Brands, fat percentages and ambiguous alternatives are not silently swapped. Food choices and nutrient snapshots are saved with the recipe.

Protein, carbs and fat appear under the recipe title, per selected portion. The Nutrition tab keeps **Creator’s values** separate from the **Ingredient estimate**; partial ingredient matches never replace the creator's summary. Batch and portion changes scale both sources independently. Values from a label can also be entered in Edit (per original serving).

Nutrition is an estimate. Values differ with food choice, brand, preparation and losses. Partial ingredient totals are labeled; an unreported nutrient stays blank rather than becoming zero. Matching one ingredient does not establish complete nutrition for the dish. USDA requests send the ingredient search query only, not the complete recipe, media, account name or shopping list.

The built-in USDA demonstration key allows initial testing but has low limits: 30 requests/hour and 50/day per IP. For routine use, get a free [FoodData Central API key](https://fdc.nal.usda.gov/api-key-signup/) and set `usdaApiKey` in the server’s private `config.json` (or set `USDA_API_KEY` in its environment), then restart Vault. Keys stay on the server and must not be committed. [USDA API documentation](https://fdc.nal.usda.gov/api-guide/) describes access, limits and data licensing. The recipe importer reads [Recipe structured data](https://developers.google.com/search/docs/appearance/structured-data/recipe).

## Shopping

**Add to shopping** copies the currently scaled batch ingredients. The **Combined / By recipe** switch remembers the selected view in this browser. Combined sums compatible quantities across recipes, including tortilla variants (16 burrito-size + 12 low-carb = 28 tortillas), plain Greek yoghurt with different fat percentages (250 g + 0.2 kg = 450 g), and recognised mozzarella, cheddar and cottage-cheese variants. Contributing recipes and original variants remain visible. Other ingredients use exact names and known aliases; unrelated foods such as tortilla chips and flavoured yoghurt are kept separate. Mass and volume are not combined without a reliable conversion. Repeated unmeasured items are grouped without inventing a quantity.

**By recipe** shows each recipe heading followed by its original ingredient variants. Repeated batches of the same recipe add together. Switching views does not change saved items, checkmarks, recipe ingredients or nutrition. Checking a combined row checks all its contributing items; undo and clear-all work across both views.

Use **Edit title** immediately below a recipe heading to rename it without opening the full editor. It starts with the currently displayed title; the saved custom name is used in the cookbook, shared recipe and shopping headings. The full **Edit** form also retains its recipe-name field. Bundled Norwegian titles use readable phrases such as “Fajita-burritoer med kylling og ost”.

Tap a grouped item to move all its contributing entries into the basket. **Undo** restores that group. **Clear completed items** removes only checked entries. **Remove all items** clears the entire list after an inline confirmation; **Undo removal** restores the last removed set, including after a refresh or restart. Restoring never duplicates entries added since the clear.

Food illustrations accompany common ingredients. **Alternatives for Norway** suggests practical substitutions, such as drained salsa or homemade pico de gallo, without silently replacing ingredients or their nutrition. Unknown ingredients use a basket illustration. Local illustrations are unmodified [OpenMoji](https://openmoji.org/) 16.0.0 assets, licensed CC BY-SA 4.0; attribution and license are included under `public/recipe-ingredients`.

## Sharing

Use **Share cookbook** above the recipe grid to share the whole cookbook, or **Share** on a recipe to share only that dish. Both use Vault’s existing share links with an optional label, expiry (one week by default), copy action and revocation from **Shared links**. These read-only links have unlimited visits until they expire or are revoked, like asset links.

A cookbook link is a live view: it includes future additions and updates. A recipe link includes only its chosen recipe; deleting that recipe makes the link unavailable. Recipients can search a shared cookbook, adjust batch size, portions and units, follow cooking steps, view nutrition and play saved videos. Their changes do not write to the owner’s recipes. Shopping lists, favourites and account details remain private. Shared pages follow the recipient browser’s Vault light/dark preference and offer a theme switch.

Every public recipe, reader asset and media request rechecks the share and owner’s active account. Links stop serving content on expiry, revocation or account suspension. Photos and videos retain byte-range playback. The reader’s scripts, styles and icon fonts are served from an explicit allowlist under `/api/share/:id/recipes/assets/`, so cookbook and single-recipe links work with the existing Cloudflare Access exceptions for `/s` and `/api/share`. No exception for the main application’s static files is needed. Cloudflare Access still applies unless those share-route exceptions are configured.

## Sharing verification

`tests/recipe-shares.test.js` exercises anonymous reading, authenticated creation, cross-account and cross-recipe isolation, live cookbook additions, media ranges, expiry, deletion, suspension and revocation. The recipient interface is also checked in desktop dark mode and mobile light mode.

## Verification and deployment

Run `npm ci`, `npm run check`, and `npm test`. Recipe tests cover conversions, portion arithmetic, missing nutrient data, caption comparison blocks, public Instagram media parsing, URL rejection, account isolation, grouped shopping, clear-all/undo across restart, uploads and byte-range playback, plus one-time samples and private photos. Live retrieval of the seven requested reels was also tested in a local authenticated Vault account. Deploy through the existing verified production pipeline. The health/frontend fingerprint is `vault-recipes-shopping-20261013`.
