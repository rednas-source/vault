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

**Batch size** multiplies ingredient quantities. **Divide into** determines how many meals that batch makes. They are deliberately independent: doubling a seven-serving recipe and dividing it into fourteen meals leaves each meal’s nutrition unchanged. Dividing the same doubled batch into seven meals doubles the per-meal amount.

Switch between **Metric**, **US** or **As written**. An ingredient’s unit selector also offers explicit units. `oz` means mass; `fl oz` means US fluid volume. Cups and spoons use US customary definitions. Mass-to-volume conversion requires an ingredient-specific density, so Vault does not assume that a cup of flour weighs the same as a cup of water. Matching a volume ingredient and entering its gram weight enables those conversions. Counts such as eggs and ambiguous ranges remain reviewable as written.

## Nutrition

The Nutrition tab shows calories, protein, carbohydrate, fat, fiber, sugars, fat subtypes, cholesterol, minerals, and available vitamins. Toggle **Per meal** and **Whole batch** without changing the underlying recipe.

Imports and saves automatically match unambiguous ingredients to **Matvaretabellen** and a small set of verified **USDA FoodData Central** foods for common US ingredients. Automatic matches are labeled estimates. The [Matvaretabellen API](https://www.matvaretabellen.no/en/api/) requires no key; Vault caches the data and includes a dated offline snapshot. The Norwegian catalog refreshes at most once per week per server process. The US supplement is a dated API snapshot, not a brand-label database.

Use an ingredient’s nutrition row to search the Norwegian catalog plus saved USDA foods, or choose **USDA extended search**. Select the correct food/raw-or-cooked state and confirm grams used in the original recipe. Weight measurements convert to grams automatically. Official volume weights are used when available; pieces and unspecified quantities need an entered edible weight. Brands, fat percentages and ambiguous alternatives are not silently swapped. Food choices and nutrient snapshots are saved with the recipe.

Protein, carbs and fat appear under the recipe title, per selected portion. The Nutrition tab keeps **Creator’s values** separate from the **Ingredient estimate**; partial ingredient matches never replace the creator's summary. Batch and portion changes scale both sources independently. Values from a label can also be entered in Edit (per original serving).

Nutrition is an estimate. Values differ with food choice, brand, preparation and losses. Partial ingredient totals are labeled; an unreported nutrient stays blank rather than becoming zero. Matching one ingredient does not establish complete nutrition for the dish. USDA requests send the ingredient search query only, not the complete recipe, media, account name or shopping list.

The built-in USDA demonstration key allows initial testing but has low limits: 30 requests/hour and 50/day per IP. For routine use, get a free [FoodData Central API key](https://fdc.nal.usda.gov/api-key-signup/) and set `usdaApiKey` in the server’s private `config.json` (or set `USDA_API_KEY` in its environment), then restart Vault. Keys stay on the server and must not be committed. [USDA API documentation](https://fdc.nal.usda.gov/api-guide/) describes access, limits and data licensing. The recipe importer reads [Recipe structured data](https://developers.google.com/search/docs/appearance/structured-data/recipe).

## Shopping

**Add to shopping** copies the currently scaled batch ingredients. Matching names and compatible units combine in the display: 2 dl milk plus 400 ml milk becomes 6 dl milk. Underlying recipe and batch records remain traceable. Fat-content variants, different preparations and incompatible mass/volume measurements stay separate; no density is guessed. Repeated unmeasured items are grouped without inventing a quantity.

Tap a grouped item to move all its contributing entries into the basket. **Undo** restores that group. **Clear completed items** removes only checked entries. **Remove all items** clears the entire list after an inline confirmation; **Undo removal** restores the last removed set, including after a refresh or restart. Restoring never duplicates entries added since the clear.

Food illustrations accompany common ingredients. **Alternatives for Norway** suggests practical substitutions, such as drained salsa or homemade pico de gallo, without silently replacing ingredients or their nutrition. Unknown ingredients use a basket illustration. Local illustrations are unmodified [OpenMoji](https://openmoji.org/) 16.0.0 assets, licensed CC BY-SA 4.0; attribution and license are included under `public/recipe-ingredients`.

## Verification and deployment

Run `npm ci`, `npm run check`, and `npm test`. Recipe tests cover conversions, portion arithmetic, missing nutrient data, caption comparison blocks, public Instagram media parsing, URL rejection, account isolation, grouped shopping, clear-all/undo across restart, uploads and byte-range playback, plus one-time samples and private photos. Live retrieval of the seven requested reels was also tested in a local authenticated Vault account. Deploy through the existing verified production pipeline. The health/frontend fingerprint is `vault-recipes-reels-20261013`.
