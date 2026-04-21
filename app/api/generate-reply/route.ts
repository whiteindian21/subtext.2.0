import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

interface Reply {
  text: string;
  tone: string;
}

interface ReplyResult {
  replies: Reply[];
}

// ✅ Extract JSON safely (handles messy AI output)
function extractJSON(text: string) {
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

// ✅ Retry logic
async function fetchWithRetry(fetchFn: () => Promise<Response>, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchFn();
      if (res.ok) return res;
    } catch {}
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error('Failed after retries');
}

// ✅ Parse context (from decode route)
function parseContext(context: string) {
  const result: any = {};
  if (!context) return result;

  const vibeMatch = context.match(/\[Suggested Vibe\]\s*(.*?)(?:\n|$)/i);
  if (vibeMatch) result.suggestedVibe = vibeMatch[1].trim().toLowerCase();

  const hiddenMatch = context.match(/\[Hidden Meaning\]\s*(.*?)(?:\n|$)/i);
  if (hiddenMatch) result.hiddenMeaning = hiddenMatch[1].trim();

  return result;
}

export async function POST(req: Request) {
  try {
    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
    }

    const { userId, text, tone, context } = await req.json();

    if (!userId || !text || !tone) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const validTones = [
      'confident','funny','savage','chill','sarcastic','romantic',
      'supportive','dry','energetic','mysterious','apologetic','flirty'
    ];

    if (!validTones.includes(tone)) {
      return NextResponse.json({ error: 'Invalid tone' }, { status: 400 });
    }

    // ✅ user check
    const { data: user } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ✅ context influence
    const decoded = parseContext(context);

    let effectiveTone = tone;

    if (decoded.suggestedVibe) {
      const map: Record<string, string> = {
        serious: 'confident',
        playful: 'funny',
        romantic: 'romantic',
        sarcastic: 'sarcastic',
        aggressive: 'savage',
        casual: 'chill',
        caring: 'supportive',
      };

      if (map[decoded.suggestedVibe]) {
        effectiveTone = map[decoded.suggestedVibe];
      }
    }

    // ✅ length rules
    const isShort = text.length < 50;
    const isLong = text.length > 120;

    const lengthInstruction = isShort
      ? "Replies must be under 12 words."
      : isLong
      ? "Replies should be 2-3 short sentences."
      : "Replies should be 1-2 sentences.";

    const toneMap: Record<string, string> = {
      confident: "confident and composed",
      funny: "playful and witty",
      savage: "bold and slightly confrontational",
      chill: "casual and relaxed",
      sarcastic: "dry and sarcastic",
      romantic: "warm and flirty",
      supportive: "empathetic and caring",
      dry: "short and blunt",
      energetic: "excited and expressive",
      mysterious: "intriguing and slightly vague",
      apologetic: "sincere and accountable",
      flirty: "playful and teasing",
    };

    // ✅ extract last message if convo
    const matches = text.match(/Other:\s*([\s\S]*?)(?=\n(?:User:|Other:)|\n*$)/g);

    let conversationContext = text;

    if (matches && matches.length > 0) {
      const last = matches[matches.length - 1]
        .replace(/^Other:\s*/, '')
        .trim();

      conversationContext = `Conversation:\n${text}\n\nReply to:\n"${last}"`;
    }

    // 🔥 NEW POWERFUL PROMPT
    const systemMessage = `
You are SubText AI — an expert in modern texting, attraction psychology, and emotional intelligence.

Your job is to generate replies that are:
- natural
- emotionally aware
- context-sensitive
- actually worth sending

---

STEP 1: Understand the message
Before writing replies, internally figure out:
- what the other person is feeling
- what they actually mean (not just what they said)
- the emotional context (serious, playful, distant, upset, etc.)

---

STEP 2: Reply with intent
Each reply should have a clear purpose:
- move the conversation forward
- reduce tension OR build attraction
- show awareness without over-explaining

---

CORE RULES:
- never sound robotic or scripted
- avoid generic lines like:
  "I understand", "that makes sense", "I'm sorry you feel that way"
- avoid over-explaining or long paragraphs
- avoid try-hard or needy energy
- no emojis unless they feel natural

---

STYLE:
- casual, human texting tone
- lowercase is okay when natural
- subtle emotion > obvious emotion
- keep it short and clean

---

QUALITY BAR:
Every reply should feel like:
"yeah… that’s exactly what I should send"

If it sounds like AI, rewrite it.

---

DIVERSITY:
Generate 5 replies, each with a different angle:
- one confident
- one playful
- one curious
- one calm
- one bold

Each reply must feel DISTINCT, not reworded versions of the same idea.

---

LENGTH:
- short messages: under 12 words
- medium: 1 sentence
- long: max 2 short sentences

---

OUTPUT FORMAT (STRICT JSON):
{
  "replies": [
    { "text": "...", "tone": "..." }
  ]
}

    const userPrompt = `
${conversationContext}

Target tone: ${toneMap[effectiveTone]}
`;

    // ✅ API call
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
            temperature: 0.65,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        })
      );

      clearTimeout(timeout);

      const data = await response.json();
      aiText = data?.choices?.[0]?.message?.content || '';

      if (!aiText) throw new Error('Empty AI response');

    } catch (err: any) {
      if (err.name === 'AbortError') {
        return NextResponse.json({ error: 'AI timeout' }, { status: 504 });
      }

      return NextResponse.json({ error: 'AI failed' }, { status: 500 });
    }

    // ✅ parse safely
    let parsed: ReplyResult;

    const raw = extractJSON(aiText);

    if (raw && Array.isArray(raw.replies)) {
      parsed = {
        replies: raw.replies.slice(0, 5).map((r: any) => ({
          text: String(r.text || '').trim(),
          tone: String(r.tone || effectiveTone),
        })),
      };
    } else {
      parsed = {
        replies: [
          {
            text: "not sure what to say here…",
            tone: effectiveTone,
          },
        ],
      };
    }

    // ✅ deduct credits only if valid
    if (parsed.replies.length > 0) {
      try {
        await supabase.rpc('deduct_credits', {
          p_user_id: userId,
          p_amount: 1,
          p_type: 'reply',
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      result: parsed,
      type: 'reply',
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
