// Food knowledge base.
// Nutrition values are per 100 g and are ESTIMATES based on USDA FoodData Central
// reference values (mostly raw / as-purchased). Prices are rough estimates only.
//
// F(key, emoji, category, location, shelfDays, [kcal, protein, carbs, fat, fiber],
//   gramsPerUnit, [buyUnit, estPrice], options)
// gramsPerUnit keys: each, cup, tbsp, tsp, clove, slice, can, bunch, head, stick,
//   stalk, ear, fillet, link, loaf, pk (typical package / bag / jar / bottle).
// options: a = aliases ("a|b|c"), veg, fruit, meat, fish, al = allergens, basic
//   (basic = seasoning-type staple: we only check that you have some, not how much).

const F = (key, emoji, cat, loc, days, n, g, buy, o = {}) => ({
  key, emoji, cat, loc, days, n, g, buy,
  aliases: (o.a || '').split('|').filter(Boolean),
  veg: !!o.veg, fruit: !!o.fruit, meat: !!o.meat, fish: !!o.fish, basic: !!o.basic,
  allergens: (o.al || '').split('|').filter(Boolean),
});
// Spice helper: negligible calories in normal amounts, presence-only matching.
const S = (key, kcal, tsp, a = '') =>
  F(key, '🧂', 'spices', 'staples', 730, [kcal, 11, 55, 9, 25], { tsp, tbsp: tsp * 3, pk: 60 }, ['jar', 2.5], { a, basic: 1 });

export const FOODS = [
  // ---------- Produce ----------
  F('onion', '🧅', 'produce', 'pantry', 30, [40, 1.1, 9.3, 0.1, 1.7], { each: 150, cup: 160, pk: 1360 }, ['each', 0.9], { a: 'yellow onion|red onion|white onion|sweet onion|shallot', veg: 1 }),
  F('green onion', '🌱', 'produce', 'fridge', 7, [32, 1.8, 7.3, 0.2, 2.6], { each: 15, bunch: 100, cup: 100 }, ['bunch', 0.9], { a: 'scallion|spring onion', veg: 1 }),
  F('garlic', '🧄', 'produce', 'pantry', 60, [149, 6.4, 33, 0.5, 2.1], { clove: 3, each: 40, head: 40, tbsp: 9, tsp: 3 }, ['head', 0.6], { a: 'garlic clove', veg: 1, basic: 1 }),
  F('ginger', '🫚', 'produce', 'fridge', 21, [80, 1.8, 18, 0.8, 2], { tbsp: 6, tsp: 2, each: 30, pk: 60 }, ['each', 1], { a: 'ginger root|fresh ginger', basic: 1 }),
  F('tomato', '🍅', 'produce', 'fridge', 7, [18, 0.9, 3.9, 0.2, 1.2], { each: 120, cup: 180 }, ['lb', 1.3], { a: 'roma tomato|plum tomato|vine tomato', veg: 1 }),
  F('cherry tomatoes', '🍅', 'produce', 'fridge', 7, [18, 0.9, 3.9, 0.2, 1.2], { cup: 150, pk: 280, each: 17 }, ['container', 3], { a: 'grape tomato', veg: 1 }),
  F('potato', '🥔', 'produce', 'pantry', 30, [77, 2, 17, 0.1, 2.2], { each: 210, cup: 150, pk: 2270 }, ['lb', 1], { a: 'russet potato|gold potato|red potato', veg: 1 }),
  F('sweet potato', '🍠', 'produce', 'pantry', 21, [86, 1.6, 20, 0.1, 3], { each: 150, cup: 133 }, ['lb', 1.2], { a: 'yam', veg: 1 }),
  F('carrot', '🥕', 'produce', 'fridge', 21, [41, 0.9, 9.6, 0.2, 2.8], { each: 61, cup: 128, pk: 907 }, ['bag', 2], { a: 'baby carrot', veg: 1 }),
  F('celery', '🥬', 'produce', 'fridge', 14, [16, 0.7, 3, 0.2, 1.6], { stalk: 40, cup: 100, each: 450, bunch: 450 }, ['bunch', 2], { veg: 1 }),
  F('bell pepper', '🫑', 'produce', 'fridge', 10, [26, 1, 6, 0.3, 2.1], { each: 120, cup: 150 }, ['each', 1.2], { a: 'red bell pepper|green bell pepper|red pepper|green pepper|capsicum|sweet pepper', veg: 1 }),
  F('jalapeño', '🌶️', 'produce', 'fridge', 10, [29, 0.9, 6.5, 0.4, 2.8], { each: 14 }, ['each', 0.2], { a: 'jalapeno|jalapeno pepper|serrano|green chili|green chilli|chile pepper', veg: 1 }),
  F('spinach', '🥬', 'produce', 'fridge', 5, [23, 2.9, 3.6, 0.4, 2.2], { cup: 30, pk: 283, bunch: 340 }, ['bag', 3.5], { a: 'baby spinach|palak', veg: 1 }),
  F('lettuce', '🥬', 'produce', 'fridge', 7, [17, 1.2, 3.3, 0.3, 2.1], { head: 600, each: 600, cup: 47, leaf: 10, pk: 255 }, ['head', 2], { a: 'romaine|romaine lettuce|iceberg|salad mix|mixed greens', veg: 1 }),
  F('kale', '🥬', 'produce', 'fridge', 7, [35, 2.9, 4.4, 1.5, 4.1], { bunch: 200, cup: 21, pk: 283 }, ['bunch', 1.8], { veg: 1 }),
  F('cabbage', '🥬', 'produce', 'fridge', 21, [25, 1.3, 5.8, 0.1, 2.5], { head: 900, each: 900, cup: 89 }, ['head', 2.5], { a: 'coleslaw mix', veg: 1 }),
  F('broccoli', '🥦', 'produce', 'fridge', 7, [34, 2.8, 6.6, 0.4, 2.6], { head: 300, each: 300, cup: 91, pk: 340 }, ['lb', 1.8], { a: 'broccoli crown|broccoli floret', veg: 1 }),
  F('cauliflower', '🥦', 'produce', 'fridge', 7, [25, 1.9, 5, 0.3, 2], { head: 600, each: 600, cup: 107 }, ['head', 3], { veg: 1 }),
  F('zucchini', '🥒', 'produce', 'fridge', 7, [17, 1.2, 3.1, 0.3, 1], { each: 200, cup: 124 }, ['each', 0.9], { a: 'courgette|squash', veg: 1 }),
  F('cucumber', '🥒', 'produce', 'fridge', 7, [15, 0.7, 3.6, 0.1, 0.5], { each: 300, cup: 104 }, ['each', 0.8], { veg: 1 }),
  F('mushrooms', '🍄', 'produce', 'fridge', 7, [22, 3.1, 3.3, 0.3, 1], { cup: 70, pk: 227, each: 18 }, ['package', 2.5], { a: 'mushroom|baby bella', veg: 1 }),
  F('corn', '🌽', 'produce', 'fridge', 5, [86, 3.3, 19, 1.4, 2], { ear: 90, each: 90, cup: 145, can: 250, pk: 340 }, ['bag', 1.5], { a: 'sweet corn|frozen corn|corn kernel|sweetcorn', veg: 1 }),
  F('green beans', '🫛', 'produce', 'fridge', 7, [31, 1.8, 7, 0.2, 2.7], { cup: 100, pk: 340, can: 240 }, ['lb', 1.8], { a: 'string bean|french bean', veg: 1 }),
  F('peas', '🫛', 'frozen', 'freezer', 240, [81, 5.4, 14, 0.4, 5.7], { cup: 145, pk: 340 }, ['bag', 1.5], { a: 'green pea|frozen pea', veg: 1 }),
  F('avocado', '🥑', 'produce', 'fridge', 5, [160, 2, 8.5, 14.7, 6.7], { each: 150, cup: 150 }, ['each', 0.9], { a: 'hass avocado', veg: 1 }),
  F('lime', '🍋‍🟩', 'produce', 'fridge', 21, [30, 0.7, 10.5, 0.2, 2.8], { each: 67, tbsp: 15, cup: 240 }, ['each', 0.3], { a: 'lime juice', fruit: 1, basic: 1 }),
  F('lemon', '🍋', 'produce', 'fridge', 21, [29, 1.1, 9.3, 0.3, 2.8], { each: 58, tbsp: 15, cup: 240 }, ['each', 0.6], { a: 'lemon juice', fruit: 1, basic: 1 }),
  F('cilantro', '🌿', 'produce', 'fridge', 7, [23, 2.1, 3.7, 0.5, 2.8], { bunch: 50, each: 50, cup: 16, tbsp: 1 }, ['bunch', 0.6], { a: 'coriander leaf|fresh coriander', veg: 1, basic: 1 }),
  F('parsley', '🌿', 'produce', 'fridge', 7, [36, 3, 6.3, 0.8, 3.3], { bunch: 60, each: 60, cup: 60, tbsp: 4 }, ['bunch', 0.9], { veg: 1, basic: 1 }),
  F('basil', '🌿', 'produce', 'fridge', 5, [23, 3.2, 2.7, 0.6, 1.6], { bunch: 60, each: 20, cup: 24, pk: 20 }, ['package', 2.5], { a: 'fresh basil', veg: 1, basic: 1 }),
  F('banana', '🍌', 'produce', 'pantry', 5, [89, 1.1, 23, 0.3, 2.6], { each: 118, cup: 150 }, ['lb', 0.6], { fruit: 1 }),
  F('apple', '🍎', 'produce', 'fridge', 30, [52, 0.3, 14, 0.2, 2.4], { each: 182, cup: 125, pk: 1360 }, ['lb', 1.6], { a: 'gala apple|fuji apple|honeycrisp', fruit: 1 }),
  F('orange', '🍊', 'produce', 'fridge', 21, [47, 0.9, 12, 0.1, 2.4], { each: 131, pk: 1810 }, ['lb', 1.3], { a: 'navel orange|clementine|mandarin', fruit: 1 }),
  F('strawberries', '🍓', 'produce', 'fridge', 5, [32, 0.7, 7.7, 0.3, 2], { cup: 150, pk: 454, each: 12 }, ['container', 3.5], { a: 'strawberry', fruit: 1 }),
  F('blueberries', '🫐', 'produce', 'fridge', 7, [57, 0.7, 14.5, 0.3, 2.4], { cup: 148, pk: 340 }, ['container', 4], { a: 'blueberry|mixed berries|berries|raspberries', fruit: 1 }),
  F('grapes', '🍇', 'produce', 'fridge', 7, [69, 0.7, 18, 0.2, 0.9], { cup: 151, pk: 900 }, ['lb', 2.5], { a: 'grape', fruit: 1 }),
  F('mango', '🥭', 'produce', 'fridge', 5, [60, 0.8, 15, 0.4, 1.6], { each: 200, cup: 165 }, ['each', 1], { fruit: 1 }),

  // ---------- Meat, seafood, protein ----------
  F('chicken breast', '🍗', 'meat', 'fridge', 2, [120, 22.5, 0, 2.6, 0], { each: 225, pk: 680, cup: 140 }, ['lb', 3.5], { a: 'chicken|chicken breast fillet|chicken tender|chicken tenderloin', meat: 1 }),
  F('chicken thighs', '🍗', 'meat', 'fridge', 2, [121, 19.7, 0, 4.1, 0], { each: 110, pk: 680 }, ['lb', 2.8], { a: 'chicken thigh|chicken leg|chicken drumstick|chicken wing', meat: 1 }),
  F('rotisserie chicken', '🍗', 'deli', 'fridge', 4, [190, 24, 0, 10, 0], { each: 700, cup: 140 }, ['each', 6], { a: 'cooked chicken|whole chicken|shredded chicken', meat: 1 }),
  F('ground beef', '🥩', 'meat', 'fridge', 2, [215, 18.6, 0, 15, 0], { pk: 454, cup: 225 }, ['lb', 6], { a: 'minced beef|beef mince|hamburger meat|lean ground beef', meat: 1 }),
  F('ground turkey', '🦃', 'meat', 'fridge', 2, [150, 18.7, 0, 8.3, 0], { pk: 454 }, ['lb', 5], { a: 'minced turkey|turkey mince|ground chicken', meat: 1 }),
  F('beef', '🥩', 'meat', 'fridge', 3, [170, 21, 0, 9, 0], { each: 225, pk: 454 }, ['lb', 9], { a: 'steak|sirloin|flank steak|skirt steak|stew meat|beef chuck|chuck roast|fajita meat|ribeye|brisket', meat: 1 }),
  F('pork chops', '🥩', 'meat', 'fridge', 3, [143, 21, 0, 5.7, 0], { each: 170, pk: 680 }, ['lb', 4], { a: 'pork chop|pork loin|pork tenderloin|pork', meat: 1 }),
  F('pork shoulder', '🥩', 'meat', 'fridge', 3, [186, 17.4, 0, 12.4, 0], { pk: 1360 }, ['lb', 3], { a: 'pork butt|carnitas|pulled pork', meat: 1 }),
  F('bacon', '🥓', 'meat', 'fridge', 7, [417, 12.6, 1.3, 39.7, 0], { slice: 28, each: 28, pk: 340 }, ['package', 6], { a: 'turkey bacon|streaky bacon', meat: 1 }),
  F('sausage', '🌭', 'meat', 'fridge', 4, [300, 15, 1, 26, 0], { link: 85, each: 85, pk: 400 }, ['package', 5], { a: 'italian sausage|breakfast sausage|chorizo|bratwurst|hot dog|kielbasa', meat: 1 }),
  F('deli turkey', '🥪', 'deli', 'fridge', 5, [104, 17, 4, 2, 0], { slice: 28, each: 28, pk: 227 }, ['package', 5], { a: 'turkey breast slice|sliced turkey|lunch meat|deli ham|ham', meat: 1 }),
  F('salmon', '🐟', 'seafood', 'fridge', 2, [208, 20.4, 0, 13.4, 0], { fillet: 170, each: 170, pk: 454 }, ['lb', 11], { a: 'salmon fillet', fish: 1, al: 'fish' }),
  F('white fish', '🐟', 'seafood', 'fridge', 2, [96, 20, 0, 1.7, 0], { fillet: 115, each: 115, pk: 454 }, ['lb', 8], { a: 'tilapia|cod|catfish|haddock|fish fillet|fish', fish: 1, al: 'fish' }),
  F('shrimp', '🦐', 'seafood', 'fridge', 2, [85, 20.1, 0, 0.5, 0], { each: 12, cup: 145, pk: 454 }, ['lb', 9], { a: 'prawn|king prawn', fish: 1, al: 'shellfish' }),
  F('tuna', '🐟', 'canned', 'pantry', 720, [116, 25.5, 0, 0.8, 0], { can: 113, cup: 150 }, ['can', 1.3], { a: 'canned tuna|tuna fish', fish: 1, al: 'fish' }),
  F('eggs', '🥚', 'dairy', 'fridge', 28, [143, 12.6, 0.7, 9.5, 0], { each: 50, pk: 600 }, ['dozen', 3.5], { a: 'egg|large egg', al: 'egg' }),
  F('tofu', '🧈', 'produce', 'fridge', 7, [144, 17.3, 2.8, 8.7, 2.3], { pk: 396, each: 396, cup: 250 }, ['package', 2.5], { a: 'firm tofu', al: 'soy' }),
  F('paneer', '🧀', 'dairy', 'fridge', 14, [300, 19, 4, 23, 0], { pk: 340, cup: 130 }, ['package', 6], { al: 'dairy' }),

  // ---------- Dairy ----------
  F('milk', '🥛', 'dairy', 'fridge', 10, [50, 3.3, 4.8, 2, 0], { cup: 244, pk: 3900 }, ['gallon', 3.6], { a: 'whole milk|2% milk|skim milk|almond milk|oat milk', al: 'dairy' }),
  F('butter', '🧈', 'dairy', 'fridge', 60, [717, 0.9, 0.1, 81, 0], { tbsp: 14, stick: 113, cup: 227, pk: 454, each: 113 }, ['package', 4.2], { a: 'salted butter|unsalted butter|margarine', al: 'dairy' }),
  F('ghee', '🧈', 'pantry', 'pantry', 270, [876, 0, 0, 99.5, 0], { tbsp: 13, cup: 205, pk: 370 }, ['jar', 7], { al: 'dairy' }),
  F('cheddar cheese', '🧀', 'dairy', 'fridge', 30, [403, 23, 3.1, 33, 0], { cup: 113, slice: 21, pk: 227, each: 21 }, ['bag', 2.5], { a: 'cheddar|cheese|shredded cheese|mexican cheese blend|monterey jack|pepper jack|colby|american cheese|cheese slice', al: 'dairy' }),
  F('mozzarella', '🧀', 'dairy', 'fridge', 21, [300, 22, 2.2, 22, 0], { cup: 112, slice: 28, pk: 227, each: 227 }, ['bag', 2.5], { a: 'mozzarella cheese|fresh mozzarella', al: 'dairy' }),
  F('parmesan', '🧀', 'dairy', 'fridge', 60, [431, 38, 4.1, 29, 0], { cup: 100, tbsp: 5, pk: 227 }, ['container', 4], { a: 'parmesan cheese|parmigiano', al: 'dairy' }),
  F('feta', '🧀', 'dairy', 'fridge', 30, [264, 14, 4.1, 21, 0], { cup: 150, pk: 170 }, ['container', 4], { a: 'feta cheese', al: 'dairy' }),
  F('cream cheese', '🧀', 'dairy', 'fridge', 21, [342, 6, 4.1, 34, 0], { tbsp: 14.5, cup: 232, pk: 227 }, ['package', 2], { al: 'dairy' }),
  F('sour cream', '🥛', 'dairy', 'fridge', 21, [198, 2.4, 4.6, 19, 0], { tbsp: 12, cup: 230, pk: 454 }, ['container', 2], { a: 'crema', al: 'dairy' }),
  F('yogurt', '🥛', 'dairy', 'fridge', 14, [61, 3.5, 4.7, 3.3, 0], { cup: 245, pk: 907 }, ['container', 3], { a: 'plain yogurt|curd|yoghurt|natural yogurt', al: 'dairy' }),
  F('greek yogurt', '🥛', 'dairy', 'fridge', 14, [59, 10, 3.6, 0.4, 0], { cup: 245, pk: 907 }, ['container', 5], { a: 'greek yoghurt|plain greek yogurt|greek plain yogurt|nonfat greek yogurt', al: 'dairy' }),
  F('heavy cream', '🥛', 'dairy', 'fridge', 14, [340, 2.8, 2.8, 36, 0], { cup: 238, tbsp: 15, pk: 473 }, ['carton', 3.5], { a: 'cream|whipping cream|double cream|half and half|single cream', al: 'dairy' }),

  // ---------- Bakery ----------
  F('bread', '🍞', 'bakery', 'pantry', 7, [252, 12.5, 43, 3.5, 6], { slice: 32, each: 32, loaf: 567, pk: 567 }, ['loaf', 2.5], { a: 'whole wheat bread|wheat bread|white bread|sandwich bread|toast|sourdough', al: 'gluten' }),
  F('flour tortillas', '🫓', 'bakery', 'pantry', 10, [304, 8, 50, 7.7, 3], { each: 45, pk: 900 }, ['package', 2.9], { a: 'tortilla|flour tortilla|wrap', al: 'gluten' }),
  F('corn tortillas', '🫓', 'bakery', 'pantry', 14, [218, 5.7, 44.6, 2.9, 6.3], { each: 26, pk: 780 }, ['package', 2], { a: 'corn tortilla|taco shell' }),
  F('hamburger buns', '🍔', 'bakery', 'pantry', 7, [279, 9.5, 49.6, 4.3, 1.8], { each: 50, pk: 400 }, ['package', 2], { a: 'bun|burger bun|hot dog bun|roll|bolillo', al: 'gluten' }),
  F('naan', '🫓', 'bakery', 'pantry', 5, [290, 9, 50, 6, 2], { each: 90, pk: 360 }, ['package', 3.5], { a: 'naan bread|roti|chapati|flatbread', al: 'gluten' }),
  F('pita', '🫓', 'bakery', 'pantry', 7, [275, 9.1, 55.7, 1.2, 2.2], { each: 60, pk: 360 }, ['package', 2.8], { a: 'pita bread|pitta', al: 'gluten' }),

  // ---------- Pantry ----------
  F('rice', '🍚', 'pantry', 'pantry', 720, [365, 7.1, 80, 0.7, 1.3], { cup: 185, pk: 907 }, ['bag', 4], { a: 'white rice|basmati rice|basmati|jasmine rice|long grain rice' }),
  F('brown rice', '🍚', 'pantry', 'pantry', 365, [367, 7.5, 76, 3.2, 3.6], { cup: 190, pk: 907 }, ['bag', 3], {}),
  F('pasta', '🍝', 'pantry', 'pantry', 720, [371, 13, 75, 1.5, 3.2], { cup: 100, pk: 454 }, ['box', 1.3], { a: 'spaghetti|penne|penne rigate|macaroni|fettuccine|linguine|rotini|noodle|lasagna noodle|farfalle|rigatoni', al: 'gluten' }),
  F('quinoa', '🌾', 'pantry', 'pantry', 720, [368, 14, 64, 6, 7], { cup: 170, pk: 454 }, ['bag', 5], {}),
  F('oats', '🥣', 'pantry', 'pantry', 365, [379, 13, 68, 6.5, 10], { cup: 80, pk: 1190 }, ['container', 4], { a: 'rolled oat|old fashioned oats|oatmeal|quick oat|porridge oat' }),
  F('flour', '🌾', 'pantry', 'staples', 365, [364, 10, 76, 1, 2.7], { cup: 125, tbsp: 8, pk: 2270 }, ['bag', 3], { a: 'all purpose flour|plain flour|wheat flour|atta', al: 'gluten' }),
  F('sugar', '🍚', 'pantry', 'staples', 730, [387, 0, 100, 0, 0], { cup: 200, tbsp: 12.5, tsp: 4.2, pk: 1810 }, ['bag', 3.5], { a: 'granulated sugar|white sugar|caster sugar' }),
  F('brown sugar', '🍚', 'pantry', 'staples', 730, [380, 0, 98, 0, 0], { cup: 220, tbsp: 14, pk: 907 }, ['bag', 2.5], {}),
  F('honey', '🍯', 'pantry', 'staples', 730, [304, 0.3, 82, 0, 0.2], { tbsp: 21, cup: 340, pk: 340 }, ['bottle', 5], {}),
  F('maple syrup', '🥞', 'pantry', 'staples', 365, [260, 0, 67, 0, 0], { tbsp: 20, cup: 315, pk: 355 }, ['bottle', 7], { a: 'pancake syrup|syrup' }),
  F('olive oil', '🫒', 'pantry', 'staples', 540, [884, 0, 0, 100, 0], { tbsp: 13.5, cup: 216, pk: 460 }, ['bottle', 8], { a: 'extra virgin olive oil', basic: 1 }),
  F('vegetable oil', '🫗', 'pantry', 'staples', 540, [884, 0, 0, 100, 0], { tbsp: 14, cup: 218, pk: 1300 }, ['bottle', 4.5], { a: 'oil|canola oil|cooking oil|avocado oil|sunflower oil|sesame oil|coconut oil', basic: 1 }),
  F('soy sauce', '🥢', 'pantry', 'staples', 730, [53, 8, 4.9, 0.6, 0.8], { tbsp: 16, cup: 255, pk: 425 }, ['bottle', 3], { a: 'tamari', al: 'soy|gluten', basic: 1 }),
  F('vinegar', '🫗', 'pantry', 'staples', 730, [18, 0, 0.1, 0, 0], { tbsp: 15, cup: 240, pk: 473 }, ['bottle', 2.5], { a: 'white vinegar|apple cider vinegar|rice vinegar|red wine vinegar|balsamic vinegar', basic: 1 }),
  F('ketchup', '🍅', 'pantry', 'staples', 365, [101, 1, 27, 0.1, 0.3], { tbsp: 17, cup: 270, pk: 567 }, ['bottle', 2.5], { a: 'tomato ketchup', basic: 1 }),
  F('mustard', '🌭', 'pantry', 'staples', 365, [60, 3.7, 5.8, 3.3, 4], { tsp: 5, tbsp: 15, pk: 400 }, ['bottle', 1.5], { a: 'dijon mustard|yellow mustard', basic: 1 }),
  F('mayonnaise', '🥪', 'pantry', 'staples', 180, [680, 1, 0.6, 75, 0], { tbsp: 13.8, cup: 220, pk: 850 }, ['jar', 4.5], { a: 'mayo', al: 'egg' }),
  F('salsa', '🍅', 'canned', 'pantry', 365, [29, 1.4, 6.4, 0.2, 1.8], { tbsp: 16, cup: 259, pk: 454 }, ['jar', 2.5], { a: 'pico de gallo|picante sauce', veg: 1 }),
  F('peanut butter', '🥜', 'pantry', 'pantry', 365, [588, 25, 20, 50, 6], { tbsp: 16, cup: 258, pk: 454 }, ['jar', 3], { al: 'peanut' }),
  F('black beans', '🫘', 'canned', 'pantry', 900, [91, 6, 16.6, 0.3, 6.9], { can: 255, cup: 172 }, ['can', 0.9], { a: 'black bean|canned black beans' }),
  F('pinto beans', '🫘', 'canned', 'pantry', 900, [90, 5.5, 16, 0.6, 5.5], { can: 255, cup: 172 }, ['can', 0.9], { a: 'pinto bean|kidney bean|refried bean|cannellini bean|white bean|bean' }),
  F('chickpeas', '🫘', 'canned', 'pantry', 900, [139, 7, 22.5, 2.6, 6.4], { can: 255, cup: 164 }, ['can', 1], { a: 'chickpea|garbanzo|garbanzo bean|chana' }),
  F('lentils', '🫘', 'pantry', 'pantry', 720, [352, 24.6, 63, 1.1, 10.7], { cup: 192, pk: 454 }, ['bag', 2], { a: 'lentil|dal|red lentil|toor dal|masoor dal|moong dal' }),
  F('diced tomatoes', '🥫', 'canned', 'pantry', 720, [24, 1, 5, 0.2, 1.2], { can: 411, cup: 240 }, ['can', 1.1], { a: 'diced tomato|canned tomato|chopped tomato|tinned tomato|plum tomatoes canned', veg: 1 }),
  F('tomato sauce', '🥫', 'canned', 'pantry', 720, [24, 1.2, 5.3, 0.3, 1.5], { can: 425, cup: 245 }, ['can', 1], { a: 'crushed tomato|tomato puree|passata', veg: 1 }),
  F('marinara sauce', '🥫', 'canned', 'pantry', 540, [51, 1.4, 8, 1.5, 1.8], { cup: 250, pk: 680, can: 680 }, ['jar', 2.5], { a: 'marinara|pasta sauce|spaghetti sauce|pizza sauce', veg: 1 }),
  F('tomato paste', '🥫', 'canned', 'pantry', 720, [82, 4.3, 19, 0.5, 4.1], { tbsp: 16, can: 170, cup: 262 }, ['can', 0.9], {}),
  F('broth', '🥣', 'canned', 'pantry', 540, [5, 0.5, 0.4, 0.2, 0], { cup: 240, pk: 946, can: 411 }, ['carton', 2], { a: 'chicken broth|vegetable broth|beef broth|chicken stock|vegetable stock|beef stock|stock|bouillon' }),
  F('coconut milk', '🥥', 'canned', 'pantry', 720, [197, 2.2, 2.8, 21, 0], { can: 400, cup: 240 }, ['can', 2.2], {}),
  F('cereal', '🥣', 'pantry', 'pantry', 270, [380, 7, 84, 2, 5], { cup: 30, pk: 340 }, ['box', 4], { al: 'gluten' }),
  F('granola', '🥣', 'pantry', 'pantry', 180, [471, 10, 64, 20, 5], { cup: 110, pk: 340 }, ['bag', 4.5], {}),
  F('tortilla chips', '🌮', 'snacks', 'pantry', 90, [489, 7, 65, 22, 5], { cup: 26, pk: 311 }, ['bag', 3], { a: 'corn chip|nacho chip' }),
  F('potato chips', '🥔', 'snacks', 'pantry', 90, [536, 7, 53, 35, 4.8], { cup: 28, pk: 227 }, ['bag', 3.5], { a: 'chip|crisps' }),
  F('granola bars', '🍫', 'snacks', 'pantry', 180, [471, 7, 68, 18, 4], { each: 24, pk: 240 }, ['box', 3.5], { a: 'granola bar|snack bar' }),
  F('hummus', '🫘', 'deli', 'fridge', 10, [166, 7.9, 14.3, 9.6, 6], { tbsp: 15, cup: 246, pk: 283 }, ['container', 3.5], { al: 'sesame' }),
  F('almonds', '🌰', 'snacks', 'pantry', 365, [579, 21, 21.6, 50, 12.5], { cup: 143, pk: 170 }, ['bag', 5], { a: 'almond', al: 'treenut' }),
  F('nuts', '🌰', 'snacks', 'pantry', 365, [620, 15, 14, 60, 7], { cup: 120, pk: 170 }, ['bag', 5], { a: 'walnut|pecan|cashew|pistachio|mixed nuts', al: 'treenut' }),
  F('chocolate chips', '🍫', 'pantry', 'pantry', 365, [479, 4.2, 63, 30, 5.9], { cup: 170, pk: 340 }, ['bag', 3], { a: 'chocolate' }),
  F('baking powder', '🧁', 'spices', 'staples', 365, [53, 0, 28, 0, 0], { tsp: 4.6, tbsp: 14, pk: 230 }, ['container', 2], { a: 'baking soda|bicarbonate of soda', basic: 1 }),
  F('vanilla extract', '🧁', 'spices', 'staples', 730, [288, 0, 12.7, 0, 0], { tsp: 4.2, tbsp: 13, pk: 60 }, ['bottle', 5], { a: 'vanilla', basic: 1 }),
  F('cornstarch', '🧁', 'spices', 'staples', 730, [381, 0.3, 91, 0, 0.9], { tbsp: 8, cup: 128, pk: 454 }, ['box', 1.8], { a: 'corn starch|cornflour', basic: 1 }),
  F('breadcrumbs', '🍞', 'pantry', 'pantry', 180, [395, 13, 72, 5, 4.5], { cup: 108, pk: 425 }, ['container', 2], { a: 'bread crumb|panko', al: 'gluten' }),
  F('taco seasoning', '🌮', 'spices', 'staples', 540, [322, 4.5, 58, 0, 13], { tbsp: 8, tsp: 2.7, pk: 28, each: 28 }, ['packet', 0.8], { a: 'fajita seasoning', basic: 1 }),

  // ---------- Frozen, beverages ----------
  F('frozen vegetables', '🥦', 'frozen', 'freezer', 240, [65, 3, 13, 0.5, 4], { cup: 140, pk: 340 }, ['bag', 1.5], { a: 'mixed vegetables|stir fry vegetables|frozen veggies', veg: 1 }),
  F('frozen pizza', '🍕', 'frozen', 'freezer', 180, [268, 11, 30, 11, 2], { each: 600, slice: 100 }, ['each', 5], { a: 'pizza', al: 'gluten|dairy' }),
  F('ice cream', '🍨', 'frozen', 'freezer', 90, [207, 3.5, 24, 11, 0.7], { cup: 132, pk: 900 }, ['container', 5], { al: 'dairy' }),
  F('chicken nuggets', '🍗', 'frozen', 'freezer', 180, [250, 15, 15, 15, 1], { each: 18, pk: 800 }, ['bag', 7], { a: 'chicken nugget|chicken strip', meat: 1, al: 'gluten' }),
  F('orange juice', '🧃', 'beverages', 'fridge', 10, [45, 0.7, 10.4, 0.2, 0.2], { cup: 248, pk: 1530 }, ['carton', 4], { a: 'juice|apple juice' }),
  F('coffee', '☕', 'beverages', 'staples', 180, [1, 0.1, 0, 0, 0], { cup: 240, tbsp: 5, pk: 340 }, ['bag', 8], { a: 'ground coffee|coffee beans', basic: 1 }),

  // ---------- Spices & seasonings ----------
  F('salt', '🧂', 'spices', 'staples', 1800, [0, 0, 0, 0, 0], { tsp: 6, tbsp: 18, pk: 737 }, ['container', 1], { a: 'sea salt|kosher salt|table salt', basic: 1 }),
  S('black pepper', 251, 2.3, 'pepper|ground pepper|peppercorn'),
  S('cumin', 375, 2.1, 'ground cumin|cumin seed|jeera'),
  S('chili powder', 282, 2.7, 'chilli powder|red chili powder|cayenne|cayenne pepper'),
  S('paprika', 282, 2.3, 'smoked paprika'),
  S('oregano', 265, 1, 'dried oregano'),
  S('italian seasoning', 265, 1, 'mixed herbs|dried herbs|dried basil|dried thyme|thyme|rosemary'),
  S('turmeric', 312, 3, 'ground turmeric|haldi'),
  S('garam masala', 380, 2, 'tikka masala spice|curry paste'),
  S('curry powder', 325, 2, 'madras curry powder'),
  S('cinnamon', 247, 2.6, 'ground cinnamon'),
  S('garlic powder', 331, 3.1, 'onion powder'),
  S('red pepper flakes', 318, 1.8, 'chili flakes|chilli flakes|crushed red pepper'),
  S('coriander', 298, 1.8, 'ground coriander|coriander seed|coriander powder'),
  S('bay leaf', 313, 0.6, 'bay leaves'),
];

export const FOOD = Object.fromEntries(FOODS.map((f) => [f.key, f]));

// H-E-B store sections in the order you would usually walk the store.
export const SECTIONS = ['Produce', 'Bakery & Tortillas', 'Deli', 'Meat & Seafood', 'Dairy & Eggs', 'Frozen',
  'Pantry', 'Canned & Jarred', 'Spices & Baking', 'Snacks', 'Beverages', 'Household', 'Other'];

export const CATEGORIES = {
  produce: 'Produce', bakery: 'Bakery & Tortillas', deli: 'Deli', meat: 'Meat & Seafood', seafood: 'Meat & Seafood',
  dairy: 'Dairy & Eggs', frozen: 'Frozen', pantry: 'Pantry', canned: 'Canned & Jarred', spices: 'Spices & Baking',
  snacks: 'Snacks', beverages: 'Beverages', household: 'Household', leftovers: 'Leftovers', other: 'Other',
};
export const sectionFor = (cat) => CATEGORIES[cat] === 'Leftovers' ? 'Other' : (CATEGORIES[cat] || 'Other');

export const LOCATIONS = { fridge: 'Fridge', freezer: 'Freezer', pantry: 'Pantry', staples: 'Spices & Staples' };

// Default shelf life (days) and location when we do not recognise the food.
export const CAT_DEFAULTS = {
  produce: ['fridge', 7], bakery: ['pantry', 7], deli: ['fridge', 5], meat: ['fridge', 3], seafood: ['fridge', 2],
  dairy: ['fridge', 14], frozen: ['freezer', 180], pantry: ['pantry', 365], canned: ['pantry', 720],
  spices: ['staples', 730], snacks: ['pantry', 120], beverages: ['pantry', 180], leftovers: ['fridge', 4], other: ['pantry', 90],
};
export const CAT_EMOJI = { produce: '🥬', bakery: '🍞', deli: '🥪', meat: '🥩', seafood: '🐟', dairy: '🥛', frozen: '🧊',
  pantry: '🥫', canned: '🥫', spices: '🧂', snacks: '🍿', beverages: '🧃', household: '🧻', leftovers: '🍱', other: '🛒' };
