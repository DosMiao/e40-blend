# E40 Blend Calculator

Works out how much E85 and pump gas to add, counting the fuel already in your tank, to hit E40 or any target ethanol blend.

**Open it:** https://dosmiao.github.io/e40-blend/

## Put it on your iPhone

1. Open the link in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Open it once from the home screen while you have signal. After that it works offline.

To send it to someone, tap **Share** at the top of the app, or send them the link.

## What it does

- **Plan both fuels:** enter your tank capacity, the fuel left in it (amount and ethanol %) and the two fuels you're adding. It tells you how much of each to pump for a fill-up or a set amount.
- **Already pumped one:** enter what you've already pumped. It picks the second fuel, tells you how much, and warns if it won't fit.
- **Ratio table:** empty-tank blends for E85 tested anywhere from E85 down to E60, with row, column and double-optimal cells marked.
- **Prices:** the cheapest pair of fuels at the station for your fill, with estimated MPG and cost per mile.
- **Unsure of your E85's real content?** Enter a range. The plan uses the low end, so even the worst case meets the target.

Amounts round toward meeting the target: E85 rounds up, pump gas rounds down, and blend percentages round down. Settings stay on your own device. Results are a guide only, so trust your ethanol sensor or a test kit for the real content.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app: HTML, CSS and JavaScript in one file |
| `sw.js` | Offline cache |
| `manifest.webmanifest`, `*.png` | Home-screen name, icons and link preview |
| `tests/core.test.mjs` | Math checks, run with `node tests/core.test.mjs` |

To update the app, edit `index.html` and push. Phones fetch the update in the background when they're online and show it the next time the app opens.
