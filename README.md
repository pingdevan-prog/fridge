# Fridge

A family kitchen assistant for households that shop at H-E-B. It tracks the food you have, suggests and plans meals, builds the shopping list, and tracks calories.

It is a single-page web app with no build step and no server. Open it on a phone and add it to the home screen to use it like an app.

## What it does

- **Scan a receipt.** Take a photo or upload a screenshot of an H-E-B receipt. Abbreviated names such as `HEB ORG BNLS CKN BRST` become "H-E-B Organics Boneless Chicken Breast". You review every item before it goes into the fridge.
- **Fridge.** Fridge, Freezer, Pantry and Spices & Staples shelves, with estimated best-before dates and a "Use these soon" row.
- **Meals.** Real recipes from the web plus built-in starter recipes, ranked by how many ingredients you already have, family preferences and ratings, food about to expire, and how healthy they are.
- **Plan.** A 7-day plan of breakfast, lunch and dinner. Lock, swap, drag and drop, and rebuild only the unlocked meals. Leftovers are planned for the next day's lunch.
- **Shop.** What the plan needs minus what is in the fridge, grouped by H-E-B store section, with brand suggestions and an estimated total.
- **Cooking mode.** Pick servings, amounts scale, big step-by-step text with timers, screen stays on. "Done cooking" subtracts what you used from the fridge and logs the calories.
- **Me.** Calories and macros per family member for today and the last 7 days, plus a weekly healthy-eating summary.

## Where the data comes from

| Thing | Source |
|---|---|
| Nutrition | Built-in table of estimates based on USDA FoodData Central reference values, plus an optional live USDA lookup when editing an item |
| Calorie ranges | Dietary Guidelines for Americans 2020-2025 |
| Web recipes | TheMealDB, with a link to each recipe's original source |
| Receipt reading | Claude vision when you add your own Anthropic API key; otherwise on-device OCR (Tesseract.js) plus an H-E-B abbreviation dictionary |
| Prices | What you paid on scanned receipts when available, otherwise rough estimates. Never H-E-B's actual prices |
| Brands | H-E-B store-brand lines, marked "unverified" until checked on heb.com |

Everything is stored in the browser on the device (localStorage). Use **Me > Backup and data** to save a backup file or move data to another phone. The Anthropic API key, if you add one, is kept only in that browser and is not part of backups.

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
js/data/                       food table, H-E-B knowledge, starter recipes, sample data
js/lib/                        units, matching, nutrition, receipts, recipes, planner, shopping, Claude
js/ui/                         one file per tab, plus cooking mode
sw.js, manifest.webmanifest    install to home screen, offline app shell
```

Fridge is a family project and is not affiliated with H-E-B.
