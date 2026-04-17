import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import Tesseract from 'tesseract.js';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

interface ReplyResult {
  replies: Array<{ text: string; tone: string; explanation?: string }>;
}

// Interface to handle the raw JSON structure from AI and fix TypeScript errors
interface RawAIResponse {
  replies: Array<{ text?: unknown; tone?: unknown; explanation?: unknown }>;
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

    // 2. Verify User
    const { data: userExists, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (userError || !userExists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 3. OCR (Image to Text)
    let extractedScreenshotText = '';
    if (screenshot && screenshot.startsWith('data:image/')) {
      try {
        const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
        extractedScreenshotText = text.trim();
      } catch (ocrError) {
        console.error('OCR failed:', ocrError);
        // Continue without OCR if it fails
      }
    }

    // 4. Dynamic Prompting Logic (Length based)
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
Your task is to generate 5 reply options in a ${toneMap[tone]} tone.
 ${lengthInstruction}

Return a STRICT JSON object with a "replies" array containing objects with:
- "text": The actual reply string.
- "tone": Specific sub-tone used (e.g., "teasing", "caring", "cold").
- "explanation": Brief reason why this works (optional).

Return ONLY valid JSON. No markdown formatting.`;

    let userPrompt = `Original Message: "${text}"\nTarget Tone: ${tone}`;
    if (context) userPrompt += `\nContext: ${context}`;
    if (extractedScreenshotText) userPrompt += `\nContext from Screenshot: ${extractedScreenshotText}`;

    // 5. Call AI
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
    
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

    // 6. Parse Response (With TypeScript Fix)
    let parsedResult: ReplyResult;
    try {
      // Cast to RawAIResponse to satisfy TypeScript
      const raw = JSON.parse(aiResponseText) as RawAIResponse;
      
      if (!Array.isArray(raw.replies)) throw new Error('Invalid JSON structure');
      
      // Map over the array safely. 'r' is now correctly typed as the interface item.
      parsedResult = { replies: raw.replies.slice(0, 5).map((r) => ({
        text: String(r.text || '').trim(),
        tone: String(r.tone || tone).trim(),
        explanation: r.explanation ? String(r.explanation).trim() : undefined
      }))};
    } catch (parseError) {
      console.error('JSON Parse error, attempting fallback:', parseError);
      // Fallback if JSON fails
      parsedResult = {
        replies: [{ 
          text: aiResponseText.replace(/[^a-zA-Z0-9\s!?.,]/g, '').substring(0, 100), 
          tone: tone, 
          explanation: 'Standard reply' 
        }]
      };
    }

    // 7. Deduct Credits
    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: 1,
      p_type: 'reply'
    });

    if (deductError || deductResult === false) {
      return NextResponse.json({ error: 'Insufficient credits or deduction failed' }, { status: 403 });
    }

    // 8. Return
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