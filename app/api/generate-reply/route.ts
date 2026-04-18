import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import Tesseract from 'tesseract.js';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

interface ReplyResult {
  replies: Array<{ text: string; tone: string; explanation?: string }>;
}

interface RawAIResponse {
  replies: Array<{ text?: unknown; tone?: unknown; explanation?: unknown }>;
}

// Helper to parse the enhanced context
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
    let { userId, text, tone, context, screenshot } = body;

    // 1. Validation
    if (!userId || !text || !tone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    tone = tone.toLowerCase();
    const validTones = ['confident', 'funny', 'savage', 'chill', 'sarcastic', 'romantic'];
    if (!validTones.includes(tone)) {
      return NextResponse.json({ error: 'Invalid tone' }, { status: 400 });
    }

    // 2. Parse enhanced context for decoded insights
    const decoded = parseContext(context);
    let effectiveTone = tone;
    let overrideInstruction = '';

    if (decoded.suggestedVibe) {
      // Map suggested vibe to allowed tones (or use it as the primary directive)
      const vibeToToneMap: Record<string, string> = {
        serious: 'confident',   // or 'chill' – map as you like
        playful: 'funny',
        romantic: 'romantic',
        sarcastic: 'sarcastic',
        aggressive: 'savage',
        casual: 'chill',
      };
      // If the suggested vibe maps to a tone, optionally override the user's choice
      const mappedTone = vibeToToneMap[decoded.suggestedVibe];
      if (mappedTone && mappedTone !== tone) {
        effectiveTone = mappedTone;
        overrideInstruction = `NOTE: The context strongly suggests a "${decoded.suggestedVibe}" vibe. Even though the user requested a "${tone}" tone, you MUST prioritize the "${decoded.suggestedVibe}" vibe. Adjust your reply accordingly.`;
      } else if (!mappedTone) {
        // No direct mapping, but still instruct to follow the vibe
        overrideInstruction = `The context indicates the suggested vibe is "${decoded.suggestedVibe}". Follow that vibe over the requested tone "${tone}" if they conflict.`;
      }
    }

    // 3. Verify User
    const { data: userExists, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (userError || !userExists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 4. OCR (if screenshot provided)
    let extractedScreenshotText = '';
    if (screenshot && screenshot.startsWith('data:image/')) {
      try {
        const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
        extractedScreenshotText = text.trim();
      } catch (ocrError) {
        console.error('OCR failed:', ocrError);
      }
    }

    // 5. Dynamic Prompting Logic (Length based)
    const isShortMessage = text.length < 50;
    const isLongMessage = text.length > 120;

    let lengthInstruction = '';
    if (isShortMessage) {
      lengthInstruction = "The incoming message is very short. Generate extremely punchy, short replies (under 15 words). Use text slang if appropriate.";
    } else if (isLongMessage) {
      lengthInstruction = "The incoming message is long and complex. Generate detailed replies (2-3 sentences) that meaningfully address the content.";
    } else {
      lengthInstruction = "Generate standard text message replies (1-2 sentences, under 30 words).";
    }

    const toneMap: Record<string, string> = {
      confident: "confident, self-assured, and high-value",
      funny: "humorous, witty, and playful",
      savage: "slightly aggressive, roasting, and unbothered",
      chill: "casual, low-effort, and relaxed",
      sarcastic: "sarcastic, witty, and deadpan",
      romantic: "romantic, affectionate, and flirtatious"
    };

    const systemMessage = `You are SubText AI, a master of text message psychology.
Your task is to generate 5 reply options in a ${toneMap[effectiveTone]} tone.
${lengthInstruction}
${overrideInstruction ? `\n${overrideInstruction}\n` : ''}
${
  decoded.hiddenMeaning 
    ? `IMPORTANT CONTEXT: The hidden meaning of the original message is: "${decoded.hiddenMeaning}". Your replies should acknowledge or address this hidden meaning appropriately.\n`
    : ''
}
${
  decoded.analysis
    ? `Additional analysis: "${decoded.analysis}". Use this to craft replies that are psychologically astute.\n`
    : ''
}

Return a STRICT JSON object with a "replies" array containing objects with:
- "text": The actual reply string.
- "tone": Specific sub-tone used (e.g., "teasing", "caring", "cold").
- "explanation": Brief reason why this works (optional).

Return ONLY valid JSON. No markdown formatting.`;

    let userPrompt = `Original Message: "${text}"\nTarget Tone: ${effectiveTone}`;
    if (context) userPrompt += `\nAdditional Context: ${context}`;
    if (extractedScreenshotText) userPrompt += `\nContext from Screenshot: ${extractedScreenshotText}`;

    // 6. Call AI
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    let aiResponseText = '';
    try {
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
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);
      const data = await response.json();
      aiResponseText = data.choices[0]?.message?.content;
      if (!aiResponseText) throw new Error('Empty response from AI');
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({ error: 'AI service timeout' }, { status: 504 });
      }
      throw fetchError;
    }

    // 7. Parse Response
    let parsedResult: ReplyResult;
    try {
      const raw = JSON.parse(aiResponseText) as RawAIResponse;
      if (!Array.isArray(raw.replies)) throw new Error('Invalid JSON structure');
      
      parsedResult = { replies: raw.replies.slice(0, 5).map((r) => ({
        text: String(r.text || '').trim(),
        tone: String(r.tone || effectiveTone).trim(),
        explanation: r.explanation ? String(r.explanation).trim() : undefined
      }))};
    } catch (parseError) {
      console.error('JSON Parse error, attempting fallback:', parseError);
      parsedResult = {
        replies: [{ 
          text: aiResponseText.replace(/[^a-zA-Z0-9\s!?.,]/g, '').substring(0, 100), 
          tone: effectiveTone, 
          explanation: 'Standard reply' 
        }]
      };
    }

    // 8. Deduct Credits
    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: 1,
      p_type: 'reply'
    });

    if (deductError || deductResult === false) {
      return NextResponse.json({ error: 'Insufficient credits or deduction failed' }, { status: 403 });
    }

    // 9. Return
    return NextResponse.json({
      success: true,
      result: parsedResult,
      type: 'reply'
    });

  } catch (error: any) {
    console.error('Reply Route Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
