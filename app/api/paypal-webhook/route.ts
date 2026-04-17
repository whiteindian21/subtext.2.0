import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import crypto from 'crypto';

const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID!;

// Helper: Fetch PayPal certificate and verify signature
async function verifyPayPalWebhook(
  req: NextRequest,
  rawBody: string
): Promise<boolean> {
  // Get headers from PayPal
  const transmissionId = req.headers.get('paypal-transmission-id');
  const timestamp = req.headers.get('paypal-transmission-time');
  const webhookId = PAYPAL_WEBHOOK_ID;
  const signature = req.headers.get('paypal-transmission-sig');
  const certUrl = req.headers.get('paypal-cert-url');
  const authAlgo = req.headers.get('paypal-auth-algo');

  if (!transmissionId || !timestamp || !signature || !certUrl || !authAlgo) {
    console.error('Missing PayPal signature headers');
    return false;
  }

  // Construct the message that PayPal signed
  const message = `${transmissionId}|${timestamp}|${webhookId}|${crypto.createHash('sha256').update(rawBody).digest('hex')}`;

  try {
    // Download the certificate
    const certResponse = await fetch(certUrl);
    const certPem = await certResponse.text();

    // Verify the signature using the certificate
    const verifier = crypto.createVerify('sha256');
    verifier.update(message);
    verifier.end();

    const isValid = verifier.verify(certPem, signature, 'base64');
    return isValid;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify signature – reject if invalid
    const isValid = await verifyPayPalWebhook(req, rawBody);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    console.log(`✅ Webhook received: ${event.event_type}`, event.id);

    // Handle different event types
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const resource = event.resource;
        const customId = resource?.custom_id;
        if (!customId) {
          console.warn('No custom_id in webhook payload');
          break;
        }
        const [userId, planId, credits] = customId.split('|');
        if (!userId || !credits) {
          console.warn('Invalid custom_id format:', customId);
          break;
        }

        // Add credits (idempotent – if already processed, RPC should handle duplicate gracefully)
        const { error: dbError } = await supabase.rpc('add_credits', {
          p_user_id: userId,
          p_amount: parseInt(credits),
          p_reference: resource.id,
          p_metadata: { webhook_event: event },
        });

        if (dbError) {
          console.error('Failed to add credits:', dbError);
          // Return 200 anyway to prevent PayPal retries (log error, manual fix later)
        } else {
          console.log(`✅ Added ${credits} credits to user ${userId}`);
        }
        break;
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        // Handle refund (e.g., deduct credits or mark as refunded)
        console.log('Refund event received:', event.resource.id);
        // You may want to log or adjust user's credits
        break;
      }

      case 'CHECKOUT.ORDER.APPROVED': {
        // Optional: capture order automatically if not done via API
        console.log('Order approved:', event.resource.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.event_type}`);
    }

    // Always return 200 to acknowledge receipt (PayPal will retry on non-200)
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent endless retries for malformed events
    return NextResponse.json({ received: true, error: 'Processing error' }, { status: 200 });
  }
}