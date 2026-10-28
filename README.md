# Word Search Maker

A free, printer-friendly word-search worksheet generator. Runs entirely in your browser on GitHub Pages—no account or server required.

**Live website:** https://andydoane.github.io/word-search-maker/

## What it does

- Enter your own words or phrases, one per line (maximum 30).
- Generate grids from 8×8 to 20×20, including rectangular layouts.
- Easy mode places words forwards horizontally and vertically; Medium also allows forwards diagonals. Shared matching letters can overlap.
- Shuffle to create a different arrangement.
- Customize title, subtitle, name/date lines, instructions, quotation, footer, and optional image.
- Choose US Letter or A4, portrait or landscape, word-bank columns and checkboxes, letter sizing, and black-and-white font styles.
- Download a 300-dpi PNG or PDF, optionally adding a line-marked answer key as page 2.
- Download the answer key separately as a PNG.
- Save a project in local browser storage or export/import a JSON project file (including its existing puzzle).

## How to use

1. Open the website.
2. Enter a list of words or phrases, one per line.
3. Select a grid size and difficulty.
4. Click **Generate puzzle**.
5. Adjust the heading, page layout, and font without changing the puzzle.
6. Click **Download PDF** or **Download PNG**.

Changing the words, difficulty, or grid size requires generating the puzzle again. If all words cannot fit, the page shows an error instead of silently omitting any.

## Development and hosting

This is a static site with three files:

- `index.html` — editor controls and preview
- `styles.css` — responsive layout
- `app.js` — generation, worksheet rendering, export, and save/load

No build tools are required. You can edit the files directly on GitHub. GitHub Pages is configured to deploy from `main` and the repository root; pushing to `main` updates the website.

For local development, use a local HTTP server or open `index.html` in a browser. Both PDF and PNG exports are handled natively in the browser, without external JavaScript libraries or a CDN. PDF pages embed high-resolution (300-dpi) raster images of the worksheet for consistent printing.

The `fonts/` directory contains 18 locally hosted Google Font files. They appear in the **Font style** menu. The Nunito Sans variable font is configured to use weight 1000 (its heaviest supported weight). Exports draw text with the loaded local fonts so the downloadable files match the preview. Keep the `fonts/` folder alongside `index.html`, `app.js`, and `styles.css` when hosting the site.

## Design and limits

- Printable worksheets use grayscale/black-and-white lettering and lines.
- The current generator is for English A–Z letters. Spaces and punctuation in words are ignored for grid placement, but the original labels appear in the word bank.
- Each word or phrase may contain up to 20 letters after normalization.
- Large or unusually dense word lists may be impossible to fit; if generation fails, try a larger grid or fewer words.
- Browser-saved projects are local to the current browser/device. JSON files can be moved to another device.
- Uploaded pictures are stored inside downloaded project files (limit: 1 MB per image).
- This is a worksheet creator, not an interactive digital solving game.

## Privacy

Word lists and saved projects are processed in the browser. There is no database, login or analytics service in this version.
