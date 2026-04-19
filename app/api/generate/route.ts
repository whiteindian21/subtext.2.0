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
    // ✅ ENV SAFETY
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

    // ✅ MESSAGE LENGTH LOGIC
    const isShort = text.length < 40;
    const isLong = text.length > 100;

    const analysisInstruction = isShort
      ? "Short message → focus on vibe + emotional signal."
      : isLong
      ? "Long message → analyze deeply (intent, tone, subtext)."
      : "Standard message → analyze tone and meaning.";

    const systemMessage = `You are SubText AI, an expert in text psychology.

${analysisInstruction}

Return STRICT JSON ONLY:
{
  "analysis": string,
  "tone": string,
  "hiddenMeaning": string,
  "suggestedVibe": string
}

NO markdown. ONLY JSON.`;

    let userPrompt = `Message:\n${text}`;
    if (context && context.trim()) {
      userPrompt += `\n\nContext: ${context}`;
    }

    // ✅ TIMEOUT CONTROL
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

    // ✅ SAFE JSON PARSE
    let parsed: DecodeResult;

    try {
      const raw = JSON.parse(aiText) as any;

      parsed = {
        analysis: String(raw.analysis || '').trim(),
        tone: String(raw.tone || 'unknown').trim(),
        hiddenMeaning: String(raw.hiddenMeaning || '').trim(),
        suggestedVibe: String(raw.suggestedVibe || 'neutral').trim(),
      };

      if (!parsed.analysis) throw new Error();

    } catch {
      parsed = {
        analysis: "Couldn't fully analyze this message. Try again.",
        tone: "unknown",
        hiddenMeaning: "Unclear meaning",
        suggestedVibe: "neutral",
      };
    }

    // ✅ SAFE CREDIT DEDUCTION
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
      result: parsed,
      type: 'decode',
    });

  } catch (err: any) {
    console.error('ROUTE ERROR:', err);

    return NextResponse.json(
      { error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
