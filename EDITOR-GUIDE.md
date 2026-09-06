# Rentdle property editor

Open `editor.html` in your project folder (or `/editor.html` on your hosted site).

1. Send listing links to Codex and ask for **Rentdle editor JSON** in the format below. It accepts one object, an array, or `{ "properties": [...] }`. JSON code fences can be pasted too.
2. Paste the data and select **Add to review**. Select two photos per property and optionally choose a puzzle date.
3. Check the facts and clue wording. Missing facts stay “not provided”; nothing is guessed. Source uncertainties belong in `notes`, which are shown in the editor.
4. Download the ZIP. Extract it into the current Rentdle folder, replacing `properties.js` and `schedule.js`. Add the new photos. Keep all existing photos.
5. Upload those files to GitHub. Reopen the editor from the updated project for the next batch.

The ZIP preserves every existing property and schedule entry loaded by the editor. Dates already in use and duplicate listings are blocked. Unsigned drafts and selected photos only live in the open page; export before closing. This is a local editing tool, not an authenticated admin dashboard, and it cannot write to your server.

## Paste format

```json
[
  {
    "title": "Knuttelstraat 18",
    "city": "Delft",
    "rent": 1900,
    "area": 77,
    "rooms": 4,
    "bedrooms": 3,
    "energyLabel": "E",
    "yearBuilt": 1962,
    "furnishing": "Furnished",
    "listingUrl": "https://www.pararius.com/apartment-for-rent/delft/73876fe4/knuttelstraat",
    "rentNote": "Monthly rent excluding bills.",
    "notes": ""
  }
]
```

Use `null` for unknown facts. Do not guess missing values. Title, city, positive rent, valid listing link and a rent explanation are required for export. This example already exists in the current catalog, so exporting it again will be blocked. For an exportable demonstration, use the editor's fictional **Load example** button with your own photos and an unused date.

## Initial installation

The game now loads `properties.js` before `schedule.js` and `script.js`. Upload the changed `index.html`, `script.js`, and new `properties.js` together. The editor also needs `editor.html`, `editor.css`, `editor-core.js`, and `editor.js`, plus the existing `schedule.js` and `properties.js`.
