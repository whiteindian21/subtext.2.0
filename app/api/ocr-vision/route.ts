import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs'; // ✅ needed for Buffer

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // ✅ ENV SAFETY
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const image = formData.get('image') as File | null;

    // ✅ VALIDATION
    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    if (!image.type?.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      );
    }

    // ✅ IMAGE → BASE64
    const bytes = await image.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const dataUrl = `data:${image.type};base64,${base64}`;

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
                text: `You are an OCR + chat parser.

Return ONLY valid JSON.

DO NOT include:
- explanations
- markdown
- text before or after JSON

FORMAT:
{
  "messages": [
    { "role": "user", "text": "..." },
    { "role": "other", "text": "..." }
  ]
}

Rules:
- Right side = user
- Left side = other
- Keep order EXACT
- If unclear, alternate starting with "other"`
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
      });

      aiText = response?.choices?.[0]?.message?.content || '';

      if (!aiText) throw new Error('Empty AI response');

    } catch (err: any) {
      console.error('OpenAI OCR ERROR:', err);

      return NextResponse.json(
        { error: 'OCR processing failed' },
        { status: 500 }
      );
    }

    // ✅ SAFE JSON PARSE (with fallback extraction)
    let parsed: any = {};

    try {
      parsed = JSON.parse(aiText);
    } catch {
      // 🔥 try extracting JSON from messy response
      const match = aiText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = {};
        }
      }
    }

    // ✅ NORMALIZE OUTPUT
    let messages: { role: string; text: string }[] = [];

    if (Array.isArray(parsed.messages)) {
      messages = parsed.messages.map((m: any) => ({
        role: m?.role === 'user' ? 'user' : 'other',
        text: String(m?.text || '').trim(),
      }));
    } else if (
      Array.isArray(parsed.userMessages) ||
      Array.isArray(parsed.otherMessages)
    ) {
      // 🔥 fallback support
      const users = parsed.userMessages || [];
      const others = parsed.otherMessages || [];

      const max = Math.max(users.length, others.length);

      for (let i = 0; i < max; i++) {
        if (others[i]) {
          messages.push({
            role: 'other',
            text: String(others[i]).trim(),
          });
        }
        if (users[i]) {
          messages.push({
            role: 'user',
            text: String(users[i]).trim(),
          });
        }
      }
    }

    // ❌ If still empty → return helpful error
    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'Could not parse conversation. Try a clearer screenshot.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      messages,
    });

  } catch (err: any) {
    console.error('VISION ROUTE ERROR:', err);

    return NextResponse.json(
      { error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
