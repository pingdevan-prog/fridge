# Fridge

A family kitchen assistant for households that shop at H-E-B. It tracks the food you have, suggests and plans meals, builds the shopping list, and tracks calories.

It is a single-page web app with no build step and no server. Open it on a phone and add it to the home screen to use it like an app.

## What it does

- **Add food fast.** Take a photo of a drawer, shelf or counter and every food found is listed (several photos at once work too), scan an H-E-B receipt, or type it in with a suggestion dropdown covering a large list of ingredients. Everything passes through a review screen before it goes into the fridge.
- **Fridge.** Fridge, Freezer, Pantry and Spices & Staples shelves, with estimated best-before dates and a "Use these soon" row. The app starts empty: it holds only what your family adds.
- **Meals.** Write your family's own recipes. Ingredients are picked from a dropdown, with foods in your fridge first. Recipes are ranked by how many ingredients you already have, family preferences and ratings, food about to expire, and how healthy they are.
- **Plan.** A 7-day plan of breakfast, lunch and dinner built only from My recipes. Lock, swap, drag and drop, and rebuild only the unlocked meals. Leftovers are planned for the next day's lunch.
- **Shop.** What the plan needs minus what is in the fridge, grouped by H-E-B store section, with brand suggestions and an estimated total.
- **Cooking mode.** Pick servings, amounts scale, big step-by-step text with timers, screen stays on. "Done cooking" subtracts what you used from the fridge and logs the calories.
- **Me.** Calories and macros per family member for today and the last 7 days, plus a weekly healthy-eating summary.
- **Sync.** Everyone who opens the app shares one kitchen automatically: add food or a recipe on one phone and it shows up on the others within a few seconds. A family can switch to a private family name and password instead (Me, Sync).

## Where the data comes from

| Thing | Source |
|---|---|
| Nutrition | Built-in table of estimates based on USDA FoodData Central reference values, plus an optional live USDA lookup when editing an item |
| Calorie ranges | Dietary Guidelines for Americans 2020-2025 |
| Receipt reading | Claude vision when you add your own Anthropic API key; otherwise on-device text reading (Tesseract.js) with contrast clean-up, a parser that tolerates common misreads, and an H-E-B abbreviation dictionary |
| Food photos | Claude vision with an API key (also reads packaged foods); otherwise two image models that run on the phone: an object finder (COCO-SSD lite) that counts foods, and a classifier (MobileNet) run over the photo in overlapping squares. These know fresh fruit and vegetables best |
| Ingredient suggestions | A built-in list of over a thousand cooking ingredients and grocery foods |
| Prices | What you paid on scanned receipts when available, otherwise rough estimates. Never H-E-B's actual prices |
| Brands | H-E-B store-brand lines, marked "unverified" until checked on heb.com |

Everything is stored in the browser on the device (localStorage), and each phone keeps a full copy. The Anthropic API key, if you add one, is kept only in that browser and is never synced or put in backups.

## How sync works

By default every phone joins the shared kitchen on its own, with no sign-in. Its name and password are built into this public code, so anyone using the app can see and change it. A private family name and password keeps the data to phones that know them. Each phone keeps a live connection to the relays, which forward a new save the moment it happens; a check every 30 seconds is the backup. Copies run on localhost use a separate test kitchen.

There is no server of our own. Each phone encrypts the family's data with a key derived from the family password (AES-GCM) and stores the scrambled result on a few free public relay servers (the Nostr network). Other phones signed in with the same family name and password download it, unlock it and merge it record by record, so changes made on two phones at once are combined (the newer change to the same item wins). The relays only ever see scrambled text. They are free public infrastructure with no uptime promise, which is why every phone keeps its own full copy and re-uploads it if the relays ever lose it. Use a password nobody could guess: anyone with the family name and password can read and change the data.

## Run it on your computer

```bash
node serve.mjs
```

Then open http://localhost:5178.

## Code layout

```
index.html, css/styles.css     page shell and design
js/app.js                      start-up
js/store.js                    saved data and the data model
js/data/                       food table, ingredient list, H-E-B knowledge
js/lib/                        units, matching, nutrition, receipts, recipes, planner, shopping, sync, Claude
js/ui/                         one file per tab, cooking mode, food photos, suggestion dropdown, icons
sw.js, manifest.webmanifest    install to home screen, offline app shell
```

Fridge is a family project and is not affiliated with H-E-B.
