import { DEMO_RESPONSE, DEMO_RESPONSE_AFTER_ANSWER } from '@/lib/identify/demo-response';
import { IDENTIFY_MODEL, buildSystemPrompt } from '@/lib/identify/prompt';
import { type IdentifyResponse, IdentifyResponseSchema } from '@/lib/identify/schema';
import Anthropic from '@anthropic-ai/sdk';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_PREFIX = 'image/';
const DEMO_LATENCY_MS = 1200;

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function shouldUseDemoMode(req: NextRequest): boolean {
  const url = new URL(req.url);
  if (url.searchParams.get('demo') === 'true') return true;
  if (process.env.ANTHROPIC_API_KEY === undefined || process.env.ANTHROPIC_API_KEY === '')
    return true;
  return false;
}

async function callClaudeVision(
  photoBase64: string,
  mediaType: string,
  disambiguationAnswer: string | null,
): Promise<IdentifyResponse> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: IDENTIFY_MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(disambiguationAnswer ?? undefined),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: photoBase64,
            },
          },
          {
            type: 'text',
            text: 'Identify this warehouse item against the seeded catalog. Respond in strict JSON per the system instructions.',
          },
        ],
      },
    ],
  });

  // Extract the model's text reply (Claude may return tool_use or text blocks; we asked for JSON in text).
  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content block');
  }

  const rawText = textBlock.text.trim();
  // Strip a possible ```json fence the model may have added despite instructions.
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude response was not valid JSON. Got: ${cleaned.slice(0, 200)}`);
  }

  // Inject the mode marker before validating — `mode` is required by the schema.
  if (typeof parsed === 'object' && parsed !== null) {
    (parsed as Record<string, unknown>).mode = 'live';
  }

  return IdentifyResponseSchema.parse(parsed);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Demo-mode short-circuit. Returns the canned response after a small artificial delay.
  if (shouldUseDemoMode(req)) {
    const url = new URL(req.url);
    const hadAnswerParam = url.searchParams.get('answered') === 'true';
    await new Promise((resolve) => setTimeout(resolve, DEMO_LATENCY_MS));
    console.log(
      '[identify] demo-mode response served',
      hadAnswerParam ? '(after disambiguation)' : '(initial)',
    );
    return NextResponse.json(hadAnswerParam ? DEMO_RESPONSE_AFTER_ANSWER : DEMO_RESPONSE);
  }

  // Real-API path — parse multipart form data.
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError(400, 'Could not parse multipart form data');
  }

  const photo = formData.get('photo');
  const disambiguationAnswer = formData.get('disambiguationAnswer');
  const answerString =
    typeof disambiguationAnswer === 'string' && disambiguationAnswer.length > 0
      ? disambiguationAnswer
      : null;

  if (!(photo instanceof File)) {
    return jsonError(400, 'photo required');
  }
  if (!photo.type.startsWith(ALLOWED_PREFIX)) {
    return jsonError(415, `Unsupported media type: ${photo.type}`);
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return jsonError(413, `Photo exceeds ${MAX_PHOTO_BYTES} bytes`);
  }

  const photoBuffer = Buffer.from(await photo.arrayBuffer());
  const photoBase64 = photoBuffer.toString('base64');

  try {
    const response = await callClaudeVision(photoBase64, photo.type, answerString);
    return NextResponse.json(response);
  } catch (err) {
    // On any real-API failure, fall through to demo-mode rather than 500-ing the UI.
    // This keeps a screencast viable even if the API key is rotated mid-recording.
    const errMessage = err instanceof Error ? err.message : String(err);
    console.warn('[identify] real-API call failed; falling back to demo-mode:', errMessage);
    return NextResponse.json(answerString ? DEMO_RESPONSE_AFTER_ANSWER : DEMO_RESPONSE, {
      headers: { 'X-Identify-Fallback': 'demo-on-error' },
    });
  }
}
