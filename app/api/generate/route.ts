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

export async function POST(req: Request) {
  try {
    // ✅ ENV SAFETY (fixes GitHub CI failure)
    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: 'Missing DEEPSEEK_API_KEY' },
        { status: 500 }
      );
    }

    const body = await req.json();
    let { userId, text, context } = body;

    // ✅ VALIDATION
    if (!userId || !text) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ✅ USER CHECK
    const { data: userExists, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !userExists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ✅ DYNAMIC ANALYSIS
    const isShort = text.length < 40;
    const isLong = text.length > 100;

    const analysisInstruction = isShort
      ? "Short message → focus on vibe + emotional signal."
      : isLong
      ? "Long message → analyze nuance + subtext deeply."
      : "Standard message → analyze tone + meaning.";

    const systemMessage = `You are SubText AI, an expert in text psychology.
${analysisInstruction}

Return STRICT JSON:
{
  "analysis": string,
  "tone": string,
  "hiddenMeaning": string,
  "suggestedVibe": string
}

NO markdown. ONLY JSON.`;

    let userPrompt = `Message:\n${text}`;
    if (context?.trim()) {
      userPrompt += `\n\nContext: ${context}`;
    }

    // ✅ TIMEOUT HANDLING
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let aiText = '';

    try {
      const response = await fetch(DEEPSEEK_API_URL, {
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
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();

      aiText = data?.choices?.[0]?.message?.content || '';

      if (!aiText) throw new Error('Empty AI response');

    } catch (err: any) {
      if (err.name === 'AbortError') {
        return NextResponse.json(
          { error: 'AI timeout' },
          { status: 504 }
        );
      }

      console.error('AI ERROR:', err);

      return NextResponse.json(
        { error: 'AI request failed' },
        { status: 500 }
      );
    }

    // ✅ SAFE PARSE (no crashes)
    let parsedResult: DecodeResult;

    try {
      const raw = JSON.parse(aiText) as any;

      parsedResult = {
        analysis: String(raw.analysis || '').trim(),
        tone: String(raw.tone || 'unknown').trim(),
        hiddenMeaning: String(raw.hiddenMeaning || '').trim(),
        suggestedVibe: String(raw.suggestedVibe || 'neutral').trim(),
      };

      if (!parsedResult.analysis) throw new Error();

    } catch {
      parsedResult = {
        analysis: "Couldn't fully decode this message. Try rephrasing.",
        tone: "unknown",
        hiddenMeaning: "Unclear meaning",
        suggestedVibe: "neutral",
      };
    }

    // ✅ SAFE CREDIT DEDUCTION (won’t break app)
    try {
      await supabase.rpc('deduct_credits', {
        p_user_id: userId,
        p_amount: 1,
        p_type: 'decode',
      });
    } catch (err) {
      console.error('Credit deduction failed:', err);
    }

    return NextResponse.json({
      success: true,
      result: parsedResult,
      type: 'decode',
    });

  } catch (error: any) {
    console.error('Decode Route Error:', error);

    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
