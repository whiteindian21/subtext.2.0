import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

interface ReplyResult {
  replies: Array<{ text: string; tone: string; explanation?: string }>;
}

interface RawAIResponse {
  replies: Array<{ text?: unknown; tone?: unknown; explanation?: unknown }>;
}

function parseContext(context: string): {
  suggestedVibe?: string;
  hiddenMeaning?: string;
  analysis?: string;
} {
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
    const body = await req.json();
    let { userId, text, tone, context } = body;

    if (!userId || !text || !tone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    tone = tone.toLowerCase();
    const validTones = [
      'confident', 'funny', 'savage', 'chill', 'sarcastic', 'romantic',
      'supportive', 'dry', 'energetic', 'mysterious', 'apologetic', 'flirty'
    ];

    if (!validTones.includes(tone)) {
      return NextResponse.json({ error: 'Invalid tone' }, { status: 400 });
    }

    const decoded = parseContext(context);
    let effectiveTone = tone;
    let overrideInstruction = '';

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

      if (mappedTone && mappedTone !== tone) {
        effectiveTone = mappedTone;
        overrideInstruction = `NOTE: The context strongly suggests a "${decoded.suggestedVibe}" vibe. Even though the user requested a "${tone}" tone, prioritize the "${decoded.suggestedVibe}" vibe.`;
      }
    }

    const { data: userExists, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !userExists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isShortMessage = text.length < 50;
    const isLongMessage = text.length > 120;

    let lengthInstruction = '';
    if (isShortMessage) {
      lengthInstruction = "Short reply under 15 words.";
    } else if (isLongMessage) {
      lengthInstruction = "Detailed reply (2-3 sentences).";
    } else {
      lengthInstruction = "Normal reply (1-2 sentences).";
    }

    const toneMap: Record<string, string> = {
      confident: "confident and high-value",
      funny: "witty and playful",
      savage: "slightly aggressive and unbothered",
      chill: "casual and relaxed",
      sarcastic: "sarcastic and deadpan",
      romantic: "affectionate and flirty",
      supportive: "empathetic and encouraging",
      dry: "short and blunt",
      energetic: "excited and expressive",
      mysterious: "intriguing and vague",
      apologetic: "remorseful and sincere",
      flirty: "playful and teasing",
    };

    let conversationContext = text;
    let lastOtherMessage = '';

    // ✅ FIXED REGEX HERE (removed 's' flag)
    const otherMatches = text.match(/Other:\s*([\s\S]*?)(?=\n(?:User:|Other:)|\n*$)/g);

    if (otherMatches && otherMatches.length > 0) {
      lastOtherMessage = otherMatches[otherMatches.length - 1]
        .replace(/^Other:\s*/, '')
        .trim();

      conversationContext = `Full conversation:\n${text}\n\nMost recent message: "${lastOtherMessage}"`;
    } else {
      lastOtherMessage = text;
      conversationContext = `Message: "${text}"`;
    }

    const systemMessage = `Generate 5 replies in a ${toneMap[effectiveTone]} tone. ${lengthInstruction}`;

    const userPrompt = `${conversationContext}\nTone: ${effectiveTone}`;

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    const aiText = data.choices[0]?.message?.content;

    let parsed: ReplyResult;

    try {
      const raw = JSON.parse(aiText);
      parsed = { replies: raw.replies.slice(0, 5) };
    } catch {
      parsed = {
        replies: [{
          text: aiText,
          tone: effectiveTone
        }]
      };
    }

    await supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: 1,
      p_type: 'reply'
    });

    return NextResponse.json({ success: true, result: parsed });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
