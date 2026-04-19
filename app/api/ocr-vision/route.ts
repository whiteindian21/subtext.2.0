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

// -------------------------------
// 🧠 SAFE JSON PARSER
// -------------------------------
function safeParse(input: string) {
  try {
    return JSON.parse(input);
  } catch {}

  const match = input.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  return null;
}

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
    // STEP 1: OCR + AI
    // -------------------------------
    let aiText = '';

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You extract chat messages from screenshots.

Return ONLY JSON.
No explanation.
No markdown.

If unsure return:
{"messages":[]}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract chat messages.

STRICT FORMAT:
{"messages":[{"role":"other","text":"..."},{"role":"user","text":"..."}]}

Rules:
- Right = user
- Left = other
- Keep order
- No empty text
- No trailing commas`
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl }
              }
            ]
          }
        ],
        max_tokens: 1500
      });

      aiText = response.choices?.[0]?.message?.content || '';

      if (!aiText) throw new Error('Empty AI response');

    } catch (err) {
      console.error('OCR ERROR:', err);

      return NextResponse.json({
        success: true,
        messages: [],
        error: 'OCR failed'
      });
    }

    console.log("🧠 RAW AI OUTPUT:\n", aiText);

    // -------------------------------
    // STEP 2: CLEAN
    // -------------------------------
    let clean = aiText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    clean = clean
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');

    // -------------------------------
    // STEP 3: PARSE
    // -------------------------------
    let parsed = safeParse(clean);

    // -------------------------------
    // STEP 4: REPAIR (if needed)
    // -------------------------------
    if (!parsed) {
      console.warn("⚠️ PRIMARY PARSE FAILED → attempting repair");

      try {
        const repair = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `Fix invalid JSON.

Return ONLY valid JSON.
No explanation.

Must match:
{"messages":[{"role":"other","text":"..."},{"role":"user","text":"..."}]}`
            },
            {
              role: 'user',
              content: `Fix this JSON:\n${clean}`
            }
          ],
          max_tokens: 1000
        });

        const fixed = repair.choices?.[0]?.message?.content || '';

        console.log("🔧 REPAIRED JSON:\n", fixed);

        parsed = safeParse(fixed);

      } catch (err) {
        console.error("❌ REPAIR FAILED:", err);
      }
    }

    // -------------------------------
    // STEP 5: NORMALIZE
    // -------------------------------
    let messages: ExtractedMessage[] = [];

    if (parsed && Array.isArray(parsed.messages)) {
      messages = parsed.messages
        .map((m: any) => ({
          role: m?.role === 'user' ? 'user' : 'other',
          text: String(m?.text || '').trim(),
        }))
        .filter((m: ExtractedMessage) => m.text.length > 0);
    }

    // -------------------------------
    // STEP 6: FINAL SAFE RETURN
    // -------------------------------
    if (messages.length === 0) {
      return NextResponse.json({
        success: true,
        messages: [],
        debug: aiText // 🔥 shows what AI returned
      });
    }

    return NextResponse.json({
      success: true,
      messages
    });

  } catch (err: any) {
    console.error('SERVER ERROR:', err);

    return NextResponse.json({
      success: true,
      messages: [],
      error: err?.message || 'Server error'
    });
  }
}
