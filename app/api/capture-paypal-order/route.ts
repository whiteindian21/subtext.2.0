import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET!;
const PAYPAL_API = process.env.PAYPAL_API!;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { orderId } = await req.json();
    const userId = user.id;

    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
    const captureRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
    });

    const captureData = await captureRes.json();
    if (!captureRes.ok) throw new Error(captureData.message || 'Capture failed');

    const customId = captureData.purchase_units[0]?.payments?.captures[0]?.custom_id;
    if (!customId) throw new Error('Invalid order data');
    const [, , credits] = customId.split('|');

    const { error: dbError } = await supabase.rpc('add_credits', {
      p_user_id: userId,
      p_amount: parseInt(credits),
      p_reference: captureData.id,
      p_metadata: { paypal_order: captureData },
    });
    if (dbError) throw dbError;

    return NextResponse.json({ success: true, creditsAdded: parseInt(credits) });
  } catch (error: any) {
    console.error('Capture error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}