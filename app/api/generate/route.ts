import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

interface DecodeResult {
  analysis: string;
  tone: string;
  hiddenMeaning: string;
  suggestedVibe: string;
}

// ✅ safer JSON extraction (handles messy AI output)
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

// ✅ retry wrapper (VERY IMPORTANT for reliability)
async function fetchWithRetry(fetchFn: () => Promise<Response>, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchFn();
      if (res.ok) return res;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Failed after retries');
}

export async function POST(req: Request) {
  try {
    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
    }

    const { userId, text, context } = await req.json();

    if (!userId || !text) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // ✅ Check user
    const { data: user } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ✅ smarter instruction
    const systemMessage = `
You are SubText AI, an expert in human communication and emotional intelligence.

Analyze the message deeply and return ONLY JSON.

Rules:
- Be concise but insightful
- Focus on emotional intent
- Avoid generic responses

Format:
{
  "analysis": "clear explanation",
  "tone": "one word or short phrase",
  "hiddenMeaning": "what they really mean",
  "suggestedVibe": "how the user should respond"
}
`;

    let prompt = `Message:\n${text}`;
    if (context?.trim()) {
      prompt += `\n\nContext:\n${context}`;
    }

    // ✅ API CALL WITH RETRY
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
              { role: 'user', content: prompt },
            ],
            temperature: 0.6, // slightly lower = more consistent
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

    // ✅ SAFE PARSE (IMPROVED)
    let parsed: DecodeResult;

    const raw = extractJSON(aiText);

    if (raw && raw.analysis) {
      parsed = {
        analysis: String(raw.analysis).trim(),
        tone: String(raw.tone || 'unknown').trim(),
        hiddenMeaning: String(raw.hiddenMeaning || '').trim(),
        suggestedVibe: String(raw.suggestedVibe || 'neutral').trim(),
      };
    } else {
      parsed = {
        analysis: "Couldn't analyze this message clearly.",
        tone: "unknown",
        hiddenMeaning: "unclear",
        suggestedVibe: "neutral",
      };
    }

    // ✅ ONLY deduct credits if success
    if (parsed.analysis && parsed.analysis !== "Couldn't analyze this message clearly.") {
      try {
        await supabase.rpc('deduct_credits', {
          p_user_id: userId,
          p_amount: 1,
          p_type: 'decode',
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      result: parsed,
      type: 'decode',
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
