# Demo item images

Hand-authored SVG illustrations representing warehouse items, used by the Round 8 visual-item-identification prototype.

These are NOT real photographs — they are minimal SVG renderings designed to:
1. Look like sketched stand-ins for warehouse photos in the demo flow.
2. Stay tiny in repo size (each ~1-2 KB).
3. Preserve the "visually identical" demo conceit — the cylindrical-pin SVG is shared across the 6 alloy variants in `mock-inventory.ts`, and the cosmetic-tub SVG is shared across the 4 formulation variants.

For real-API verification, you should photograph actual parts. The mock catalog references these SVG paths so that demo-mode and the UI render correctly without any external assets.

## Files

| File | Used by SKUs |
|---|---|
| `cylindrical-pin.svg` | M-PIN-304, M-PIN-316L, M-PIN-AL6061, M-PIN-AL7075, M-PIN-TI2, M-PIN-BRASS (the visually-identical metal cluster) |
| `cosmetic-tub.svg` | C-TUB-MOIST-A, C-TUB-MOIST-B, C-TUB-NIGHT-A, C-TUB-EYE-A (the visually-identical cosmetic cluster) |
| `threaded-rod.svg` | M-ROD-M8-100 |
| `hex-nut.svg` | M-NUT-M10 |
| `flange.svg` | M-FLG-CUSTOM-A |
| `bushing.svg` | M-BSH-12-16 |
| `smd-resistor.svg` | E-RES-1K-0805 |
| `blank-pcb.svg` | E-PCB-BLANK-A |

Items in `mock-inventory.ts` whose `imagePath` is `null` (e.g. raw stock, tooling, packaging consumables) intentionally have no demo image — the UI should render an "image unavailable" placeholder for those.

## License

These illustrations were generated for SUPER-MESHINE and are released under the same license as the repo.
