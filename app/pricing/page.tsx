'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { 
  Check, Zap, Loader2, CheckCircle, 
  Sparkles, Flame, Star, Shield, Gift, X, ArrowLeft, Settings
} from 'lucide-react';

// --- Navbar (Standardized) ---
const Navbar = () => (
  <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-zinc-950/70 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/60">
    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <Link href="/dashboard" className="flex items-center gap-3 group cursor-pointer">
        <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform duration-300">
          <Sparkles className="text-white w-5 h-5 fill-white" />
        </div>
        <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent hidden sm:block">SubText AI</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/settings" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors px-4 py-2 rounded-full hover:bg-white/5 flex items-center gap-2">
          <Settings size={16} /> Settings
        </Link>
      </div>
    </div>
  </nav>
);

// --- PayPal Button Component (Updated: horizontal layout, pill shape, security message) ---
const PayPalButtonComponent = ({ amount, planId, credits, onSuccess, onError }: any) => {
  return (
    <div className="space-y-3">
      <PayPalButtons
        style={{ 
          layout: "horizontal", 
          color: "gold", 
          shape: "pill", 
          label: "checkout", 
          tagline: false 
        }}
        createOrder={async () => {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token) throw new Error('Not authenticated');
          const res = await fetch("/api/create-paypal-order", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ amount, planId, credits }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          return data.orderId;
        }}
        onApprove={async (data) => {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          const res = await fetch("/api/capture-paypal-order", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ orderId: data.orderID }),
          });
          const result = await res.json();
          if (res.ok) {
            onSuccess();
          } else {
            onError(result.error || "Payment failed");
          }
        }}
        onError={() => onError("An error occurred with PayPal")}
      />
      <p className="text-[11px] text-center text-zinc-500 flex items-center justify-center gap-1">
        <Shield size={12} /> Secure card payments powered by PayPal
      </p>
    </div>
  );
};

export default function PricingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState<number>(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<{ id: string; credits: number; price: number; name: string } | null>(null);

  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  if (!paypalClientId) {
    console.error('Missing NEXT_PUBLIC_PAYPAL_CLIENT_ID');
  }

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data } = await supabase
          .from('profiles')
          .select('credits')
          .eq('id', session.user.id)
          .single();
        if (data) setCredits(data.credits);
      } else {
        router.push('/auth');
      }
    };
    getUser();
  }, [router]);

  const handlePaymentSuccess = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single();
    if (data) setCredits(data.credits);
    setSelectedPlan(null);
    setMessage({ type: 'success', text: 'Credits added successfully!' });
    setTimeout(() => setMessage(null), 5000);
  };

  const handlePaymentError = (error: string) => {
    setSelectedPlan(null);
    setMessage({ type: 'error', text: error });
    setTimeout(() => setMessage(null), 5000);
  };

  // Explicit styles to avoid JIT compilation issues with dynamic classes
  const plans = [
    { 
      id: 'viral', name: 'Viral Pack', price: 2, credits: 15, badge: 'IMPULSE BUY', icon: Flame, 
      desc: 'Perfect for a quick test.',
      styles: { 
        border: 'border-orange-500/20', hover: 'hover:border-orange-500/40', 
        text: 'text-orange-400', bg: 'bg-orange-500/10', btn: 'bg-white text-black hover:bg-zinc-200' 
      } 
    },
    { 
      id: 'starter', name: 'Starter Pack', price: 5, credits: 50, badge: null, icon: Zap, 
      desc: 'Best entry price point.',
      styles: { 
        border: 'border-indigo-500/20', hover: 'hover:border-indigo-500/40', 
        text: 'text-indigo-400', bg: 'bg-indigo-500/10', btn: 'bg-white text-black hover:bg-zinc-200' 
      } 
    },
    { 
      id: 'popular', name: 'Popular Pack', price: 10, credits: 120, badge: 'BEST VALUE', icon: Star, 
      desc: 'Most credits per dollar.',
      styles: { 
        border: 'border-purple-500/40', hover: 'hover:border-purple-500/60', 
        text: 'text-purple-400', bg: 'bg-purple-500/20', btn: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:shadow-purple-500/25' 
      } 
    },
    { 
      id: 'power', name: 'Power Pack', price: 20, credits: 300, badge: null, icon: Zap, 
      desc: 'For the heavy users.',
      styles: { 
        border: 'border-blue-500/20', hover: 'hover:border-blue-500/40', 
        text: 'text-blue-400', bg: 'bg-blue-500/10', btn: 'bg-white text-black hover:bg-zinc-200' 
      } 
    }
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-500" size={40} />
      </div>
    );
  }

  return (
    <PayPalScriptProvider options={{ 
      clientId: paypalClientId!,
      currency: "USD",
      intent: "capture"
    }}>
      <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-purple-500/30 relative overflow-x-hidden">
        
        {/* Ambient Background */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-zinc-950 to-zinc-950 opacity-50" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)`, backgroundSize: `40px 40px` }} />
        </div>

        <Navbar />

        {/* Hero Section */}
        <div className="relative z-10 pt-32 pb-16 px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-purple-300 text-xs font-bold uppercase tracking-widest mb-8 backdrop-blur-md shadow-sm">
              <Gift size={12} /> Simple, transparent pricing
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
              Unlock the <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">full power</span>
            </h1>
            <p className="text-zinc-400 text-xl max-w-2xl mx-auto mb-8">
              No subscriptions. Credits never expire. One-time purchases only.
            </p>
            
            <div className="inline-flex items-center gap-3 bg-zinc-900/50 border border-white/10 px-6 py-3 rounded-full backdrop-blur-sm">
              <Sparkles size={18} className="text-purple-400 fill-purple-400/20" />
              <span className="text-sm font-medium">You have <strong className="text-white">{credits}</strong> credits available</span>
            </div>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-24">
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-center mb-2">Choose your pack</h2>
            <p className="text-zinc-500 text-center text-sm">Instant delivery • Secure checkout</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const isPopular = plan.id === 'popular';
              
              return (
                <div 
                  key={plan.id} 
                  className={`relative p-8 rounded-3xl bg-zinc-900/40 border backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 group flex flex-col ${isPopular ? 'border-purple-500/50 shadow-xl shadow-purple-900/20' : plan.styles.border + ' hover:' + plan.styles.hover}`}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg ${isPopular ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-zinc-800 text-zinc-300 border border-white/10'}`}>
                      {isPopular && <Star size={10} fill="currentColor" />} {plan.badge}
                    </div>
                  )}

                  <div className="flex-1 flex flex-col h-full">
                    {/* Header */}
                    <div className="mb-6">
                      <div className={`w-12 h-12 rounded-xl ${plan.styles.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ${isPopular ? 'shadow-lg shadow-purple-500/20' : ''}`}>
                        <Icon className={plan.styles.text} size={24} />
                      </div>
                      <h3 className="text-lg font-bold mb-1 text-white">{plan.name}</h3>
                      <p className="text-zinc-500 text-sm">{plan.desc}</p>
                    </div>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="text-4xl font-black text-white mb-1">${plan.price}</div>
                      <div className={`text-sm font-medium ${plan.styles.text}`}>{plan.credits} Credits</div>
                    </div>

                    {/* Features */}
                    <ul className="space-y-4 mb-8 flex-1">
                      <li className="flex items-start gap-2 text-sm text-zinc-400">
                        <Check size={16} className="text-zinc-600 mt-0.5" /> Low friction purchase
                      </li>
                      <li className="flex items-start gap-2 text-sm text-zinc-400">
                        <Check size={16} className="text-zinc-600 mt-0.5" /> {isPopular ? 'Best value per dollar' : 'Perfect for testing'}
                      </li>
                      <li className="flex items-start gap-2 text-sm text-zinc-400">
                        <Check size={16} className="text-zinc-600 mt-0.5" /> All features included
                      </li>
                    </ul>

                    {/* Button */}
                    <button
                      onClick={() => setSelectedPlan({ id: plan.id, credits: plan.credits, price: plan.price, name: plan.name })}
                      className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 ${plan.styles.btn} ${isPopular ? 'shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40' : 'hover:scale-105'}`}
                    >
                      Get {plan.credits} Credits <ArrowLeft size={16} className="rotate-[-45deg]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Security Footer */}
        <div className="relative z-10 text-center px-6 pb-12">
          <div className="inline-flex items-center gap-2 bg-zinc-900/50 border border-white/5 px-6 py-3 rounded-full backdrop-blur-sm">
            <Shield size={18} className="text-green-400" />
            <span className="text-xs font-medium text-zinc-400">Secure checkout powered by PayPal</span>
          </div>
        </div>

        {/* Payment Modal */}
        {selectedPlan && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" 
              onClick={() => setSelectedPlan(null)}
            />
            
            {/* Modal Content */}
            <div className="relative bg-zinc-900 border border-white/10 rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
              {/* Glow effect */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-[50px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white">Checkout</h3>
                  <button 
                    onClick={() => setSelectedPlan(null)} 
                    className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="mb-8 p-5 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Purchasing</p>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-2xl font-bold text-white">{selectedPlan.credits} Credits</p>
                      <p className="text-zinc-400 text-sm">{selectedPlan.name}</p>
                    </div>
                    <p className="text-2xl font-bold text-purple-400">${selectedPlan.price}</p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <PayPalButtonComponent
                    amount={selectedPlan.price}
                    planId={selectedPlan.id}
                    credits={selectedPlan.credits}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </div>
                
                <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                  By completing this purchase, you agree to our Terms. <br/>
                  Credits are added immediately after payment.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {message && (
          <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-8 duration-500 z-50 backdrop-blur-md border ${
            message.type === 'success' 
              ? 'bg-emerald-500/90 border-emerald-500/20 text-white' 
              : 'bg-red-500/90 border-red-500/20 text-white'
          }`}>
            {message.type === 'success' ? <CheckCircle size={18} /> : <X size={18} />}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}
      </div>
    </PayPalScriptProvider>
  );
}