import { NETWORK_MESSAGE } from "@/lib/errors";

const GENERIC_MESSAGE = "משהו השתבש. נסו שוב, ואם הבעיה חוזרת פנו לתמיכה.";

/** Ordered so the first matching pattern wins; keep specific patterns before generic ones. */
const KNOWN_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /invalid login credentials/i, message: "אימייל או סיסמה שגויים." },
  {
    pattern: /user already registered/i,
    message: "כבר קיים משתמש עם כתובת האימייל הזו. נסו להתחבר.",
  },
  { pattern: /password should be at least/i, message: "הסיסמה קצרה מדי — נדרשים לפחות 6 תווים." },
  { pattern: /unable to validate email address/i, message: "כתובת האימייל אינה תקינה." },
  { pattern: /rate limit/i, message: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות." },
  { pattern: /fetch failed|failed to fetch|networkerror/i, message: NETWORK_MESSAGE },
];

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

/**
 * Translates Supabase Auth error messages (always English, undocumented as a
 * stable contract) into user-facing Hebrew copy. Unrecognized errors fall back
 * to a generic message rather than leaking raw English/implementation detail.
 */
export function mapAuthError(error: unknown): string {
  const message = extractMessage(error);
  if (!message) return GENERIC_MESSAGE;

  const match = KNOWN_PATTERNS.find(({ pattern }) => pattern.test(message));
  return match ? match.message : GENERIC_MESSAGE;
}
