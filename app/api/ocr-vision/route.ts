import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    
    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Convert image to base64
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');
    const mimeType = image.type;
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    // Call OpenAI with vision-capable model (cheapest: gpt-4o-mini)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // cheapest vision model
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract the conversation from this chat screenshot. Return a JSON object with exactly two fields:
- "userMessages": an array of strings (messages sent by the user, i.e., the person whose phone/chat is being viewed)
- "otherMessages": an array of strings (messages from the other person)

Rules:
- If you see chat bubbles, right-aligned bubbles are usually the user, left-aligned are the other person.
- If there are names or labels (e.g., "Me:", "You:", "John:"), use them to determine roles.
- If you cannot distinguish roles, assume the first message is from "other" and alternate.
- Include every message from the visible screenshot.
- Do not include any extra text, commentary, or markdown. Output only valid JSON.`
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

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    const parsed = JSON.parse(content);
    // Ensure arrays exist
    const result = {
      userMessages: Array.isArray(parsed.userMessages) ? parsed.userMessages : [],
      otherMessages: Array.isArray(parsed.otherMessages) ? parsed.otherMessages : [],
    };
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Vision OCR error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process image' },
      { status: 500 }
    );
  }
}
