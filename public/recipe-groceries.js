/* Food illustrations and Norway-oriented substitution suggestions. */
const RecipeGroceries=(()=>{
  const groups=[
    [/pico de gallo|salsa/i,'1F345','Try drained tomato salsa, or make pico de gallo with chopped tomato, onion, coriander, lime and salt. Salsa is wetter; drain before filling tortillas.'],
    [/fat.free.*che(?:ese|ddar)|american cheese|reduced.fat.*cheddar/i,'1F9C0','Look for a lighter grated yellow cheese (lett gulost), or use ordinary cheddar in a smaller amount. Fat and protein will differ; update the nutrition match.'],
    [/tortilla|wrap/i,'1F32F','Use large wheat or wholegrain tortillas if low-carb/protein wraps are unavailable. Check the pack size and nutrition: ordinary wraps usually change the per-serving macros.'],
    [/enchilada/i,'1F345','Try tomato sauce seasoned with mild chilli, cumin and garlic. Taste for salt and keep the sauce fairly thick.'],
    [/chipotle|adobo|harissa|chili paste/i,'1F336','Try a chilli paste available locally, or tomato paste with smoked paprika and chilli. Start with less and adjust the heat; this changes the flavour.'],
    [/tajin/i,'1F34B','Try lime zest, mild chilli powder and a little salt. Add lime juice to taste.'],
    [/buffalo sauce/i,'1F336','Try a cayenne-style hot sauce. Buffalo sauces vary in salt, heat and added fat; check the label.'],
    [/ultrafiltered milk/i,'1F95B','Use a high-protein skimmed milk, if available. Ordinary skimmed milk works differently in the macro calculation; check its label.'],
    [/vital wheat gluten/i,'1F33E','Look for hvetegluten in specialist or baking shops. Replacing it with flour changes the dough and protein content; do not treat it as an equal nutrition swap.'],
    [/turkey pepperoni/i,'1F969','Try a lean poultry salami or your preferred pepperoni. Weigh the slices and use its package nutrition.'],
    [/greek yogurt|greek yoghurt/i,'1F95B','Look for plain gresk yoghurt with the intended fat percentage. Plain skyr can work in many fillings, but is thicker and has different nutrition.'],
    [/cottage cheese/i,'1F9C0','Use cottage cheese with a similar fat percentage; blend smooth for sauces.'],
    [/chicken|kylling/i,'1F357',''],[/beef|steak|kjøtt/i,'1F969',''],[/cheese|cheddar|mozzarella|parmigiano/i,'1F9C0',''],
    [/milk|melk|yogurt|yoghurt/i,'1F95B',''],[/sweet potato|potato|potet/i,'1F954',''],[/pepper.*diced|bell pepper|paprika/i,'1FAD1',''],
    [/onion|løk/i,'1F9C5',''],[/garlic|hvitløk/i,'1F9C4',''],[/tomato|tomat/i,'1F345',''],[/lime|lemon|sitron/i,'1F34B',''],
    [/butter|smør/i,'1F9C8',''],[/honey|honning/i,'1F36F',''],[/egg/i,'1F95A',''],[/flour|cornstarch|oat|gluten|mel\b/i,'1F33E',''],
    [/cilantro|coriander|oregano|herb/i,'1F33F',''],[/oil|olje/i,'1FAD2',''],[/salt|seasoning|powder|cumin|pepper/i,'1F9C2','']
  ];
  return {forName(name){const match=groups.find(([pattern])=>pattern.test(name));return match?{image:'/recipe-ingredients/'+match[1]+'.svg',alternative:match[2]}:{image:null,alternative:''};}};
})();
