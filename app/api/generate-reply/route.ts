import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

interface ReplyResult {
  replies: Array<{ text: string; tone: string; explanation?: string }>;
}

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
    // ✅ ENV SAFETY (fixes GitHub CI failure)
    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: 'Missing DEEPSEEK_API_KEY' },
        { status: 500 }
      );
    }

    const body = await req.json();
    let { userId, text, tone, context } = body;

    // ✅ VALIDATION
    if (!userId || !text || !tone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    tone = tone.toLowerCase();

    const validTones = [
      'confident', 'funny', 'savage', 'chill', 'sarcastic', 'romantic',
      'supportive', 'dry', 'energetic', 'mysterious', 'apologetic', 'flirty'
    ];

    if (!validTones.includes(tone)) {
      return NextResponse.json({ error: 'Invalid tone' }, { status: 400 });
    }

    // ✅ CONTEXT PARSING
    const decoded = parseContext(context);
    let effectiveTone = tone;

    if (decoded.suggestedVibe) {
      const vibeToToneMap: Record<string, string> = {
        serious: 'confident',
        playful: 'funny',
        romantic: 'romantic',
        sarcastic: 'sarcastic',
        aggressive: 'savage',
        casual: 'chill',
        caring: 'supportive',
        energetic: 'energetic',
        mysterious: 'mysterious',
        apologetic: 'apologetic',
        flirty: 'flirty',
      };

      const mappedTone = vibeToToneMap[decoded.suggestedVibe];
      if (mappedTone) effectiveTone = mappedTone;
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

    // ✅ LENGTH LOGIC
    const isShort = text.length < 50;
    const isLong = text.length > 120;

    const lengthInstruction = isShort
      ? "Short reply under 15 words."
      : isLong
      ? "Detailed reply (2-3 sentences)."
      : "Normal reply (1-2 sentences).";

    const toneMap: Record<string, string> = {
      confident: "confident and high-value",
      funny: "witty and playful",
      savage: "slightly aggressive",
      chill: "casual and relaxed",
      sarcastic: "sarcastic and deadpan",
      romantic: "affectionate and flirty",
      supportive: "empathetic",
      dry: "short and blunt",
      energetic: "excited and expressive",
      mysterious: "intriguing and vague",
      apologetic: "remorseful",
      flirty: "playful and teasing",
    };

    // ✅ FIXED REGEX (no 's' flag)
    const matches = text.match(/Other:\s*([\s\S]*?)(?=\n(?:User:|Other:)|\n*$)/g);

    let conversationContext = text;

    if (matches && matches.length > 0) {
      const last = matches[matches.length - 1]
        .replace(/^Other:\s*/, '')
        .trim();

      conversationContext = `Conversation:\n${text}\n\nLast message: "${last}"`;
    }

    const systemMessage = `Generate 5 replies in a ${toneMap[effectiveTone]} tone. ${lengthInstruction}`;
    const userPrompt = `${conversationContext}\nTone: ${effectiveTone}`;

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
          temperature: 0.8,
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

    // ✅ SAFE PARSING
    let parsed: ReplyResult;

    try {
      const raw = JSON.parse(aiText) as any;

      parsed = {
        replies: Array.isArray(raw.replies)
          ? raw.replies.slice(0, 5).map((r: any) => ({
              text: String(r.text || '').trim(),
              tone: String(r.tone || effectiveTone),
              explanation: r.explanation
                ? String(r.explanation)
                : undefined,
            }))
          : [],
      };

      if (parsed.replies.length === 0) throw new Error();

    } catch {
      parsed = {
        replies: [
          {
            text: aiText.slice(0, 120),
            tone: effectiveTone,
          },
        ],
      };
    }

    // ✅ CREDIT DEDUCTION (SAFE)
    try {
      await supabase.rpc('deduct_credits', {
        p_user_id: userId,
        p_amount: 1,
        p_type: 'reply',
      });
    } catch (err) {
      console.error('Credit deduction failed:', err);
    }

    return NextResponse.json({
      success: true,
      result: parsed,
    });

  } catch (err: any) {
    console.error('ROUTE ERROR:', err);

    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}
