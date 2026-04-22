import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DecodeResult {
  analysis: string;
  tone: string;
  hiddenMeaning: string;
  suggestedVibe: string;
  emotionalIntensity: 'low' | 'medium' | 'high';
  redFlags: string[];
  confidence: number;
}

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
  delayMs = 500
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
  return text.trim().slice(0, 2000); // cap input length
}

function buildFallback(): DecodeResult {
  return {
    analysis: "Couldn't analyze this message clearly.",
    tone: 'unknown',
    hiddenMeaning: 'unclear',
    suggestedVibe: 'neutral',
    emotionalIntensity: 'low',
    redFlags: [],
    confidence: 0,
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── 1. Env check ──
  if (!DEEPSEEK_API_KEY) {
    console.error('[decode] Missing DEEPSEEK_API_KEY');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // ── 2. Parse + validate body ──
  let userId: string, text: string, context: string | undefined;
  try {
    ({ userId, text, context } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'Missing or empty text' }, { status: 400 });
  }

  const cleanText = sanitizeText(text);
  const cleanContext = context ? sanitizeText(context) : null;

  // ── 3. Verify user exists ──
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('id, credits')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // ── 4. Credits check BEFORE calling AI (saves API costs) ──
  if ((user.credits ?? 0) < 1) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
  }

  // ── 5. Build prompt ──
  const systemMessage = `
You are SubText AI — an expert in human psychology, attraction dynamics, and emotional intelligence.

Analyze the message and return ONLY valid JSON. No markdown, no explanation outside the JSON.

Go beyond surface-level. Ask yourself:
- What emotion is driving this message?
- What are they NOT saying?
- Is there tension, avoidance, testing, or interest?
- What does the phrasing, punctuation, and word choice reveal?

Return this exact JSON structure:
{
  "analysis": "2-3 sentences. Specific and insightful. Reference actual words or patterns from the message.",
  "tone": "single word or 2-word phrase (e.g. 'guarded', 'playfully distant', 'testing you')",
  "hiddenMeaning": "what they actually mean beneath the surface — be direct, not vague",
  "suggestedVibe": "how the user should emotionally respond (e.g. 'stay calm and pull back slightly', 'match their energy', 'show genuine interest')",
  "emotionalIntensity": "low | medium | high",
  "redFlags": ["array of specific concerns, or empty array if none"],
  "confidence": number between 0-100 representing how clear the intent is
}

Rules:
- Never give generic output like "they seem busy" or "they like you"
- Always reference specific words or patterns from the message
- If the message is ambiguous, say so in analysis and reflect it in confidence score
- redFlags should only appear if genuinely warranted — don't manufacture them
`.trim();

  const userPrompt = [
    `Message to decode:\n"${cleanText}"`,
    cleanContext ? `\nAdditional context:\n${cleanContext}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // ── 6. Call AI ──
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
          temperature: 0.55,
          max_tokens: 600,
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
    console.error('[decode] AI call failed:', err);
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 });
  }

  // ── 7. Parse response ──
  const raw = extractJSON(aiText);
  let parsed: DecodeResult;

  if (raw && typeof raw.analysis === 'string' && raw.analysis.length > 0) {
    parsed = {
      analysis: String(raw.analysis).trim(),
      tone: String(raw.tone ?? 'unknown').trim(),
      hiddenMeaning: String(raw.hiddenMeaning ?? '').trim(),
      suggestedVibe: String(raw.suggestedVibe ?? 'neutral').trim(),
      emotionalIntensity:
        raw.emotionalIntensity === 'low' ||
        raw.emotionalIntensity === 'medium' ||
        raw.emotionalIntensity === 'high'
          ? raw.emotionalIntensity
          : 'medium',
      redFlags: Array.isArray(raw.redFlags)
        ? (raw.redFlags as string[]).map(String).slice(0, 5)
        : [],
      confidence: typeof raw.confidence === 'number'
        ? Math.min(100, Math.max(0, Math.round(raw.confidence)))
        : 50,
    };
  } else {
    parsed = buildFallback();
  }

  // ── 8. Deduct credits only on successful decode ──
  const decodeSucceeded = parsed.analysis !== buildFallback().analysis;

  if (decodeSucceeded) {
    const { error: deductError } = await supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: 1,
      p_type: 'decode',
    });

    if (deductError) {
      // Log but don't fail — user got their result
      console.error('[decode] Credit deduction failed:', deductError);
    }
  }

  // ── 9. Respond ──
  return NextResponse.json({
    success: decodeSucceeded,
    result: parsed,
    type: 'decode',
  });
}
