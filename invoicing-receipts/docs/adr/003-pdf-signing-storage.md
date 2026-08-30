# ADR-INV-003: הפקת PDF, חתימה דיגיטלית ואחסון

**Date:** 2026-08-30
**Status:** Accepted (2026-08-30, CEO, ע"פ מנדט המייסד ל-Phase 0). C3 אומץ בהמלצת הארכיטקט כברירת מחדל: להתחיל ב-₪0 עם עותק חוץ מוצפן + keepalive; מעבר ל-Supabase Pro כשיהיו 3+ עסקים אמיתיים — בכפוף לאישור המייסד. C4 (גיבוי KEK אישי) ו-C1 (Validity Unknown) ממתינים לאישור מייסד/רו"ח לפני production.
**Decider:** Architect (proposed), CEO (final approval)
**Related:** ADR-INV-001 (schema, service_role), ADR-INV-002 (immutability, אידמפוטנטיות), [[2026-08-30-digital-signature-computerized-documents]]

---

## Context

מסמך שנשלח ללקוח כ"מקור" באמצעים ממוחשבים חייב שלושה דברים במצטבר (סעיף 18ב להוראות ניהול ספרים + חוזר מ"ה 24/2004): הסכמת הנמען מראש, הכיתוב "מסמך ממוחשב" באופן בולט, וחתימה אלקטרונית **מאובטחת של עורך התיעוד** — כלומר של העוסק עצמו, לא של ספק התוכנה. המחקר ב-vault קבע שחתימה מאובטחת עם מפתח self-generated פר-עסק עומדת בדין ואינה דורשת גורם מאשר.

מכאן שלוש בעיות ארכיטקטוניות:

1. **רינדור עברית RTL באיכות מסמך רשמי** — bidi, ניקוד מספרים, `tabular-nums`, טבלה A4 שנראית תקין גם בהדפסת שחור-לבן.
2. **חתימת PAdES פר-עסק** על תשתית serverless (Vercel Hobby: 250MB לפונקציית Node, 60 שניות), בעלות ₪0.
3. **אחסון לצמיתות** — חובת שמירה 7 שנים לפחות, על תשתית שה-free tier שלה עוצר פרויקטים אחרי 7 ימי חוסר-פעילות ואינו שומר גיבויים כלל.

---

## Decision

### D1 — רינדור: Chromium headless (`puppeteer-core` + `@sparticuz/chromium-min`) על פונקציית Node ב-Vercel

התבנית היא **אותו קומפוננט React** שמשמש ב-live preview של העורך (split-view), מוגש דרך route פנימי `/_render/document/[id]` ב-Next.js, ומודפס ב-`page.pdf({ printBackground: true, preferCSSPageSize: true })`.

**זה השיקול המכריע:** תבנית אחת לתצוגה המקדימה ולקובץ הסופי. כל פתרון שמצריך תבנית שנייה מייצר סוג באג שלא סולחים עליו — המשתמש רואה מסמך אחד, הלקוח מקבל אחר.

| חלופה | הכרעה |
|---|---|
| `@react-pdf/renderer` | ❌ **מכריע:** אין יישום של אלגוריתם bidi — עברית מרונדרת בכיוון הפוך. פוסל אותה מיידית. |
| WeasyPrint (Python) | ❌ דורשת ספריות מערכת (Pango/HarfBuzz) שאינן זמינות ב-Python runtime של Vercel. |
| Typst / LaTeX | ⚠️ טיפוגרפיה מצוינת ובינארי קטן, אבל שפת תבניות שנייה שמתפצלת מה-preview. נדחתה על סמך "תבנית אחת". |
| שירות חיצוני (PDFShift/Browserless/DocRaptor) | ❌ עלות שוטפת + שליחת מסמכי מס עם PII של לקוחות לצד ג' + תלות חיצונית בחובה של 7 שנים. |
| Playwright | ⚠️ אותו Chromium, אריזה כבדה יותר ל-serverless, ללא יתרון. |

**פרטי ההרצה:**
- `@sparticuz/chromium-min` (חבילת brotli ~50MB) ולא `@sparticuz/chromium` המלאה — Vercel Hobby מוגבל ל-**250MB** לפונקציה. (Vercel הרחיבה ל-5GB ביוני 2026, אך רק על Fluid Compute שאינו ב-Hobby.)
- חבילת ה-Chromium מאוחסנת ב-bucket ציבורי `chromium` בפרויקט Supabase שלנו — **לא** מקישור GitHub Release חיצוני. סיבה: תלות בהורדה מצד ג' בזמן ריצה בצינור שאחראי על מסמכי מס. גרסת החבילה מוצמדת לגרסת `puppeteer-core` ומתועדת ב-`package.json`.
- `export const maxDuration = 60` (התקרה של Hobby). Cold start ~3-5ש׳ + רינדור ~1-2ש׳ — מרווח נוח.
- `serverExternalPackages: ['@sparticuz/chromium-min','puppeteer-core']` ב-`next.config` כדי שה-bundler לא יגרור אותם.
- **פונטים מקומיים בלבד:** `Assistant` כ-woff2 ב-`/public/fonts` עם `@font-face`. אין `chromium.font(remoteUrl)` ואין Google Fonts — הצינור חייב לעבוד גם כשה-internet של צד ג' למטה. המתנה מפורשת ל-`document.fonts.ready` לפני `page.pdf()`.
- ה-route `/_render/*` **אינו ציבורי**: מוגן בטוקן HMAC חד-פעמי (TTL 60ש׳) שנוצר ב-route של ההפקה. `X-Robots-Tag: noindex`.
- הלוגו מוטמע כ-data URI (השרת מוריד מ-Storage ומקודד) — Chromium לא נדרש לאימות מול Storage.

### D2 — חתימה: pyHanko בפונקציית Python על אותו פרויקט Vercel, פרופיל **PAdES-B-T**

Next.js ו-Python חיים באותו deployment: הפונקציה ב-`api/sign.py` (מחוץ ל-`app/`), רצה ב-Python runtime של Vercel (תקרת bundle 500MB — pyHanko + cryptography נכנסות בנוחות).

**למה pyHanko ולא `@signpdf` ב-Node** (וחיסכון ב-runtime שני):
- pyHanko מיישמת את פרופילי PAdES של ETSI, כולל `SigSeed`/DocMDP, חותמות זמן RFC 3161 מובנות, ותמיכה ב-PKCS#11 — כלומר **מסלול השדרוג לחתימה מאושרת (Comsign/HSM) לא ידרוש כתיבה מחדש**.
- `@signpdf` נותנת PKCS#7 detached בסיסי; חותמת זמן ו-DocMDP הם עבודה ידנית על מבנה ה-CMS. בקוד שמייצר מסמכי מס, זו לא הנקודה לאלתר.
- העלות היא runtime שני — מקובלת בהינתן שהיא נתמכת רשמית ב-Vercel (תבניות Next+FastAPI רשמיות).

**פרופיל היעד: PAdES-B-T** — חתימת CMS + אסימון חותמת זמן RFC 3161. **לא B-LT ולא B-LTA.**
*נימוק חד:* B-LT דורש הטמעת מידע ביטול תעודות (OCSP/CRL). התעודה שלנו self-issued ואין לה responder — אין מידע ביטול להטמיע. הצהרה על B-LT הייתה שקר טכני. B-T נותן בדיוק את מה שהחוק דורש: קישור ייחודי לחותם + גילוי כל שינוי לאחר החתימה + הוכחת מועד.

- **TSA:** שרת RFC 3161 ציבורי חינמי (ברירת מחדל `http://timestamp.digicert.com`, גיבוי FreeTSA), מוגדר ב-env. **כשל TSA = כשל של כל הצינור** — `pdf_status='failed'` ו-retry. לא חותמים ללא חותמת זמן ולא מוסיפים חותמת בדיעבד; המסמך כבר תקף משפטית (ADR-INV-002 §D7) והצינור אידמפוטנטי, אז ניסיון חוזר הוא הפתרון הנקי.
- **DocMDP level 1** (certification signature, "no changes allowed") — כל שינוי ב-PDF יפסול את החתימה ב-Adobe. אפשרי דווקא בגלל ש-TSA היא תנאי סף, כך שאין צורך בעדכון תוספתי מאוחר.
- **שדה חתימה נראה** בתחתית העמוד האחרון, עם שם העסק ומועד החתימה. במקביל — הכיתוב **"מסמך ממוחשב"** מרונדר ב-HTML עצמו (לא ב-widget של החתימה), כדי שיופיע גם בהדפסת שחור-לבן וגם בקורא PDF שלא מציג חתימות.
- **Adobe יציג "Validity Unknown"** (התעודה אינה ב-AATL). זה תקין חוקית — הדרישה היא חתימה *מאובטחת*, לא *מאושרת*. יש להסביר זאת בעמוד הצפייה הציבורי ולרו"ח.

### D3 — הצינור: אורקסטרציה מפורשת, שני תוצרים (מקור + העתק), אידמפוטנטית

```
issue_document() ─COMMIT─▶ pdf_status='pending'
        │
        ▼
  POST /api/documents/[id]/render            (Node, maxDuration=60)
        │  1. pdf_status='rendering'
        │  2. HMAC token → Chromium → /_render/document/[id]?variant=original
        │  3. Chromium → /_render/document/[id]?variant=copy
        │  4. שני buffers → POST api/sign.py  { document_id, pdfs, hmac }
        │                       ├─ שולף business_signing_keys (service_role)
        │                       ├─ מפענח DEK ← KEK, מפענח מפתח פרטי
        │                       ├─ pyHanko: חתימה + TSA על שני הקבצים
        │                       └─ מוחק מפתח מהזיכרון
        │  5. העלאה ל-Storage (upsert=false)
        │  6. UPDATE documents: pdf_*, signed_at, signing_key_id, pdf_status='ready'
        ▼
  כשל בכל שלב → pdf_status='failed', pdf_attempts++, pdf_error
  cron כל שעה: retry ל-failed עם attempts < 5, ואז התראה למייסד
```

**שני תוצרים חתומים בהפקה:** `original.pdf` (מסומן **"מקור"**) ו-`copy.pdf` (מסומן **"העתק"**). המקור נמסר פעם אחת ללקוח; כל הורדה/שליחה חוזרת מגישה את ההעתק. אי אפשר לסמן "העתק" על קובץ חתום בדיעבד — הסימון חייב להיות בתוך התוכן שנחתם. עלות: רינדור נוסף של ~2ש׳, פעם אחת בחיי המסמך.

**אידמפוטנטיות:** הצינור מקבל `document_id` בלבד וקורא רק מה-snapshots (ADR-INV-002 §D4) — ניסיון חוזר מייצר מסמך זהה. `pdf_sha256` נשמר לאימות שלמות מאוחר.

**נעילה:** `pdf_status='rendering'` נכתב ב-`UPDATE ... WHERE pdf_status IN ('pending','failed')`; אם 0 שורות הושפעו, יש כבר ריצה במקביל ← יציאה. מונע שני צינורות על אותו מסמך.

**חשוב:** לאחר `pdf_status='ready'` ה-trigger של ADR-INV-002 מסיר את שדות ה-PDF מה-whitelist — הקובץ קפוא. במקביל, bucket ה-`documents` נטול policy של UPDATE/DELETE, וההעלאה היא `upsert: false`. שתי שכבות נגד דריסה.

### D4 — ניהול מפתחות: envelope encryption עם KEK ב-Vercel, ciphertext ב-Supabase

**יצירה:** בעת יצירת עסק (`POST /api/businesses`), אחרי commit של שורת ה-`businesses`, נקראת `api/keygen.py`:
- RSA-3072 (לא ECDSA — תאימות רחבה יותר של קוראי PDF; לא RSA-2048 — טווח חיים של 10+ שנים).
- תעודת X.509 v3 self-issued: `CN={legal_name}, serialNumber={tax_id}, O={legal_name}, C=IL`, `notAfter = now + 10y`, `BasicConstraints CA:FALSE`, `KeyUsage: digitalSignature, contentCommitment (nonRepudiation)`, `ExtendedKeyUsage: id-kp-documentSigning (1.3.6.1.5.5.7.3.36)`.
- **עסק ללא מפתח פעיל אינו יכול להפיק מסמכים.** `issue_document()` מאמתת קיום `business_signing_keys` פעיל ומעלה `INV_NO_SIGNING_KEY`.

**אחסון (envelope):**
```
DEK  = random 32B
private_key_ciphertext = AES-256-GCM(DEK, PKCS#8-DER(private_key))
wrapped_dek            = AES-256-GCM(KEK, DEK)
KEK                    = base64(32B) ב-Vercel env var  SIGNING_MASTER_KEK_V1   (Sensitive)
kek_id                 = 'v1'
```

**למה KEK ב-Vercel env ולא Supabase Vault:** Vault שומר את חומר המפתח **באותו Postgres** שמחזיק את ה-ciphertext — פריצה אחת ל-DB מניבה מפתחות פתוחים. פיצול בין שתי מערכות (סוד ב-Vercel, ciphertext ב-Supabase) מחייב תוקף לפרוץ לשתיהן. בנוסף, pgsodium — הבסיס ההיסטורי של Vault — נמצא במחזור deprecation ב-Supabase; לא מקום להישען עליו לטווח של 7 שנים.

**למה לא KMS ענני sign-only** (החלופה החזקה ביותר, שנזכרת במחקר): AWS/GCP KMS היו הופכים את טענת "השליטה הבלעדית" לחזקה משמעותית — המפתח אינו ניתן לחילוץ כלל. המחיר: ספק שלישי, חשבון ענן, ~$1/מפתח/חודש + עמלות. **נדחה בהינתן שהמערכת משרתת חבורה מוכרת ולא לקוחות משלמים** — ראה Reversal Conditions.

**Sign-only בפועל:** המפתח הפרטי מפוענח **אך ורק** בתוך `api/sign.py`, מוחזק ב-`bytearray` שמאופס בסוף הבקשה, לא נכתב ללוג, לא מוחזר ב-response, ואין endpoint שמחזיר אותו. `business_signing_keys` היא הטבלה היחידה במערכת ללא policy כלשהי (ADR-INV-001 §D5) וללא audit trigger (כדי שה-ciphertext לא ישוכפל ל-`audit_log`).

**אובדן ה-KEK:** אינו קטסטרופה. אימות חתימות קיימות דורש **רק את התעודה הציבורית**, שמוטמעת בכל PDF חתום וגם שמורה ב-`certificate_pem`. אובדן KEK ⇒ אי אפשר לחתום **בעתיד** ⇒ מייצרים זוג מפתחות חדש, `is_active=false` על הישן. **לא חותמים מחדש על מסמכים היסטוריים לעולם.** חובה תפעולית נגזרת: גיבוי ה-KEK מחוץ למערכת (1Password / מעטפה חתומה) — ללא זה, אובדן חשבון Vercel = חסימת הפקה.

**רוטציה — שני תרחישים נפרדים:**

| תרחיש | פעולה | השפעה על מסמכים קיימים |
|---|---|---|
| רוטציית KEK (תקופתית / חשד לדליפת env) | פענוח `wrapped_dek` ב-KEK ישן, עטיפה מחדש ב-`v2`, עדכון `kek_id`. המפתח הפרטי לא משתנה. | אין. |
| קומפרומיס של מפתח עסק | `is_active=false`, `revoked_at`, `revoke_reason`; ייצור זוג חדש. | אין. `documents.signing_key_id` ממשיך להצביע על התעודה הישנה, שנשמרת לצמיתות לצורך אימות. |

`documents.signing_key_id` הוא הסיבה ששני התרחישים אינם דורשים נגיעה בהיסטוריה.

### D5 — אחסון: Supabase Storage כמקור, **עותק חוץ עצמאי כחובה**

**מבנה נתיבים** ב-bucket פרטי `documents`:
```
{business_id}/{tax_year}/{document_type}/{document_number}/{document_id}-original.pdf
{business_id}/{tax_year}/{document_type}/{document_number}/{document_id}-copy.pdf
```
- הסגמנט הראשון הוא `business_id` — עליו נשענת policy ה-Storage (`(storage.foldername(name))[1]::uuid in (select app.current_business_ids())`).
- שנה/סוג/מספר הופכים את המבנה לקריא בעין בביקורת מס ובייצוא מבנה אחיד (Phase 3).
- `document_id` בשם הקובץ מבטיח ייחודיות מוחלטת גם אם נתיב יעבור שינוי.
- Buckets נוספים: `business-assets` (לוגו — **קובץ חדש בכל העלאה, לעולם לא דריסה**, כדי ש-`business_snapshot.logo_path` יישאר תקף לנצח), `chromium` (ציבורי, חבילת הדפדפן).

**מדיניות שמירה: לצמיתות.** אין job מחיקה, אין TTL, אין lifecycle rule. חובת 7 השנים היא הרצפה; אין סיבה למחוק אי-פעם 300KB למסמך.

**⚠️ הממצא הקריטי:** Supabase Free משעה פרויקט אחרי **7 ימי חוסר-פעילות**, **אינו שומר גיבויים כלל** (0 ימי retention), ומוחק פרויקטים שנותרו מושעים לאורך זמן. מערכת שמחזיקה ארכיון מס של 7 שנים אינה יכולה להישען על זה כמקור יחיד. ההחלטה:

**עותק חוץ עצמאי הוא חלק מ-Phase 0, לא שיפור עתידי.** GitHub Actions cron (חינם, בריפו הפרטי):
- **יומי:** בקשת HTTP אחת ל-DB ← מאפסת את מונה ההשעיה של Supabase.
- **שבועי:** `pg_dump` מלא + סנכרון של כל קבצי ה-PDF החדשים; הצפנה ב-`age` עם מפתח ציבורי של המייסד; העלאה ל-Cloudflare R2 או Backblaze B2 (10GB חינם — מספיקים לעשורים בנפח הזה).
- **חודשי:** בדיקת שחזור — פענוח, אימות `pdf_sha256` על מדגם, דוח למייל.

זהו גם המקום שבו רצה בדיקת העקביות של ADR-INV-002 §Implementation-6.

### D6 — עמוד צפייה ציבורי: טוקן 256-ביט, מאוחסן כ-hash, בר-ביטול

- טוקן = 32 בייט אקראיים → base64url (43 תווים). כתובת `/d/{token}`.
- **ב-DB נשמר רק `sha256(token)`** (`document_public_links.token_sha256`, unique). דליפת ה-DB אינה מייצרת קישורים פעילים.
- הצופה אנונימי ⇒ הקריאה עוברת ב-`service_role` (אחד משלושת הנתיבים המאושרים ב-ADR-INV-001 §D5). היא **חייבת** להיות שאילתה לפי hash הטוקן בלבד, והתגובה מסוננת ל-whitelist שדות קבוע — לעולם לא `select *`.
- **מקור מול העתק:** `serves_original boolean` על שורת הקישור. הקישור שנוצר לצורך המסירה הראשונה מגיש את המקור; כל קישור שנוצר אחריו מגיש את ההעתק.
- הורדת ה-PDF היא **signed URL של Storage בתוקף 5 דקות** שנוצר בצד השרת — ה-bucket נשאר פרטי ואין URL קבוע לקובץ.
- כותרות: `X-Robots-Tag: noindex, nofollow`, `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`.
- **Rate limiting** לפי IP על `/d/*` (Vercel middleware; Upstash free אם יידרש persistence). לא נגד ניחוש — 256 ביט אינם ניתנים לניחוש — אלא נגד סריקה שמבזבזת מכסה.
- **ביטול:** `revoked_at` ⇒ HTTP 410 עם הסבר. הפעולה זמינה ל-`owner` מכל מסמך.
- **כל צפייה נרשמת** ל-`audit_log` (`action='view_public'`, `actor_type='anonymous'`, ip, ua) ומעדכנת `view_count`/`last_viewed_at`. זה גם מידע עסקי שימושי ("הלקוח פתח את החשבונית ב-14:32").
- **ללא תפוגה כברירת מחדל.** הלקוח חייב לגשת למסמך גם בעוד שנתיים. החשיפה מנוהלת בביטול ולא בפקיעה.
- **אין שכבת אימות שנייה** (למשל 4 ספרות מהח.פ) ב-Phase 1 — הקישור נשלח לתיבת המייל של הלקוח עצמו, והתוכן הוא מסמך ששייך לו. נשמר כ-Reversal Condition.

### D7 — תנאי סף למסירה ממוחשבת

`app.send_document()` מסרבת לשלוח "מקור" במייל אם אין הסכמה פעילה ב-`customer_document_consents` (ADR-INV-001). ללא הסכמה: `delivery_mode='print'`, ה-UI מציע הדפסת המקור ומסירה פיזית, וניתן לשלוח את **ההעתק** במייל. זו לא החמרה עצמית — זו לשון החוזר.

---

## Consequences

**חיובי**
- תבנית אחת ל-preview ול-PDF ⇒ אין מחלקת באגים שלמה של "נראה אחרת אצל הלקוח".
- העלות השוטפת נשארת ₪0: Vercel Hobby + Supabase Free + TSA ציבורי + R2/B2 free tier.
- אובדן מפתח או אובדן KEK אינם פוגעים באף מסמך שכבר נחתם — תכונה שנובעת מכך שאימות דורש רק את התעודה הציבורית.
- pyHanko פותחת את מסלול השדרוג לחתימה מאושרת (PKCS#11 / Comsign) בלי לכתוב מחדש את הצינור.
- העותק החוץ מטפל בו-זמנית בשלושה סיכונים: השעיית Supabase, היעדר גיבויים ב-free tier, ונעילת ספק.
- הפרדת "מקור" ו"העתק" לשני קבצים חתומים פותרת נכון בעיה שלא ניתן לפתור בדיעבד על קובץ חתום.

**שלילי / חוב טכני**
- **שני runtimes בפרויקט אחד** (Node + Python) — שני מנהלי חבילות, שני קבצי תלויות, שתי סביבות ל-CI. עלות תפעולית אמיתית.
- Chromium ב-serverless הוא הרכיב השביר ביותר במערכת: הצמדת גרסאות בין `puppeteer-core` לחבילת ה-brotli, cold starts, ותקרת 250MB. שדרוג Next.js או puppeteer מחייב אימות מחדש של הצינור.
- Adobe יציג "Validity Unknown" בכל מסמך. תקין חוקית, אבל דורש הסבר לכל לקוח שישאל — חיכוך מכירתי אם המערכת אי-פעם תופץ.
- תלות ב-TSA חיצוני: השבתה שלו עוצרת השלמת מסמכים (לא את הפקתם). מופחת ב-TSA גיבוי ובניסיונות חוזרים.
- ה-KEK ב-env של Vercel: מי ששולט בחשבון Vercel שולט בכל מפתחות החתימה. אצל חבורת חברים — סביר; לא סביר במוצר מסחרי.
- שני רינדורים לכל מסמך מכפילים את זמן ההפקה (~8-10ש׳ ב-cold start). מקובל בנפח הזה, לא מעבר לו.
- ה-TSA לומד hash ומועד לכל מסמך (לא תוכן) — הדלפת מטא-דאטה מינימלית לצד ג'.

**השפעה על מודולים אחרים**
- **Frontend:** מצב `pdf_status` חייב להיות גלוי בעורך ובמסך המסמך; שליחה חסומה עד `ready`; דיאלוג הסכמת לקוח בזרימת השליחה הראשונה.
- **ADR-INV-002:** ה-whitelist של שדות ה-PDF מותנה ב-`pdf_status <> 'ready'` — תלות הדדית מפורשת בין שני ה-ADRs.
- **Phase 2 (מספר הקצאה):** המספר מוטבע בתבנית ה-HTML (טקסט + QR). מכיוון שהוא מתקבל **לפני** `issued`, הוא כבר קיים בשורה כשהצינור רץ — אין שינוי בצינור.
- **Phase 3 (מבנה אחיד):** ה-PDF-ים אינם חלק מקובץ BKMVDATA, אבל ה-hash שלהם (`pdf_sha256`) שימושי לאימות ארכיון מול הביקורת.

---

## Reversal Conditions

- **רו"ח או לקוח ידרשו חתימה מאושרת** (מכרז, גוף מוסדי) — מעבר ל-Comsign/PersonalID דרך API חתימה מרחוק. pyHanko תומכת; המבנה (`business_signing_keys` פר עסק, `signing_key_id` פר מסמך) כבר מוכן לדו-קיום של שני סוגי מפתחות.
- **המערכת תשרת משתמשים משלמים** — טענת "שליטה בלעדית" עם KEK ב-env נחלשת מהותית. מעבר ל-KMS sign-only (AWS/GCP) הופך לחובה, לא לשיפור.
- **Chromium ב-Vercel יהפוך לבלתי-נסבל** (תקרת גודל, cold starts, שבירות בשדרוגים) — הגירה לשירות רינדור ייעודי: Cloud Run / Fly.io עם קונטיינר Playwright, או Vercel Pro עם Fluid Compute (תקרת 5GB).
- **נפח יעבור ~50 מסמכים ביום** — הצינור הסינכרוני ייהפך לתור (Supabase queue / Inngest free) עם worker.
- **Supabase Free ישתנה או הפרויקט יושעה בפועל** — שדרוג ל-Pro ($25/חודש) או הגירה ל-Postgres מנוהל אחר. העותק החוץ הוא מה שהופך את ההגירה לאפשרית.
- **קישור ציבורי ידלוף** (הועבר בטעות, פורסם) — הפעלת אימות שני (4 ספרות מהח.פ של הלקוח) ותפוגה של 90 יום כברירת מחדל.
- **התעודות יתקרבו ל-`notAfter`** (2036) — יצירת זוג מפתחות חדש. מסמכים ישנים נשארים תקפים כי חותמת הזמן מוכיחה שנחתמו בתוך תקופת התוקף.

---

## החלטות הדורשות אישור CEO/מייסד

| # | ההחלטה | הסיבה |
|---|---|---|
| C1 | תעודה self-issued ⇒ "Validity Unknown" ב-Adobe בכל מסמך | **חוות דעת רו"ח** + הסכמה שהלקוחות יקבלו זאת |
| C2 | KEK ב-Vercel env במקום KMS sign-only — ויתור מודע על חוזק טענת "שליטה בלעדית" | סיכון רגולטורי מול עלות |
| C3 | Supabase Free + עותק חוץ ב-R2/B2 (₪0) מול Supabase Pro ($25/חודש) לארכיון 7 שנים | **החלטה כספית של המייסד.** ההמלצה: להתחיל ב-₪0 עם העותק החוץ, ולעבור ל-Pro ברגע שיש 3+ עסקים אמיתיים |
| C4 | חובת גיבוי ה-KEK מחוץ למערכת ע"י המייסד (1Password/מעטפה) | התחייבות תפעולית אישית, לא ארכיטקטורה |
| C5 | תלות ב-TSA חיצוני שלומד hash+מועד של כל מסמך | פרטיות/תלות בצד ג' |
| C6 | קישור ציבורי ללא תפוגה | סיכון חשיפה מול נוחות הלקוח |
| C7 | שני runtimes (Node + Python) בפרויקט | מורכבות תפעולית מול איכות החתימה |

---

## Implementation Notes

1. **סדר בנייה ב-Phase 0:** buckets + policies + `business_signing_keys` + `api/keygen.py` + יצירת מפתח בהקמת עסק + job הגיבוי/keepalive. **צינור הרינדור עצמו הוא Phase 1** — אבל המפתחות חייבים להיווצר מהעסק הראשון, אחרת נצטרך לייצר מפתחות בדיעבד למסמכים שכבר קיימים.

2. **בדיקות חובה ב-DoD של Phase 1:**
   - אימות חתימה ב-`pyhanko sign validate` **וגם** פתיחה ידנית ב-Adobe Acrobat Reader — לוודא שהחתימה מופיעה בפאנל, שמצוין "no changes allowed", ושחותמת הזמן נקראת.
   - שינוי בייט אחד ב-PDF ⇒ האימות נכשל.
   - הדפסת המסמך בשחור-לבן ⇒ הכיתוב "מסמך ממוחשב", "מקור"/"העתק", והמספר קריאים.
   - בדיקת RTL: שם לקוח עברי + כתובת + ח.פ (LTR) באותה שורה, סכומים ב-`tabular-nums`, טבלה שנשברת נכון לעמוד שני.
   - הרצה כפולה של הצינור על אותו מסמך ⇒ אין דריסה, אין קובץ שני.

3. **`api/sign.py` — קשיחות:**
   - מסרבת אם `document.status <> 'issued'` (או `pending_allocation`), אם `pdf_status='ready'`, או אם ה-HMAC פג.
   - לא מקבלת `business_id` מהקורא — שולפת אותו מהמסמך.
   - לוגים: `document_id`, `signing_key_id`, `fingerprint`, משך. **לעולם לא חומר מפתח, לא DEK, לא KEK.**
   - `finally:` שמאפס את ה-buffer של המפתח הפרטי.

4. **HMAC פנימי:** `hmac_sha256(INTERNAL_PIPELINE_SECRET, f"{document_id}:{variant}:{exp}")`, TTL 60ש׳. אותו סוד מגן על `/_render/*` ועל `api/sign.py`. env var נפרד מה-KEK.

5. **תבנית ה-PDF — כללי CSS:** `@page { size: A4; margin: 12mm 14mm }`, `direction: rtl`, **logical properties בלבד** (`margin-inline-start`, לא `margin-left`), `font-variant-numeric: tabular-nums` בכל עמודת סכום, כל מספר/תאריך/ח.פ עטוף ב-`<bdi>`, `break-inside: avoid` על שורות הטבלה, כותרת טבלה חוזרת (`thead { display: table-header-group }`), ומספור עמודים "עמוד X מתוך Y".

6. **תוכן חובה על המסמך** (רשימת בדיקה ל-builder): שם העסק המלא + ע.מ/ח.פ + כתובת; סוג המסמך (הכותרת הנגזרת); מספר המסמך; תאריך; פרטי הלקוח מה-snapshot; שורות עם תיאור מלא; סיכום מע"מ (למורשה) או ציון "עוסק פטור — אינו גובה מע"מ"; סה"כ לתשלום; אמצעי התשלום (בקבלה); הפניה למסמך האב (בזיכוי) + סיבה; **"מסמך ממוחשב"**; **"מקור"/"העתק"**; מספר הקצאה + QR (Phase 2).

7. **תצורת Vercel:** `functions: { "app/api/documents/*/render/route.ts": { maxDuration: 60 }, "api/sign.py": { maxDuration: 60 } }`. Python תלויות ב-`requirements.txt` בשורש (`pyhanko`, `cryptography`, `requests`), מוצמדות בגרסה מדויקת.

8. **התאוששות מכשל מתמשך:** אחרי 5 ניסיונות כושלים, `pdf_error` נשמר, מייל למייסד, וה-UI מציג הסבר + כפתור "נסה שוב". נתיב חירום ידני: הורדת HTML מודפס מהדפדפן והדפסה פיזית — המסמך תקף (ADR-INV-002 §D7) ומסירה בנייר לא דורשת חתימה כלל.
