'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { 
  Sparkles, LogOut, Copy, Loader2, Zap, MessageSquare, Brain,
  X, Settings, CheckCircle, Info, ChevronRight, Upload, Trash2,
  Shield, Smile, Eye, Target, Star, Heart, Flame, Send, Share2
} from 'lucide-react';

// Types
type OutputType = 'decode' | 'reply';
type ToastType = 'success' | 'error';

interface DecodeResult {
  analysis: string;
  tone: string;
  hiddenMeaning: string;
  suggestedVibe: string;
}

interface ReplyItem {
  text: string;
  tone: string;
  explanation?: string;
}

interface ReplyResult {
  replies: ReplyItem[];
}

interface ReplyWithTag extends ReplyItem {
  tag: 'Best' | 'Safe' | 'Bold';
}

const TONE_OPTIONS = [
  { label: 'Confident', emoji: '😎', category: 'confident', vibeMatch: ['serious', 'confident', 'aggressive'] },
  { label: 'Funny', emoji: '😂', category: 'funny', vibeMatch: ['playful', 'sarcastic'] },
  { label: 'Savage', emoji: '🔥', category: 'savage', vibeMatch: ['aggressive', 'sarcastic'] },
  { label: 'Chill', emoji: '❤️', category: 'chill', vibeMatch: ['casual', 'playful', 'serious'] },
  { label: 'Sarcastic', emoji: '🙄', category: 'sarcastic', vibeMatch: ['sarcastic', 'playful'] },
  { label: 'Romantic', emoji: '😘', category: 'romantic', vibeMatch: ['romantic'] },
  { label: 'Supportive', emoji: '🤗', category: 'supportive', vibeMatch: ['serious', 'romantic', 'caring'] },
  { label: 'Short & Dry', emoji: '🗿', category: 'dry', vibeMatch: ['serious', 'sarcastic', 'casual'] },
  { label: 'Energetic', emoji: '⚡', category: 'energetic', vibeMatch: ['playful', 'confident'] },
  { label: 'Mysterious', emoji: '🕵️', category: 'mysterious', vibeMatch: ['serious', 'sarcastic', 'playful'] },
  { label: 'Apologetic', emoji: '🙏', category: 'apologetic', vibeMatch: ['serious'] },
  { label: 'Flirty', emoji: '😉', category: 'flirty', vibeMatch: ['romantic', 'playful'] },
];

const getBestToneForVibe = (suggestedVibe: string): string => {
  const vibeLower = suggestedVibe.toLowerCase().trim();
  const match = TONE_OPTIONS.find(tone => 
    tone.vibeMatch.some(match => vibeLower.includes(match) || match === vibeLower)
  );
  return match?.category || 'chill';
};

const getReplyTag = (reply: ReplyItem, index: number): 'Best' | 'Safe' | 'Bold' => {
  if (index === 0) return 'Best';
  const toneLower = reply.tone.toLowerCase();
  if (toneLower.includes('confident') || toneLower.includes('savage') || toneLower.includes('energetic')) return 'Bold';
  if (toneLower.includes('supportive') || toneLower.includes('chill') || toneLower.includes('apologetic')) return 'Safe';
  return 'Safe';
};

const tagStyles = {
  Best: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Safe: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Bold: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
};

const tagIcons = {
  Best: <Star className="w-3 h-3" />,
  Safe: <Shield className="w-3 h-3" />,
  Bold: <Flame className="w-3 h-3" />
};

const ROTATING_PLACEHOLDERS = [
  "Paste their message here... \"I'm busy rn, talk later\"",
  "Try: \"I can't believe you did that 😤\"",
  "Upload a screenshot of any conversation",
  "\"Are we still on for tonight?\"",
  "\"I need some space right now...\""
];

// ─── GO VIRAL: generates a share card and triggers download ───────────────────
async function downloadShareCard(originalText: string, hiddenMeaning: string) {
  // Dynamically import html2canvas only when needed
  // If you don't have html2canvas, install it: npm install html2canvas
  // Alternatively, this uses a canvas-only approach with no dependencies.

  const CARD_W = 1080;
  const CARD_H = 1080;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, '#0f0a1e');
  bg.addColorStop(0.5, '#130d2e');
  bg.addColorStop(1, '#0a0a18');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Subtle grid pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CARD_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CARD_H); ctx.stroke();
  }
  for (let y = 0; y < CARD_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CARD_W, y); ctx.stroke();
  }

  // Glow orb top-left
  const orb1 = ctx.createRadialGradient(200, 200, 0, 200, 200, 400);
  orb1.addColorStop(0, 'rgba(139,92,246,0.25)');
  orb1.addColorStop(1, 'rgba(139,92,246,0)');
  ctx.fillStyle = orb1;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Glow orb bottom-right
  const orb2 = ctx.createRadialGradient(900, 900, 0, 900, 900, 350);
  orb2.addColorStop(0, 'rgba(236,72,153,0.2)');
  orb2.addColorStop(1, 'rgba(236,72,153,0)');
  ctx.fillStyle = orb2;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Helper: wrap text
  function wrapText(text: string, maxWidth: number, font: string): string[] {
    ctx.font = font;
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // ── "THEY SAID" label ──
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = 'rgba(161,161,170,0.7)';
  ctx.letterSpacing = '4px';
  ctx.fillText('THEY SAID', 80, 120);

  // Decorative line under label
  ctx.strokeStyle = 'rgba(139,92,246,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 135); ctx.lineTo(280, 135); ctx.stroke();

  // ── Original message bubble ──
  const bubbleX = 80;
  const bubbleY = 160;
  const bubbleW = CARD_W - 160;
  const msgFont = '500 44px Georgia, serif';
  const msgLines = wrapText(`"${originalText}"`, bubbleW - 60, msgFont);
  const bubbleH = msgLines.length * 60 + 60;

  // Bubble background
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  const r = 20;
  ctx.beginPath();
  ctx.moveTo(bubbleX + r, bubbleY);
  ctx.lineTo(bubbleX + bubbleW - r, bubbleY);
  ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY, bubbleX + bubbleW, bubbleY + r);
  ctx.lineTo(bubbleX + bubbleW, bubbleY + bubbleH - r);
  ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY + bubbleH, bubbleX + bubbleW - r, bubbleY + bubbleH);
  ctx.lineTo(bubbleX + r, bubbleY + bubbleH);
  ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleH, bubbleX, bubbleY + bubbleH - r);
  ctx.lineTo(bubbleX, bubbleY + r);
  ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + r, bubbleY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Message text
  ctx.font = msgFont;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  msgLines.forEach((line, i) => {
    ctx.fillText(line, bubbleX + 30, bubbleY + 50 + i * 60);
  });

  // ── Divider with "BUT WHAT THEY REALLY MEAN IS" ──
  const dividerY = bubbleY + bubbleH + 70;
  ctx.strokeStyle = 'rgba(139,92,246,0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(80, dividerY); ctx.lineTo(CARD_W - 80, dividerY); ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = 'bold 24px monospace';
  ctx.fillStyle = 'rgba(167,139,250,0.8)';
  const labelText = '✦  WHAT THEY REALLY MEAN  ✦';
  const labelW = ctx.measureText(labelText).width;
  ctx.fillText(labelText, (CARD_W - labelW) / 2, dividerY + 45);

  // ── Hidden meaning card ──
  const hmCardX = 80;
  const hmCardY = dividerY + 75;
  const hmCardW = CARD_W - 160;
  const hmFont = 'bold 52px Georgia, serif';
  const hmLines = wrapText(hiddenMeaning, hmCardW - 80, hmFont);
  const hmCardH = hmLines.length * 72 + 60;

  // Card gradient background
  const cardGrad = ctx.createLinearGradient(hmCardX, hmCardY, hmCardX + hmCardW, hmCardY + hmCardH);
  cardGrad.addColorStop(0, 'rgba(139,92,246,0.2)');
  cardGrad.addColorStop(1, 'rgba(236,72,153,0.15)');
  ctx.fillStyle = cardGrad;
  ctx.strokeStyle = 'rgba(139,92,246,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(hmCardX + r, hmCardY);
  ctx.lineTo(hmCardX + hmCardW - r, hmCardY);
  ctx.quadraticCurveTo(hmCardX + hmCardW, hmCardY, hmCardX + hmCardW, hmCardY + r);
  ctx.lineTo(hmCardX + hmCardW, hmCardY + hmCardH - r);
  ctx.quadraticCurveTo(hmCardX + hmCardW, hmCardY + hmCardH, hmCardX + hmCardW - r, hmCardY + hmCardH);
  ctx.lineTo(hmCardX + r, hmCardY + hmCardH);
  ctx.quadraticCurveTo(hmCardX, hmCardY + hmCardH, hmCardX, hmCardY + hmCardH - r);
  ctx.lineTo(hmCardX, hmCardY + r);
  ctx.quadraticCurveTo(hmCardX, hmCardY, hmCardX + r, hmCardY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Hidden meaning text
  ctx.font = hmFont;
  ctx.fillStyle = '#ffffff';
  hmLines.forEach((line, i) => {
    ctx.fillText(line, hmCardX + 40, hmCardY + 58 + i * 72);
  });

  // ── Bottom branding bar ──
  const barY = CARD_H - 110;
  const barGrad = ctx.createLinearGradient(0, barY, CARD_W, barY + 110);
  barGrad.addColorStop(0, 'rgba(139,92,246,0.15)');
  barGrad.addColorStop(1, 'rgba(236,72,153,0.1)');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, barY, CARD_W, 110);

  ctx.strokeStyle = 'rgba(139,92,246,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, barY); ctx.lineTo(CARD_W, barY); ctx.stroke();

  // Brand name
  ctx.font = 'bold 36px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('SubText AI', 80, barY + 65);

  // Tagline
  ctx.font = '24px monospace';
  ctx.fillStyle = 'rgba(167,139,250,0.7)';
  ctx.fillText('trysubtext.online', 80, barY + 95);

  // ✦ badge right side
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = 'rgba(236,72,153,0.8)';
  const badge = '✦ decode what\'s unsaid';
  const badgeW = ctx.measureText(badge).width;
  ctx.fillText(badge, CARD_W - badgeW - 80, barY + 65);

  // Download
  const link = document.createElement('a');
  link.download = 'subtext-decoded.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [input, setInput] = useState<string>('');
  const [context, setContext] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingReplies, setLoadingReplies] = useState<boolean>(false);
  const [output, setOutput] = useState<{ data: DecodeResult | ReplyResult; type: OutputType } | null>(null);
  const [activeTab, setActiveTab] = useState<'decode' | 'reply'>('decode');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false); // ← NEW
  
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);

  const [lastDecodeResult, setLastDecodeResult] = useState<DecodeResult | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % ROTATING_PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        fetchCredits(session.user.id);
      } else {
        router.push('/auth');
      }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchCredits(session.user.id);
      } else {
        setUser(null);
        router.push('/auth');
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const fetchCredits = async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', uid)
      .single();
    if (data) setCredits(data.credits);
  };

  const performVisionOCR = async (file: File) => {
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/ocr-vision', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); return; }
      const messages = data.messages;
      if (messages && Array.isArray(messages) && messages.length > 0) {
        const formattedLines = messages.map((msg: { role: string; text: string }) => {
          const speaker = msg.role === 'user' ? 'You' : 'Them';
          return `${speaker}: ${msg.text}`;
        });
        setInput(formattedLines.join('\n\n'));
        showToast('Conversation extracted with speaker labels!', 'success');
      } else {
        showToast('Could not parse conversation. Try a clearer screenshot.', 'error');
      }
    } catch (err) {
      console.error('Vision OCR error:', err);
      showToast('Failed to extract text from image.', 'error');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image too large (max 5MB)', 'error'); return; }
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    performVisionOCR(file);
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleDecode = async () => {
    if (!input.trim()) { showToast('Please paste a message or upload a screenshot', 'error'); return; }
    if (credits <= 0) { showToast('Out of credits! Please upgrade.', 'error'); return; }
    setLoading(true);
    setActiveTab('decode');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, text: input, context: context.trim() || undefined })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        setOutput({ data: data.result, type: 'decode' });
        setCredits(prev => prev - 1);
        setLastDecodeResult(data.result as DecodeResult);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    } catch (err) {
      console.error(err);
      showToast('Something went wrong. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateRepliesFromDecode = async () => {
    if (!lastDecodeResult) { showToast('Please decode the message first', 'error'); return; }
    if (credits <= 0) { showToast('Out of credits! Please upgrade.', 'error'); return; }
    setLoadingReplies(true);
    setActiveTab('reply');
    try {
      let bestTone = getBestToneForVibe(lastDecodeResult.suggestedVibe);
      bestTone = bestTone.toLowerCase().trim();
      const enhancedContext = [
        context,
        `[Decoded Analysis] ${lastDecodeResult.analysis}`,
        `[Hidden Meaning] ${lastDecodeResult.hiddenMeaning}`,
        `[Suggested Vibe] ${lastDecodeResult.suggestedVibe}`
      ].filter(Boolean).join('\n');
      const res = await fetch('/api/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, text: input, context: enhancedContext, tone: bestTone })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        setOutput({ data: data.result, type: 'reply' });
        setCredits(prev => prev - 1);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    } catch (err) {
      console.error(err);
      showToast('Something went wrong. Try again.', 'error');
    } finally {
      setLoadingReplies(false);
    }
  };

  // ── GO VIRAL handler ──────────────────────────────────────────────────────
  const handleGoViral = async () => {
    if (!output || output.type !== 'decode') return;
    const decoded = output.data as DecodeResult;
    setIsGeneratingCard(true);
    try {
      await downloadShareCard(input, decoded.hiddenMeaning);
      showToast('Share card downloaded! Post it anywhere 🔥', 'success');
    } catch (err) {
      console.error('Share card error:', err);
      showToast('Could not generate card. Try again.', 'error');
    } finally {
      setIsGeneratingCard(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  };

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  const repliesWithTags: ReplyWithTag[] = output?.type === 'reply' && output.data
    ? (output.data as ReplyResult).replies.map((reply, idx) => ({ ...reply, tag: getReplyTag(reply, idx) }))
    : [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-purple-500/30 relative">
      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes glowPulse {
          0% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(168, 85, 247, 0); }
          100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .animate-fadeInUp { animation: fadeInUp 0.5s ease-out forwards; }
        .animate-glow-pulse { animation: glowPulse 1.5s infinite; }
        .shimmer-btn {
          background: linear-gradient(90deg, #7c3aed, #ec4899, #f97316, #ec4899, #7c3aed);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
      `}</style>
      
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-zinc-950 to-zinc-950 opacity-50" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)`, backgroundSize: `40px 40px` }} />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-zinc-950/70 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/60">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
            <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-1.5 rounded-lg shadow-lg shadow-purple-500/20">
              <Sparkles className="text-white w-5 h-5 fill-white" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent hidden sm:block">SubText AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="flex items-center gap-2 bg-zinc-900/50 border border-white/10 px-3 py-1.5 rounded-full hover:bg-zinc-800 hover:border-white/20 transition-all hover:scale-105 group">
              <Zap className="text-yellow-400 w-4 h-4 group-hover:fill-yellow-400/20 transition-all" />
              <span className="text-sm font-medium text-zinc-300 group-hover:text-white">{credits} credits</span>
            </Link>
            <div className="flex items-center gap-1 pl-4 border-l border-white/10">
              <div className="hidden md:block text-right pr-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Welcome</p>
                <p className="text-sm font-semibold text-white truncate max-w-[120px]">{userName}</p>
              </div>
              <Link href="/settings" className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition rounded-lg">
                <Settings size={18} />
              </Link>
              <button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition rounded-lg" title="Logout">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-28 pb-20 px-4 max-w-4xl mx-auto">
        
        {/* Hero Header */}
        <div className="text-center mb-10 animate-fadeInUp">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Decode the <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">hidden meaning</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Paste any message or upload a screenshot – get instant AI analysis and perfect replies.
          </p>
        </div>

        {/* Input Card */}
        <div className={`bg-zinc-900/40 border rounded-3xl p-6 md:p-8 mb-12 backdrop-blur-xl shadow-2xl shadow-black/20 transition-all duration-300 ${isFocused ? 'border-purple-500/40 shadow-purple-500/10' : 'border-white/10'}`}>
          <textarea
            className="w-full bg-transparent text-xl md:text-2xl placeholder-zinc-600 focus:outline-none resize-none min-h-[120px] leading-relaxed font-medium transition-all"
            placeholder={ROTATING_PLACEHOLDERS[placeholderIndex]}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          
          <div className="flex justify-between items-center mt-2 text-xs text-zinc-500">
            <div className="flex items-center gap-3">
              <span>{input.length} characters</span>
              {input.length > 0 && <span className="text-purple-400 animate-pulse">Ready to decode</span>}
            </div>
            <div className="flex items-center gap-2">
              <Sparkles size={12} className="text-purple-400" />
              <span>AI-powered analysis</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm font-medium hover:bg-purple-500/20 transition-colors">
              <Upload size={16} />
              Upload Screenshot
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            {ocrLoading && (
              <div className="flex items-center gap-2 text-sm text-zinc-400 bg-black/30 px-3 py-1.5 rounded-full">
                <Loader2 size={14} className="animate-spin" />
                Extracting conversation with AI...
              </div>
            )}
            {imagePreview && !ocrLoading && (
              <div className="relative inline-block group">
                <img src={imagePreview} alt="Preview" className="h-12 w-auto rounded-md border border-white/10 object-cover" />
                <button onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5 text-white hover:bg-red-600 transition scale-0 group-hover:scale-100">
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
          
          <div className="group mt-6">
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 group-focus-within:text-purple-400 transition-colors">
              <Info size={12} /> Context or Question (optional)
            </label>
            <textarea
              className="w-full bg-black/20 border border-white/5 rounded-xl p-4 text-sm placeholder-zinc-600 focus:outline-none focus:border-purple-500/30 focus:bg-black/40 transition resize-none"
              placeholder="Add context or ask a question, e.g., 'Am I overreacting?', 'What does she really mean?'"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
            />
          </div>

          <div className="mt-8">
            <button
              onClick={handleDecode}
              disabled={loading || (!input.trim() && !ocrLoading)}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold py-4 rounded-xl hover:opacity-90 hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg group"
            >
              {loading && activeTab === 'decode' ? <Loader2 className="animate-spin" size={22} /> : <Brain size={22} className="group-hover:scale-110 transition-transform" />}
              {loading && activeTab === 'decode' ? (
                <span className="flex items-center gap-1">Decoding <span className="animate-pulse">...</span></span>
              ) : (
                'Decode Message'
              )}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {output && (
          <div ref={resultsRef} className="space-y-8 animate-fadeInUp">
            
            {output.type === 'decode' && (
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-[26px] blur opacity-20 group-hover:opacity-40 transition duration-700"></div>
                <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-[24px] p-6 md:p-8 shadow-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20">
                      <Brain className="text-purple-400" size={22} />
                    </div>
                    <h3 className="font-bold uppercase tracking-widest text-sm text-purple-300">AI Decoded Analysis</h3>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare size={16} className="text-blue-400" />
                        <p className="text-blue-400 text-xs font-bold uppercase tracking-wider">Deep Analysis</p>
                      </div>
                      <p className="text-white text-base leading-relaxed">{(output.data as DecodeResult).analysis}</p>
                    </div>
                    
                    <div className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all">
                      <div className="flex items-center gap-2 mb-3">
                        <Smile size={16} className="text-emerald-400" />
                        <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Detected Tone</p>
                      </div>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-emerald-300 font-medium">{(output.data as DecodeResult).tone}</span>
                      </div>
                    </div>
                    
                    <div className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all md:col-span-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Target size={16} className="text-amber-400" />
                        <p className="text-amber-400 text-xs font-bold uppercase tracking-wider">Suggested Vibe for Reply</p>
                      </div>
                      <p className="text-amber-200/90 text-lg font-medium">{(output.data as DecodeResult).suggestedVibe}</p>
                    </div>
                  </div>
                  
                  {/* Hidden Meaning */}
                  <div className="mt-6 p-6 bg-gradient-to-br from-purple-900/30 to-indigo-900/20 rounded-2xl border border-purple-500/30 relative overflow-hidden shadow-lg shadow-purple-500/10">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Sparkles size={64} className="text-purple-500" /></div>
                    <div className="flex items-center gap-2 mb-3">
                      <Eye size={18} className="text-purple-400" />
                      <p className="text-purple-400 text-xs font-bold uppercase tracking-widest">Hidden Meaning</p>
                    </div>
                    <p className="text-white text-xl md:text-2xl font-semibold leading-relaxed relative z-10">
                      {(output.data as DecodeResult).hiddenMeaning}
                    </p>
                  </div>

                  {/* ── GO VIRAL BUTTON ── */}
                  <div className="mt-6 p-4 bg-black/30 rounded-2xl border border-white/5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-1.5 bg-pink-500/10 rounded-lg border border-pink-500/20 mt-0.5">
                        <Share2 size={14} className="text-pink-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Go Viral</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Download a share card with the decoded text — post it to TikTok, Reels, or Stories</p>
                      </div>
                    </div>
                    <button
                      onClick={handleGoViral}
                      disabled={isGeneratingCard}
                      className="shimmer-btn w-full text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 text-sm tracking-wide shadow-lg shadow-pink-500/20 hover:shadow-pink-500/40 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {isGeneratingCard ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Generating share card...
                        </>
                      ) : (
                        <>
                          <Share2 size={16} />
                          Download Share Card
                          <span className="text-white/60 font-normal">→ post anywhere</span>
                        </>
                      )}
                    </button>
                  </div>
                  {/* ── END GO VIRAL ── */}
                  
                  <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-8"></div>
                  
                  <button
                    onClick={generateRepliesFromDecode}
                    disabled={loadingReplies}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 font-semibold text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 group"
                  >
                    {loadingReplies ? (
                      <><Loader2 size={20} className="animate-spin" /> Generating replies...</>
                    ) : (
                      <><Send size={18} className="group-hover:translate-x-1 transition-transform" /> Generate Smart Replies</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {output.type === 'reply' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={16} /> Choose Your Reply Personality
                  </h3>
                  <button onClick={() => setOutput(null)} className="text-xs text-zinc-600 hover:text-white flex items-center gap-1 transition-colors">
                    Clear <X size={14} />
                  </button>
                </div>
                <div className="grid gap-4">
                  {repliesWithTags.map((reply, i) => (
                    <div 
                      key={i} 
                      className="group relative bg-zinc-900/40 hover:bg-zinc-900/60 border border-white/5 hover:border-white/15 rounded-2xl p-5 transition-all duration-300 hover:scale-[1.01] cursor-pointer"
                      onClick={() => copyToClipboard(reply.text)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-zinc-100 text-lg leading-relaxed flex-1">{reply.text}</p>
                        <button 
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(reply.text); }} 
                          className="p-2.5 bg-zinc-800 hover:bg-white text-zinc-400 hover:text-black rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300"
                          title="Copy to clipboard"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-4">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full border ${tagStyles[reply.tag]}`}>
                          {tagIcons[reply.tag]}
                          {reply.tag}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-zinc-400 border border-white/5">
                          {reply.tone}
                        </span>
                        {reply.explanation && (
                          <span className="text-xs text-zinc-500 italic">"{reply.explanation}"</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setOutput(null)} 
                  className="w-full py-4 text-sm text-zinc-500 hover:text-white border border-dashed border-white/10 rounded-xl hover:border-white/30 hover:bg-white/5 transition-all flex items-center justify-center gap-2 group"
                >
                  Analyze another message <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading Skeleton for Decode */}
        {loading && activeTab === 'decode' && !output && (
          <div className="space-y-5 animate-pulse">
            <div className="bg-zinc-900/50 rounded-2xl p-6 border border-white/5">
              <div className="h-6 w-32 bg-purple-500/20 rounded mb-6"></div>
              <div className="grid md:grid-cols-2 gap-5">
                <div className="h-32 bg-white/5 rounded-xl"></div>
                <div className="h-32 bg-white/5 rounded-xl"></div>
                <div className="md:col-span-2 h-24 bg-white/5 rounded-xl"></div>
              </div>
              <div className="mt-6 h-40 bg-purple-500/10 rounded-xl"></div>
            </div>
          </div>
        )}

        {/* Loading Skeleton for Replies */}
        {loadingReplies && activeTab === 'reply' && !output && (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 w-48 bg-white/10 rounded"></div>
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-zinc-900/50 rounded-2xl p-5 border border-white/5 h-28"></div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!output && !loading && !loadingReplies && (
          <div className="text-center py-24 opacity-40 border-2 border-dashed border-white/10 rounded-3xl transition-all hover:border-white/20">
            <div className="inline-flex p-4 rounded-full bg-white/5 mb-4">
              <MessageSquare size={32} className="text-white" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium tracking-wide text-zinc-400">Paste a message or upload a screenshot to start</p>
          </div>
        )}

        <div className="mt-20 text-center">
          <p className="text-xs text-zinc-600 flex items-center justify-center gap-1">
            <Sparkles size={10} /> Powered by SubText AI — Decode what's unsaid
          </p>
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-8 duration-500 z-50 backdrop-blur-md border ${
          toast.type === 'success' 
            ? 'bg-emerald-500/90 border-emerald-500/20 text-white' 
            : 'bg-red-500/90 border-red-500/20 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <X size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
