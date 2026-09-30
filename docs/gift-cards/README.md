# Gift cards — approved designs

Approved by the GM on 2026-09-30 («نعتمد هذول»).

## Printed cards (`print/`)

| File | What it is |
|---|---|
| `print/Almond_11_Gift_Cards_10JOD_Front_Back.pdf` | Print master: 22 pages, front then back for each of the 11 designs |
| `print/Almond_Blank_Barcode_Back.pdf` | The shared back on its own |
| `print/Almond_10JOD_Designs_Preview.pdf` | Two-page proof sheet (Arabic set, English set) for approvals and quotes |

- **Value:** fixed **10 JOD**, printed on the front ("10 دنانير" / "10 JOD").
- **Size:** CR80. Trim 85.7 × 54 mm (243 × 153 pt), 3 mm bleed on every side
  (page 259.7 × 170 pt), vector.
- **Fronts:** AR01–AR05 and EN01–EN06, the same artwork as the app and the
  website (`packages/shared/src/gifts/designs.ts`) plus the printed value.
- **Back:** one design for all cards. It carries no barcode and no code: the
  white panel is left empty for the variable data.
  - Panel, measured from the trim's top-left: x 38.9 mm, y 12.1 mm,
    size 41.4 × 12.0 mm.
  - Inside it, per card: the redemption barcode and code **under a silver
    scratch-off layer**, and a visible serial number the cashier uses to
    activate the card at sale.

## App and website

The digital cards use the same 11 artworks **without** a printed value
(`almond-app/assets/gift-cards/`, `almond-web/public/gift-cards/`), because an
eGift can be 5, 10, 15 or 25 JOD. The value shows beside the card, never on it.

## Not built yet (needed before printed cards go on sale)

Printed cards need what the eGift flow does not have:

1. **Codes generated in advance** for the print run, one per card, exported to
   the printer only after the supplier is chosen and has signed a
   confidentiality undertaking.
2. **An activation state:** a card is worth nothing until the cashier sells and
   activates it by serial number, so a card taken from the counter is worthless.
   Precedent: Starbucks and prepaid top-up cards.
3. **Redemption on the server** (the eGift flow is still a mock; there is no
   server gift rail yet).
