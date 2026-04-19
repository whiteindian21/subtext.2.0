import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs'; // ✅ required for Buffer

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

    // ✅ CONVERT IMAGE → BASE64
    const bytes = await image.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const dataUrl = `data:${image.type};base64,${base64}`;

    let aiText = '';

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // 💸 cheapest vision model
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are an OCR + chat parser.

Extract ALL messages from this screenshot and return STRICT JSON:

{
  "messages": [
    { "role": "user", "text": "..." },
    { "role": "other", "text": "..." }
  ]
}

Rules:
- Right side bubbles = user
- Left side bubbles = other
- If unclear, alternate starting with "other"
- Keep messages in order
- NO markdown
- NO explanations
- ONLY JSON`
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

    // ✅ SAFE PARSE
    let parsed: any;

    try {
      parsed = JSON.parse(aiText);
    } catch {
      parsed = {};
    }

    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.map((m: any) => ({
          role: m?.role === 'user' ? 'user' : 'other',
          text: String(m?.text || '').trim(),
        }))
      : [];

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
