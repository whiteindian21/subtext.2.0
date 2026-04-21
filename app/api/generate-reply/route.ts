import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

interface Reply {
  text: string;
  tone: string;
  score: number;
}

interface ReplyResult {
  replies: Reply[];
}

// ✅ Safe JSON extraction
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

// ✅ Context parser
function parseContext(context: string) {
  const result: any = {};
  if (!context) return result;

  const vibeMatch = context.match(/\[Suggested Vibe\]\s*(.*?)(?:\n|$)/i);
  if (vibeMatch) result.suggestedVibe = vibeMatch[1].trim().toLowerCase();

  const hiddenMatch = context.match(/\[Hidden Meaning\]\s*(.*?)(?:\n|$)/i);
  if (hiddenMatch) result.hiddenMeaning = hiddenMatch[1].trim();

  const analysisMatch = context.match(/\[Decoded Analysis\]\s*(.*?)(?:\n|$)/i);
  if (analysisMatch) result.analysis = analysisMatch[1].trim();

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

    // ✅ Normalize tone
    let normalizedTone = String(tone).toLowerCase().trim();

    const validTones = [
      'confident','funny','savage','chill','sarcastic','romantic',
      'supportive','dry','energetic','mysterious','apologetic','flirty'
    ];

    if (!validTones.includes(normalizedTone)) {
      normalizedTone = 'chill';
    }

    // ✅ User check
    const { data: user } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const decoded = parseContext(context);

    // ✅ Extract last message
    const matches = text.match(/Other:\s*([\s\S]*?)(?=\n(?:User:|Other:)|\n*$)/g);

    let conversationContext = text;

    if (matches && matches.length > 0) {
      const last = matches[matches.length - 1]
        .replace(/^Other:\s*/, '')
        .trim();

      conversationContext = `Conversation:\n${text}\n\nReply to:\n"${last}"`;
    }

    // ✅ Smart length logic
    const totalLength = (text + (context || '')).length;

    const isShort = totalLength < 80;
    const isLong = totalLength > 200;

    const lengthInstruction = isShort
      ? "Replies must be under 12 words."
      : isLong
      ? "Replies should be 2–3 thoughtful sentences."
      : "Replies should be 1–2 sentences.";

    // 🔥 FINAL EMOTION + INTELLIGENCE PROMPT
    const systemMessage = `
You are SubText AI — an expert in texting, attraction psychology, and emotional intelligence.

Your goal is to generate replies that feel REAL, EMOTIONAL, and ENGAGING.

---

STEP 1: Understand deeply (internal)
- what are they feeling?
- what do they actually mean?
- what is the emotional tension?

---

STEP 2: Respond with intent
Each reply must:
- move the conversation forward
- create engagement (not dead-end)
- either reduce tension OR build attraction

---

RULES:
- no robotic phrasing
- no generic replies like "I understand"
- no boring or safe replies
- no over-explaining
- avoid needy energy

---

STYLE:
- casual texting tone
- lowercase is fine
- emotion should feel natural, not forced

---

EMOTIONAL DEPTH:
- reflect their emotion when needed
- if tension exists, lean into it slightly
- allow subtle vulnerability when appropriate
- DO NOT play it safe

---

CONVERSATION PULL:
- at least 2 replies must create curiosity or invite a response
- avoid replies that end the conversation

---

DIVERSITY (IMPORTANT):
Generate 5 replies with DISTINCT emotional energy:

1. Confident → calm, grounded, self-assured  
2. Playful → teasing, light tension, slightly flirty  
3. Curious → pulls them in with a question  
4. Emotional → shows understanding or honesty  
5. Bold → slightly risky, intriguing, unexpected  

Each reply must feel like a DIFFERENT personality.

---

QUALITY CHECK:
If it sounds like AI → rewrite it.

Replies should make the other person WANT to respond.

---

${lengthInstruction}

---

CONTEXT:
Hidden meaning: ${decoded.hiddenMeaning || 'unknown'}
Analysis: ${decoded.analysis || 'unknown'}

---

OUTPUT STRICT JSON:
{
  "replies": [
    { "text": "...", "tone": "${normalizedTone}", "score": number }
  ]
}
`;

    const userPrompt = `
${conversationContext}

Target tone: ${normalizedTone}
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
            temperature: 0.75, // 🔥 slightly higher = more emotion
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

    // ✅ Parse safely
    let parsed: ReplyResult;

    const raw = extractJSON(aiText);

    if (raw && Array.isArray(raw.replies)) {
      const replies = raw.replies.slice(0, 5).map((r: any) => ({
        text: String(r.text || '').trim(),
        tone: normalizedTone,
        score: Number(r.score || 0),
      }));

      // ⭐ Sort by best reply first
      replies.sort((a: Reply, b: Reply) => b.score - a.score);

      parsed = { replies };

    } else {
      parsed = {
        replies: [
          { text: "not sure what to say here…", tone: normalizedTone, score: 0 }
        ],
      };
    }

    // ✅ Deduct credits
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
