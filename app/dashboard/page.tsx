'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { 
  Sparkles, LogOut, Copy, Loader2, Zap, MessageSquare, Brain,
  X, Settings, CheckCircle, Info, ChevronRight, Upload, Trash2,
  Shield, Smile, Eye, Target, Star, Flame, Send, Share2, AlertTriangle,
  ArrowRight, Lightbulb
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_CHARS = 2000;
const LOW_CREDIT_THRESHOLD = 5;

const TONE_OPTIONS = [
  { label: 'Confident', emoji: '😎', category: 'confident', vibeMatch: ['serious', 'confident', 'aggressive'] },
  { label: 'Funny',     emoji: '😂', category: 'funny',     vibeMatch: ['playful', 'sarcastic'] },
  { label: 'Savage',    emoji: '🔥', category: 'savage',    vibeMatch: ['aggressive', 'sarcastic'] },
  { label: 'Chill',     emoji: '❤️', category: 'chill',     vibeMatch: ['casual', 'playful', 'serious'] },
  { label: 'Sarcastic', emoji: '🙄', category: 'sarcastic', vibeMatch: ['sarcastic', 'playful'] },
  { label: 'Romantic',  emoji: '😘', category: 'romantic',  vibeMatch: ['romantic'] },
  { label: 'Supportive',emoji: '🤗', category: 'supportive',vibeMatch: ['serious', 'romantic', 'caring'] },
  { label: 'Short & Dry',emoji:'🗿', category: 'dry',       vibeMatch: ['serious', 'sarcastic', 'casual'] },
  { label: 'Energetic', emoji: '⚡', category: 'energetic', vibeMatch: ['playful', 'confident'] },
  { label: 'Mysterious',emoji: '🕵️',category: 'mysterious', vibeMatch: ['serious', 'sarcastic', 'playful'] },
  { label: 'Apologetic',emoji: '🙏', category: 'apologetic',vibeMatch: ['serious'] },
  { label: 'Flirty',    emoji: '😉', category: 'flirty',    vibeMatch: ['romantic', 'playful'] },
];

// Example decode shown in empty state
const EXAMPLE_DECODE = {
  input: '"I\'m busy rn, talk later"',
  analysis: 'Short, dismissive phrasing with no time commitment. The vagueness of "later" signals low priority — if you were important right now, they\'d give a time.',
  tone: 'Distancing',
  hiddenMeaning: 'They\'re not busy. You\'re just not the priority right now.',
  suggestedVibe: 'Stay confident — don\'t double text or ask when to talk.',
};

const CONTEXT_SUGGESTIONS = [
  'Are they interested?',
  'Should I respond?',
  'Am I overthinking this?',
  'Is this sarcastic?',
  'Are they pulling away?',
];

const ROTATING_PLACEHOLDERS = [
  "Paste their message here... \"I'm busy rn, talk later\"",
  "Try: \"I can't believe you did that 😤\"",
  "Upload a screenshot of any conversation",
  "\"Are we still on for tonight?\"",
  "\"I need some space right now...\"",
];

// Session storage keys
const SS_INPUT   = 'subtext_input';
const SS_CONTEXT = 'subtext_context';
const SS_OUTPUT  = 'subtext_output';
const SS_DECODE  = 'subtext_last_decode';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getBestToneForVibe = (suggestedVibe: string): string => {
  const vibeLower = suggestedVibe.toLowerCase().trim();
  const match = TONE_OPTIONS.find(t =>
    t.vibeMatch.some(m => vibeLower.includes(m) || m === vibeLower)
  );
  return match?.category || 'chill';
};

const getReplyTag = (reply: ReplyItem, index: number): 'Best' | 'Safe' | 'Bold' => {
  if (index === 0) return 'Best';
  const t = reply.tone.toLowerCase();
  if (t.includes('confident') || t.includes('savage') || t.includes('energetic')) return 'Bold';
  return 'Safe';
};

const tagStyles = {
  Best: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Safe: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Bold: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

const tagIcons = {
  Best: <Star  className="w-3 h-3" />,
  Safe: <Shield className="w-3 h-3" />,
  Bold: <Flame  className="w-3 h-3" />,
};

// ─── Share Card — tone-aware, native share on mobile ─────────────────────────
interface CardTheme {
  bg: [string, string, string];
  orb1: [string, string, number, number];
  orb2: [string, string, number, number];
  accent: string;
  labelColor: string;
  dividerColor: string;
  hmBg: [string, string];
  hmBorder: string;
  badge: string;
  emoji: string;
  vibe: string;
}

const TONE_THEMES: Record<string, CardTheme> = {
  savage: {
    bg: ['#1a0505','#1f0808','#0d0000'],
    orb1: ['rgba(239,68,68,0.3)','rgba(239,68,68,0)',880,120],
    orb2: ['rgba(251,146,60,0.2)','rgba(251,146,60,0)',200,900],
    accent:'#ef4444', labelColor:'rgba(252,165,165,0.85)',
    dividerColor:'rgba(239,68,68,0.35)',
    hmBg:['rgba(239,68,68,0.18)','rgba(251,146,60,0.12)'],
    hmBorder:'rgba(239,68,68,0.5)', badge:'rgba(239,68,68,0.88)',
    emoji:'🔥', vibe:'SAVAGE',
  },
  romantic: {
    bg: ['#1a0514','#1f0818','#0d0009'],
    orb1: ['rgba(236,72,153,0.3)','rgba(236,72,153,0)',150,200],
    orb2: ['rgba(244,114,182,0.2)','rgba(244,114,182,0)',900,850],
    accent:'#ec4899', labelColor:'rgba(249,168,212,0.88)',
    dividerColor:'rgba(236,72,153,0.35)',
    hmBg:['rgba(236,72,153,0.2)','rgba(192,38,211,0.12)'],
    hmBorder:'rgba(236,72,153,0.55)', badge:'rgba(236,72,153,0.88)',
    emoji:'💕', vibe:'ROMANTIC',
  },
  flirty: {
    bg: ['#160518','#1a081f','#0d0010'],
    orb1: ['rgba(192,38,211,0.28)','rgba(192,38,211,0)',180,180],
    orb2: ['rgba(236,72,153,0.2)','rgba(236,72,153,0)',880,880],
    accent:'#c026d3', labelColor:'rgba(240,171,252,0.88)',
    dividerColor:'rgba(192,38,211,0.35)',
    hmBg:['rgba(192,38,211,0.18)','rgba(236,72,153,0.12)'],
    hmBorder:'rgba(192,38,211,0.5)', badge:'rgba(192,38,211,0.88)',
    emoji:'😉', vibe:'FLIRTY',
  },
  mysterious: {
    bg: ['#05060f','#080a18','#020308'],
    orb1: ['rgba(99,102,241,0.25)','rgba(99,102,241,0)',200,200],
    orb2: ['rgba(139,92,246,0.18)','rgba(139,92,246,0)',880,880],
    accent:'#6366f1', labelColor:'rgba(165,180,252,0.88)',
    dividerColor:'rgba(99,102,241,0.35)',
    hmBg:['rgba(99,102,241,0.18)','rgba(139,92,246,0.1)'],
    hmBorder:'rgba(99,102,241,0.5)', badge:'rgba(99,102,241,0.88)',
    emoji:'🕵️', vibe:'MYSTERIOUS',
  },
  playful: {
    bg: ['#0a1205','#0d1808','#050a02'],
    orb1: ['rgba(34,197,94,0.25)','rgba(34,197,94,0)',180,180],
    orb2: ['rgba(250,204,21,0.18)','rgba(250,204,21,0)',900,850],
    accent:'#22c55e', labelColor:'rgba(134,239,172,0.88)',
    dividerColor:'rgba(34,197,94,0.3)',
    hmBg:['rgba(34,197,94,0.16)','rgba(250,204,21,0.1)'],
    hmBorder:'rgba(34,197,94,0.45)', badge:'rgba(34,197,94,0.88)',
    emoji:'😂', vibe:'PLAYFUL',
  },
  cold: {
    bg: ['#080c14','#0b1020','#04060e'],
    orb1: ['rgba(14,165,233,0.22)','rgba(14,165,233,0)',180,180],
    orb2: ['rgba(99,102,241,0.15)','rgba(99,102,241,0)',900,900],
    accent:'#0ea5e9', labelColor:'rgba(186,230,253,0.85)',
    dividerColor:'rgba(14,165,233,0.3)',
    hmBg:['rgba(14,165,233,0.15)','rgba(99,102,241,0.1)'],
    hmBorder:'rgba(14,165,233,0.45)', badge:'rgba(14,165,233,0.88)',
    emoji:'🧊', vibe:'COLD',
  },
  default: {
    bg: ['#0f0a1e','#130d2e','#0a0a18'],
    orb1: ['rgba(139,92,246,0.25)','rgba(139,92,246,0)',200,200],
    orb2: ['rgba(236,72,153,0.2)','rgba(236,72,153,0)',900,900],
    accent:'#8b5cf6', labelColor:'rgba(167,139,250,0.88)',
    dividerColor:'rgba(139,92,246,0.35)',
    hmBg:['rgba(139,92,246,0.2)','rgba(236,72,153,0.12)'],
    hmBorder:'rgba(139,92,246,0.5)', badge:'rgba(139,92,246,0.88)',
    emoji:'🧠', vibe:'DECODED',
  },
};

function getCardTheme(tone: string): CardTheme {
  const t = tone.toLowerCase();
  if (t.includes('savage') || t.includes('aggress'))   return TONE_THEMES.savage;
  if (t.includes('romantic') || t.includes('loving'))  return TONE_THEMES.romantic;
  if (t.includes('flirt'))                              return TONE_THEMES.flirty;
  if (t.includes('mysteri') || t.includes('cryptic'))  return TONE_THEMES.mysterious;
  if (t.includes('playful') || t.includes('funny') || t.includes('humor')) return TONE_THEMES.playful;
  if (t.includes('distant') || t.includes('cold') || t.includes('dismissi') || t.includes('avoid')) return TONE_THEMES.cold;
  return TONE_THEMES.default;
}

function rrect(ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number, r:number) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, font: string, max?: number): string[] {
  ctx.font = font;
  const words = text.split(' '); const lines: string[] = []; let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW) { if (cur) lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  if (max && lines.length > max) { lines.splice(max); lines[max-1] = lines[max-1].replace(/\s*\w+$/, '…'); }
  return lines;
}

async function downloadShareCard(
  originalText: string,
  hiddenMeaning: string,
  tone: string,
  suggestedVibe: string
) {
  const W = 1080, H = 1350, PAD = 80;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const th = getCardTheme(tone);

  // Background
  const bgG = ctx.createLinearGradient(0,0,W,H);
  bgG.addColorStop(0,th.bg[0]); bgG.addColorStop(.5,th.bg[1]); bgG.addColorStop(1,th.bg[2]);
  ctx.fillStyle = bgG; ctx.fillRect(0,0,W,H);

  // Grid
  ctx.strokeStyle='rgba(255,255,255,0.025)'; ctx.lineWidth=1;
  for(let x=0;x<W;x+=45){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=45){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  // Orbs
  const [oa1,ob1,ox1,oy1]=th.orb1;
  const g1=ctx.createRadialGradient(ox1,oy1,0,ox1,oy1,420);
  g1.addColorStop(0,oa1); g1.addColorStop(1,ob1); ctx.fillStyle=g1; ctx.fillRect(0,0,W,H);
  const [oa2,ob2,ox2,oy2]=th.orb2;
  const g2=ctx.createRadialGradient(ox2,oy2,0,ox2,oy2,360);
  g2.addColorStop(0,oa2); g2.addColorStop(1,ob2); ctx.fillStyle=g2; ctx.fillRect(0,0,W,H);

  // ── Top bar ──
  ctx.font='bold 30px monospace'; ctx.fillStyle='rgba(255,255,255,0.5)';
  ctx.fillText('SubText AI', PAD, 70);

  // Vibe badge (top right)
  const badgeText = `${th.emoji}  ${th.vibe}`;
  ctx.font='bold 24px monospace';
  const bW2 = ctx.measureText(badgeText).width + 40;
  rrect(ctx, W-PAD-bW2, 40, bW2, 44, 22);
  ctx.fillStyle=th.badge; ctx.fill();
  ctx.fillStyle='#fff'; ctx.fillText(badgeText, W-PAD-bW2+20, 68);

  ctx.strokeStyle=th.dividerColor; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(PAD,96); ctx.lineTo(W-PAD,96); ctx.stroke();

  // ── THEY SAID ──
  let cy = 136;
  ctx.font='bold 22px monospace'; ctx.fillStyle=th.labelColor;
  ctx.fillText('THEY SAID', PAD, cy); cy+=16;
  ctx.strokeStyle=th.accent; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(PAD,cy); ctx.lineTo(PAD+190,cy); ctx.stroke(); cy+=22;

  const trimMsg = originalText.length > 180 ? originalText.slice(0,177)+'…' : originalText;
  const mLines = wrapLines(ctx, `"${trimMsg}"`, W-PAD*2-60, '500 42px Georgia,serif', 4);
  const mH = mLines.length*58+52;
  rrect(ctx, PAD, cy, W-PAD*2, mH, 20);
  ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.09)'; ctx.lineWidth=1; ctx.stroke();
  ctx.font='500 42px Georgia,serif'; ctx.fillStyle='rgba(255,255,255,0.88)';
  mLines.forEach((l,i) => ctx.fillText(l, PAD+30, cy+46+i*58));
  cy += mH + 50;

  // ── Divider ──
  ctx.strokeStyle=th.dividerColor; ctx.lineWidth=1; ctx.setLineDash([6,5]);
  ctx.beginPath(); ctx.moveTo(PAD,cy); ctx.lineTo(W-PAD,cy); ctx.stroke();
  ctx.setLineDash([]); cy+=42;
  ctx.font='bold 22px monospace'; ctx.fillStyle=th.labelColor;
  const midLbl='✦  WHAT THIS ACTUALLY MEANS  ✦';
  ctx.fillText(midLbl,(W-ctx.measureText(midLbl).width)/2, cy); cy+=50;

  // ── Hidden Meaning card ──
  const hmLines = wrapLines(ctx, hiddenMeaning, W-PAD*2-80, 'bold 54px Georgia,serif', 4);
  const hmH = hmLines.length*72+64;
  const hmG = ctx.createLinearGradient(PAD,cy,W-PAD,cy+hmH);
  hmG.addColorStop(0,th.hmBg[0]); hmG.addColorStop(1,th.hmBg[1]);
  rrect(ctx, PAD, cy, W-PAD*2, hmH, 22);
  ctx.fillStyle=hmG; ctx.fill();
  ctx.strokeStyle=th.hmBorder; ctx.lineWidth=1.5; ctx.stroke();
  ctx.font='bold 54px Georgia,serif'; ctx.fillStyle='#fff';
  hmLines.forEach((l,i) => ctx.fillText(l, PAD+40, cy+58+i*72));
  cy += hmH + 40;

  // ── Tone + Vibe pills ──
  const toneText = `TONE: ${(tone.length>18?tone.slice(0,16)+'…':tone).toUpperCase()}`;
  ctx.font='bold 22px monospace';
  const tpW = ctx.measureText(toneText).width + 44;
  rrect(ctx, PAD, cy, tpW, 50, 25);
  ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.65)'; ctx.fillText(toneText, PAD+22, cy+32);

  const vibeText = suggestedVibe.length>42 ? suggestedVibe.slice(0,39)+'…' : suggestedVibe;
  ctx.font='20px monospace';
  const vpW2 = Math.min(ctx.measureText(vibeText).width+44, W-PAD*2-tpW-20);
  rrect(ctx, PAD+tpW+16, cy, vpW2, 50, 25);
  ctx.fillStyle=th.hmBg[0]; ctx.fill();
  ctx.strokeStyle=th.hmBorder; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle=th.labelColor; ctx.fillText(vibeText, PAD+tpW+16+22, cy+31);

  // ── Bottom branding ──
  const barY = H-118;
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,barY,W,118);
  ctx.strokeStyle=th.dividerColor; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,barY); ctx.lineTo(W,barY); ctx.stroke();
  ctx.font='bold 32px monospace'; ctx.fillStyle='rgba(255,255,255,0.9)';
  ctx.fillText('SubText AI', PAD, barY+56);
  ctx.font='20px monospace'; ctx.fillStyle=th.labelColor;
  ctx.fillText('trysubtext.online', PAD, barY+88);
  ctx.font='bold 24px monospace'; ctx.fillStyle=th.badge;
  const tag="decode what's unsaid ✦";
  ctx.fillText(tag, W-ctx.measureText(tag).width-PAD, barY+72);

  // ── Share or download ──
  return new Promise<void>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('Canvas export failed')); return; }
      const file = new File([blob], 'subtext-decoded.png', { type: 'image/png' });
      if (
        typeof navigator !== 'undefined' &&
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({ files: [file], title: 'SubText decoded this' });
        } catch (e: any) {
          if (e?.name !== 'AbortError') reject(e);
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href=url; a.download='subtext-decoded.png'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      resolve();
    }, 'image/png');
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();

  const [user,            setUser]            = useState<User | null>(null);
  const [credits,         setCredits]         = useState<number>(0);
  const [input,           setInput]           = useState<string>('');
  const [context,         setContext]         = useState<string>('');
  const [loading,         setLoading]         = useState<boolean>(false);
  const [loadingReplies,  setLoadingReplies]  = useState<boolean>(false);
  // FIX 5: decode + replies can coexist
  const [decodeOutput,    setDecodeOutput]    = useState<DecodeResult | null>(null);
  const [replyOutput,     setReplyOutput]     = useState<ReplyResult  | null>(null);
  const [toast,           setToast]           = useState<{ message: string; type: ToastType } | null>(null);
  const [placeholderIdx,  setPlaceholderIdx]  = useState(0);
  const [isFocused,       setIsFocused]       = useState(false);
  const [isGeneratingCard,setIsGeneratingCard]= useState(false);
  const [selectedImage,   setSelectedImage]   = useState<File | null>(null);
  const [imagePreview,    setImagePreview]    = useState<string | null>(null);
  const [ocrLoading,      setOcrLoading]      = useState<boolean>(false);
  const [lastDecodeResult,setLastDecodeResult]= useState<DecodeResult | null>(null);
  const [showClearConfirm,setShowClearConfirm]= useState(false); // FIX: safe clear

  const resultsRef = useRef<HTMLDivElement>(null);

  // Rotating placeholders
  useEffect(() => {
    const id = setInterval(() => setPlaceholderIdx(p => (p+1) % ROTATING_PLACEHOLDERS.length), 4000);
    return () => clearInterval(id);
  }, []);

  // FIX 4: Restore session state on mount
  useEffect(() => {
    try {
      const si = sessionStorage.getItem(SS_INPUT);
      const sc = sessionStorage.getItem(SS_CONTEXT);
      const so = sessionStorage.getItem(SS_OUTPUT);
      const sd = sessionStorage.getItem(SS_DECODE);
      if (si) setInput(si);
      if (sc) setContext(sc);
      if (so) {
        const parsed = JSON.parse(so);
        if (parsed.type === 'decode') setDecodeOutput(parsed.data);
        if (parsed.type === 'reply')  setReplyOutput(parsed.data);
      }
      if (sd) setLastDecodeResult(JSON.parse(sd));
    } catch {}
  }, []);

  // FIX 4: Persist state to sessionStorage on change
  useEffect(() => { sessionStorage.setItem(SS_INPUT, input); }, [input]);
  useEffect(() => { sessionStorage.setItem(SS_CONTEXT, context); }, [context]);
  useEffect(() => {
    if (decodeOutput) sessionStorage.setItem(SS_OUTPUT, JSON.stringify({ type: 'decode', data: decodeOutput }));
  }, [decodeOutput]);
  useEffect(() => {
    if (replyOutput) sessionStorage.setItem(SS_OUTPUT, JSON.stringify({ type: 'reply', data: replyOutput }));
  }, [replyOutput]);
  useEffect(() => {
    if (lastDecodeResult) sessionStorage.setItem(SS_DECODE, JSON.stringify(lastDecodeResult));
  }, [lastDecodeResult]);

  // Auth
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) { setUser(session.user); fetchCredits(session.user.id); }
      else router.push('/auth');
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) { setUser(session.user); fetchCredits(session.user.id); }
      else { setUser(null); router.push('/auth'); }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const fetchCredits = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('credits').eq('id', uid).single();
    if (data) setCredits(data.credits);
  };

  const performVisionOCR = async (file: File) => {
    setOcrLoading(true);
    try {
      const fd = new FormData(); fd.append('image', file);
      const res  = await fetch('/api/ocr-vision', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); return; }
      const msgs = data.messages;
      if (msgs && Array.isArray(msgs) && msgs.length > 0) {
        setInput(msgs.map((m: {role:string;text:string}) => `${m.role==='user'?'You':'Them'}: ${m.text}`).join('\n\n'));
        showToast('Conversation extracted!', 'success');
      } else {
        showToast('Could not parse conversation. Try a clearer screenshot.', 'error');
      }
    } catch (e) {
      console.error(e); showToast('Failed to extract text from image.', 'error');
    } finally { setOcrLoading(false); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5*1024*1024) { showToast('Image too large (max 5MB)', 'error'); return; }
    setSelectedImage(file); setImagePreview(URL.createObjectURL(file)); performVisionOCR(file);
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(null); setImagePreview(null);
  };

  const handleDecode = async () => {
    if (!input.trim()) { showToast('Please paste a message or upload a screenshot', 'error'); return; }
    if (credits <= 0)  { showToast('Out of credits! Please upgrade.', 'error'); return; }
    setLoading(true); setReplyOutput(null);
    try {
      const res  = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, text: input, context: context.trim() || undefined }),
      });
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); }
      else {
        setDecodeOutput(data.result as DecodeResult);
        setLastDecodeResult(data.result as DecodeResult);
        setCredits(p => p - 1);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    } catch (e) { console.error(e); showToast('Something went wrong. Try again.', 'error'); }
    finally { setLoading(false); }
  };

  const generateRepliesFromDecode = async () => {
    if (!lastDecodeResult) { showToast('Please decode the message first', 'error'); return; }
    if (credits <= 0)      { showToast('Out of credits! Please upgrade.', 'error'); return; }
    setLoadingReplies(true);
    try {
      const bestTone = getBestToneForVibe(lastDecodeResult.suggestedVibe).toLowerCase().trim();
      const enhancedContext = [
        context,
        `[Decoded Analysis] ${lastDecodeResult.analysis}`,
        `[Hidden Meaning] ${lastDecodeResult.hiddenMeaning}`,
        `[Suggested Vibe] ${lastDecodeResult.suggestedVibe}`,
      ].filter(Boolean).join('\n');
      const res  = await fetch('/api/generate-reply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, text: input, context: enhancedContext, tone: bestTone }),
      });
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); }
      else {
        setReplyOutput(data.result as ReplyResult);
        setCredits(p => p - 1);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    } catch (e) { console.error(e); showToast('Something went wrong. Try again.', 'error'); }
    finally { setLoadingReplies(false); }
  };

  const handleGoViral = async () => {
    if (!decodeOutput) return;
    setIsGeneratingCard(true);
    try {
      await downloadShareCard(input, decodeOutput.hiddenMeaning, decodeOutput.tone, decodeOutput.suggestedVibe);
      showToast('Share card ready! Post it anywhere 🔥', 'success');
    } catch (e) { console.error(e); showToast('Could not generate card. Try again.', 'error'); }
    finally { setIsGeneratingCard(false); }
  };

  const handleClearAll = () => {
    setDecodeOutput(null); setReplyOutput(null); setLastDecodeResult(null);
    setInput(''); setContext(''); setShowClearConfirm(false);
    [SS_INPUT, SS_CONTEXT, SS_OUTPUT, SS_DECODE].forEach(k => sessionStorage.removeItem(k));
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/'); };
  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); showToast('Copied!', 'success'); };
  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const isLowCredits = credits > 0 && credits <= LOW_CREDIT_THRESHOLD;
  const isOutOfCredits = credits === 0;
  const charPct = (input.length / MAX_CHARS) * 100;
  const charWarning = input.length > MAX_CHARS * 0.85;
  const charOver    = input.length > MAX_CHARS;

  const repliesWithTags: ReplyWithTag[] = replyOutput?.replies
    ? replyOutput.replies.map((r, i) => ({ ...r, tag: getReplyTag(r, i) }))
    : [];

  const hasAnyOutput = !!(decodeOutput || replyOutput);

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-purple-500/30 relative">
      <style jsx>{`
        @keyframes fadeInUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer    { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes pulse-slow { 0%,100%{opacity:.6} 50%{opacity:1} }
        .animate-fadeInUp  { animation: fadeInUp .5s ease-out forwards; }
        .shimmer-btn {
          background: linear-gradient(90deg,#7c3aed,#ec4899,#f97316,#ec4899,#7c3aed);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
        .pulse-slow { animation: pulse-slow 2s ease-in-out infinite; }
      `}</style>

      {/* Ambient BG */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-zinc-950 to-zinc-950 opacity-50" />
        <div className="absolute inset-0 opacity-20" style={{backgroundImage:`radial-gradient(circle at 1px 1px,rgba(255,255,255,.05) 1px,transparent 0)`,backgroundSize:'40px 40px'}} />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-zinc-950/70 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
            <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-1.5 rounded-lg shadow-lg shadow-purple-500/20">
              <Sparkles className="text-white w-5 h-5 fill-white" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent hidden sm:block">SubText AI</span>
          </div>
          <div className="flex items-center gap-4">
            {/* FIX 2: Credits pill with low/empty state colour */}
            <Link
              href="/pricing"
              className={`flex items-center gap-2 border px-3 py-1.5 rounded-full transition-all hover:scale-105 group ${
                isOutOfCredits
                  ? 'bg-red-500/10 border-red-500/40 animate-pulse'
                  : isLowCredits
                  ? 'bg-amber-500/10 border-amber-500/40 pulse-slow'
                  : 'bg-zinc-900/50 border-white/10 hover:bg-zinc-800 hover:border-white/20'
              }`}
            >
              <Zap className={`w-4 h-4 ${isOutOfCredits ? 'text-red-400' : isLowCredits ? 'text-amber-400' : 'text-yellow-400'}`} />
              <span className={`text-sm font-medium ${isOutOfCredits ? 'text-red-300' : isLowCredits ? 'text-amber-300' : 'text-zinc-300 group-hover:text-white'}`}>
                {credits} credits
              </span>
            </Link>
            <div className="flex items-center gap-1 pl-4 border-l border-white/10">
              <div className="hidden md:block text-right pr-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Welcome</p>
                <p className="text-sm font-semibold text-white truncate max-w-[120px]">{userName}</p>
              </div>
              <Link href="/settings" className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition rounded-lg"><Settings size={18} /></Link>
              <button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition rounded-lg"><LogOut size={18} /></button>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-28 pb-20 px-4 max-w-4xl mx-auto">

        {/* Hero */}
        <div className="text-center mb-10 animate-fadeInUp">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Decode the <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">hidden meaning</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Paste any message or upload a screenshot – get instant AI analysis and perfect replies.
          </p>
        </div>

        {/* FIX 2: Low credit inline banner above decode button */}
        {(isLowCredits || isOutOfCredits) && (
          <div className={`mb-6 rounded-2xl px-5 py-4 flex items-center gap-4 border animate-fadeInUp ${
            isOutOfCredits
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}>
            <AlertTriangle size={18} className={isOutOfCredits ? 'text-red-400 shrink-0' : 'text-amber-400 shrink-0'} />
            <p className={`text-sm flex-1 ${isOutOfCredits ? 'text-red-300' : 'text-amber-300'}`}>
              {isOutOfCredits
                ? "You're out of credits. Top up to keep decoding."
                : `Only ${credits} credit${credits === 1 ? '' : 's'} left — running low.`}
            </p>
            <Link
              href="/pricing"
              className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1 transition-all ${
                isOutOfCredits
                  ? 'bg-red-500 hover:bg-red-400 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              Get credits <ArrowRight size={12} />
            </Link>
          </div>
        )}

        {/* Input Card */}
        <div className={`bg-zinc-900/40 border rounded-3xl p-6 md:p-8 mb-12 backdrop-blur-xl shadow-2xl shadow-black/20 transition-all duration-300 ${isFocused ? 'border-purple-500/40 shadow-purple-500/10' : 'border-white/10'}`}>
          <textarea
            className="w-full bg-transparent text-xl md:text-2xl placeholder-zinc-600 focus:outline-none resize-none min-h-[120px] leading-relaxed font-medium transition-all"
            placeholder={ROTATING_PLACEHOLDERS[placeholderIdx]}
            value={input}
            onChange={e => { if (e.target.value.length <= MAX_CHARS + 50) setInput(e.target.value); }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />

          {/* FIX: char counter */}
          <div className="flex justify-between items-center mt-2 text-xs text-zinc-500">
            <div className="flex items-center gap-3">
              <span className={charOver ? 'text-red-400 font-bold' : charWarning ? 'text-amber-400' : ''}>
                {input.length}/{MAX_CHARS}
              </span>
              {input.length > 0 && !charOver && <span className="text-purple-400 animate-pulse">Ready to decode</span>}
              {charOver && <span className="text-red-400">Too long — trim it down for best results</span>}
            </div>
            {/* Mini progress bar */}
            {input.length > 0 && (
              <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${charOver ? 'bg-red-500' : charWarning ? 'bg-amber-400' : 'bg-purple-500'}`}
                  style={{ width: `${Math.min(charPct, 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Screenshot upload */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm font-medium hover:bg-purple-500/20 transition-colors">
              <Upload size={16} />
              Upload Screenshot
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            {ocrLoading && (
              <div className="flex items-center gap-2 text-sm text-zinc-400 bg-black/30 px-3 py-1.5 rounded-full">
                <Loader2 size={14} className="animate-spin" /> Extracting conversation...
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

          {/* FIX 3: Context field with tap-to-fill suggestions */}
          <div className="group mt-6">
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 group-focus-within:text-purple-400 transition-colors">
              <Lightbulb size={12} /> What do you actually want to know? (optional)
            </label>
            <textarea
              className="w-full bg-black/20 border border-white/5 rounded-xl p-4 text-sm placeholder-zinc-600 focus:outline-none focus:border-purple-500/30 focus:bg-black/40 transition resize-none"
              placeholder="e.g. 'Are they interested?' or 'Should I even reply?'"
              value={context}
              onChange={e => setContext(e.target.value)}
              rows={2}
            />
            {/* Tap-to-fill suggestions */}
            <div className="flex flex-wrap gap-2 mt-2">
              {CONTEXT_SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setContext(s)}
                  className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:bg-purple-500/20 hover:border-purple-500/40 hover:text-purple-300 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Decode button */}
          <div className="mt-8">
            <button
              onClick={handleDecode}
              disabled={loading || charOver || (!input.trim() && !ocrLoading) || isOutOfCredits}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold py-4 rounded-xl hover:opacity-90 hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg group"
            >
              {loading
                ? <><Loader2 className="animate-spin" size={22}/><span>Decoding<span className="animate-pulse">...</span></span></>
                : <><Brain size={22} className="group-hover:scale-110 transition-transform"/>Decode Message</>
              }
            </button>
          </div>
        </div>

        {/* ── Results ── */}
        {(hasAnyOutput || loading || loadingReplies) && (
          <div ref={resultsRef} className="space-y-8 animate-fadeInUp">

            {/* FIX 5: Decode result always stays visible */}
            {decodeOutput && (
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-[26px] blur opacity-20 group-hover:opacity-40 transition duration-700" />
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
                      <p className="text-white text-base leading-relaxed">{decodeOutput.analysis}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all">
                      <div className="flex items-center gap-2 mb-3">
                        <Smile size={16} className="text-emerald-400" />
                        <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Detected Tone</p>
                      </div>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-emerald-300 font-medium">{decodeOutput.tone}</span>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all md:col-span-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Target size={16} className="text-amber-400" />
                        <p className="text-amber-400 text-xs font-bold uppercase tracking-wider">Suggested Vibe for Reply</p>
                      </div>
                      <p className="text-amber-200/90 text-lg font-medium">{decodeOutput.suggestedVibe}</p>
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
                      {decodeOutput.hiddenMeaning}
                    </p>
                  </div>

                  {/* Go Viral */}
                  <div className="mt-6 p-4 bg-black/30 rounded-2xl border border-white/5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-1.5 bg-pink-500/10 rounded-lg border border-pink-500/20 mt-0.5">
                        <Share2 size={14} className="text-pink-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Go Viral</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Creates a card styled to the <span className="text-zinc-400 font-medium">{decodeOutput.tone}</span> tone — share straight to TikTok, Reels, or Stories
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleGoViral}
                      disabled={isGeneratingCard}
                      className="shimmer-btn w-full text-white font-bold py-3.5 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 text-sm tracking-wide shadow-lg shadow-pink-500/20 hover:shadow-pink-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      {isGeneratingCard
                        ? <><Loader2 size={16} className="animate-spin"/>Building your card...</>
                        : <><Share2 size={16}/>Share This Decode <span className="text-white/60 font-normal">→ TikTok · Reels · Stories</span></>
                      }
                    </button>
                  </div>

                  <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-8" />

                  <button
                    onClick={generateRepliesFromDecode}
                    disabled={loadingReplies || isOutOfCredits}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 font-semibold text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingReplies
                      ? <><Loader2 size={20} className="animate-spin"/>Generating replies...</>
                      : <><Send size={18} className="group-hover:translate-x-1 transition-transform"/>Generate Smart Replies</>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* Loading skeleton for decode */}
            {loading && !decodeOutput && (
              <div className="space-y-5 animate-pulse">
                <div className="bg-zinc-900/50 rounded-2xl p-6 border border-white/5">
                  <div className="h-6 w-32 bg-purple-500/20 rounded mb-6" />
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="h-32 bg-white/5 rounded-xl" />
                    <div className="h-32 bg-white/5 rounded-xl" />
                    <div className="md:col-span-2 h-24 bg-white/5 rounded-xl" />
                  </div>
                  <div className="mt-6 h-40 bg-purple-500/10 rounded-xl" />
                </div>
              </div>
            )}

            {/* FIX 5: Replies appear BELOW decode, not replacing it */}
            {replyOutput && (
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={16} /> Choose Your Reply
                  </h3>
                  {/* FIX: confirm before clearing */}
                  {showClearConfirm ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-400">Clear everything?</span>
                      <button onClick={handleClearAll} className="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition">Yes, clear</button>
                      <button onClick={() => setShowClearConfirm(false)} className="px-2 py-1 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 transition">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowClearConfirm(true)} className="text-xs text-zinc-600 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
                      Clear all <X size={14} />
                    </button>
                  )}
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
                          onClick={e => { e.stopPropagation(); copyToClipboard(reply.text); }}
                          className="p-2.5 bg-zinc-800 hover:bg-white text-zinc-400 hover:text-black rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-4">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full border ${tagStyles[reply.tag]}`}>
                          {tagIcons[reply.tag]}{reply.tag}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-zinc-400 border border-white/5">{reply.tone}</span>
                        {reply.explanation && <span className="text-xs text-zinc-500 italic">"{reply.explanation}"</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loading skeleton for replies */}
            {loadingReplies && !replyOutput && (
              <div className="space-y-4 animate-pulse">
                <div className="h-8 w-48 bg-white/10 rounded" />
                {[1,2,3].map(i => <div key={i} className="bg-zinc-900/50 rounded-2xl p-5 border border-white/5 h-28" />)}
              </div>
            )}
          </div>
        )}

        {/* FIX 1: Rich empty state with example decode */}
        {!hasAnyOutput && !loading && !loadingReplies && (
          <div className="animate-fadeInUp">
            <div className="text-center mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">Example Decode</p>
            </div>
            <div className="relative opacity-70 hover:opacity-90 transition-opacity duration-300 pointer-events-none select-none">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600/30 to-pink-600/30 rounded-[26px] blur" />
              <div className="relative bg-zinc-900/60 border border-white/10 rounded-[24px] p-6 md:p-8">
                {/* Example input bubble */}
                <div className="mb-5 flex items-center gap-2">
                  <div className="bg-zinc-800/80 rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs">
                    <p className="text-zinc-200 text-sm">{EXAMPLE_DECODE.input}</p>
                  </div>
                  <span className="text-xs text-zinc-600 italic">their message</span>
                </div>
                <div className="grid md:grid-cols-2 gap-4 mb-5">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <p className="text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-2">Deep Analysis</p>
                    <p className="text-zinc-300 text-sm leading-relaxed">{EXAMPLE_DECODE.analysis}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-2">Detected Tone</p>
                    <div className="inline-flex px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-emerald-300 text-sm font-medium">{EXAMPLE_DECODE.tone}</span>
                    </div>
                  </div>
                </div>
                <div className="p-5 bg-gradient-to-br from-purple-900/30 to-indigo-900/20 rounded-2xl border border-purple-500/30">
                  <p className="text-purple-400 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1"><Eye size={12}/> Hidden Meaning</p>
                  <p className="text-white text-lg font-semibold">{EXAMPLE_DECODE.hiddenMeaning}</p>
                </div>
                <div className="mt-4 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-1">Suggested Vibe</p>
                  <p className="text-amber-200/80 text-sm">{EXAMPLE_DECODE.suggestedVibe}</p>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-zinc-600 mt-4">Paste your message above to get your own decode</p>
          </div>
        )}

        <div className="mt-20 text-center">
          <p className="text-xs text-zinc-600 flex items-center justify-center gap-1">
            <Sparkles size={10} /> Powered by SubText AI — Decode what's unsaid
          </p>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-3 z-50 backdrop-blur-md border ${
          toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-500/20 text-white' : 'bg-red-500/90 border-red-500/20 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={18}/> : <X size={18}/>}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
