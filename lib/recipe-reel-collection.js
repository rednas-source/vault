'use strict';
// User-requested collection. Facts checked against public captions, spoken
// instructions and on-screen cooking times on 2026-10-13. Methods paraphrased.
// Media is fetched into the signed-in user's private storage, never bundled.
const Model=require('../public/recipe-model');
const recipes=[
  {
    code:'DHja6NsJigP',title:'Queso Chicken Rolls',servings:8,time:'20–25 min cooking + prep',
    description:'Eight freezer-friendly tortilla rolls filled with seasoned chicken, creamy queso and cheese. Recipe by @stealth_health_life.',
    sourceNutrition:{calories:335,protein:35,carbs:25,fat:9},
    ingredients:['20 oz chicken breast','Juice of 1 lime','1 packet taco seasoning','200 g 2% cottage cheese','75 g fat-free Greek yogurt','4 tbsp salsa','2 tbsp red enchilada sauce','Garlic powder to taste','Salt to taste','4 tbsp pico de gallo','50 g reduced-fat cheese','50 g fat-free cheddar','8 low-carb burrito tortillas'],
    instructions:[
      'Tenderize the chicken breasts. Coat with lime juice and taco seasoning.',
      'Air-fry the chicken at 200°C (400°F) for 12–15 minutes, until cooked through. Thickness and air fryer affect the time.',
      'Blend the cottage cheese, yogurt, salsa, enchilada sauce, garlic powder and salt until smooth.',
      'Finely chop the cooked chicken. Stir in the pico de gallo, blended queso and both cheeses.',
      'Divide the filling between eight tortillas. Spread it across their width and roll each one closed.',
      'Bake the rolls at 200°C (400°F) for 8–10 minutes. Cool before packing for the freezer.'
    ]
  },
  {
    code:'DIrV94jJeGk',title:'Mini Steak & Cheese Burritos',servings:16,time:'8 min searing + 4 hr marinating + prep',
    description:'Sixteen snack-size burritos with seared steak, cheddar and Greek yogurt. Recipe by @stealth_health_life.',
    sourceNutrition:{calories:230,protein:25,carbs:5,fat:12},
    ingredients:['900 g skirt steak, exterior fat trimmed','Salt to taste','Tajin to taste','2 tbsp ancho chili powder','1 tbsp garlic powder','1 tbsp onion powder','1 tbsp black pepper','1 tsp cumin','20 g avocado oil','16 low-carb tortillas','240 g reduced-fat sharp cheddar','320 g nonfat Greek yogurt','Cilantro for garnish'],
    instructions:[
      'Cut the steaks into manageable pieces. Season both sides with salt and Tajin, then coat with the chili powder, garlic powder, onion powder, pepper and cumin.',
      'Set the seasoned steaks on a wire rack and refrigerate uncovered for at least four hours.',
      'Heat a heavy pan or grill over high heat. Oil the meat and sear in two batches for about two minutes per side; adjust for thickness and your preferred doneness.',
      'Chop the steak into small pieces and mix with chopped cilantro.',
      'Divide the yogurt, cheddar and steak evenly among sixteen tortillas. Fold in the sides and roll tightly.',
      'Optionally toast the burritos in a pan. Cool, wrap individually and freeze.'
    ]
  },
  {
    code:'DMnsBcEpZXO',title:'Sheet Pan Personal Pizzas',servings:8,time:'36–44 min cooking + 5 min rest + prep',
    description:'One tray makes eight personal pizzas with a yogurt-based crust, tomato sauce, cheese and turkey pepperoni. Recipe by @stealth_health_life.',
    sourceNutrition:{calories:405,protein:32,carbs:44,fat:11},
    ingredients:['375 g all-purpose flour','50 g vital wheat gluten','12 g baking powder','10 g nutritional yeast','10 g salt','Garlic powder to taste','Oregano to taste','500 g plain 0% Greek yogurt','400 g fat-free ultrafiltered milk','20 g olive oil','400 g tomato sauce','227 g reduced-fat mozzarella','40 g Parmigiano Reggiano','40 slices turkey pepperoni','5 g oil spray'],
    instructions:[
      'Heat the oven to 190°C (375°F). Line a 33 × 46 × 2.5 cm sheet pan with baking paper.',
      'Thoroughly combine the flour, wheat gluten, baking powder, nutritional yeast, salt, garlic powder and oregano.',
      'Stir in the yogurt, milk and olive oil until the mixture has a thick batter consistency. Spread it into all four corners of the lined tray.',
      'Bake for 25–30 minutes, then rest the base for five minutes.',
      'Spread over the tomato sauce. Add mozzarella, grated Parmigiano Reggiano and pepperoni. Finish with garlic powder and a light oil spray.',
      'Bake at 190°C for eight minutes, then use the grill/broiler for 3–6 minutes until browned and bubbling. Watch closely.',
      'Cut into eight portions. Serve or cool and freeze individually.'
    ]
  },
  {
    code:'DMGVunyJSpv',title:'Sheet Pan Cheesy Chicken Fajita Burritos',servings:12,time:'40–55 min cooking + prep',
    description:'Twelve burritos filled with roasted peppers, onions and cheesy taco-seasoned chicken. Recipe by @stealth_health_life.',
    sourceNutrition:{calories:445,protein:42,carbs:35,fat:16},
    ingredients:['6 bell peppers, diced','2 onions, diced','15 g coarse salt','1360 g boneless skinless chicken thighs, diced','40 g tomato paste','30 g chili paste (harissa or adobo)','3 packets taco seasoning','20 g neutral oil','Oregano or chili flakes, optional','280 g pico de gallo','150 g 0% Greek yogurt','120 g reduced-fat mozzarella','80 g reduced-fat cheddar','80 g reduced-fat mozzarella, optional topping','Cilantro for garnish','12 protein tortillas'],
    instructions:[
      'Heat the oven to 220°C (425°F). Spread the diced peppers and onions on a sheet pan, season with salt and roast for 20–30 minutes, until most released water has evaporated.',
      'Add the diced chicken, tomato paste, chili paste, taco seasoning and oil. Mix thoroughly; use a bowl if the pan is too crowded.',
      'Roast for 18–20 minutes, until the chicken is cooked through. Optionally grill/broil for another 2–3 minutes to brown the top.',
      'Stir in the pico de gallo, yogurt, 120 g mozzarella and cheddar while the mixture is hot.',
      'If using the extra mozzarella, scatter it on top and return to the oven for 2–3 minutes to melt. Add cilantro.',
      'Divide the filling into twelve equal portions. Fill and roll the tortillas, then serve or cool and freeze.'
    ]
  },
  {
    code:'DGJPGUYSnVB',title:'Chili Cheese Beef Burritos',servings:16,time:'25–30 min roasting + 20–30 min cooling + prep',
    description:'Sixteen burritos with roasted sweet potato, chili-seasoned beef and a blended cheese sauce. Recipe by @stealth_health_life.',
    sourceNutrition:{calories:445,protein:32,carbs:44,fat:15},
    ingredients:['500 g sweet potatoes, diced','5 g avocado oil','Salt to taste','Black pepper to taste','Chili powder to taste','1344 g 93% lean ground beef','2 packets chili or taco seasoning','300 g 2% cottage cheese','100 g American cheese','410 g fire-roasted tomatoes','200 g chipotle peppers in adobo','Garlic powder to taste','2 tbsp cornstarch','2 tbsp water','150 g sharp cheddar','Cilantro or green onions, a handful','16 burrito-size tortillas','Fat-free Greek yogurt, a spoonful per burrito'],
    instructions:[
      'Heat the oven to 220°C (425°F). Toss the diced sweet potatoes with avocado oil, salt, pepper and chili powder. Roast for 25–30 minutes.',
      'Blend the cottage cheese, American cheese, fire-roasted tomatoes and chipotle peppers until smooth. Season with salt, pepper and garlic powder.',
      'Brown the beef in a large pan and mix in the chili or taco seasoning. Stir in the blended sauce.',
      'Mix the cornstarch with the water, stir it into the beef and simmer until thickened. Add chopped cilantro or green onions.',
      'Combine the beef mixture with the roasted sweet potatoes and cheddar. Chill for 20–30 minutes to firm the filling.',
      'Spread a spoonful of Greek yogurt on each tortilla. Divide the filling into sixteen portions, fill and roll. Serve or freeze individually.'
    ]
  },
  {
    code:'DOB_QOcAR9r',title:'Cheesy Buffalo Chicken Burritos',servings:12,time:'36–43 min baking + 10–15 min rest + prep',
    description:'Twelve sweet-and-spicy buffalo chicken burritos with sweet potato, cheddar and mozzarella. Recipe by @stealth_health_life.',
    sourceNutrition:{calories:475,protein:44,carbs:37,fat:17},
    ingredients:['2 sweet onions, diced','500 g sweet potato, diced','15 g coarse salt','1360 g boneless skinless chicken thighs, diced','120 g buffalo sauce','40 g tomato paste','40 g honey','30 g Worcestershire sauce','20 g butter','1 tsp garlic powder','Black pepper to taste','10 g cornstarch','180 g reduced-fat cheddar','150 g 0% Greek yogurt','Green onions for garnish','160 g reduced-fat mozzarella','12 low-carb high-protein burrito tortillas'],
    reviewNote:'The creator permits chicken breast instead of thighs. Recalculate ingredient nutrition if you change the cut or tortilla brand. The optional dip has no measured quantities and is not included.',
    instructions:[
      'Heat the oven to 220°C (425°F). Spread the diced onions and sweet potato on a sheet pan, add salt and bake for 20–25 minutes.',
      'Mix in the diced chicken, buffalo sauce, tomato paste, honey, Worcestershire sauce, butter, garlic powder and pepper. Use a bowl if needed.',
      'Bake at 220°C for 16–18 minutes, until the chicken is cooked through. Optionally finish under the grill/broiler for 3–4 minutes.',
      'Stir in the cornstarch, cheddar, yogurt and chopped green onions until the mixture thickens. The creator suggests a little more cornstarch if it is still watery.',
      'Scatter the mozzarella over the top and return to the oven until melted. Let the filling rest for 10–15 minutes.',
      'Divide between twelve tortillas and roll closed. Serve or cool and freeze. An optional dip combines yogurt, buffalo sauce, ranch seasoning and a little sweetener to taste.'
    ]
  },
  {
    code:'DRH-aJfEeTI',title:'Sheet Pan Cheesy Steak Fajita Burritos',servings:12,time:'28–38 min cooking + 10–15 min tenderizing + prep',
    description:'Twelve steak fajita burritos with roasted vegetables, pico de gallo and melted cheese. Recipe by @stealth_health_life.',
    sourceNutrition:{calories:425,protein:45,carbs:46,fat:19},
    reviewNote:'Creator reports 425 kcal, 45 g protein, 46 g carbs and 19 g fat per burrito. Those macros imply about 535 kcal using 4/4/9; source figures are retained for review. Low-carb tortilla labels may treat fibre differently. Confirm the packaging before relying on these totals.',
    ingredients:['1360 g flank or skirt steak','3/4 tsp baking soda','2 tsp water','40 g tomato paste','15 g soy sauce','30 g adobo sauce','3 packets taco seasoning (about 90 g)','20 g neutral oil','1 tsp cumin','6 bell peppers, diced','2 onions, diced','15 g salt','280 g pico de gallo','150 g 0% Greek yogurt','120 g reduced-fat mozzarella','80 g reduced-fat cheddar','80 g reduced-fat mozzarella, optional topping','Cilantro for garnish','12 low-carb tortillas'],
    instructions:[
      'Heat the oven to 220°C (425°F). Slice the steak thinly across the grain. Mix the baking soda with water, coat the steak and leave for 10–15 minutes.',
      'Mix the tomato paste, soy sauce, adobo sauce, taco seasoning, oil and cumin into the steak.',
      'Spread the peppers and onions on a sheet pan, season with salt and roast for 20–30 minutes.',
      'Place a wire rack over the vegetables and spread the steak over it. Grill/broil on high for roughly eight minutes, watching closely, until browned and cooked to your liking.',
      'Combine the steak and vegetables with pico de gallo, yogurt, mozzarella and cheddar. If using the extra mozzarella, scatter on top and melt briefly in the oven. Finish with cilantro.',
      'Divide into twelve equal portions and roll into the tortillas. Serve or cool and freeze.'
    ]
  }
];
module.exports=recipes.map(r=>({...r,ingredients:r.ingredients.map(Model.parseIngredient)}));
