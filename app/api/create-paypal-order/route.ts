import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET!;
const PAYPAL_API = process.env.PAYPAL_API!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

// 🔥 STEP 1: Get PayPal access token (REQUIRED for live)
async function getPayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');

  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Failed to get PayPal token');

  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    // 🔐 Get token from header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // 🔐 Verify Supabase user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { amount, planId, credits } = await req.json();

    if (!amount || !planId || !credits) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const userId = user.id;

    // 🔥 STEP 2: Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // 🔥 STEP 3: Create order
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`, // ✅ IMPORTANT FIX
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: Number(amount).toFixed(2), // ✅ FIXED HERE
            },
            description: `${credits} credits for SubText AI`,
            custom_id: `${userId}|${planId}|${credits}`,
          },
        ],
        application_context: {
          return_url: `${APP_URL}/dashboard`,
          cancel_url: `${APP_URL}/pricing`,
        },
      }),
    });

    const order = await response.json();

    if (!response.ok) {
      console.error('PayPal error:', order);
      throw new Error(order.message || 'PayPal order creation failed');
    }

    return NextResponse.json({ orderId: order.id });

  } catch (error: any) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}