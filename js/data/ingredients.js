// A large list of cooking ingredients and grocery foods, used for the suggestion dropdown when
// typing a food or a recipe ingredient. Grouped by the fridge category each one belongs to.
const RAW = {
  produce: `apple|green apple|red apple|gala apple|fuji apple|honeycrisp apple|granny smith apple|apricot|avocado|banana|plantain|blackberries|blueberries|raspberries|strawberries|cranberries|cherries|grapes|red grapes|green grapes|kiwi|lemon|lime|key lime|orange|navel orange|blood orange|mandarin|clementine|tangerine|grapefruit|mango|papaya|pineapple|peach|nectarine|pear|asian pear|plum|pomegranate|watermelon|cantaloupe|honeydew melon|coconut|dates|figs|guava|passion fruit|dragon fruit|lychee|persimmon|star fruit|jackfruit|rhubarb|tomato|roma tomato|cherry tomatoes|grape tomatoes|heirloom tomato|tomatillo|onion|yellow onion|white onion|red onion|sweet onion|shallot|green onion|leek|chives|garlic|ginger|turmeric root|potato|russet potato|yukon gold potato|red potato|baby potatoes|sweet potato|yam|carrot|baby carrots|celery|parsnip|turnip|rutabaga|radish|daikon|beet|jicama|bell pepper|red bell pepper|green bell pepper|yellow bell pepper|orange bell pepper|jalapeño|serrano pepper|poblano pepper|anaheim pepper|habanero|thai chili|banana pepper|cucumber|english cucumber|persian cucumber|zucchini|yellow squash|butternut squash|acorn squash|spaghetti squash|pumpkin|eggplant|okra|green beans|snap peas|snow peas|edamame|corn on the cob|broccoli|broccolini|cauliflower|cabbage|red cabbage|napa cabbage|bok choy|baby bok choy|brussels sprouts|kale|spinach|baby spinach|swiss chard|collard greens|mustard greens|arugula|romaine lettuce|iceberg lettuce|butter lettuce|spring mix|mixed greens|coleslaw mix|watercress|endive|radicchio|fennel|artichoke|asparagus|mushrooms|white mushrooms|cremini mushrooms|portobello mushrooms|shiitake mushrooms|oyster mushrooms|enoki mushrooms|bean sprouts|alfalfa sprouts|cilantro|parsley|flat leaf parsley|basil|thai basil|mint|dill|rosemary|thyme|oregano leaves|sage|tarragon|bay leaves fresh|lemongrass|curry leaves|kaffir lime leaves|methi leaves|horseradish root|galangal|taro|cassava|chayote|nopales|seaweed salad|tofu|firm tofu|silken tofu|extra firm tofu|tempeh|seitan`,
  meat: `chicken breast|boneless chicken breast|chicken thighs|boneless chicken thighs|chicken drumsticks|chicken wings|chicken tenders|whole chicken|ground chicken|chicken legs|cornish hen|turkey breast|ground turkey|turkey legs|whole turkey|ground beef|lean ground beef|beef chuck roast|beef brisket|beef short ribs|beef stew meat|sirloin steak|ribeye steak|new york strip steak|t-bone steak|filet mignon|flank steak|skirt steak|beef tenderloin|top round roast|beef fajita meat|carne asada|beef liver|oxtail|veal|pork chops|boneless pork chops|pork tenderloin|pork loin|pork shoulder|pork butt|pork belly|baby back ribs|spare ribs|ground pork|ham|ham steak|spiral ham|bacon|thick cut bacon|turkey bacon|canadian bacon|pancetta|prosciutto|salami|pepperoni|chorizo|italian sausage|breakfast sausage|smoked sausage|kielbasa|andouille sausage|bratwurst|hot dogs|lamb chops|ground lamb|leg of lamb|lamb shoulder|goat meat|duck breast|venison|bison|ground bison|deli turkey|deli ham|roast beef deli|deli chicken|corned beef|pastrami|bologna|meatballs`,
  seafood: `salmon|salmon fillet|smoked salmon|tilapia|cod|catfish|halibut|mahi mahi|tuna steak|swordfish|trout|sea bass|snapper|flounder|haddock|pollock|sardines fresh|mackerel|shrimp|jumbo shrimp|cooked shrimp|prawns|scallops|crab meat|crab legs|lobster tail|crawfish|mussels|clams|oysters|squid|calamari|octopus|anchovies|fish sticks|imitation crab`,
  dairy: `milk|whole milk|2% milk|1% milk|skim milk|lactose free milk|almond milk|oat milk|soy milk|coconut milk beverage|buttermilk|half and half|heavy cream|heavy whipping cream|whipped cream|coffee creamer|sour cream|cream cheese|cottage cheese|ricotta|mascarpone|yogurt|plain yogurt|greek yogurt|vanilla yogurt|kefir|butter|salted butter|unsalted butter|ghee|margarine|eggs|large eggs|egg whites|cheddar cheese|sharp cheddar|shredded cheddar|mozzarella|fresh mozzarella|shredded mozzarella|string cheese|parmesan|grated parmesan|pecorino romano|monterey jack|pepper jack|colby jack|swiss cheese|provolone|american cheese|gouda|smoked gouda|brie|camembert|blue cheese|gorgonzola|feta|goat cheese|queso fresco|cotija|oaxaca cheese|queso blanco|paneer|halloumi|gruyere|havarti|muenster|mexican cheese blend|italian cheese blend|velveeta|queso dip|pudding|custard`,
  bakery: `bread|white bread|whole wheat bread|multigrain bread|sourdough bread|rye bread|french bread|baguette|ciabatta|brioche|challah|texas toast|garlic bread|hamburger buns|hot dog buns|brioche buns|dinner rolls|bolillos|kaiser rolls|english muffins|bagels|croissants|pita bread|naan|flatbread|tortillas|flour tortillas|corn tortillas|whole wheat tortillas|low carb tortillas|taco shells|tostadas|lavash|roti|chapati|paratha|pizza dough|pizza crust|muffins|donuts|cinnamon rolls|pound cake|angel food cake|pie crust|puff pastry|phyllo dough|crescent rolls|biscuits|cornbread|kolaches`,
  pantry: `rice|white rice|brown rice|jasmine rice|basmati rice|long grain rice|arborio rice|sushi rice|wild rice|instant rice|quinoa|couscous|pearl couscous|bulgur|farro|barley|millet|polenta|grits|cornmeal|oats|rolled oats|steel cut oats|instant oatmeal|cream of wheat|pasta|spaghetti|penne|rigatoni|fettuccine|linguine|angel hair pasta|macaroni|elbow macaroni|rotini|farfalle|orzo|lasagna noodles|egg noodles|ramen noodles|instant ramen|rice noodles|udon noodles|soba noodles|glass noodles|lo mein noodles|gnocchi|tortellini|ravioli|mac and cheese box|flour|all purpose flour|bread flour|whole wheat flour|cake flour|self rising flour|almond flour|coconut flour|chickpea flour|masa harina|rice flour|atta flour|cornstarch|baking powder|baking soda|yeast|instant yeast|sugar|brown sugar|powdered sugar|cane sugar|coconut sugar|honey|maple syrup|agave syrup|molasses|corn syrup|vanilla extract|almond extract|cocoa powder|chocolate chips|semi sweet chocolate chips|dark chocolate|white chocolate chips|baking chocolate|sprinkles|marshmallows|graham crackers|shredded coconut|food coloring|gelatin|sweetened condensed milk|evaporated milk|powdered milk|olive oil|extra virgin olive oil|vegetable oil|canola oil|avocado oil|coconut oil|sesame oil|peanut oil|sunflower oil|cooking spray|shortening|lard|white vinegar|apple cider vinegar|red wine vinegar|white wine vinegar|balsamic vinegar|rice vinegar|sherry vinegar|soy sauce|low sodium soy sauce|tamari|fish sauce|oyster sauce|hoisin sauce|teriyaki sauce|sriracha|hot sauce|chili garlic sauce|gochujang|sambal oelek|worcestershire sauce|ketchup|mustard|yellow mustard|dijon mustard|whole grain mustard|honey mustard|mayonnaise|miracle whip|ranch dressing|italian dressing|caesar dressing|balsamic vinaigrette|blue cheese dressing|thousand island dressing|bbq sauce|steak sauce|buffalo sauce|tartar sauce|cocktail sauce|relish|pickles|dill pickles|pickled jalapeños|capers|olives|black olives|kalamata olives|green olives|sun dried tomatoes|roasted red peppers|artichoke hearts|peanut butter|almond butter|nutella|jam|strawberry jam|grape jelly|tahini|hummus|pesto|salsa|salsa verde|enchilada sauce|taco sauce|queso|marinara sauce|pasta sauce|alfredo sauce|vodka sauce|pizza sauce|tomato paste|curry paste|red curry paste|green curry paste|tikka masala sauce|butter chicken sauce|miso paste|chicken bouillon|beef bouillon|vegetable bouillon|better than bouillon|breadcrumbs|panko|croutons|stuffing mix|cereal|granola|pancake mix|waffle mix|cake mix|brownie mix|cornbread mix|biscuit mix|pie filling|popcorn kernels|lentils|red lentils|green lentils|brown lentils|toor dal|moong dal|chana dal|urad dal|masoor dal|split peas|dried black beans|dried pinto beans|dried chickpeas|dried kidney beans|rajma|almonds|walnuts|pecans|cashews|pistachios|peanuts|pine nuts|hazelnuts|macadamia nuts|mixed nuts|sunflower seeds|pumpkin seeds|chia seeds|flax seeds|sesame seeds|hemp seeds|raisins|dried cranberries|dried apricots|prunes|dried mango|coffee|ground coffee|coffee beans|instant coffee|tea bags|green tea|black tea|chai tea|matcha|hot chocolate mix|protein powder`,
  canned: `black beans|pinto beans|kidney beans|refried beans|cannellini beans|great northern beans|navy beans|chickpeas|garbanzo beans|lima beans|baked beans|diced tomatoes|crushed tomatoes|tomato sauce|whole peeled tomatoes|fire roasted tomatoes|rotel|tomato puree|canned corn|creamed corn|canned green beans|canned peas|canned carrots|canned potatoes|canned mushrooms|canned spinach|canned pumpkin|green chiles|chipotle peppers in adobo|coconut milk|coconut cream|chicken broth|beef broth|vegetable broth|chicken stock|bone broth|cream of mushroom soup|cream of chicken soup|tomato soup|chicken noodle soup|canned chili|canned tuna|canned salmon|canned chicken|sardines|spam|canned pineapple|canned peaches|mandarin oranges canned|fruit cocktail|applesauce|cranberry sauce|water chestnuts|bamboo shoots|hearts of palm`,
  frozen: `frozen peas|frozen corn|frozen broccoli|frozen mixed vegetables|frozen spinach|frozen green beans|frozen cauliflower rice|frozen stir fry vegetables|frozen edamame|frozen berries|frozen strawberries|frozen blueberries|frozen mango|frozen fruit|frozen pizza|frozen waffles|frozen pancakes|frozen french fries|tater tots|hash browns|frozen chicken nuggets|frozen chicken tenders|frozen fish fillets|frozen shrimp|frozen meatballs|frozen burritos|frozen dumplings|potstickers|frozen egg rolls|frozen lasagna|frozen dinners|frozen pie crust|ice cream|frozen yogurt|popsicles|whipped topping|frozen garlic bread|frozen paratha|frozen naan|frozen samosas|ice`,
  spices: `salt|kosher salt|sea salt|black pepper|white pepper|peppercorns|garlic powder|onion powder|garlic salt|paprika|smoked paprika|chili powder|cayenne pepper|red pepper flakes|cumin|ground cumin|cumin seeds|coriander|ground coriander|coriander seeds|turmeric|ground turmeric|garam masala|curry powder|chaat masala|tandoori masala|kashmiri chili powder|amchur|asafoetida|hing|fenugreek seeds|kasuri methi|mustard seeds|fennel seeds|ajwain|cardamom|green cardamom|black cardamom|cloves|cinnamon|cinnamon sticks|nutmeg|allspice|star anise|saffron|ginger powder|oregano|dried oregano|basil dried|thyme dried|rosemary dried|sage dried|dill weed|parsley flakes|bay leaves|italian seasoning|herbes de provence|poultry seasoning|cajun seasoning|creole seasoning|old bay|lemon pepper|taco seasoning|fajita seasoning|ranch seasoning|everything bagel seasoning|chinese five spice|za'atar|sumac|ras el hanout|adobo seasoning|sazon|chili lime seasoning|tajin|msg|celery salt|seasoned salt|steak seasoning|pumpkin pie spice|apple pie spice|cream of tartar|vanilla bean`,
  snacks: `tortilla chips|potato chips|pita chips|pretzels|popcorn|crackers|saltine crackers|cheese crackers|goldfish crackers|rice cakes|granola bars|protein bars|trail mix|beef jerky|cookies|oreos|chocolate bars|candy|gummies|fruit snacks|pudding cups|applesauce pouches|nut butter crackers|seaweed snacks|veggie straws|cheese puffs|salsa con queso|guacamole`,
  beverages: `water|sparkling water|orange juice|apple juice|grape juice|cranberry juice|lemonade|coconut water|soda|cola|ginger ale|root beer|iced tea|sports drink|energy drink|kombucha|almond milk beverage|chocolate milk|smoothie|wine|red wine|white wine|cooking wine|mirin|sake|beer|club soda|tonic water`,
  deli: `rotisserie chicken|potato salad|macaroni salad|chicken salad|egg salad|fresh salsa|pico de gallo|guacamole fresh|deli salad|sushi|prepared tamales|fried chicken|deli sandwich|olive bar olives`,
};

// Sauces and grains get their own groups (they are listed under pantry/canned above for history).
const SAUCE = /\b(sauce|salsa|ketchup|mustard|mayo|mayonnaise|miracle whip|dressing|vinaigrette|pesto|relish|marinara|alfredo|aioli|chutney|gochujang|sriracha|sambal oelek|hoisin|teriyaki|worcestershire|tamari|bbq|barbecue|jam|jelly|preserves|marmalade|paste|mole|hummus|tahini|vinegar|pickles?|pickled|capers|olives|queso|nutella|peanut butter|almond butter)\b/;
const GRAIN = /\b(rice|pasta|penne|spaghetti|rigatoni|fettuccine|linguine|macaroni|rotini|farfalle|orzo|lasagna|noodles?|ramen|udon|soba|quinoa|couscous|bulgur|farro|barley|millet|polenta|grits|oats|oatmeal|cereal|granola|lentils?|dal|split peas|gnocchi|tortellini|ravioli|cream of wheat|dried \w+ beans|dried chickpeas|rajma|mac and cheese)\b/;
const EXCEPT = { 'rice vinegar': 'sauces', 'rice flour': 'pantry', 'rice cakes': 'snacks', 'rice noodles': 'grains', 'cocoa powder': 'pantry', 'tomato paste': 'sauces', 'peanut butter': 'sauces' };
function regroup(cat, key) {
  if (EXCEPT[key]) return EXCEPT[key];
  if (cat !== 'pantry' && cat !== 'canned') return cat;
  if (SAUCE.test(key)) return 'sauces';
  if (GRAIN.test(key)) return 'grains';
  return cat;
}

/** All ingredients: [{ name, cat }], no duplicates. */
export const INGREDIENTS = (() => {
  const seen = new Set(), out = [];
  for (const [cat, list] of Object.entries(RAW)) for (const name of list.split('|')) {
    const key = name.trim().toLowerCase();
    if (key && !seen.has(key)) { seen.add(key); out.push({ name: key, cat: regroup(cat, key) }); }
  }
  // Everyday names the receipt reader gives packaged products.
  for (const [name, cat] of [['coconut flakes', 'pantry'], ['crispy salad topping', 'snacks'], ['butter spread', 'dairy'], ['baby corn', 'produce'],
    ['gummy candy', 'snacks'], ['chocolate candy', 'snacks'], ['sour patch kids', 'snacks'], ['vegetable seasoning', 'spices'], ['multigrain chips', 'snacks'],
    ['pretzel crisps', 'snacks'], ['coke zero', 'beverages'], ['diet coke', 'beverages'], ['coca-cola', 'beverages'], ['sprite', 'beverages'],
    ['dr pepper', 'beverages'], ['ramen veggie mix', 'frozen'], ['sweet potato bites', 'frozen'], ['corn on the cob', 'produce'], ['colby cheese', 'dairy'],
    ['sandwich bread', 'bakery'], ['whole grain bread', 'bakery'], ['ramen seasoning', 'spices'], ['mole sauce', 'sauces'], ['salmon fillet', 'seafood'], ['french beans', 'produce'], ['fresh corn', 'produce'], ['cloud 9 tomatoes', 'produce'],
    // Common packaged foods, so the photo recognizer and the suggestions know them too.
    ['chipotle mayo', 'sauces'], ['sriracha mayo', 'sauces'], ['spicy mayo', 'sauces'], ['garlic aioli', 'sauces'], ['salad kit', 'produce'], ['bagged salad', 'produce'],
    ['sliced turkey', 'deli'], ['sliced ham', 'deli'], ['lunch meat', 'deli'], ['cheese slices', 'dairy'], ['shredded cheese', 'dairy'], ['yogurt cups', 'dairy'],
    ['drinkable yogurt', 'dairy'], ['cold brew coffee', 'beverages'], ['bottled water', 'beverages'], ['protein shake', 'beverages'], ['fruit cups', 'snacks'],
    ['jello cups', 'snacks'], ['salsa jar', 'sauces'], ['tortilla wraps', 'bakery'], ['frozen burritos', 'frozen'], ['frozen vegetables', 'frozen'],
    ['chicken nuggets', 'frozen'], ['pizza rolls', 'frozen'], ['fish fillets', 'seafood'], ['deli salad', 'deli'], ['rotisserie chicken', 'deli']]) {
    if (!seen.has(name)) { seen.add(name); out.push({ name, cat }); }
  }
  return out;
})();
const BY_NAME = new Map(INGREDIENTS.map((i) => [i.name, i.cat]));
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9%' -]+/g, ' ').replace(/\s+/g, ' ').trim();
const singular = (w) => (w.length > 3 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && /(oes|ches|shes)$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const variants = (n) => { const w = n.split(' '), last = w.pop(), base = w.length ? w.join(' ') + ' ' : ''; return [n, base + singular(last), base + last + 's', base + last + 'es']; };

/** Fridge category for an ingredient name from the list (plural or singular), or null. */
export const ingredientCategory = (name) => { for (const v of variants(norm(name))) if (BY_NAME.has(v)) return BY_NAME.get(v); return null; };

const BY_HEAD = new Map(); // last word (singular) -> list entries ending in it, longest first
for (const i of INGREDIENTS) { const head = singular(i.name.split(' ').pop()); if (!BY_HEAD.has(head)) BY_HEAD.set(head, []); BY_HEAD.get(head).push(i); }
for (const l of BY_HEAD.values()) l.sort((a, b) => b.name.length - a.name.length);
const SPICE = /\b(seasoning|spices?|rub|masala)\b/;
const DRINK = /\b(coke|cola|sprite|soda|pepsi|fanta|juice|lemonade|kombucha|gatorade|powerade|energy drink|iced tea|sparkling water|wine|beer)\b/;
const SNACK = /\b(chips|crisps|pretzels?|candy|gumm(y|ies)|cookies|crackers|popcorn|jerky|granola bars?|protein bars?|trail mix)\b/;

/**
 * Best fridge category for any food name ("Baby bella mushrooms", "Mole sauce", "Coke Zero"), or null when unsure.
 * Goes by the whole name first, then by what kind of product the words say, then by the main (last) word.
 */
export function categoryOf(name) {
  const n = norm(name);
  if (!n) return null;
  const exact = ingredientCategory(n);
  if (exact) return exact;
  if (SPICE.test(n)) return 'spices';
  if (SAUCE.test(n)) return 'sauces';
  if (DRINK.test(n)) return 'beverages';
  if (SNACK.test(n)) return 'snacks';
  if (GRAIN.test(n)) return 'grains';
  if (/\bcheese\b/.test(n)) return 'dairy';
  // The main word of a food name is the last one: "baby bella mushrooms" is mushrooms, "coconut flakes" is not coconut.
  const words = n.split(' '), head = singular(words[words.length - 1]);
  for (const i of BY_HEAD.get(head) || []) if (i.name.split(' ').every((w) => words.includes(w) || words.map(singular).includes(singular(w)))) return i.cat;
  return null;
}

// Categories that sit together on the same shelves; a food-table match in another group is the wrong food.
const GROUP = { meat: 'm', seafood: 'm', deli: 'm', pantry: 'p', grains: 'p', sauces: 'p', canned: 'p', spices: 'p', snacks: 'p', bakery: 'p' };
/** Do two categories describe the same kind of food? */
export const sameKind = (a, b) => a === b || (GROUP[a] && GROUP[a] === GROUP[b]);
