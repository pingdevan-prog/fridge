// H-E-B specific knowledge: receipt abbreviations, store-brand lines, a sample receipt.

// Receipt shorthand -> readable words.
export const ABBR = {
  HEB: 'H-E-B', HCF: 'Hill Country Fare', CM: 'Central Market', ORG: 'Organic', ORGNC: 'Organic',
  BNLS: 'Boneless', SKNLS: 'Skinless', SKLS: 'Skinless', CKN: 'Chicken', CHKN: 'Chicken', CHIX: 'Chicken', CHK: 'Chicken',
  BRST: 'Breast', BRSTS: 'Breasts', THGH: 'Thighs', THGHS: 'Thighs', TNDR: 'Tenders', DRUM: 'Drumsticks',
  GRND: 'Ground', GRD: 'Ground', BF: 'Beef', TRKY: 'Turkey', TKY: 'Turkey', PRK: 'Pork', SSG: 'Sausage', BCN: 'Bacon',
  SLMN: 'Salmon', SHRMP: 'Shrimp', FLT: 'Fillet', STK: 'Steak', RST: 'Roast',
  SHRD: 'Shredded', SHRED: 'Shredded', SLCD: 'Sliced', SLC: 'Sliced', DCD: 'Diced', CHPD: 'Chopped', WHL: 'Whole', WHT: 'Wheat',
  MOZZ: 'Mozzarella', CHDR: 'Cheddar', CHED: 'Cheddar', PARM: 'Parmesan', MONT: 'Monterey', JK: 'Jack', CHS: 'Cheese', CHSE: 'Cheese',
  MLK: 'Milk', BTR: 'Butter', BTTR: 'Butter', CRM: 'Cream', SR: 'Sour', YGRT: 'Yogurt', YOG: 'Yogurt', YGT: 'Yogurt', GRK: 'Greek',
  PLN: 'Plain', VAN: 'Vanilla', SLTD: 'Salted', UNSLTD: 'Unsalted', UNSLT: 'Unsalted', QTRS: 'Quarters', HVY: 'Heavy', WHP: 'Whipping',
  LG: 'Large', LRG: 'Large', SM: 'Small', MED: 'Medium', XL: 'Extra Large', JMBO: 'Jumbo',
  FRZ: 'Frozen', FZN: 'Frozen', FRSH: 'Fresh', SWT: 'Sweet', NAT: 'Natural', LS: 'Low Sodium', RF: 'Reduced Fat', FF: 'Fat Free', LF: 'Low Fat',
  BLK: 'Black', GRN: 'Green', RD: 'Red', YLW: 'Yellow', WHI: 'White', BRN: 'Brown',
  BNS: 'Beans', BEAN: 'Beans', TOM: 'Tomatoes', TOMS: 'Tomatoes', PTO: 'Potato', POT: 'Potatoes', VEG: 'Vegetable', VEGS: 'Vegetables',
  ONN: 'Onion', ONIONS: 'Onions', PPR: 'Pepper', PEPR: 'Pepper', BRCLI: 'Broccoli', BROC: 'Broccoli', SPNCH: 'Spinach', LETT: 'Lettuce',
  AVO: 'Avocado', AVOC: 'Avocado', CILAN: 'Cilantro', JAL: 'Jalapeño', JALAPENO: 'Jalapeño', STRWBRY: 'Strawberries', STRAW: 'Strawberries',
  BLUBRY: 'Blueberries', BLUEB: 'Blueberries', BAN: 'Bananas', ORNG: 'Orange', APL: 'Apple', LMN: 'Lemon', GRP: 'Grapes',
  SCE: 'Sauce', SAUC: 'Sauce', MARIN: 'Marinara', KETCH: 'Ketchup', MAYO: 'Mayonnaise', MSTRD: 'Mustard', DRSG: 'Dressing',
  JCE: 'Juice', BRD: 'Bread', BN: 'Buns', BUNS: 'Buns', HMBGR: 'Hamburger', TORT: 'Tortillas', TORTS: 'Tortillas', FLR: 'Flour',
  SGR: 'Sugar', OO: 'Olive Oil', EVOO: 'Extra Virgin Olive Oil', CND: 'Canned', PNT: 'Peanut', PB: 'Peanut Butter',
  CHOC: 'Chocolate', CKY: 'Cookies', CKIE: 'Cookies', CRKR: 'Crackers', CRKRS: 'Crackers', CHP: 'Chips', CHPS: 'Chips',
  CRL: 'Cereal', GRAN: 'Granola', OATML: 'Oatmeal', FASH: 'Fashioned', BRTH: 'Broth', STCK: 'Stock', SP: 'Soup',
  RICE: 'Rice', PSTA: 'Pasta', SPAG: 'Spaghetti', MAC: 'Macaroni', NDL: 'Noodles', QNOA: 'Quinoa', LNTL: 'Lentils',
  CHKPEA: 'Chickpeas', GARB: 'Garbanzo', SLSA: 'Salsa', GUAC: 'Guacamole', HUMM: 'Hummus', EGG: 'Eggs',
  TWLS: 'Towels', TWL: 'Towels', RL: 'Rolls', TP: 'Toilet Paper', BTH: 'Bath', TISS: 'Tissue', DTRG: 'Detergent', DET: 'Detergent',
  SFTNR: 'Softener', DSH: 'Dish', TRSH: 'Trash', BG: 'Bags', BGS: 'Bags', NAPK: 'Napkins', PLT: 'Plates', FOIL: 'Foil',
  SHMP: 'Shampoo', COND: 'Conditioner', TTHPST: 'Toothpaste', BATT: 'Batteries', CLNR: 'Cleaner', SPNG: 'Sponges', WPS: 'Wipes',
  ICECRM: 'Ice Cream', PZA: 'Pizza', NUGG: 'Nuggets', WFL: 'Waffles', BRKFST: 'Breakfast', TACO: 'Taco', SEAS: 'Seasoning',
  CHNKY: 'Chunky', SMTH: 'Smooth', CRNCHY: 'Crunchy', ROMA: 'Roma', HASS: 'Hass', BABY: 'Baby', PNR: 'Paneer', PPRS: 'Peppers',
};
// Paper "PPR" means pepper for food but paper for towels; resolved in receipt.js by the next word.

/** Words that mark a non-food line (goes to the Household list, not the fridge). */
export const NONFOOD = /\b(paper|towels?|toilet|tissue|napkins?|detergent|softener|bleach|soap|shampoo|conditioner|toothpaste|toothbrush|deodorant|lotion|razor|diapers?|wipes|trash|foil|plastic wrap|zip|ziploc|storage bags?|plates|cups|cutlery|batteries|cleaner|sponges?|lysol|clorox|windex|bounty|charmin|tide|dawn|cat|dog|pet|litter|charcoal|candles?|light bulbs?|magazine|gift card|flowers|bouquet|vitamins?|tylenol|advil|bandages?)\b/i;

/** Lines on a receipt that are never items. */
export const SKIP_LINE = /\b(sub\s*total|subtotal|total|tax|debit|credit|visa|mastercard|amex|discover|change due|change|cash|balance|coupon|savings|you saved|bag fee|items sold|item count|card #|auth|approval|ref #|reference|thank you|cashier|store #|tel |www\.|\.com|ebt|tender|discount|points|receipt|survey|return policy|trans(action)?|terminal|aid:|chip|pin verified|curbside|order #)\b/i;

// H-E-B store-brand lines. Descriptions are general positioning, not claims about a specific product.
export const BRAND_LINES = {
  hcf: { name: 'Hill Country Fare', why: "H-E-B's budget line, usually the lowest price on the shelf" },
  heb: { name: 'H-E-B', why: "H-E-B's main store brand, a good middle ground on price and quality" },
  organics: { name: 'H-E-B Organics', why: "H-E-B's organic line, for fewer additives and pesticides" },
  cm: { name: 'Central Market', why: "H-E-B's premium line, picked for taste and quality" },
  select: { name: 'H-E-B Select Ingredients', why: 'made without a list of artificial ingredients' },
  natural: { name: 'H-E-B Natural', why: 'meat raised without added hormones or antibiotics' },
  bakery: { name: 'H-E-B Bakery', why: 'baked in the store, so it is fresher than packaged' },
  loose: { name: 'Loose produce', why: 'no brand needed: pick what looks freshest, usually the best price per pound' },
};

// Which line to suggest by food category and shopping preference.
export const BRAND_BY_CAT = {
  produce: { value: 'loose', balanced: 'loose', healthiest: 'organics' },
  meat: { value: 'hcf', balanced: 'heb', healthiest: 'natural' },
  seafood: { value: 'heb', balanced: 'heb', healthiest: 'heb' },
  dairy: { value: 'hcf', balanced: 'heb', healthiest: 'organics' },
  bakery: { value: 'hcf', balanced: 'bakery', healthiest: 'select' },
  deli: { value: 'heb', balanced: 'heb', healthiest: 'select' },
  frozen: { value: 'hcf', balanced: 'heb', healthiest: 'organics' },
  pantry: { value: 'hcf', balanced: 'heb', healthiest: 'organics' },
  canned: { value: 'hcf', balanced: 'heb', healthiest: 'organics' },
  spices: { value: 'hcf', balanced: 'heb', healthiest: 'organics' },
  snacks: { value: 'hcf', balanced: 'heb', healthiest: 'select' },
  beverages: { value: 'hcf', balanced: 'heb', healthiest: 'organics' },
  other: { value: 'hcf', balanced: 'heb', healthiest: 'organics' },
};

// A well-known national brand to compare against, per food. Availability is NOT verified.
export const NATIONAL_ALT = {
  pasta: 'Barilla', 'marinara sauce': "Rao's Homemade", rice: 'Mahatma', oats: 'Quaker', 'greek yogurt': 'Chobani', yogurt: 'Stonyfield',
  butter: 'Land O Lakes', eggs: 'Vital Farms', milk: 'Fairlife', 'cheddar cheese': 'Tillamook', 'flour tortillas': 'Mission',
  'corn tortillas': 'Mission', 'peanut butter': 'Jif', 'black beans': "Bush's", 'pinto beans': "Bush's", chickpeas: "Bush's",
  broth: 'Swanson', 'olive oil': 'California Olive Ranch', 'soy sauce': 'Kikkoman', ketchup: 'Heinz', mayonnaise: "Hellmann's",
  salsa: 'Pace', 'tortilla chips': 'Tostitos', bread: "Nature's Own", 'diced tomatoes': 'Hunts', 'tomato sauce': 'Hunts',
  'coconut milk': 'Thai Kitchen', tuna: 'StarKist', hummus: 'Sabra', cereal: 'Cheerios', bacon: 'Oscar Mayer', honey: 'Nature Nates',
};
