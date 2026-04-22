import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Reply {
  text: string;
  tone: string;
  score: number;
  intent: string;
}

interface ReplyResult {
  replies: Reply[];
}

interface ParsedContext {
  suggestedVibe?: string;
  hiddenMeaning?: string;
  analysis?: string;
  emotionalIntensity?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_TONES = [
  'confident', 'funny', 'savage', 'chill', 'sarcastic',
  'romantic', 'supportive', 'dry', 'energetic', 'mysterious',
  'apologetic', 'flirty',
] as const;

type ValidTone = typeof VALID_TONES[number];

const REPLY_PERSONALITIES = [
  { label: 'Confident', description: 'calm, grounded, self-assured — does not chase' },
  { label: 'Playful', description: 'teasing, light tension, slightly flirty — keeps it fun' },
  { label: 'Curious', description: 'pulls them in with a question — creates intrigue' },
  { label: 'Honest', description: 'shows genuine emotion or vulnerability — real, not scripted' },
  { label: 'Bold', description: 'slightly risky, unexpected — makes them stop and think' },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractJSON(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
  }
  return null;
}

async function fetchWithRetry(
  fetchFn: () => Promise<Response>,
  retries = 2,
  delayMs = 400
): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchFn();
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (i < retries) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
  }
  throw lastError;
}

function sanitizeText(text: string): string {
  return text.trim().slice(0, 3000);
}

function parseContext(context: string | undefined): ParsedContext {
  if (!context?.trim()) return {};
  const result: ParsedContext = {};

  const patterns: Array<[keyof ParsedContext, RegExp]> = [
    ['suggestedVibe', /\[Suggested Vibe\]\s*(.*?)(?:\n|$)/i],
    ['hiddenMeaning', /\[Hidden Meaning\]\s*(.*?)(?:\n|$)/i],
    ['analysis', /\[Decoded Analysis\]\s*(.*?)(?:\n|$)/i],
    ['emotionalIntensity', /\[Emotional Intensity\]\s*(.*?)(?:\n|$)/i],
  ];

  for (const [key, regex] of patterns) {
    const match = context.match(regex);
    if (match) result[key] = match[1].trim();
  }

  return result;
}

function extractLastMessage(text: string): string | null {
  const matches = text.match(/Other:\s*([\s\S]*?)(?=\n(?:User:|Other:)|\n*$)/g);
  if (!matches?.length) return null;
  return matches[matches.length - 1].replace(/^Other:\s*/, '').trim();
}

function getLengthInstruction(totalLength: number): string {
  if (totalLength < 80) return 'Each reply must be under 12 words. Short and punchy.';
  if (totalLength > 300) return 'Each reply should be 2–3 sentences. Thoughtful but not over-explaining.';
  return 'Each reply should be 1–2 sentences. Natural texting length.';
}

function buildFallbackReplies(tone: string): ReplyResult {
  return {
    replies: [
      { text: "honestly not sure how to respond to that…", tone, score: 0, intent: 'neutral' },
    ],
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── 1. Env check ──
  if (!DEEPSEEK_API_KEY) {
    console.error('[reply] Missing DEEPSEEK_API_KEY');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // ── 2. Parse + validate body ──
  let userId: string, text: string, tone: string, context: string | undefined;
  try {
    ({ userId, text, tone, context } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'Missing or empty text' }, { status: 400 });
  }
  if (!tone || typeof tone !== 'string') {
    return NextResponse.json({ error: 'Missing tone' }, { status: 400 });
  }

  // ── 3. Normalize tone ──
  const normalizedTone: ValidTone = VALID_TONES.includes(
    tone.toLowerCase().trim() as ValidTone
  )
    ? (tone.toLowerCase().trim() as ValidTone)
    : 'chill';

  const cleanText = sanitizeText(text);
  const decoded = parseContext(context);

  // ── 4. Verify user + credits ──
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('id, credits')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if ((user.credits ?? 0) < 1) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
  }

  // ── 5. Build conversation context ──
  const lastMessage = extractLastMessage(cleanText);
  const conversationContext = lastMessage
    ? `Conversation:\n${cleanText}\n\nYou are replying to:\n"${lastMessage}"`
    : `Message:\n${cleanText}`;

  const totalLength = cleanText.length + (context?.length ?? 0);
  const lengthInstruction = getLengthInstruction(totalLength);

  // ── 6. Build prompt ──
  const personalitiesBlock = REPLY_PERSONALITIES.map(
    (p, i) => `${i + 1}. ${p.label} → ${p.description}`
  ).join('\n');

  const systemMessage = `
You are SubText AI — an expert in attraction psychology, emotional intelligence, and modern texting.

Your job is to generate 5 replies that each feel like a DIFFERENT person wrote them.
Each reply must move the conversation forward and make the other person WANT to respond.

---

CONTEXT FROM DECODE:
- Hidden meaning: ${decoded.hiddenMeaning ?? 'not provided'}
- Emotional tone: ${decoded.analysis ?? 'not provided'}
- Suggested vibe: ${decoded.suggestedVibe ?? 'not provided'}
- Emotional intensity: ${decoded.emotionalIntensity ?? 'not provided'}
- User's target tone: ${normalizedTone}

---

GENERATE 5 REPLIES WITH THESE PERSONALITIES:
${personalitiesBlock}

---

RULES:
- No robotic phrasing. If it sounds like AI, rewrite it.
- No generic openers like "I understand", "that's fair", "I hear you"
- No over-explaining or justifying
- No needy or desperate energy
- Lowercase is fine — this is texting, not an email
- At least 3 replies must create curiosity or naturally invite a response
- Each reply must feel emotionally distinct from the others

---

${lengthInstruction}

---

OUTPUT STRICT JSON ONLY — no markdown, no explanation:
{
  "replies": [
    {
      "text": "the reply text",
      "tone": "personality label in lowercase",
      "score": number 1-100 (how likely this gets a response),
      "intent": "one phrase describing what this reply accomplishes"
    }
  ]
}
`.trim();

  const userPrompt = `${conversationContext}\n\nTarget tone: ${normalizedTone}`;

  // ── 7. Call AI ──
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let aiText = '';

  try {
    const response = await fetchWithRetry(() =>
      fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.8,
          max_tokens: 800,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })
    );

    clearTimeout(timeout);

    const data = await response.json();
    aiText = data?.choices?.[0]?.message?.content ?? '';

    if (!aiText) throw new Error('Empty AI response');
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'AI request timed out' }, { status: 504 });
    }
    console.error('[reply] AI call failed:', err);
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 });
  }

  // ── 8. Parse + validate replies ──
  const raw = extractJSON(aiText);
  let parsed: ReplyResult;

  if (raw && Array.isArray(raw.replies) && raw.replies.length > 0) {
    const replies: Reply[] = (raw.replies as Record<string, unknown>[])
      .slice(0, 5)
      .map((r) => ({
        text: String(r.text ?? '').trim(),
        tone: String(r.tone ?? normalizedTone).trim(),
        score: typeof r.score === 'number'
          ? Math.min(100, Math.max(0, Math.round(r.score)))
          : 50,
        intent: String(r.intent ?? '').trim(),
      }))
      .filter((r) => r.text.length > 0);

    if (replies.length === 0) {
      parsed = buildFallbackReplies(normalizedTone);
    } else {
      // Sort best reply first
      replies.sort((a, b) => b.score - a.score);
      parsed = { replies };
    }
  } else {
    parsed = buildFallbackReplies(normalizedTone);
  }

  // ── 9. Deduct credits only on success ──
  const replySucceeded =
    parsed.replies.length > 0 &&
    parsed.replies[0].text !== buildFallbackReplies(normalizedTone).replies[0].text;

  if (replySucceeded) {
    const { error: deductError } = await supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: 1,
      p_type: 'reply',
    });

    if (deductError) {
      console.error('[reply] Credit deduction failed:', deductError);
    }
  }

  // ── 10. Respond ──
  return NextResponse.json({
    success: replySucceeded,
    result: parsed,
    type: 'reply',
  });
}
