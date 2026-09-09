# Rentdle property editor

Open `editor.html` in your project folder (or `/editor.html` on your hosted site).

1. Send listing links to Codex and ask for **Rentdle editor JSON** in the format below. It accepts one object, an array, or `{ "properties": [...] }`. JSON code fences can be pasted too.
2. Paste the data and select **Add to review**. Select one exterior photo and optionally place a map pin (or enter latitude and longitude). With both coordinates blank, clue 2 shows the city name. Optionally choose a puzzle date.
3. Check the facts and clue wording. Missing facts stay “not provided”; nothing is guessed. Source uncertainties belong in `notes`, which are shown in the editor.
4. Use the calendar to assign dates. Choose an empty day and a property. Selecting a scheduled property moves it; tick the repeat option only if you want both dates. Clear an occupied day before replacing it. Clearing a date keeps the property in the catalog.
5. Select **Check update**. Fix blocking errors and review the warnings. Missing photos and invalid properties block export; gaps, repeated puzzles and changes to today or earlier dates require acknowledgement. The calendar shows coverage for the next 14 days in Amsterdam time. Calendar edits can be exported without adding new properties.
6. Download the ZIP. Extract it into the current Rentdle folder, replacing `properties.js` and `schedule.js`. Add the new photos. Keep all existing photos.
7. Upload those files to GitHub. Reopen the editor from the updated project for the next batch.

The ZIP preserves existing properties and includes your edited schedule. Duplicate listings and date conflicts are blocked. Drafts, calendar edits and selected photos only live in the open page; export before closing. This is a local editing tool, not an authenticated admin dashboard, and it cannot write to your server.

New photos are decoded and resized to fit within 1600 × 1600 pixels, preserving proportions and orientation, then encoded as JPEG at 82% quality. Photos are never cropped or enlarged. Smaller originals within the dimension limit are kept. The preview shows the exported photo and its size savings. Transparent backgrounds become white when converted to JPEG. Existing catalog photos are checked for availability but are not recompressed. Input photos must be JPG, PNG or WebP up to 15 MB. All processing happens in your browser.

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
    "features": "",
    "listingUrl": "https://www.pararius.com/apartment-for-rent/delft/73876fe4/knuttelstraat",
    "rentNote": "Monthly rent excluding bills.",
    "notes": "",
    "latitude": null,
    "longitude": null
  }
]
```

Use `null` for unknown facts. Do not guess missing values. Title, city, positive rent, valid listing link and a rent explanation are required for export. This example already exists in the current catalog, so exporting it again will be blocked. For an exportable demonstration, use the editor's fictional **Load example** button with your own photos and an unused date.

## Initial installation

Upload the updated game and editor files, including `map-core.js`, `map.js`, `map.css`, and the complete `vendor/leaflet` folder. Keep your current `schedule.js`, `properties.js`, and photos. Subsequent property-update ZIPs still contain only the catalog, schedule, and new photos.

Interactive maps work on the hosted site or an HTTP localhost server. If you open `editor.html` directly as a local file, coordinate entry and export still work, but tiles are not requested: local file pages cannot send the website identification required by OSM. No address-search API, account, API key, or automatic geocoding is used.

## Map pins

Choose **Open map to place pin**, navigate to the property, and click its position. Drag the pin to adjust it. You can also enter or paste latitude and longitude directly; confirm the position before exporting. Latitude must be between −85.05112878 and 85.05112878 (the supported map projection), longitude between −180 and 180. Zero is valid. Leave both coordinates blank to use the city; partial or invalid coordinates block export. Pasted JSON can use top-level `latitude` and `longitude` or a `coordinates` object containing those fields.

Existing records now use the same five-clue order. To add a map, use **Add a map to an existing property**, choose the record, set its coordinates, and select **Save pin**. Then check and export. Clear both coordinate fields and save to return to the city fallback. No property locations are guessed. Changing an already scheduled property also changes its practice version; existing guesses and statistics are retained.

Maps load only when opened in the editor or displayed as a game clue. Moving away removes the active map. Restoring a game already on clue 2 loads that visible map. Earlier wins do not load a map unless the player navigates to it afterwards. City fallback clues never load map assets or tiles. Tiles use normal browser caching and visible OpenStreetMap attribution. There is no offline download, prefetch job, or tile archive in exports. The tile provider URL can be changed in `map.js` if traffic outgrows the public service. See https://operations.osmfoundation.org/policies/tiles/ for the public service policy.

## Clue order

1. Exterior photo
2. Neighbourhood map, or city name if no pin is specified
3. Living area and room counts
4. Construction year and furnishing
5. Standout features, with the energy label as a fallback

Add verified extras such as a balcony, garden, lift, parking or renovation in the optional `features` field. This becomes clue 5. If it is blank, a known energy label is used instead. If neither is available, the clue says “Additional features not provided” and the export check flags it for review. You can edit the final clue wording before export. Previously provided JSON still works; missing features are never invented.
