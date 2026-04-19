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
    const body = await req.json();
    let { userId, text, context } = body;  // removed screenshot

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

    // 3. Dynamic Prompting based on message length
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

    // 4. Build system prompt with conversation & question handling
    const systemMessage = `You are SubText AI, an expert in text psychology and relationship decoding.
${analysisInstruction}

The user may provide a conversation snippet with labels like "User:" (the person using this app) and "Other:" (the other person). Use these to understand who said what.

If the user asks a question in the "Context" field (e.g., "Am I overreacting?", "Is she being sarcastic?"), answer that question directly within your analysis.

Respond with a JSON object containing:
- "analysis": A bold explanation of what is really happening (2-4 sentences). If a question was asked, start with the answer.
- "tone": The detected emotional tone of the OTHER person's message (e.g., dismissive, flirty, anxious, neutral).
- "hiddenMeaning": What the OTHER person actually means but isn't saying directly (1 sentence).
- "suggestedVibe": The recommended energy level for the user's reply (e.g., "match energy", "playful", "serious").

Return ONLY valid JSON. No markdown.`;

    let userPrompt = `Conversation or message to analyze:\n${text}`;
    if (context && context.trim()) {
      userPrompt += `\n\nUser's context or question: ${context}`;
    }

    // 5. Call DeepSeek API
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
          temperature: 0.7,
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
