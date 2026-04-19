import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // ✅ ENV SAFETY (prevents GitHub CI failures)
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

    // ✅ SAFE BUFFER (fixes Node/Edge issues)
    const bytes = await image.arrayBuffer();
    const base64Image = Buffer.from(bytes).toString('base64');
    const dataUrl = `data:${image.type};base64,${base64Image}`;

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
                text: `Extract the conversation from this chat screenshot.

Return STRICT JSON with:
- "userMessages": string[]
- "otherMessages": string[]

Rules:
- Right side = user, left side = other
- If unclear, alternate starting with "other"
- Include ALL messages
- NO markdown, NO explanation, ONLY JSON`
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

      if (!aiText) {
        throw new Error('Empty AI response');
      }

    } catch (err: any) {
      console.error('OpenAI ERROR:', err);

      return NextResponse.json(
        { error: 'AI processing failed' },
        { status: 500 }
      );
    }

    // ✅ SAFE PARSE (prevents crashes)
    let parsed: any;

    try {
      parsed = JSON.parse(aiText);
    } catch {
      parsed = {};
    }

    const result = {
      userMessages: Array.isArray(parsed.userMessages)
        ? parsed.userMessages.map((m: any) => String(m))
        : [],
      otherMessages: Array.isArray(parsed.otherMessages)
        ? parsed.otherMessages.map((m: any) => String(m))
        : [],
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Vision OCR error:', error);

    return NextResponse.json(
      { error: error?.message || 'Failed to process image' },
      { status: 500 }
    );
  }
}
