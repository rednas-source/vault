# Recipes in Vault

Open **Recipes** in the top navigation. Each Vault account has its own cookbook and shopping list. Data is stored in `<storagePath>/.recipes`, including locally saved photos and videos; include this directory in backups.

## Import and cook

1. Paste a recipe URL into **Found something good?**, or choose **Add recipe**.
2. For websites exposing Recipe structured data, Vault extracts the ingredients, instructions, photo, original serving count, source link and available nutrition. Public social-page metadata can also populate a draft. Instagram often restricts automated access: paste its caption into the import form when the link cannot supply the recipe. Vault does not log into Instagram or download a private reel.
3. Review the draft. Each ingredient and each cooking step gets its own line. Headings such as `Ingredients:` and `Instructions:` (also `Ingredienser:` and `Slik gjør du:`) help caption imports. Check quantities, ambiguous ranges, temperatures and original serving count before saving. This is deterministic text/structured-data import, not an AI transcription or invented recipe.
4. Add a photo or an optional saved recipe video. Imported photos are copied to your Vault when accessible. Images support JPG/PNG/WebP/GIF up to 15 MB. Videos support MP4/M4V/MOV/WebM up to 512 MB and upload in 4 MB chunks. H.264 MP4 is the most portable video choice. Playback uses the browser’s codecs; this upload flow does not transcode unsupported video codecs. A browser-readable video supplies a cover frame if the recipe has no photo.
5. Use **Start cooking** for large, one-step-at-a-time instructions. On supported HTTPS browsers, the screen remains awake while that cooking view is active. Ingredients stay available below the current step.

## Quantities and portions

**Batch size** multiplies ingredient quantities. **Divide into** determines how many meals that batch makes. They are deliberately independent: doubling a seven-serving recipe and dividing it into fourteen meals leaves each meal’s nutrition unchanged. Dividing the same doubled batch into seven meals doubles the per-meal amount.

Switch between **Metric**, **US** or **As written**. An ingredient’s unit selector also offers explicit units. `oz` means mass; `fl oz` means US fluid volume. Cups and spoons use US customary definitions. Mass-to-volume conversion requires an ingredient-specific density, so Vault does not assume that a cup of flour weighs the same as a cup of water. Matching a volume ingredient and entering its gram weight enables those conversions. Counts such as eggs and ambiguous ranges remain reviewable as written.

## Nutrition

The Nutrition tab shows calories, protein, carbohydrate, fat, fiber, sugars, fat subtypes, cholesterol, minerals, and available vitamins. Toggle **Per meal** and **Whole batch** without changing the underlying recipe.

Use an ingredient’s nutrition row to search **USDA FoodData Central**, choose the matching food/raw-or-cooked state, and confirm the grams used in the original recipe. Weight measurements convert to grams automatically; pieces and volume need an entered edible weight. Food selections and their nutrient snapshots are saved with the recipe. Alternatively, enter values from the original recipe or a label in the editor’s optional nutrition section (per original serving). Publisher values are used when no ingredients have been matched.

Nutrition is an estimate. Values differ with food choice, brand, preparation and losses. Partial ingredient totals are labeled; an unreported nutrient stays blank rather than becoming zero. Matching one ingredient does not establish complete nutrition for the dish. USDA requests send the ingredient search query only, not the complete recipe, media, account name or shopping list.

The built-in USDA demonstration key allows initial testing but has low limits: 30 requests/hour and 50/day per IP. For routine use, get a free [FoodData Central API key](https://fdc.nal.usda.gov/api-key-signup/) and set `usdaApiKey` in the server’s private `config.json` (or set `USDA_API_KEY` in its environment), then restart Vault. Keys stay on the server and must not be committed. [USDA API documentation](https://fdc.nal.usda.gov/api-guide/) describes access, limits and data licensing. The recipe importer reads [Recipe structured data](https://developers.google.com/search/docs/appearance/structured-data/recipe).

## Shopping

**Add to shopping** copies the currently scaled batch ingredients into your list. Recipes remain separate so quantities from different batches are traceable. Tap an item to move it out of the active list immediately after saving. **Undo**, or the collapsed **In your basket** section, restores it. **Clear completed items** only clears completed checklist entries. The list persists across refreshes, devices and server restarts for your account.

## Verification and deployment

Run `npm ci`, `npm run check`, and `npm test`. Recipe tests cover conversions, portion arithmetic, missing nutrient data, structured/caption imports, local-network URL rejection, per-account persistence, shopping undo, authenticated uploads and byte-range playback. Deploy through the existing verified production pipeline. The health/frontend fingerprint is `vault-recipes-20261006`.
