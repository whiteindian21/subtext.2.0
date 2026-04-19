import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs'; // needed for Buffer

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
    }

    const formData = await req.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }
    if (!image.type?.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Convert image to base64
    const bytes = await image.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const dataUrl = `data:${image.type};base64,${base64}`;

    // Optional: warn if image is very large ( > 5MB base64 ≈ 3.7MB raw)
    if (base64.length > 5_000_000) {
      console.warn('Large image detected, may affect token usage');
    }

    let aiText = '';
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are an OCR assistant that extracts a conversation from a chat screenshot.

Return ONLY a valid JSON object. No explanations, no markdown, no extra text.

The JSON must have this exact structure:
{
  "messages": [
    { "role": "user", "text": "message content" },
    { "role": "other", "text": "message content" }
  ]
}

Rules:
- "user" = messages from the right side (e.g., blue/green bubbles)
- "other" = messages from the left side (other participant)
- Preserve the exact order of messages as they appear top to bottom.
- If you are uncertain who spoke first, assume "other" speaks first.
- Each message text must be trimmed and non-empty.
- If the screenshot contains no conversation, return { "messages": [] }.

Example screenshot (imaginary) would produce:
{ "messages": [{"role":"other","text":"Hi there!"},{"role":"user","text":"Hello!"}] }

Now process the attached image.`
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000, // increased for longer conversations
      });

      aiText = response?.choices?.[0]?.message?.content || '';
      if (!aiText) throw new Error('Empty AI response');
    } catch (err: any) {
      console.error('OpenAI API error:', err);
      return NextResponse.json({ error: 'OCR processing failed' }, { status: 500 });
    }

    // ---------- Robust JSON extraction ----------
    let parsed: any = null;
    let cleanJson = aiText.trim();

    // Remove markdown code fences
    cleanJson = cleanJson.replace(/```json\s*|\s*```/g, '');
    // Try to extract first valid JSON object
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.warn('Failed to parse extracted JSON:', jsonMatch[0]);
      }
    }

    // If still null, try direct parse (maybe it's already clean)
    if (!parsed) {
      try {
        parsed = JSON.parse(cleanJson);
      } catch (e) {
        console.error('Raw AI output:', aiText);
        return NextResponse.json(
          { error: 'AI returned malformed JSON. Please retry or use a clearer screenshot.' },
          { status: 400 }
        );
      }
    }

    // ---------- Normalize messages ----------
    let messages: { role: string; text: string }[] = [];

    if (Array.isArray(parsed.messages)) {
      messages = parsed.messages
        .map((m: any) => ({
          role: m?.role === 'user' ? 'user' : 'other',
          text: String(m?.text || '').trim(),
        }))
        .filter(m => m.text.length > 0);
    }
    // Fallback for alternate structures (e.g., userMessages/otherMessages)
    else if (Array.isArray(parsed.userMessages) || Array.isArray(parsed.otherMessages)) {
      const users = parsed.userMessages || [];
      const others = parsed.otherMessages || [];
      const maxLen = Math.max(users.length, others.length);
      for (let i = 0; i < maxLen; i++) {
        if (others[i] && String(others[i]).trim()) {
          messages.push({ role: 'other', text: String(others[i]).trim() });
        }
        if (users[i] && String(users[i]).trim()) {
          messages.push({ role: 'user', text: String(users[i]).trim() });
        }
      }
    }

    // Final validation
    if (messages.length === 0) {
      // Provide specific reason if possible
      const hasMessagesField = parsed && (Array.isArray(parsed.messages) || Array.isArray(parsed.userMessages));
      const errorMsg = hasMessagesField
        ? 'Conversation detected but all messages were empty. Try a clearer screenshot.'
        : 'No conversation could be extracted. Ensure the screenshot shows clear chat bubbles.';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    return NextResponse.json({ success: true, messages });
  } catch (err: any) {
    console.error('Vision route error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
