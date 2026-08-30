/**
 * Maps `INV_*` Postgres error codes (raised via `raise exception 'INV_CODE: ...'` in the
 * migrations under supabase/migrations/) to a Hebrew message safe to show a user.
 *
 * Source of the codes so far:
 * - 0003a_core_tables.sql   — business_members owner guard, businesses identity guard
 * - 0006_audit.sql          — audit_log immutability
 * - 0007_immutability.sql   — ADR-INV-002 §D3 document/child-row/allocation immutability
 * - 0008_issue_function.sql — ADR-INV-002 §D2 app.issue_document() validation sequence
 *
 * B9 (app.create_business()) will extend this map with INV_UNAUTHENTICATED, INV_NO_PROFILE,
 * INV_BUSINESS_LIMIT, INV_BAD_TAX_ID, INV_TAX_ID_EXISTS — not added yet, out of this batch's
 * scope (see vault/Engineering/invoicing-phase-0-plan.md, B9).
 *
 * A handful of these codes are not named verbatim anywhere in ADR-INV-001/002's short lists
 * (INV_DOCUMENT_NOT_FOUND, INV_FORBIDDEN, INV_NO_LINES, INV_CUSTOMER_REQUIRED,
 * INV_CREDIT_NEEDS_PARENT, INV_CREDIT_OF_CREDIT, INV_NO_VAT_RATE, INV_NOT_OWNER,
 * INV_COUNTER_ALREADY_STARTED, INV_IMMUTABLE_CHILD, INV_ALLOCATION_IMMUTABLE,
 * INV_AUDIT_IMMUTABLE) — they were introduced while implementing the validation steps the
 * ADRs describe in prose (e.g. "יש customer_id", "credit_note דורשת parent_document_id")
 * but did not assign an explicit code to. Named here for completeness; flagged for review.
 */

export const INV_ERROR_MESSAGES: Record<string, string> = {
  // business_members / businesses (0003a_core_tables.sql)
  INV_NO_OWNER: "לא ניתן להסיר את הבעלים האחרון של העסק — חייב להישאר בעלים אחד לפחות.",
  INV_IMMUTABLE_FIELD: "לא ניתן לשנות שדה זהות של העסק (ח.פ/סוג ישות/יוצר) לאחר יצירתו.",

  // audit_log (0006_audit.sql)
  INV_AUDIT_IMMUTABLE: "יומן הביקורת הוא לקריאה בלבד — לא ניתן לערוך או למחוק רשומות ממנו.",

  // document / child-row / allocation immutability (0007_immutability.sql, ADR-INV-002 §D3)
  INV_IMMUTABLE_DELETE: "מסמך שהופק אינו ניתן למחיקה. לתיקון — הפק מסמך זיכוי.",
  INV_IMMUTABLE_STATUS: "מעבר הסטטוס המבוקש אינו מותר במסמך שהופק.",
  INV_IMMUTABLE_FIELDS: "לא ניתן לערוך שדות אלו במסמך שכבר הופק.",
  INV_IMMUTABLE_CHILD: "לא ניתן לערוך שורות פריט או תקבולים של מסמך שאינו טיוטה.",
  INV_ALLOCATION_IMMUTABLE: "לא ניתן לערוך או למחוק בקשת הקצאת מספר לאחר שהתקבלה עליה תשובה.",

  // app.issue_document() / app.seed_for() (0008_issue_function.sql, ADR-INV-002 §D2)
  INV_DOCUMENT_NOT_FOUND: "המסמך המבוקש לא נמצא.",
  INV_FORBIDDEN: "אין לך הרשאה מספקת לפעולה זו בעסק.",
  INV_ALREADY_ISSUED: "המסמך כבר הופק ולא ניתן להפיק אותו שוב.",
  INV_NO_LINES: "לא ניתן להפיק מסמך ללא שורות פריט.",
  INV_CUSTOMER_REQUIRED: "יש לבחור לקוח לפני הפקת המסמך.",
  INV_TYPE_NOT_ALLOWED: "סוג מסמך זה אינו מותר עבור סוג העסק שלך.",
  INV_CREDIT_NEEDS_PARENT: "מסמך זיכוי חייב להיות מקושר למסמך אב מופק, עם נימוק זיכוי.",
  INV_CREDIT_OF_CREDIT: "לא ניתן להפיק מסמך זיכוי כנגד מסמך זיכוי אחר.",
  INV_CREDIT_EXCEEDS_PARENT: "סכום הזיכוי חורג מהיתרה שנותרה במסמך האב.",
  INV_PAYMENTS_MISMATCH: "סכום התקבולים אינו תואם את הסכום לתשלום במסמך.",
  INV_NO_VAT_RATE: 'לא נמצא שיעור מע"מ בתוקף לתאריך ההפקה.',
  INV_NO_SIGNING_KEY: "לעסק אין מפתח חתימה פעיל — לא ניתן להפיק מסמכים כרגע.",

  // app.set_start_number() (0008_issue_function.sql, ADR-INV-001 Implementation Notes #7)
  INV_NOT_OWNER: "רק בעלים של העסק רשאי לקבוע את מספר ההתחלה של סדרת המספור.",
  INV_COUNTER_ALREADY_STARTED: "כבר הופק מסמך בסדרה זו — לא ניתן לשנות את מספר ההתחלה.",
};

const DEFAULT_MESSAGE = "אירעה שגיאה בלתי צפויה. נסו שוב, ואם הבעיה חוזרת פנו לתמיכה.";

/**
 * Extracts the `INV_*` code from a raw Postgres error message (format:
 * `"INV_CODE: free-text detail"`) and returns the matching Hebrew message. Falls back to a
 * generic Hebrew message for anything that isn't a recognized `INV_*` code — callers must
 * never surface a raw Postgres/stack-trace error string to the end user.
 */
export function toUserMessage(rawMessage: string | null | undefined): string {
  if (!rawMessage) {
    return DEFAULT_MESSAGE;
  }

  const match = rawMessage.match(/\b(INV_[A-Z_]+)\b/);
  if (!match) {
    return DEFAULT_MESSAGE;
  }

  const code = match[1] as string;
  return INV_ERROR_MESSAGES[code] ?? DEFAULT_MESSAGE;
}
