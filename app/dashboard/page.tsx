'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { 
  Sparkles, LogOut, Copy, Loader2, Zap, MessageSquare, Brain,
  X, Settings, CheckCircle, Info, ChevronRight, Upload, Trash2
} from 'lucide-react';

// Types (same as before)
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

// Tone mapping (unchanged)
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
  const vibeLower = suggestedVibe.toLowerCase();
  const match = TONE_OPTIONS.find(tone => 
    tone.vibeMatch.some(match => vibeLower.includes(match) || match === vibeLower)
  );
  return match?.label || 'Chill';
};

export default function Dashboard() {
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [input, setInput] = useState<string>('');
  const [context, setContext] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [output, setOutput] = useState<{ data: DecodeResult | ReplyResult; type: OutputType } | null>(null);
  const [activeTab, setActiveTab] = useState<'decode' | 'reply'>('decode');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  
  // Screenshot states
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);

  const [lastDecodeResult, setLastDecodeResult] = useState<DecodeResult | null>(null);

  // Auth & Credits (unchanged)
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

  // UPDATED: Vision OCR using GPT-4o-mini with new messages array format
  const performVisionOCR = async (file: File) => {
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const res = await fetch('/api/ocr-vision', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (data.error) {
        showToast(data.error, 'error');
        return;
      }
      
      // New logic: use messages array and convert to readable format
      const messages = data.messages;
      
      if (messages && Array.isArray(messages) && messages.length > 0) {
        // Format each message as "You: text" or "Them: text"
        const formattedLines = messages.map((msg: { role: string; text: string }) => {
          const speaker = msg.role === 'user' ? 'You' : 'Them';
          return `${speaker}: ${msg.text}`;
        });
        
        const formattedConversation = formattedLines.join('\n\n');
        setInput(formattedConversation);
        showToast('Conversation extracted with speaker labels!', 'success');
      } else {
        // No messages found – show error as requested
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
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image too large (max 5MB)', 'error');
      return;
    }
    setSelectedImage(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    performVisionOCR(file);
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(null);
    setImagePreview(null);
  };

  // Main decode action (unchanged logic)
  const handleDecode = async () => {
    if (!input.trim()) {
      showToast('Please paste a message or upload a screenshot', 'error');
      return;
    }
    if (credits <= 0) {
      showToast('Out of credits! Please upgrade.', 'error');
      return;
    }

    setLoading(true);
    setActiveTab('decode');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          text: input,
          context: context.trim() || undefined
        })
      });
      
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        setOutput({ data: data.result, type: 'decode' });
        setCredits(prev => prev - 1);
        setLastDecodeResult(data.result as DecodeResult);
        
        setTimeout(() => {
          document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err) {
      console.error(err);
      showToast('Something went wrong. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateRepliesFromDecode = async () => {
    if (!lastDecodeResult) {
      showToast('Please decode the message first', 'error');
      return;
    }
    if (credits <= 0) {
      showToast('Out of credits! Please upgrade.', 'error');
      return;
    }

    setLoading(true);
    setActiveTab('reply');
    try {
      const bestTone = getBestToneForVibe(lastDecodeResult.suggestedVibe);
      
      const enhancedContext = [
        context,
        `[Decoded Analysis] ${lastDecodeResult.analysis}`,
        `[Hidden Meaning] ${lastDecodeResult.hiddenMeaning}`,
        `[Suggested Vibe] ${lastDecodeResult.suggestedVibe}`
      ].filter(Boolean).join('\n');

      const res = await fetch('/api/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          text: input,
          context: enhancedContext,
          tone: bestTone
        })
      });
      
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        setOutput({ data: data.result, type: 'reply' });
        setCredits(prev => prev - 1);
        setTimeout(() => {
          document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err) {
      console.error(err);
      showToast('Something went wrong. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-purple-500/30 relative">
      {/* Ambient background (unchanged) */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-zinc-950 to-zinc-950 opacity-50" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)`, backgroundSize: `40px 40px` }} />
      </div>

      {/* Navbar (unchanged) */}
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
        
        {/* Header (unchanged) */}
        <div className="text-center mb-10 animate-fade-in-up">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Decode the <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">hidden meaning</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Paste any message or upload a screenshot – get instant AI analysis and perfect replies.
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-zinc-900/40 border border-white/10 rounded-3xl p-6 md:p-8 mb-12 backdrop-blur-xl shadow-2xl shadow-black/20 transition-all hover:border-white/20 animate-slide-in-up">
          <textarea
            className="w-full bg-transparent text-xl md:text-2xl placeholder-zinc-600 focus:outline-none resize-none min-h-[120px] leading-relaxed font-medium"
            placeholder='Paste their message here... e.g. "Im busy rn, talk later" or upload a screenshot'
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          {/* Screenshot Upload */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm font-medium hover:bg-purple-500/20 transition-colors">
              <Upload size={16} />
              Upload Screenshot
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            {ocrLoading && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 size={14} className="animate-spin" />
                Extracting conversation with AI...
              </div>
            )}
            {imagePreview && !ocrLoading && (
              <div className="relative inline-block">
                <img src={imagePreview} alt="Preview" className="h-12 w-auto rounded-md border border-white/10 object-cover" />
                <button onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5 text-white hover:bg-red-600 transition">
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
          
          {/* Context Input - now supports questions */}
          <div className="group mt-6">
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 group-focus-within:text-purple-400 transition-colors">
              <Info size={12} /> Context or Question (optional)
            </label>
            <textarea
              className="w-full bg-black/20 border border-white/5 rounded-xl p-4 text-sm placeholder-zinc-600 focus:outline-none focus:border-purple-500/30 focus:bg-black/40 transition resize-none"
              placeholder="Add context or ask a question about the conversation, e.g., 'Am I overreacting?', 'What does she really mean?', 'Is this sarcastic?'"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
            />
          </div>

          {/* Decode Button */}
          <div className="mt-8">
            <button
              onClick={handleDecode}
              disabled={loading || (!input.trim() && !ocrLoading)}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold py-4 rounded-xl hover:opacity-90 hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg group"
            >
              {loading && activeTab === 'decode' ? <Loader2 className="animate-spin" size={22} /> : <Brain size={22} className="group-hover:scale-110 transition-transform" />}
              {loading && activeTab === 'decode' ? 'Decoding...' : 'Decode Message'}
            </button>
          </div>
        </div>

        {/* Results Section (unchanged) */}
        {output && (
          <div id="results" className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            
            {output.type === 'decode' && (
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-[26px] blur opacity-20 group-hover:opacity-40 transition duration-700"></div>
                <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-[24px] p-8 md:p-10 shadow-2xl">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <Brain className="text-purple-400" size={24} />
                    </div>
                    <h3 className="font-bold uppercase tracking-widest text-sm text-purple-300">AI Decoded Analysis</h3>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-3">Deep Dive</p>
                      <p className="text-white text-xl leading-relaxed font-light">{(output.data as DecodeResult).analysis}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Detected Tone:</span>
                      <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-zinc-300">
                        {(output.data as DecodeResult).tone}
                      </span>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-purple-900/20 to-indigo-900/10 rounded-2xl border border-purple-500/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Sparkles size={64} className="text-purple-500" /></div>
                      <p className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Sparkles size={12} /> Hidden Meaning
                      </p>
                      <p className="text-white text-xl font-medium leading-relaxed relative z-10">
                        {(output.data as DecodeResult).hiddenMeaning}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Suggested Vibe for Reply</p>
                      <p className="text-zinc-300 text-lg">{(output.data as DecodeResult).suggestedVibe}</p>
                    </div>
                  </div>
                  
                  <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-10"></div>
                  
                  <button
                    onClick={generateRepliesFromDecode}
                    disabled={loading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 font-semibold text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 group"
                  >
                    {loading && activeTab === 'reply' ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <>
                        <MessageSquare size={20} />
                        Generate Smart Replies
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {output.type === 'reply' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={16} /> Suggested Replies
                  </h3>
                  <button onClick={() => setOutput(null)} className="text-xs text-zinc-600 hover:text-white flex items-center gap-1 transition-colors">
                    Clear <X size={14} />
                  </button>
                </div>
                <div className="grid gap-4">
                  {(output.data as ReplyResult).replies.map((reply, i) => (
                    <div key={i} className="group relative bg-zinc-900/50 hover:bg-zinc-900/80 border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all duration-300">
                      <p className="text-zinc-100 pr-10 text-lg leading-relaxed">{reply.text}</p>
                      <div className="flex items-center gap-3 mt-4">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-white/5 text-zinc-400 border border-white/5">
                          {reply.tone}
                        </span>
                        {reply.explanation && (
                          <span className="text-xs text-zinc-500 italic">"{reply.explanation}"</span>
                        )}
                      </div>
                      <button 
                        onClick={() => copyToClipboard(reply.text)} 
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-zinc-800 hover:bg-white text-zinc-400 hover:text-black rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0"
                        title="Copy to clipboard"
                      >
                        <Copy size={16} />
                      </button>
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

        {/* Empty State */}
        {!output && !loading && (
          <div className="text-center py-24 opacity-30 border-2 border-dashed border-white/10 rounded-3xl animate-pulse">
            <div className="inline-flex p-4 rounded-full bg-white/5 mb-4">
              <MessageSquare size={32} className="text-white" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium tracking-wide text-zinc-400">Paste a message or upload a screenshot to start</p>
          </div>
        )}
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
