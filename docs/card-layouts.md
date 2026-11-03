# Designing your own photo cards

PartyBooth puts guests' photos into a **card layout**: the printed 4×6, the 2×6 strip, the postcard, and so on. You can import your own designs three ways, or build one in the editor.

Open **Settings → Card layouts**. **Import layout** takes PNG, JPG and `.json` files, and you can pick several files at once. Tick the layouts guests may choose from and set the default.

---

## Card sizes

Design at 300 dots per inch so prints are sharp.

| Card | Pixels | Notes |
|---|---|---|
| 4×6 portrait | 1200 × 1800 | Most common |
| 6×4 landscape | 1800 × 1200 | Postcards, big group shots |
| 2×6 strip | 600 × 1800 | Prints two-up on 4×6 paper, cut down the middle |
| 5×7 | 1500 × 2100 | Needs 5×7 paper |
| Square | 1500 × 1500 | Social media |
| Phone story | 1080 × 1920 | Screen only, for sharing |

Leave about 40 px of safe margin on every edge: printers can trim a little.

---

## Option 1: PNG with see-through windows (easiest)

The booth puts your design **on top** of the photos. Wherever your design is transparent, the photo shows through.

**In Canva**
1. Create a design with a custom size, for example **1200 × 1800 px**.
2. Design the card: background, event name, date, decorations.
3. Add a rectangle (or any shape) for each photo, then **delete** it, or make it fully transparent, so there is a hole. Simplest way: build the background from shapes and leave gaps where the photos go.
4. **Share → Download → PNG**, tick **Transparent background** (needs Canva Pro).

**In Photoshop, Affinity, GIMP, Photopea (free, in a browser)**
1. New document 1200 × 1800 px, transparent background.
2. Design on layers, then select each photo area and delete it so it is transparent.
3. Export as PNG (keep transparency).

**Import it.** PartyBooth finds each transparent window and places a photo behind it, in reading order (top-left first). Round or odd-shaped windows work: the photo fills the window's bounding box and your frame masks the edges.

If the windows come out in the wrong order or slightly off, press **Edit** on the layout to drag and resize the photo areas.

## Option 2: a background picture

Import a JPG (or a PNG without holes). It becomes the card background. Then **Edit** the layout and drag photo areas where you want them. Good for themed backgrounds such as a beach scene or a wedding watercolour.

## Option 3: the built-in editor

**New layout**, **Edit** on your own layouts, or **Copy & edit** on a built-in one opens the editor:
- **Size** and **Print** set the card size and paper.
- **Background**: a colour, a fade between two colours, or **Use an image**.
- **Frame on top**: a PNG with see-through windows (as in Option 1). **Find photo windows** re-runs the automatic detection.
- **+ Photo area** and **+ Text**: drag to move, use the corner handle to resize, and set corners, tilt and borders in the side panel.
- Text can include fill-ins that update automatically: `{event}`, `{date}`, `{hashtag}`.
- **Export layout file** saves a `.json` you can share with another booth or keep as a backup.

---

## Option 4: layout files (`.json`)

For exact control, or to share designs. Coordinates are pixels from the top-left of the card.

```json
{
  "pbLayout": 1,
  "name": "Wedding strip",
  "width": 600,
  "height": 1800,
  "print": "2x6",
  "background": { "gradient": ["#FFFFFF", "#F3EEE8"], "angle": 180 },
  "slots": [
    { "x": 40, "y": 40,  "w": 520, "h": 390, "radius": 8 },
    { "x": 40, "y": 450, "w": 520, "h": 390, "radius": 8 },
    { "x": 40, "y": 860, "w": 520, "h": 390, "radius": 8 }
  ],
  "shapes": [
    { "x": 200, "y": 1330, "w": 200, "h": 3, "fill": "#B08D57" }
  ],
  "texts": [
    { "text": "{event}", "x": 300, "y": 1440, "size": 64, "font": "Elegant", "color": "#2B2942", "align": "center", "maxWidth": 520 },
    { "text": "{date}",  "x": 300, "y": 1545, "size": 32, "font": "Rounded", "color": "#8A7A66", "align": "center" }
  ]
}
```

| Field | Meaning |
|---|---|
| `width`, `height` | Card size in pixels |
| `print` | Paper: `4x6`, `6x4`, `2x6`, `5x7`, `7x5`, `6x8`, `auto`, or `none` (screen only) |
| `background` | A colour (`"#FFFFFF"`), a fade (`{"gradient": ["#color1", "#color2"], "angle": 180}`), or an image as a data URL |
| `overlay` | Optional PNG (data URL) drawn on top of everything: your frame with see-through windows |
| `slots` | Photo areas, filled in order. Each: `x`, `y`, `w`, `h`, and optional `radius` (rounded corners), `rotate` (degrees), `border` (px) and `borderColor` |
| `shapes` | Optional coloured rectangles: `x`, `y`, `w`, `h`, `fill`, `radius` |
| `texts` | Text: `text`, `x`, `y` (centre point for centred text), `size`, `font`, `weight`, `color`, `align` (`left`, `center`, `right`), `maxWidth` (shrinks to fit), `rotate`, `stroke`, `strokeColor` |

Fonts: `Display` (bold sign lettering), `Rounded` (clean), `Script` (brush script), `Elegant` (italic serif), `Handwritten`.

The number of `slots` sets how many photos the booth takes for that card.

A file can hold several layouts: `{ "layouts": [ {…}, {…} ] }` or a plain list `[ {…}, {…} ]`.

---

## Tips

- Put the event name on the card as `{event}` text instead of baking it into the image, so one design works for every party.
- Light backgrounds look better on dye-sub printers; very dark areas can show banding.
- Test-print one card on the real paper before the party.
- See `sample-layouts/` for a PNG frame and a `.json` strip to try.
