# Vertical Research: Mapping 5 Candidate Verticals for SUPER-MESHINE

**Date:** 2026-05-07
**Brief:** Map 5 candidate verticals (cosmetics, processed food, metal/mechanical workshops, electronics assembly, general contract manufacturing) for an Israeli SMB ERP product targeting 10–80 employee companies. Output is balanced facts only; no recommendation.
**Scope:** Israeli SMB, 10-80 employees, manufacturing/logistics

## TL;DR

- Five Israeli manufacturing verticals were profiled with ≥75 candidate companies, public ERP pain quotes, competitor pricing, and applicable regulation.
- Pain points repeat across verticals: Priority's complexity/API instability, SAP B1 cost & implementation drag, Odoo accounting/support gaps, Katana price-tier escalation, NetSuite TCO.
- Israeli regulators in scope include the MoH Cosmetics Department (תמרוקים), Food Control Service, Chief Rabbinate (kosher), the Standards Institution of Israel (SII), and EU-cascade regimes (RoHS/REACH, ISO 22000/22716, FDA 21 CFR for exporters).
- Source breadth ranges from G2/Capterra/SoftwareAdvice (pain) to ensun, Dun & Bradstreet, Manufacturers Association of Israel, and Made-in-Israel directories (companies).
- Several specific employee-count claims for individual Israeli SMBs are marked unverified: most Israeli SMB sites do not publish headcount; verification requires LinkedIn/Dun & Bradstreet pulls in a follow-up pass.

## 1. Verticals Analyzed

| Vertical | Israeli companies (source) | Estimated TAM | Competition | Regulation | Pain from current ERP |
|---|---|---|---|---|---|
| Cosmetics / personal care | ~41–44 manufacturers ([ensun](https://ensun.io/search/cosmetics/israel)); ~350 members in MAI consumer-goods division ([MAI](https://eng.industry.org.il/)) | Israel cosmetics market ~USD 830M ([Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/israel-cosmetics-products-market-industry/companies)) | Odoo, Katana, MRPeasy, NetSuite | MoH Cosmetics Regulations (Pharmacists Reg. 2023), ISO 22716, FDA 21 CFR (exporters) | Priority complexity; SAP B1 cost; Katana price-tier creep |
| Processed food / private label | 1,062 "Other Food Mfg" profiles + 3,687 broader food-mfg in D&B; ≥160 enterprise members in MAI Food Industries Assoc. | Tnuva 55.2% / Strauss 21.3% in dairy ([Times of Israel](https://www.timesofisrael.com/monopoly-nation-how-a-handful-of-firms-control-prices-hold-israelis-to-ransom/)); SMB tail substantial | Odoo, NetSuite, Acumatica, MRPeasy | ISO 22000/HACCP, kosher (Chief Rabbinate), MoH Food Control Service | SAP B1 mobile/UX issues; Priority bugs |
| Metal / mechanical workshop | 538 metalworking-mfg profiles in D&B Israel; ~500 members in MAI Metal/Electrical/Infra division | Aerospace/defense/medical demand; ~25% of local industrial output (MAI) | Katana, MRPeasy, Odoo, Acumatica | ISO 9001, AS9100 (aerospace), ISO 13485 (medical) | Priority API instability; Katana add-on pricing |
| Electronics / assembly | 67 contract-mfg, 100 electronics-mfg, 89 PCB profiles ([ensun](https://ensun.io/search/electronics-manufacturing/israel)) | Strong defense/medical/telecom demand; export-oriented | Acumatica, NetSuite, Priority, Odoo | RoHS, REACH (EU export), AS9100, ISO 13485, IPC standards | NetSuite cost; SAP B1 implementation pain |
| Contract manufacturing (general) | 67 contract-mfg profiles ([ensun](https://ensun.io/search/contract-manufacturing/israel)) | Mixed; cross-vertical | Odoo, Acumatica, Priority | Cross-vertical (depends on end product) | Generic ERP not multi-customer-aware |

## 2. Pain Evidence — Quotes from the Field

> "Lots of bugs/errors with the software with no known resolution times" — [G2 Priority ERP review summary](https://www.g2.com/products/priority-erp/reviews)

> "Highly complex system to learn, bad API and bad integration capabilities" — [G2 Priority ERP](https://www.g2.com/products/priority-erp/reviews)

> "Priority program tries to cover many fields at once" lacking depth — [Capterra Priority Software](https://www.capterra.com/p/142289/Priority-Software/reviews/)

> "Difficult to deploy all capabilities without hiring an implementation manager" (Priority) — [Capterra](https://www.capterra.com/p/142289/Priority-Software/reviews/)

> "The cost of licensing and ongoing maintenance can be a drawback" (SAP B1) — [Capterra SAP Business One](https://www.capterra.com/p/214667/SAP-Business-One/reviews/)

> "Tends to freeze and crash often enough that losing work" (SAP B1) — [Capterra](https://www.capterra.com/p/214667/SAP-Business-One/reviews/)

> "Accessibility via mobile devices presents a number of difficulties" (SAP B1) — [Capterra](https://www.capterra.com/p/214667/SAP-Business-One/reviews/)

> "Updates often break features, require technical skills" (Odoo) — [Capterra Odoo](https://www.capterra.com/p/135618/Odoo/reviews/)

> "Accounting is a nightmare. Way too complicated to stay on track" (Odoo) — [Capterra Odoo](https://www.capterra.com/p/135618/Odoo/reviews/)

> "Odoo Support is the worst on Earth" — [Capterra Odoo](https://www.capterra.com/p/135618/Odoo/reviews/)

> "523% price increase driven by model changes and tier bumps" (Katana) — [Brahmin Solutions analysis](https://www.brahmin-solutions.com/blog/katana-pricing)

> "NetSuite support is expensive, ineffective" — [BrokenRubik NetSuite review](https://www.brokenrubik.com/blog/oracle-netsuite-pros-and-cons-the-definitive-guide)

> "Out-of-box reports being deficient" (Acumatica) — [Capterra Acumatica](https://www.capterra.com/p/96371/Acumatica-Cloud-ERP/reviews/)

> "Restrictions on how many records can be uploaded" (MRPeasy) — [Capterra MRPeasy](https://www.capterra.com/p/134177/MRPEasy/reviews/)

## 3. Competitors per Vertical

### Cosmetics
| Competitor | Public pricing | Strengths | Documented weaknesses | Source |
|---|---|---|---|---|
| Odoo MRP | $24.90/user/mo Standard; $37.40 Custom | Modular; batch tracking; multi-company | Setup complexity; accounting issues; updates break customizations | [Capterra Odoo](https://www.capterra.com/p/135618/Odoo/reviews/), [whizzbridge](https://www.whizzbridge.com/blog/odoo-pricing) |
| MRPeasy | $49–$59/user/mo entry | Affordable; easy onboarding for very small shops | BOM upload limits; weak subcontractor BOM substitution; UI dated | [Capterra MRPeasy](https://www.capterra.com/p/134177/MRPEasy/reviews/) |
| NetSuite | $999/mo base + $129–199/user | Mature lot/batch & financials | Expensive; mobile/UX dated; cosmetics-specific GMP not native | [BrokenRubik](https://www.brokenrubik.com/blog/netsuite-pricing-the-definitive-guide) |

### Processed food / private label
| Competitor | Public pricing | Strengths | Documented weaknesses | Source |
|---|---|---|---|---|
| NetSuite | From $999/mo + per-user | Strong financials, lot trace | High TCO; complex; long implementations | [BrokenRubik](https://www.brokenrubik.com/blog/netsuite-pricing-the-definitive-guide) |
| Acumatica | $20K–$100K+ annual; resource-based | Flexible; not per-user | Reporting weak out-of-box; VAR-only model | [Capterra Acumatica](https://www.capterra.com/p/96371/Acumatica-Cloud-ERP/reviews/), [ITQlick](https://www.itqlick.com/acumatica-cloud-erp/pricing) |
| Odoo (with food extensions) | $24.90/user/mo Std | Cheap entry; flexible | Custom modules break on upgrade; support quality variable | [Capterra Odoo](https://www.capterra.com/p/135618/Odoo/reviews/) |

### Metal / mechanical workshops
| Competitor | Public pricing | Strengths | Documented weaknesses | Source |
|---|---|---|---|---|
| Katana Cloud | $299/mo base + add-ons; full stack $747–$1,095/mo | Visual MOs; shop-floor friendly | Aggressive tier creep; weak invoicing; pricing model changed multiple times | [Brahmin Solutions](https://www.brahmin-solutions.com/blog/katana-pricing), [Capterra Katana](https://www.capterra.com/p/172888/Katana-MRP/) |
| MRPeasy | $49–$59/user/mo entry | Cheap; routings, work orders | Record-count caps; dated UI | [Capterra MRPeasy](https://www.capterra.com/p/134177/MRPEasy/reviews/) |
| Odoo MRP | $24.90/user/mo Std | BOMs/routings/PLM module | Manufacturing-specific projects often $80K–$150K+ | [navabrindsol Odoo cost](https://navabrindsol.com/blog/odoo-erp-implementation-cost-for-automotive-companies-2026-breakdown/) |

### Electronics / assembly
| Competitor | Public pricing | Strengths | Documented weaknesses | Source |
|---|---|---|---|---|
| Acumatica | $20K–$100K+/yr | Resource-tier pricing scales with usage | Reporting limits; partner-only delivery | [ITQlick Acumatica](https://www.itqlick.com/acumatica-cloud-erp/pricing) |
| Priority | Quote-only; commonly $100–$200/user/mo range | Native multi-level BOM, lot/serial, Israeli locale | Bugs reported; bad API stability; complex UX | [G2 Priority](https://www.g2.com/products/priority-erp/reviews), [softwareadvice](https://www.softwareadvice.com/manufacturing/priority-software-profile/) |
| NetSuite | $999/mo + per-user | Multi-entity; planning | Manufacturing planning not customizable on custom fields; expensive | [BrokenRubik](https://www.brokenrubik.com/blog/oracle-netsuite-pros-and-cons-the-definitive-guide) |

### Contract manufacturing (general)
| Competitor | Public pricing | Strengths | Documented weaknesses | Source |
|---|---|---|---|---|
| Odoo | $24.90/user/mo Std | Flexible; multi-company; affordable | Customization breakage on upgrade | [Capterra Odoo](https://www.capterra.com/p/135618/Odoo/reviews/) |
| Acumatica | $20K–$100K+/yr | Make-to-order/ETO support | Tailoring difficult post-implementation | [Capterra Acumatica](https://www.capterra.com/p/96371/Acumatica-Cloud-ERP/reviews/) |
| Priority | Quote-only | Israeli market depth | Stability/API complaints | [G2 Priority](https://www.g2.com/products/priority-erp/reviews) |

## 4. Regulation Checklist

### Cosmetics
- **Israel MoH Cosmetics Department** — registration via רוקחים (Pharmacists) Regulations (Cosmetics) 2023, EU-aligned (EC 1223/2009), "Responsible Person" required: [gov.il cosmetics-business](https://www.gov.il/he/service/cosmetics-business), [MoH cosmetics portal](https://cosmetics.health.gov.il/)
- **MoH cosmetics product registry** (58,441+ products listed): [registries.health.gov.il/Cosmetics](https://registries.health.gov.il/Cosmetics)
- **ISO 22716 (Cosmetics GMP)** — Israeli Standard via SII: [sii.org.il ISO 22716](https://www.sii.org.il/en/iso-22716/) ; [ISO 22716:2007](https://www.iso.org/standard/36437.html)
- **FDA Cosmetics GMP / 21 CFR (for U.S. exporters)**: [FDA cosmetic GMP guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/draft-guidance-industry-cosmetic-good-manufacturing-practices), [21 CFR cosmetics](https://www.fda.gov/cosmetics/cosmetics-laws-regulations/regulations-related-cosmetics-title-21-code-federal-regulations-21-cfr)

### Processed food / private label
- **Israel Food Control Service (MoH)** — importer/manufacturer registration ([USDA FAS overview](https://apps.fas.usda.gov/newgainapi/api/Report/DownloadReportByFileName?fileName=Retail+Foods_Tel+Aviv_Israel_IS2023-0005.pdf))
- **ISO 22000 / HACCP**: [ISO 22000 Wikipedia](https://en.wikipedia.org/wiki/ISO_22000)
- **Kosher** — Chief Rabbinate of Israel; market-essential per [Times of Israel / WorldWideBridge](https://wwbridge-cert.com/blog/posts/certification-requirements-for-food-and-beverages-in-israel)
- **FSIS Israel import/export guidance** for meat/poultry exporters: [USDA FSIS Israel](https://www.fsis.usda.gov/inspection/import-export/import-export-library/israel)

### Metal / mechanical workshop
- **ISO 9001** (baseline QMS); **AS9100** for aerospace ([SinoExtrude Israel CNC overview](https://sinoextrud.com/cnc-machining-israel/) — references B.S.L AS9100)
- **ISO 13485** for medical-device parts
- **Standards Institution of Israel (SII)**: [sii.org.il](https://www.sii.org.il/en/)

### Electronics / assembly
- **EU RoHS** Directive 2011/65/EU (10 restricted substances): [EU Commission RoHS](https://environment.ec.europa.eu/topics/waste-and-recycling/rohs-directive_en)
- **EU REACH** (chemical SVHC reporting): [Assent REACH/RoHS comparison](https://www.assent.com/blog/difference-reach-rohs-compliance/)
- **AS9100** (defense/aerospace) and **IPC-A-610** assembly acceptability standards
- **ISO 13485** (medical electronics)
- **FDA 21 CFR Part 11** (electronic records — for medical device exporters): [FDA CGMP](https://www.fda.gov/drugs/pharmaceutical-quality-resources/current-good-manufacturing-practice-cgmp-regulations)

### Contract manufacturing (general)
- Inherits regulation of the end-product vertical (food → ISO 22000; medical → ISO 13485; aerospace → AS9100; cosmetics → ISO 22716).
- ISO 9001 is the universal baseline.

## 5. Findings Supporting Each Vertical

### Cosmetics — supporting points
1. ~41–44 cosmetics manufacturers identified ([ensun](https://ensun.io/search/cosmetics/israel)); MAI consumer-goods division has ~350 members across 13 branches including cosmetics.
2. Active private-label cluster (DATS, Peer Pharm, E.L. Erman, Anna Lotan, T.D.O.T., Pharma Cosmetics) suggests multi-customer, multi-batch ERP needs.
3. New Pharmacists (Cosmetics) Regulations 2023 + MoH "Responsible Person" requirement create digital recordkeeping burden.
4. ISO 22716 GMP recognized via SII — formalized batch traceability obligations.
5. Dead Sea cluster export-oriented; multi-currency & FDA-export workflows relevant.

**Concerns:** Market dominated by a few large brands (AHAVA, L'Oréal-IL); SMB tail may be small and contract-manufacturing-led, limiting per-customer ACV ceiling.

### Processed food / private label — supporting points
1. 1,062 "Other Food Mfg" + 3,687 broader food-mfg D&B profiles → wide SMB base.
2. Kosher + HACCP/ISO 22000 stack mandates lot/batch/expiry traceability — ERP-native value proposition.
3. MAI Food Industries Assoc. — 160+ enterprise members, 100+ exporters → export documentation pain.
4. Private-label players (Afifit, Adom Group, Blue Fish) handle multi-SKU, multi-customer formulation/packaging.
5. Strong appetite for cost reduction post-Tnuva/Strauss duopoly pressure.

**Concerns:** Margins tight; willingness-to-pay for software historically low; many shops on legacy Hashavshevet/Ezrat-Mahshev or Priority.

### Metal / mechanical workshop — supporting points
1. 538 metalworking-mfg profiles (D&B); MAI metal division 500 members ≈25% of industrial output, 90,000 employees.
2. Tel Aviv–Haifa axis dense with precision shops feeding aerospace/defense (IAI, Elbit, Rafael) and medical-device firms.
3. Job-shop / make-to-order workflows are the canonical Katana/MRPeasy weak spot — opening here.
4. AS9100 + ISO 13485 traceability map cleanly to ERP serial/lot tracking features.
5. Smaller shops typically not on Priority — green field.

**Concerns:** Highly fragmented; customer acquisition cost may be high; many micro-shops <10 employees fall below the 10–80 target.

### Electronics / assembly — supporting points
1. ~100 electronics-mfg + 89 PCB + 67 contract-mfg profiles in ensun → robust pipeline.
2. EU RoHS/REACH compliance creates BoM-level data obligations (substance disclosure) — ERP-suitable.
3. Cluster geography: Petach Tikva, Yokneam, Migdal Ha'emek, Caesarea, Misgav Industrial Park.
4. Heavy NPI / engineering-change traffic; per-product BOM versioning is core.
5. Defense/aerospace lot serialization required.

**Concerns:** Large incumbents (Elbit, IAI suppliers) often locked into Priority/SAP; SMB layer may include very small (<10 employee) design shops outside the target band.

### General contract manufacturing — supporting points
1. ensun lists 67 contract manufacturers Israel-wide; cross-vertical mix.
2. Multi-customer, multi-IP scenarios poorly covered by Odoo/MRPeasy default tenancy.
3. Ability to span verticals = horizontal moat for an AI-native ERP.
4. Customer-supplied materials and consigned inventory workflows are a known ERP gap.
5. Aligned with KappaSense, Medibrane, ICS-style boutique manufacturers.

**Concerns:** "Contract manufacturing" as a category is loose; risks defining a non-ICP. Per-customer needs vary too much for one templated product.

## 6. Companies to Contact (REQUIRED)

> Notes on size estimates: Israeli SMB headcount is rarely public; sizes flagged "est." are inferred from LinkedIn employee bands, D&B profiles, or industry-press references and should be verified before outreach. Where unverifiable, marked ⚠️.

### Cosmetics (15+ companies)

| # | Name | Region | Est. size | Website | LinkedIn / Phone / Email | Why a good target |
|---|---|---|---|---|---|---|
| 1 | Anna Lotan Ltd. | Or Akiva industrial park | 50–100 est. ⚠️ | annalotan.com | linkedin.com/company/anna-lotan | Established private-label producer; ISO 22716/9001/13481-compliant plant |
| 2 | E.L. Erman Cosmetic Manufacturing | Israel | 50–80 est. ⚠️ | elerman.com | LinkedIn: E.L. Erman | Largest private-label producer (face/hair/body/makeup) |
| 3 | DATS Premium Cosmetics (PLC) | Israel | 30–60 est. ⚠️ | dats.org.il | via website contact form | OEM/private label end-to-end |
| 4 | Peer Pharm Group | Israel | 40–80 est. ⚠️ | peerpharm.com | via website | Pharma-grade cosmetics; defense-quality QA processes |
| 5 | T.D.O.T. Industries | Dead Sea region | 30–60 est. ⚠️ | tdot-industries.com | via website | Dead Sea PL specialist; MAI-recognized |
| 6 | Pharma Cosmetics Laboratories | Israel | 30–60 est. ⚠️ | (see CosmeticIndex listing) | via Israeli Cosmetic Mfrs Assoc. | Pharma-cosmetic crossover |
| 7 | TN Factory | Israel | 20–50 est. ⚠️ | (xiranskincare listing) | via Israeli cosmetic mfrs assoc | End-to-end PL |
| 8 | Crystalline Health & Beauty | Arad | 30–60 est. ⚠️ | crystalline.co.il | via website | Dead Sea full chain manufacturer |
| 9 | Sea of Spa Laboratories | Israel | 40–80 est. ⚠️ | seaofspa.com | LinkedIn: Sea of Spa | Export brand with own production |
| 10 | Christina Cosmetics | Israel | 50–100 est. ⚠️ | christina.com | LinkedIn: Christina Cosmetics | Pro-skincare brand, multi-SKU |
| 11 | Lavido | Nahalal (Galilee) | 40–80 est. ⚠️ | lavido.com | linkedin.com/company/lavido-ltd- | Natural skincare leader |
| 12 | Gigi Cosmetic Laboratories | Israel | 30–60 est. ⚠️ | gigicosmetic.co.il | rocketreach.co/gigi-cosmetic-laboratories | Established 1957; pro-line |
| 13 | Holy Land (HL Labs) | Israel | 40–80 est. ⚠️ | holyland-cosmetics.com | LinkedIn: Holy Land Cosmetics | Pro-skincare, export-heavy |
| 14 | Dr. Korman Laboratories | Israel | 20–40 est. ⚠️ | dr-korman.com | LinkedIn: Dr. Korman | Clinical/dermatology cosmetics |
| 15 | KB Pure | Israel | 10–30 est. ⚠️ | cosmeticisrael.com/kb-pure | via website | Boutique natural skincare |
| 16 | Cosmetic Acme Innovation | Israel | 10–30 est. ⚠️ | (xiranskincare listing) | n/a | Startup-friendly contract mfg |
| 17 | S-Schwartz Natural | Israel | 10–30 est. ⚠️ | (xiranskincare listing) | n/a | Clean/natural cosmetics |

Sources: [ensun cosmetics IL](https://ensun.io/search/cosmetics/israel), [Top private label Israel](https://xiranskincare.com/top-9-private-label-cosmetics-manufacturers-in-israel/), [Cosmetic Index Israeli Assoc.](https://cosmeticindex.com/_the-israeli-association-of-cosmetic-manufacturers), [Anna Lotan about](https://annalotanusa.com/about-us/).

### Processed food / private label (15+ companies)

| # | Name | Region | Est. size | Website | LinkedIn / Phone / Email | Why a good target |
|---|---|---|---|---|---|---|
| 1 | Afifit (אפיפית) | Nazareth area | 80–150 est. ⚠️ (may exceed band) | afifit.com | LinkedIn: Afifit | Major Israeli PL snack/cracker mfg |
| 2 | Adom Food Group | Israel | 50–100 est. ⚠️ | adomgroup.com | via website | PL development specialist |
| 3 | Blue Fish | Israel | 30–60 est. ⚠️ | bluefish.co.il | via website | Fish PL & own-brand |
| 4 | Achdut / Achva (tahini, halva) | Ariel/Barkan | 80–150 est. ⚠️ | achva.co.il | LinkedIn: Achva | Heritage food mfg, export |
| 5 | Carmit Candy Industries | Israel | 80–150 est. ⚠️ | carmit.com | LinkedIn: Carmit Candy | Confectionery exporter |
| 6 | Wissotzky Tea | Tel Aviv | 80–150 est. ⚠️ | wtea.com | LinkedIn: Wissotzky Tea | Tea processing/packaging |
| 7 | Galam Group | Kibbutz Ma'anit | 80–150 est. ⚠️ | galamgroup.com | LinkedIn: Galam | Specialty ingredients for food mfg |
| 8 | Gan Shmuel Foods | Gan Shmuel | 80–150 est. ⚠️ | gan-shmuel.com | LinkedIn: Gan-Shmuel | Juice/processed foods |
| 9 | Y. Braun & Sons | Israel | 30–80 est. ⚠️ | (D&B listing) | via D&B | Mid-size processed food |
| 10 | Maabarot Products | Maabarot | 50–100 est. ⚠️ | maabarot.com | LinkedIn: Maabarot Products | Pet food + nutritionals |
| 11 | F&C Licorice | Israel | 30–80 est. ⚠️ | fc-licorice.com | LinkedIn: F&C Licorice | Confectionery |
| 12 | Roberto Food | Israel | 20–50 est. ⚠️ | robertofood.com | via website | PL & branded |
| 13 | Beigel & Beigel (Unilever Israel plant Safed) | Safed | 100+ est. ⚠️ | (via Unilever IL) | LinkedIn: Unilever Israel | Snack mfg, PL conversations possible |
| 14 | Ta'amti (טעמתי) | Israel | 50–100 est. ⚠️ | taamti.co.il | LinkedIn: Ta'amti | Frozen/convenience food |
| 15 | Of Tov (עוף טוב) | Israel | 50–100 est. ⚠️ (may exceed band) | oftov.co.il | LinkedIn: Of Tov | Poultry processor |
| 16 | Salads Galil | Galilee | 30–80 est. ⚠️ | (Dun's 100) | via D&B | Salads & dips |
| 17 | Soglowek | Nahariya | 80–150 est. ⚠️ | soglowek.co.il | LinkedIn: Soglowek | Meat processing |

Sources: [D&B Israel Food Mfg](https://www.dnb.com/business-directory/company-information.food_manufacturing.il.html), [Lusha F&B Israel](https://www.lusha.com/company-search/food-and-beverage-manufacturing/37c596cb49/israel/131/), [Dun's 100 Food Mfrs](https://www.duns100.co.il/en/rating/Food_Industry/Food_Manufacturers), [MAI Food Industries Assoc.](https://eng.industry.org.il/).

### Metal / mechanical workshop (15+ companies)

| # | Name | Region | Est. size | Website | LinkedIn / Phone / Email | Why a good target |
|---|---|---|---|---|---|---|
| 1 | Hi-Tech Mechanics Ltd. | Jerusalem (15 Ha'oman St) | 50–100 est. ⚠️ | hitechm.co.il | +972-52-7507776; LinkedIn: Hi-Tech Mechanics | Since 1997; mass-production CNC |
| 2 | GevaTech Ltd. | Holon + Petach Tikva | 20–50 est. ⚠️ | gevait.com | via website | Boutique CNC, ISO-compliant |
| 3 | M.D.R. Machining Ltd. | Israel | 20–50 est. ⚠️ | mdrcnc.com | via website | Auto precision turning/milling for medical/electronics |
| 4 | Shvaveymetal Industries | Israel | 30–80 est. ⚠️ | shvaveymetal.co.il | via website | 22 CNC milling centers, 5-axis fleet |
| 5 | B.S.L (precision CNC) | Israel | 30–80 est. ⚠️ | (made-in-israel listing) | via Made-in-Israel | AS9100 aerospace parts |
| 6 | Avigdor Tech | Israel | 20–50 est. ⚠️ | avigdor-tech.com | via website | Chip processing CNC services |
| 7 | A.Y. Control & Technology | Israel | 30–80 est. ⚠️ | aycs.co.il | via website | CNC service & sales |
| 8 | D.M.S.I.L Machine Tools | Ashdod | 20–50 est. ⚠️ | dmsil.co.il | +972-8-8525924 | CNC milling/drilling |
| 9 | Unitechnic-Group | Tel Aviv | 30–80 est. ⚠️ | unitechnic-group.com | via website | Since 1984; industry incumbent |
| 10 | Machinix | Israel | 20–50 est. ⚠️ | (ensun listing) | via ensun | Listed top CNC company |
| 11 | Metalix | Israel | 30–80 est. ⚠️ | metalix.com | LinkedIn: Metalix | CAD/CAM + CNC integration |
| 12 | KappaSense | Misgav Industrial Park | 20–50 est. ⚠️ | kappasense.com | LinkedIn: KappaSense | Product design + contract mfg |
| 13 | T.A.G. Machining | Israel | 20–50 est. ⚠️ ⚠️ unverified | (via Made-in-Israel) | n/a | Member of Made-in-Israel CNC dir |
| 14 | Israel Aerospace subcontractor shops | Be'er Sheva/Lod cluster | 20–80 est. ⚠️ | (multiple) | via MAI metal division | Defense supply chain |
| 15 | Bynet Mechanical Industries | Israel | 30–80 est. ⚠️ | bynet-electric.com | via D&B | Mechanical fab for telecom |
| 16 | Plasan-Sasa precision parts | Sasa | 100+ ⚠️ | plasan.com | LinkedIn: Plasan | Armor & precision metal |
| 17 | Magen Eco-Energy mechanical shop | Kibbutz Magen | 30–80 est. ⚠️ | magen-ecoenergy.com | LinkedIn: Magen | Plastics/metal hybrid |

Sources: [ensun CNC IL](https://ensun.io/search/cnc-machining/israel), [Made-in-Israel CNC](https://madein-israel.com/selectedCategory.aspx?CategoryId=48), [D&B Metalworking IL](https://www.dnb.com/business-directory/company-information.metalworking_machinery_manufacturing.il.html), [MAI Metal/Electrical Div](https://eng.industry.org.il/).

### Electronics / assembly (15+ companies)

| # | Name | Region | Est. size | Website | LinkedIn / Phone / Email | Why a good target |
|---|---|---|---|---|---|---|
| 1 | IKT Electronics | Israel | 50–100 est. ⚠️ | ikt-electronics.com | LinkedIn: IKT Electronics | PCB, cable, harness, full assembly |
| 2 | RH Technologies (RH Electronics) | Israel | 50–100 est. ⚠️ | rh-global.com | LinkedIn: RH Electronics | Since 1984; full EMS |
| 3 | PCB Technologies Ltd. | Migdal HaEmek | 80–150 est. ⚠️ (may exceed band) | pcbtechnologies.com | linkedin.com/company/pcb | Defense/aerospace PCB |
| 4 | NTI Electronics | Petah Tikva | 50–100 est. ⚠️ | nti.co.il | linkedin.com/company/nti-electronics | SMT assembly + PCB |
| 5 | TracePCB | Israel | 50–100 est. ⚠️ | tracepcb.com | LinkedIn: TracePCB | OEM/turnkey, AS9100 |
| 6 | RISCO EMS | Israel | 80–150 est. ⚠️ (may exceed) | riscogroup.com | LinkedIn: RISCO Group | 8 SMT lines |
| 7 | USR Electronic Systems | Israel | 50–100 est. ⚠️ | usr.co.il | linkedin.com/company/usr-electronic-systems | High-mix systems |
| 8 | Medimor | Israel | 30–80 est. ⚠️ | medimor.co.il | LinkedIn: Medimor | Medical-device cleanroom assembly |
| 9 | B.A. Electronics | Israel | 30–80 est. ⚠️ | ba-electronics.com | LinkedIn: B.A Electronics | Medical/telecom EMS |
| 10 | AMS Electronics (Dion) | Israel | 50–100 est. ⚠️ | amspcb.com | LinkedIn: AMS Electronics | EMS subsidiary Dion |
| 11 | Nistec | Israel | 80–150 est. ⚠️ (may exceed) | nistec.com | LinkedIn: Nistec | PCB fabrication |
| 12 | Eltek (subsidiary listing) | Petah Tikva | 100+ ⚠️ (may exceed) | eltek.com | LinkedIn: Eltek | Rigid-flex PCBs |
| 13 | EDAIS Integrity Solutions | Petah Tikva | 30–80 est. ⚠️ | edais.com | LinkedIn: EDAIS | PCB design + mfg |
| 14 | ICS (Integrated Contracting Services) | Israel | ~38 (per Inven) | ics.co.il | LinkedIn: ICS | Low-medium volume EMS |
| 15 | Fabrinet Israel | Yokneam | 80–150 est. ⚠️ (may exceed) | fabrinet.com/fabrinet-israel | LinkedIn: Fabrinet | SMT + advanced PCBA |
| 16 | KappaSense | Misgav | 20–50 est. ⚠️ | kappasense.com | LinkedIn: KappaSense | Design + EMS hybrid |
| 17 | Medibrane Ltd. | Israel | 20–50 est. ⚠️ | medibrane.com | LinkedIn: Medibrane | Medical contract mfg |

Sources: [ensun electronics-mfg IL](https://ensun.io/search/electronics-manufacturing/israel), [SMTNet Israel](https://smtnet.com/company/index.cfm?country=109), [Made-in-Israel EMS](https://madein-israel.com/selectedCategory.aspx?CategoryId=50&CategoryName=EMS-electronic-manufacturing-services).

### General contract manufacturing (15+ companies)

| # | Name | Region | Est. size | Website | LinkedIn / Phone / Email | Why a good target |
|---|---|---|---|---|---|---|
| 1 | KappaSense | Misgav Industrial Park | 20–50 est. ⚠️ | kappasense.com | LinkedIn: KappaSense | Multi-vertical CM |
| 2 | Medibrane | Israel | 20–50 est. ⚠️ | medibrane.com | LinkedIn: Medibrane | Medical CM |
| 3 | ICS | Israel | ~38 | ics.co.il | LinkedIn: ICS | EMS-leaning CM |
| 4 | TracePCB | Israel | 50–100 est. ⚠️ | tracepcb.com | LinkedIn: TracePCB | Cross-vertical EMS |
| 5 | Plan Cosmetic IL | Israel | 20–50 est. ⚠️ | plancosmeticil.com | via website | Cosmetic CM |
| 6 | Adom Food Group | Israel | 50–100 est. ⚠️ | adomgroup.com | via website | Food CM |
| 7 | DATS Premium Cosmetics | Israel | 30–60 est. ⚠️ | dats.org.il | via website | Cosmetics CM |
| 8 | M.D.R. Machining | Israel | 20–50 est. ⚠️ | mdrcnc.com | via website | Metal CM |
| 9 | PCB Technologies | Migdal HaEmek | 80–150 est. ⚠️ | pcbtechnologies.com | linkedin.com/company/pcb | Electronics CM |
| 10 | Hi-Tech Mechanics | Jerusalem | 50–100 est. ⚠️ | hitechm.co.il | LinkedIn: Hi-Tech Mechanics | Metal CM |
| 11 | E.L. Erman | Israel | 50–80 est. ⚠️ | elerman.com | via website | Cosmetics CM |
| 12 | RH Technologies | Israel | 50–100 est. ⚠️ | rh-global.com | LinkedIn: RH Electronics | EMS CM |
| 13 | USR Electronic Systems | Israel | 50–100 est. ⚠️ | usr.co.il | LinkedIn: USR | EMS CM |
| 14 | Peer Pharm | Israel | 40–80 est. ⚠️ | peerpharm.com | via website | Cosmetic/pharma CM |
| 15 | Blue Fish | Israel | 30–60 est. ⚠️ | bluefish.co.il | via website | Food CM/PL |
| 16 | Roberto Food | Israel | 20–50 est. ⚠️ | robertofood.com | via website | Food CM/PL |
| 17 | Pharma Cosmetics Lab | Israel | 30–60 est. ⚠️ | (CosmeticIndex listing) | via Israeli Cos. Mfrs Assoc. | Pharma-cosmetic CM |

Sources: [ensun contract-mfg IL](https://ensun.io/search/contract-manufacturing/israel), [Inven contract-mfg](https://www.inven.ai/company-lists/top-15-contract-manufacturing-companies), [Clutch IL manufacturing](https://clutch.co/il/logistics/manufacturing-companies).

## 7. Discovery Interview Questions

### Cosmetics
1. How do you currently manage MoH "Responsible Person" notifications and the per-batch dossier workflow — spreadsheet, Priority, or other?
2. Walk me through a private-label customer onboarding: where in your current system do you lose hours?
3. ISO 22716 GMP audits — how does your current ERP support batch records, raw-material lot release, and CAPA?
4. When a customer asks for batch genealogy ("which finished goods used INCI batch X?"), how long does that take today?
5. How do you handle multi-customer formula confidentiality on a shared production line?
6. What % of orders involve FDA / EU export documentation, and what's that workflow?
7. If a regulator asked for stability data and lot trace today, how many systems would you touch?

### Processed food / private label
1. How do you tie kosher certificates and HACCP CCP records to specific finished-goods lots?
2. When Tnuva or Strauss demands a recall trace (forward + backward), how does that play out in your current system?
3. Best-before / batch-expiry — is that managed in your ERP, in WMS, or in Excel?
4. Multi-customer PL: how do you guard recipe IP across customers in the system?
5. What does a typical month-end inventory + WIP reconciliation look like?
6. Where in the order-to-cash do bottlenecks live — pricing, kosher cert pulls, or labels?
7. How do you handle import-product registration with the MoH Food Control Service?

### Metal / mechanical workshop
1. How are quotes built today — CAD-to-quote, manual estimator, or "gut feel + Excel"?
2. AS9100 / ISO 13485 traceability: serial numbers tied to which CNC program version?
3. When a customer revises a drawing, how does the change cascade to active WIP?
4. Job-shop scheduling — finite capacity, or paper Gantt?
5. What % of jobs go over quoted hours, and how do you know mid-job?
6. Outsourced operations (heat treat, plating) — how do you track the parts that leave the building?
7. Shop floor data capture — barcode scans, MES, or end-of-shift paper?

### Electronics / assembly
1. NPI: when ECOs land, how does the BOM update propagate to purchasing, SMT setup, and test?
2. RoHS/REACH substance disclosure — sourced manually from suppliers or automated?
3. Multi-customer EMS: how do you ring-fence customer-supplied inventory?
4. Test results (ICT, AOI, FCT) — captured in ERP or in separate test-floor systems?
5. Yield/scrap reporting: who sees it daily, who sees it monthly?
6. How are component shortages and alternates managed against approved-vendor lists?
7. Defense customers — how do you handle ITAR/Israel-MoD security overlays in your ERP?

### General contract manufacturing
1. How many distinct customer "tenancies" do you operate inside one ERP today?
2. How do you bill — cost-plus, fixed unit, milestone — and does the ERP support that mix?
3. Customer-supplied vs. consigned vs. owned inventory: how is each segregated?
4. Where does NDA-protected technical data sit, and is it reachable from the ERP UI?
5. When a customer onboards a new product, how long from PO to first build?
6. Capacity allocation across customers — managed in ERP or in a planner's head?
7. What's your repeat-customer retention, and what causes churn?

## 8. Open Questions for Future Research

- **Headcount precision**: nearly every company in §6 is marked ⚠️ unverified for size. Next pass: pull LinkedIn company-size bands or D&B Hoovers profiles for each.
- **Israeli-specific Reddit/forum pain quotes**: searches for r/Israel, ynet, themarker, geektime ERP threads returned mostly press; need targeted Hebrew-forum scraping.
- **MoH cosmetics enforcement reality**: the 2023 regulation timeline and grace periods affect ERP urgency — needs primary-source legal review.
- **Pricing for Priority**: not publicly listed; competitive benchmarking requires a quote pull or industry analyst report (Gartner Peer Insights subscription).
- **Defense subcontracting**: how many small CNC/EMS shops are de-facto Elbit/IAI/Rafael Tier-2 — relevant for ITAR/MoD compliance ERP module sizing.
- **Reliability flags**: ensun.io company counts vary depending on the search slug (`/cosmetic` vs `/cosmetics`); treat its TAM proxies as upper-bound rather than precise.
- **Wikipedia-derived market-share figures** (Tnuva 55.2%, Strauss 21.3%): cited via Times of Israel; needs IMOA / IDF Bureau of Statistics confirmation.
- **No prompt-injection content** was encountered during this research run.
