import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import Tesseract from 'tesseract.js';

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
    const body = await req.json();
    let { userId, text, context, screenshot } = body;

    // 1. Validation
    if (!userId || !text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      }
    }

    // 4. Dynamic Prompting Logic (Decode)
    const isShortMessage = text.length < 40;
    const isLongMessage = text.length > 100;

    let analysisInstruction = '';
    if (isShortMessage) {
      analysisInstruction = "This is a very short message (like 'k' or 'ok'). Focus on the 'vibe check' and immediate emotional implication. Be concise.";
    } else if (isLongMessage) {
      analysisInstruction = "This is a long or complex message. Analyze the nuance, potential subtext, and the specific emotional state behind the words.";
    } else {
      analysisInstruction = "Analyze the standard meaning and subtext of this message.";
    }

    const systemMessage = `You are SubText AI, an expert in text psychology and relationship decoding.
 ${analysisInstruction}

Analyze the user's message and respond with a JSON object containing:
- "analysis": A bold explanation of what is really happening (2 sentences max for short texts, 3-4 for long texts).
- "tone": The detected emotional tone (e.g., dismissive, flirty, anxious, neutral).
- "hiddenMeaning": What they actually mean but aren't saying directly (1 sentence).
- "suggestedVibe": The recommended energy level for the user's reply (e.g., "match energy", "playful", "serious").

Return ONLY valid JSON. No markdown.`;

    let userPrompt = `Decode this message: "${text}"`;
    if (context) userPrompt += `\nUser Context: ${context}`;
    if (extractedScreenshotText) userPrompt += `\nScreenshot Context: ${extractedScreenshotText}`;

    // 5. Call AI
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
          temperature: 0.7, // Slightly lower temp for factual analysis
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

    // 6. Parse Response
    let parsedResult: DecodeResult;
    try {
      const raw = JSON.parse(aiResponseText);
      
      // Basic validation
      if (!raw.analysis || !raw.tone || !raw.hiddenMeaning) {
        throw new Error('Missing required fields in AI response');
      }

      parsedResult = {
        analysis: String(raw.analysis).trim(),
        tone: String(raw.tone).trim(),
        hiddenMeaning: String(raw.hiddenMeaning).trim(),
        suggestedVibe: String(raw.suggestedVibe || 'neutral').trim()
      };
    } catch (parseError) {
      console.error('JSON Parse error:', parseError);
      // Fallback
      parsedResult = {
        analysis: "Unable to process complex analysis due to format error.",
        tone: "unknown",
        hiddenMeaning: "Check the message manually.",
        suggestedVibe: "neutral"
      };
    }

    // 7. Deduct Credits
    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: 1,
      p_type: 'decode'
    });

    if (deductError || deductResult === false) {
      return NextResponse.json({ error: 'Insufficient credits or deduction failed' }, { status: 403 });
    }

    // 8. Return
    return NextResponse.json({
      success: true,
      result: parsedResult,
      type: 'decode'
    });

  } catch (error: any) {
    console.error('Decode Route Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}