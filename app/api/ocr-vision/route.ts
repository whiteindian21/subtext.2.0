import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type ExtractedMessage = {
  role: 'user' | 'other';
  text: string;
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!image.type?.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Convert image → base64
    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString('base64');

    const dataUrl = `data:${image.type};base64,${base64}`;

    // -------------------------------
    // STEP 1: PRIMARY OCR + JSON
    // -------------------------------
    let aiText = '';

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // 🔥 upgrade from mini
        messages: [
          {
            role: 'system',
            content: `You are a strict OCR + JSON extraction engine.

You ONLY return valid JSON.
No explanations.
No markdown.
No extra text.

If unsure → return: {"messages":[]}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract chat messages from this screenshot.

FORMAT STRICTLY:
{"messages":[{"role":"other","text":"..."},{"role":"user","text":"..."}]}

RULES:
- Right side = "user"
- Left side = "other"
- Keep order top → bottom
- No empty messages
- No trailing commas
- No extra keys
- If unclear → return {"messages":[]}`
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl }
              }
            ]
          }
        ],
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      aiText = response.choices?.[0]?.message?.content || '';
      if (!aiText) throw new Error('Empty AI response');

    } catch (err) {
      console.error('OCR ERROR:', err);
      return NextResponse.json({ error: 'OCR failed' }, { status: 500 });
    }

    console.log("RAW AI:", aiText);

    // -------------------------------
    // STEP 2: CLEAN JSON STRING
    // -------------------------------
    let clean = aiText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // Remove trailing commas
    clean = clean
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');

    // Extract JSON safely
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) clean = match[0];

    let parsed: any = null;

    try {
      parsed = JSON.parse(clean);
    } catch (err) {
      console.warn("PRIMARY PARSE FAILED");

      // -------------------------------
      // STEP 3: AUTO-REPAIR PASS (🔥 KEY)
      // -------------------------------
      try {
        const repair = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `Fix invalid JSON.

Return ONLY valid JSON.
Do not explain anything.`
            },
            {
              role: 'user',
              content: clean
            }
          ],
          max_tokens: 1000,
        });

        const fixed = repair.choices?.[0]?.message?.content || '';
        parsed = JSON.parse(fixed);

      } catch (repairErr) {
        console.error("REPAIR FAILED:", repairErr);

        return NextResponse.json(
          { error: 'Could not parse conversation. Try a clearer screenshot.' },
          { status: 400 }
        );
      }
    }

    // -------------------------------
    // STEP 4: NORMALIZE
    // -------------------------------
    let messages: ExtractedMessage[] = [];

    if (Array.isArray(parsed?.messages)) {
      messages = parsed.messages
        .map((m: any) => ({
          role: m?.role === 'user' ? 'user' : 'other',
          text: String(m?.text || '').trim(),
        }))
        .filter((m: ExtractedMessage) => m.text.length > 0);
    }

    // -------------------------------
    // STEP 5: FINAL SAFETY
    // -------------------------------
    if (messages.length === 0) {
      return NextResponse.json({
        success: true,
        messages: [],
        warning: 'No clear conversation detected'
      });
    }

    return NextResponse.json({
      success: true,
      messages
    });

  } catch (err: any) {
    console.error('SERVER ERROR:', err);

    return NextResponse.json(
      { error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
