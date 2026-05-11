// Prototype mock inventory — Round 8 visual item identification.
// 50 realistic items spanning metal/CNC, electronics, and cosmetics.
// Includes two visually-near-identical clusters that differ only by raw material —
// the core demo conceit (warehouse worker can't tell them apart by sight).

export type OpenOrder = {
  orderNumber: string;
  quantity: number;
  dueDate: string;
};

export type InventoryItem = {
  sku: string;
  name: string;
  visualDescription: string;
  rawMaterial: string;
  batchNumber: string;
  location: string;
  imagePath: string | null;
  openOrders: OpenOrder[];
};

export const MOCK_INVENTORY: readonly InventoryItem[] = [
  // ───────────────────────────────────────────────────────────────────────
  // CLUSTER A: Cylindrical pins — 6 SKUs, visually identical, different alloy.
  // This is the primary demo conceit (mirrors the Amtan Karmiel pain point).
  // ───────────────────────────────────────────────────────────────────────
  {
    sku: 'M-PIN-304',
    name: 'Cylindrical pin 8×30mm — Stainless 304',
    visualDescription:
      'Polished metallic cylinder, 30mm long, 8mm diameter, no markings, plain machined ends',
    rawMaterial: 'Stainless steel 304 (UNS S30400)',
    batchNumber: 'B2026-04-15-A',
    location: 'Aisle 3 / Shelf B / Bin 04',
    imagePath: '/demo-items/cylindrical-pin.svg',
    openOrders: [{ orderNumber: 'PO-7821', quantity: 500, dueDate: '2026-05-22' }],
  },
  {
    sku: 'M-PIN-316L',
    name: 'Cylindrical pin 8×30mm — Stainless 316L',
    visualDescription:
      'Polished metallic cylinder, 30mm long, 8mm diameter, no markings, plain machined ends',
    rawMaterial: 'Stainless steel 316L (medical-grade, UNS S31603)',
    batchNumber: 'B2026-04-22-C',
    location: 'Aisle 3 / Shelf B / Bin 05',
    imagePath: '/demo-items/cylindrical-pin.svg',
    openOrders: [
      { orderNumber: 'PO-7902', quantity: 250, dueDate: '2026-05-18' },
      { orderNumber: 'PO-7915', quantity: 100, dueDate: '2026-06-04' },
    ],
  },
  {
    sku: 'M-PIN-AL6061',
    name: 'Cylindrical pin 8×30mm — Aluminum 6061-T6',
    visualDescription:
      'Polished metallic cylinder, 30mm long, 8mm diameter, no markings, plain machined ends',
    rawMaterial: 'Aluminum alloy 6061-T6 (anodized clear)',
    batchNumber: 'B2026-04-08-A',
    location: 'Aisle 3 / Shelf B / Bin 06',
    imagePath: '/demo-items/cylindrical-pin.svg',
    openOrders: [{ orderNumber: 'PO-7733', quantity: 1000, dueDate: '2026-05-29' }],
  },
  {
    sku: 'M-PIN-AL7075',
    name: 'Cylindrical pin 8×30mm — Aluminum 7075-T6',
    visualDescription:
      'Polished metallic cylinder, 30mm long, 8mm diameter, no markings, plain machined ends',
    rawMaterial: 'Aluminum alloy 7075-T6 (aerospace-grade, anodized)',
    batchNumber: 'B2026-04-12-B',
    location: 'Aisle 3 / Shelf B / Bin 07',
    imagePath: '/demo-items/cylindrical-pin.svg',
    openOrders: [{ orderNumber: 'PO-7818', quantity: 200, dueDate: '2026-05-25' }],
  },
  {
    sku: 'M-PIN-TI2',
    name: 'Cylindrical pin 8×30mm — Titanium Grade 2',
    visualDescription:
      'Polished metallic cylinder, 30mm long, 8mm diameter, no markings, plain machined ends',
    rawMaterial: 'Titanium Grade 2 (commercially pure)',
    batchNumber: 'B2026-03-30-A',
    location: 'Aisle 3 / Shelf B / Bin 08',
    imagePath: '/demo-items/cylindrical-pin.svg',
    openOrders: [{ orderNumber: 'PO-7886', quantity: 80, dueDate: '2026-06-12' }],
  },
  {
    sku: 'M-PIN-BRASS',
    name: 'Cylindrical pin 8×30mm — Brass C360',
    visualDescription:
      'Polished metallic cylinder, 30mm long, 8mm diameter, no markings, plain machined ends',
    rawMaterial: 'Brass C360 (free-machining)',
    batchNumber: 'B2026-04-19-A',
    location: 'Aisle 3 / Shelf B / Bin 09',
    imagePath: '/demo-items/cylindrical-pin.svg',
    openOrders: [],
  },

  // ───────────────────────────────────────────────────────────────────────
  // CLUSTER B: Cosmetic cream tubs — 4 SKUs, identical packaging, different formulation.
  // ───────────────────────────────────────────────────────────────────────
  {
    sku: 'C-TUB-MOIST-A',
    name: '50ml cream tub — Daily Moisturizer Base A',
    visualDescription: 'White HDPE round jar, 50ml capacity, opaque white lid, no label applied',
    rawMaterial: 'Aqua, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Phenoxyethanol',
    batchNumber: 'CR-2026-04-15-001',
    location: 'Cold storage / Rack 12 / Slot A',
    imagePath: '/demo-items/cosmetic-tub.svg',
    openOrders: [{ orderNumber: 'CO-4421', quantity: 2000, dueDate: '2026-05-20' }],
  },
  {
    sku: 'C-TUB-MOIST-B',
    name: '50ml cream tub — Daily Moisturizer Base B (sensitive skin)',
    visualDescription: 'White HDPE round jar, 50ml capacity, opaque white lid, no label applied',
    rawMaterial: 'Aqua, Glycerin, Squalane, Niacinamide, Allantoin, Phenoxyethanol',
    batchNumber: 'CR-2026-04-22-002',
    location: 'Cold storage / Rack 12 / Slot B',
    imagePath: '/demo-items/cosmetic-tub.svg',
    openOrders: [
      { orderNumber: 'CO-4503', quantity: 1500, dueDate: '2026-05-26' },
      { orderNumber: 'CO-4517', quantity: 800, dueDate: '2026-06-08' },
    ],
  },
  {
    sku: 'C-TUB-NIGHT-A',
    name: '50ml cream tub — Night Cream Retinol 0.3%',
    visualDescription: 'White HDPE round jar, 50ml capacity, opaque white lid, no label applied',
    rawMaterial: 'Aqua, Retinol 0.3%, Squalane, Tocopherol, Phenoxyethanol — light-sensitive',
    batchNumber: 'CR-2026-04-18-003',
    location: 'Cold storage / Rack 12 / Slot C (light-sealed)',
    imagePath: '/demo-items/cosmetic-tub.svg',
    openOrders: [{ orderNumber: 'CO-4488', quantity: 600, dueDate: '2026-05-30' }],
  },
  {
    sku: 'C-TUB-EYE-A',
    name: '50ml cream tub — Eye Contour Peptide',
    visualDescription: 'White HDPE round jar, 50ml capacity, opaque white lid, no label applied',
    rawMaterial: 'Aqua, Acetyl Hexapeptide-8, Caffeine, Hyaluronic Acid, Phenoxyethanol',
    batchNumber: 'CR-2026-04-25-004',
    location: 'Cold storage / Rack 12 / Slot D',
    imagePath: '/demo-items/cosmetic-tub.svg',
    openOrders: [{ orderNumber: 'CO-4537', quantity: 400, dueDate: '2026-06-15' }],
  },

  // ───────────────────────────────────────────────────────────────────────
  // Other metal CNC parts (for catalog variety)
  // ───────────────────────────────────────────────────────────────────────
  {
    sku: 'M-ROD-M8-100',
    name: 'Threaded rod M8 × 100mm',
    visualDescription: 'Threaded steel rod, 100mm long, M8 thread, full length',
    rawMaterial: 'Stainless steel 304',
    batchNumber: 'TR-2026-04-10',
    location: 'Aisle 4 / Shelf A / Bin 02',
    imagePath: '/demo-items/threaded-rod.svg',
    openOrders: [{ orderNumber: 'PO-7902', quantity: 250, dueDate: '2026-05-18' }],
  },
  {
    sku: 'M-NUT-M10',
    name: 'Hex nut M10',
    visualDescription: 'Hex nut, M10 thread, brass color',
    rawMaterial: 'Brass C360',
    batchNumber: 'HN-2026-04-05',
    location: 'Aisle 4 / Shelf C / Bin 11',
    imagePath: '/demo-items/hex-nut.svg',
    openOrders: [{ orderNumber: 'PO-7841', quantity: 5000, dueDate: '2026-05-15' }],
  },
  {
    sku: 'M-FLG-CUSTOM-A',
    name: 'Custom flange, 80mm OD, 4-bolt pattern',
    visualDescription: 'Round metal flange, 80mm OD, 4 bolt holes at 60mm PCD, raw machined finish',
    rawMaterial: 'Aluminum 6061-T6',
    batchNumber: 'FL-2026-04-12',
    location: 'Aisle 5 / Pallet 03',
    imagePath: '/demo-items/flange.svg',
    openOrders: [{ orderNumber: 'PO-7855', quantity: 50, dueDate: '2026-06-01' }],
  },
  {
    sku: 'M-BSH-12-16',
    name: 'Bushing 12mm ID × 16mm OD × 20mm L',
    visualDescription: 'Cylindrical bushing, bronze color, 20mm long, 16mm OD, 12mm ID',
    rawMaterial: 'Sintered bronze (oil-impregnated)',
    batchNumber: 'BS-2026-04-08',
    location: 'Aisle 3 / Shelf D / Bin 02',
    imagePath: '/demo-items/bushing.svg',
    openOrders: [],
  },
  {
    sku: 'M-WSH-M8',
    name: 'Flat washer M8',
    visualDescription: 'Flat round washer, 8mm ID, ~17mm OD, 1.6mm thick',
    rawMaterial: 'Galvanized steel',
    batchNumber: 'WS-2026-03-28',
    location: 'Aisle 4 / Shelf E / Bin 01',
    imagePath: '/demo-items/washer.svg',
    openOrders: [{ orderNumber: 'PO-7818', quantity: 10000, dueDate: '2026-05-25' }],
  },
  {
    sku: 'M-SCR-M6-25',
    name: 'Socket head cap screw M6 × 25mm',
    visualDescription: 'Black-oxide finish, M6 × 25mm, hex socket head',
    rawMaterial: 'Alloy steel 12.9 grade, black oxide coating',
    batchNumber: 'SC-2026-04-02',
    location: 'Aisle 4 / Shelf B / Bin 14',
    imagePath: '/demo-items/socket-screw.svg',
    openOrders: [{ orderNumber: 'PO-7829', quantity: 3000, dueDate: '2026-05-21' }],
  },
  {
    sku: 'M-BRACKET-L',
    name: 'L-bracket 50×50×40mm',
    visualDescription: 'Right-angle metal bracket, 50×50mm legs, 40mm depth, 4 mounting holes',
    rawMaterial: 'Mild steel, zinc-plated',
    batchNumber: 'LB-2026-03-22',
    location: 'Aisle 5 / Shelf A / Bin 08',
    imagePath: '/demo-items/l-bracket.svg',
    openOrders: [],
  },
  {
    sku: 'M-SHAFT-12-150',
    name: 'Drive shaft 12mm × 150mm',
    visualDescription: 'Polished steel shaft, 12mm dia, 150mm long, ground finish',
    rawMaterial: '1045 carbon steel, induction hardened',
    batchNumber: 'DS-2026-04-14',
    location: 'Aisle 6 / Rack A / Slot 03',
    imagePath: '/demo-items/drive-shaft.svg',
    openOrders: [{ orderNumber: 'PO-7912', quantity: 75, dueDate: '2026-06-05' }],
  },
  {
    sku: 'M-HSG-AL-50',
    name: 'Aluminum housing 50×50×30mm',
    visualDescription:
      'Rectangular machined housing, 50×50×30mm, M3 mounting holes, anodized black',
    rawMaterial: 'Aluminum 6061-T6, hard anodized black',
    batchNumber: 'HS-2026-04-09',
    location: 'Aisle 5 / Shelf C / Bin 02',
    imagePath: '/demo-items/aluminum-housing.svg',
    openOrders: [{ orderNumber: 'PO-7866', quantity: 120, dueDate: '2026-05-28' }],
  },
  {
    sku: 'M-COUP-08-08',
    name: 'Flexible coupling 8mm-8mm',
    visualDescription: 'Black aluminum flex coupling, 8mm bore both sides, 25mm OD',
    rawMaterial: 'Aluminum 6061, anodized black',
    batchNumber: 'CP-2026-04-01',
    location: 'Aisle 6 / Shelf B / Bin 05',
    imagePath: '/demo-items/flex-coupling.svg',
    openOrders: [],
  },
  {
    sku: 'M-GEAR-20T',
    name: 'Spur gear 20-tooth, M1 module',
    visualDescription: 'Spur gear, 20 teeth, M1 module, 6mm bore, ~22mm OD',
    rawMaterial: 'Acetal (Delrin) machined',
    batchNumber: 'GR-2026-03-25',
    location: 'Aisle 7 / Bin 11',
    imagePath: '/demo-items/spur-gear.svg',
    openOrders: [{ orderNumber: 'PO-7847', quantity: 60, dueDate: '2026-05-20' }],
  },

  // ───────────────────────────────────────────────────────────────────────
  // Electronic components
  // ───────────────────────────────────────────────────────────────────────
  {
    sku: 'E-RES-1K-0805',
    name: 'SMD resistor 1kΩ 1% — 0805',
    visualDescription: 'Small black SMD resistor on cut tape, 0805 footprint, beige back',
    rawMaterial: 'Thick-film resistor element on Al2O3 ceramic substrate',
    batchNumber: 'EL-2026-04-03',
    location: 'SMT line / Reel rack / R-12',
    imagePath: '/demo-items/smd-resistor.svg',
    openOrders: [{ orderNumber: 'PO-EL-201', quantity: 5000, dueDate: '2026-05-12' }],
  },
  {
    sku: 'E-CAP-10U-X7R',
    name: 'MLCC 10µF X7R 25V — 1206',
    visualDescription: 'Small brown MLCC capacitor, 1206 footprint, on cut tape',
    rawMaterial: 'Multilayer ceramic, X7R dielectric, Ni-Sn terminals',
    batchNumber: 'EL-2026-04-05',
    location: 'SMT line / Reel rack / C-08',
    imagePath: '/demo-items/mlcc.svg',
    openOrders: [{ orderNumber: 'PO-EL-205', quantity: 3000, dueDate: '2026-05-14' }],
  },
  {
    sku: 'E-LED-RED-0603',
    name: 'LED red 0603',
    visualDescription: 'Tiny red SMD LED on cut tape, 0603 footprint',
    rawMaterial: 'AlGaInP semiconductor, transparent epoxy lens',
    batchNumber: 'EL-2026-04-07',
    location: 'SMT line / Reel rack / D-04',
    imagePath: '/demo-items/smd-led.svg',
    openOrders: [],
  },
  {
    sku: 'E-MCU-STM32',
    name: 'STM32F103C8T6 microcontroller — LQFP-48',
    visualDescription: 'Square IC chip, LQFP-48 package, ~7×7mm body, label "STM32F103C8T6"',
    rawMaterial: 'ARM Cortex-M3 silicon die in plastic LQFP package, lead-free',
    batchNumber: 'EL-2026-03-30',
    location: 'SMT line / IC bin / M-01',
    imagePath: '/demo-items/mcu-chip.svg',
    openOrders: [{ orderNumber: 'PO-EL-218', quantity: 200, dueDate: '2026-05-20' }],
  },
  {
    sku: 'E-CON-DS9-M',
    name: 'D-Sub 9-pin male connector, solder cup',
    visualDescription: 'Trapezoidal metal connector with 9 pins, solder-cup terminations, no shell',
    rawMaterial: 'Brass body tin-plated, gold-flash contacts',
    batchNumber: 'EL-2026-04-11',
    location: 'Aisle 8 / Bin 03',
    imagePath: '/demo-items/dsub-connector.svg',
    openOrders: [{ orderNumber: 'PO-EL-222', quantity: 80, dueDate: '2026-05-30' }],
  },
  {
    sku: 'E-PCB-BLANK-A',
    name: 'Blank PCB 100×80mm — 2-layer FR4',
    visualDescription: 'Green PCB, 100×80mm, 2-layer FR4, HASL finish, blank (no components)',
    rawMaterial: 'FR-4 epoxy glass, 1oz copper, lead-free HASL',
    batchNumber: 'EL-2026-04-14',
    location: 'PCB storage / Rack 02 / Slot 11',
    imagePath: '/demo-items/blank-pcb.svg',
    openOrders: [{ orderNumber: 'PO-EL-228', quantity: 30, dueDate: '2026-06-02' }],
  },
  {
    sku: 'E-WIRE-AWG22-RED',
    name: 'Hookup wire AWG22 red — 100m spool',
    visualDescription: 'Red insulated wire on plastic spool, ~100m, single core',
    rawMaterial: 'Tinned copper conductor, PVC insulation (UL1007)',
    batchNumber: 'EL-2026-03-15',
    location: 'Aisle 8 / Shelf D / Slot 04',
    imagePath: '/demo-items/wire-spool.svg',
    openOrders: [],
  },
  {
    sku: 'E-WIRE-AWG22-BLK',
    name: 'Hookup wire AWG22 black — 100m spool',
    visualDescription: 'Black insulated wire on plastic spool, ~100m, single core',
    rawMaterial: 'Tinned copper conductor, PVC insulation (UL1007)',
    batchNumber: 'EL-2026-03-15',
    location: 'Aisle 8 / Shelf D / Slot 05',
    imagePath: '/demo-items/wire-spool.svg',
    openOrders: [{ orderNumber: 'PO-EL-231', quantity: 5, dueDate: '2026-06-10' }],
  },

  // ───────────────────────────────────────────────────────────────────────
  // Cosmetic raw materials & packaging
  // ───────────────────────────────────────────────────────────────────────
  {
    sku: 'C-RAW-GLY-25KG',
    name: 'Glycerin 99.5% — 25kg drum',
    visualDescription: 'White HDPE drum, 25kg, blue lid, "GLYCERIN 99.5%" label',
    rawMaterial: 'Vegetable-derived glycerin, kosher certified',
    batchNumber: 'GL-2026-04-02',
    location: 'Bulk room / Aisle A / Pallet 01',
    imagePath: '/demo-items/glycerin-drum.svg',
    openOrders: [],
  },
  {
    sku: 'C-RAW-HYAL-1KG',
    name: 'Hyaluronic acid (sodium hyaluronate) — 1kg jar',
    visualDescription: 'Small white powder jar, 1kg, brown wraparound label',
    rawMaterial: 'Sodium hyaluronate, 1.0–1.4 MDa, food/cosmetic grade',
    batchNumber: 'HA-2026-03-20',
    location: 'Bulk room / Aisle B / Shelf 02',
    imagePath: '/demo-items/raw-jar.svg',
    openOrders: [{ orderNumber: 'CO-4540', quantity: 2, dueDate: '2026-05-22' }],
  },
  {
    sku: 'C-RAW-RETINOL-100G',
    name: 'Retinol pure — 100g amber jar',
    visualDescription:
      'Small amber glass jar, 100g, "RETINOL PURE" sticker, light-sensitive marking',
    rawMaterial: 'Retinol pure (vitamin A), light- and oxygen-sensitive',
    batchNumber: 'RT-2026-04-12',
    location: 'Cold storage / Locker 03 (light-sealed)',
    imagePath: '/demo-items/amber-jar.svg',
    openOrders: [{ orderNumber: 'CO-4488', quantity: 1, dueDate: '2026-05-30' }],
  },
  {
    sku: 'C-RAW-SQUAL-5KG',
    name: 'Squalane (olive-derived) — 5kg drum',
    visualDescription: 'White HDPE drum, 5kg, "SQUALANE" green label',
    rawMaterial: 'Squalane from olive oil, COSMOS-approved',
    batchNumber: 'SQ-2026-03-28',
    location: 'Bulk room / Aisle A / Pallet 04',
    imagePath: '/demo-items/raw-jar.svg',
    openOrders: [],
  },
  {
    sku: 'C-PKG-TUB-50ML',
    name: 'Empty cream tub 50ml — white HDPE',
    visualDescription: 'White HDPE round empty tub, 50ml, separate white lid, no label',
    rawMaterial: 'HDPE virgin, food-grade',
    batchNumber: 'PK-2026-04-01',
    location: 'Packaging / Aisle 1 / Pallet 05',
    imagePath: '/demo-items/empty-tub.svg',
    openOrders: [{ orderNumber: 'CO-4421', quantity: 2000, dueDate: '2026-05-20' }],
  },
  {
    sku: 'C-PKG-PUMP-30ML',
    name: 'Airless pump bottle 30ml — white',
    visualDescription:
      'Cylindrical white airless pump bottle, 30ml, gloss finish, push-down dispenser',
    rawMaterial: 'PP body, PE pump mechanism, food-grade',
    batchNumber: 'PK-2026-04-08',
    location: 'Packaging / Aisle 1 / Pallet 09',
    imagePath: '/demo-items/airless-bottle.svg',
    openOrders: [{ orderNumber: 'CO-4503', quantity: 1500, dueDate: '2026-05-26' }],
  },
  {
    sku: 'C-LBL-MOIST-A',
    name: 'Label sheet — Moisturizer Base A',
    visualDescription: 'Sheet of self-adhesive labels, "Daily Moisturizer" branding, 50 per sheet',
    rawMaterial: 'PP self-adhesive, water-resistant',
    batchNumber: 'LB-2026-04-15',
    location: 'Packaging / Drawer 03',
    imagePath: '/demo-items/label-sheet.svg',
    openOrders: [],
  },
  {
    sku: 'C-RAW-PHEN-10KG',
    name: 'Phenoxyethanol — 10kg drum (preservative)',
    visualDescription: 'White HDPE drum, 10kg, blue lid, "PHENOXYETHANOL" label',
    rawMaterial: 'Phenoxyethanol, cosmetic grade, INCI-listed',
    batchNumber: 'PH-2026-03-12',
    location: 'Bulk room / Aisle C / Pallet 02 (regulated)',
    imagePath: '/demo-items/glycerin-drum.svg',
    openOrders: [{ orderNumber: 'CO-4540', quantity: 1, dueDate: '2026-05-22' }],
  },

  // ───────────────────────────────────────────────────────────────────────
  // Misc filler — toolroom, fasteners, raw stock
  // ───────────────────────────────────────────────────────────────────────
  {
    sku: 'M-BAR-AL-1M',
    name: 'Aluminum bar stock 25mm × 1m',
    visualDescription: '25mm square aluminum bar, 1m long, raw mill finish',
    rawMaterial: 'Aluminum 6061-T6 raw',
    batchNumber: 'BA-2026-03-10',
    location: 'Raw stock / Rack 01',
    imagePath: null,
    openOrders: [],
  },
  {
    sku: 'M-BAR-SS-1M',
    name: 'Stainless steel bar stock 25mm × 1m',
    visualDescription: '25mm square stainless bar, 1m long, raw mill finish',
    rawMaterial: 'Stainless steel 304 raw',
    batchNumber: 'BA-2026-03-12',
    location: 'Raw stock / Rack 02',
    imagePath: null,
    openOrders: [{ orderNumber: 'PO-7950', quantity: 4, dueDate: '2026-06-15' }],
  },
  {
    sku: 'M-PLATE-AL-500',
    name: 'Aluminum plate 500×500×6mm',
    visualDescription: 'Square aluminum plate, 500mm side, 6mm thick',
    rawMaterial: 'Aluminum 5052-H32',
    batchNumber: 'PL-2026-03-15',
    location: 'Raw stock / Rack 04',
    imagePath: null,
    openOrders: [],
  },
  {
    sku: 'M-TOOL-EM-6',
    name: 'End mill 6mm 4-flute carbide',
    visualDescription: 'Carbide end mill, 6mm diameter, 4 flutes, TiAlN coated',
    rawMaterial: 'Tungsten carbide with TiAlN PVD coating',
    batchNumber: 'TL-2026-04-01',
    location: 'Tool crib / Drawer 03',
    imagePath: null,
    openOrders: [{ orderNumber: 'PO-TL-101', quantity: 5, dueDate: '2026-05-18' }],
  },
  {
    sku: 'M-TOOL-EM-3',
    name: 'End mill 3mm 2-flute carbide',
    visualDescription: 'Carbide end mill, 3mm diameter, 2 flutes, uncoated',
    rawMaterial: 'Tungsten carbide, uncoated',
    batchNumber: 'TL-2026-04-01',
    location: 'Tool crib / Drawer 03',
    imagePath: null,
    openOrders: [],
  },
  {
    sku: 'M-TOOL-DRILL-5',
    name: 'Drill bit 5mm HSS',
    visualDescription: 'HSS twist drill, 5mm diameter, 86mm overall',
    rawMaterial: 'High-speed steel M2',
    batchNumber: 'TL-2026-03-20',
    location: 'Tool crib / Drawer 04',
    imagePath: null,
    openOrders: [],
  },
  {
    sku: 'M-CONS-LUB-1L',
    name: 'Cutting fluid 1L bottle',
    visualDescription: 'Yellow 1L plastic bottle, cutting fluid label',
    rawMaterial: 'Water-soluble synthetic coolant',
    batchNumber: 'CN-2026-03-25',
    location: 'Consumables / Shelf B',
    imagePath: null,
    openOrders: [],
  },
  {
    sku: 'M-WLD-ROD-3-2',
    name: 'TIG welding rod 3.2mm SS308',
    visualDescription: 'Stainless welding rod, 3.2mm dia, ~1m long, in cardboard tube',
    rawMaterial: 'ER308L stainless filler rod',
    batchNumber: 'WR-2026-03-18',
    location: 'Welding / Rack A / Slot 02',
    imagePath: null,
    openOrders: [{ orderNumber: 'PO-7872', quantity: 50, dueDate: '2026-05-25' }],
  },
  {
    sku: 'M-FIN-PWD-BLK',
    name: 'Powder coating black 5kg',
    visualDescription: 'Black powder-coat in 5kg bag, plastic-lined',
    rawMaterial: 'Polyester powder coating, RAL 9005',
    batchNumber: 'PC-2026-03-22',
    location: 'Finishing / Bin 01',
    imagePath: null,
    openOrders: [],
  },
  {
    sku: 'M-PACK-BUBBLE',
    name: 'Bubble wrap roll 500mm × 50m',
    visualDescription: 'Clear bubble wrap on cardboard core, 500mm wide, 50m long',
    rawMaterial: 'LDPE film',
    batchNumber: 'PK-2026-03-01',
    location: 'Shipping / Roll rack',
    imagePath: null,
    openOrders: [],
  },
  {
    sku: 'M-PACK-BOX-A',
    name: 'Cardboard box 300×200×150mm',
    visualDescription: 'Brown corrugated cardboard box, flat-packed',
    rawMaterial: 'Corrugated cardboard, recycled',
    batchNumber: 'PK-2026-03-15',
    location: 'Shipping / Bay 02',
    imagePath: null,
    openOrders: [{ orderNumber: 'PO-PK-001', quantity: 200, dueDate: '2026-05-15' }],
  },
] as const;

export function findItemBySku(sku: string): InventoryItem | undefined {
  return MOCK_INVENTORY.find((item) => item.sku === sku);
}

/**
 * Returns a token-efficient one-line-per-item catalog summary suitable for
 * embedding in a Claude system prompt. Format: SKU | name | visualDescription | rawMaterial.
 * Total length is bounded (~5-6KB for 50 items) — well inside Claude's context budget.
 */
export function getCatalogForPrompt(): string {
  return MOCK_INVENTORY.map(
    (item) => `${item.sku} | ${item.name} | ${item.visualDescription} | RM: ${item.rawMaterial}`,
  ).join('\n');
}
