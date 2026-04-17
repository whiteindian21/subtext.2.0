"use client";

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  MessageSquare, 
  Brain,
  Sparkles,
  Zap,
  Check,
  Star,
  Flame,
  Copy,
  CheckCircle2,
  ChevronUp,
  RefreshCw,
  Share2,
  X
} from 'lucide-react';

// --- Custom Animations (Tailwind doesn't have these by default) ---
// Ideally put these in your globals.css, but included here for a single-file solution.
const customStyles = `
  @keyframes gradient-x {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  .animate-gradient-x {
    background-size: 200% 200%;
    animation: gradient-x 3s ease infinite;
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  .animate-float {
    animation: float 6s ease-in-out infinite;
  }
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .group-hover\\:shimmer:hover::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent);
    transform: skewX(-20deg) translateX(-150%);
    transition: transform 0.5s;
    animation: shimmer 1s forwards;
  }
`;

// --- Components ---

const Navbar = () => (
  <>
    <style>{customStyles}</style>
    <nav className="fixed w-full z-50 top-0 border-b border-white/5 bg-zinc-950/70 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform duration-300">
            <Sparkles className="text-white w-5 h-5 fill-white" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">SubText AI</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/auth" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors px-4 py-2 rounded-full hover:bg-white/5">Login</Link>
          <Link href="/auth" className="hidden sm:flex items-center gap-2 text-sm font-bold bg-white text-black px-5 py-2.5 rounded-full hover:bg-zinc-200 hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  </>
);

const Hero = () => {
  const demoRef = useRef<HTMLElement>(null);
  const scrollToDemo = () => demoRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      {/* Enhanced Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] -z-10 animate-pulse opacity-40" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[100px] -z-10 animate-float" />
      
      {/* Subtle Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-20 -z-10 pointer-events-none"
        style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`, backgroundSize: `40px 40px` }}
      />

      <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-8 backdrop-blur-md shadow-lg shadow-indigo-500/10 animate-fade-in-up">
          <Zap size={12} className="text-indigo-400 fill-indigo-400" /> The #1 AI Text Analyzer
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1] text-white animate-fade-in-up animation-delay-150">
          Decode what they <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient-x">REALLY mean</span>
        </h1>
        
        <p className="text-lg md:text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed animate-fade-in-up animation-delay-300">
          Stop overthinking texts. Let AI break it down, reveal hidden psychology, and generate the perfect viral reply in seconds.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-500">
          <Link href="/auth" className="group relative overflow-hidden w-full sm:w-auto bg-white text-black font-bold text-lg px-8 py-4 rounded-full hover:scale-105 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2 shimmer">
            Try it now <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <button onClick={scrollToDemo} className="w-full sm:w-auto px-8 py-4 rounded-full border border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white transition-all duration-300 font-medium backdrop-blur-sm hover:border-white/20">
            See how it works
          </button>
        </div>
        
        <div className="mt-16 flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500 font-medium">
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5"><Sparkles size={14} className="text-yellow-500"/> 10k+ Active Users</div>
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5"><Star size={14} className="text-purple-400 fill-purple-400"/> 4.9 Rating</div>
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5"><Zap size={14} className="text-blue-400"/> 1M+ Decoded</div>
        </div>
      </div>
    </section>
  );
};

const DemoSection = () => {
  // Fixed hook placement
  const demoRef = useRef<HTMLElement>(null);
  const [message, setMessage] = useState("I'm busy rn, talk later");
  const [selectedTone, setSelectedTone] = useState('Savage');
  const [analysis, setAnalysis] = useState('');
  const [suggestedReply, setSuggestedReply] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);

  const analyzeMessage = (text: string) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('busy') || lowerText.includes('later') || lowerText.includes('rn'))
      return "📊 Analysis: They're likely creating distance or avoiding deeper conversation. Short, non-committal replies often indicate low investment or testing your reaction. Best approach: mirror their energy or call it out playfully.";
    if (lowerText.includes('hey') || lowerText.includes('hi') || lowerText.includes('hello'))
      return "📊 Analysis: Low-effort opener. They're testing the waters but not fully engaged. This is a neutral signal - reply with something interesting to gauge their real interest level.";
    if (lowerText.includes('?') && text.length > 30)
      return "📊 Analysis: Engaged and curious! They're asking thoughtful questions which shows genuine interest. High green flag - reciprocate with similar energy and depth.";
    if (lowerText.includes('sorry') || lowerText.includes('my bad'))
      return "📊 Analysis: They're acknowledging a mistake, which shows emotional intelligence. However, look for changed behavior - words without action are just empty apologies.";
    return "📊 Analysis: Neutral tone detected. They're being polite but not overly invested. This could be a baseline response - look for patterns over multiple messages to determine true feelings.";
  };

  const generateReply = (tone: string, originalMessage: string) => {
    const lowerOriginal = originalMessage.toLowerCase();
    const isLowEffort = lowerOriginal.includes('busy') || lowerOriginal.includes('later') || lowerOriginal.includes('rn');
    const replies: Record<string, Record<string, string>> = {
      Confident: { lowEffort: "Cool. Let me know when your schedule clears up and we can talk for real.", default: "No worries. Hit me up when you're free to have an actual conversation." },
      Funny: { lowEffort: "Wow, 4 whole words? Don't overwhelm yourself!", default: "I'll try to contain my excitement 🙃" },
      Savage: { lowEffort: "That's the longest text you've sent all week. Progress!", default: "K. Don't hurt yourself typing that." },
      Chill: { lowEffort: "No rush, I'll be doing interesting things ✌️", default: "All good, catch you later! 👋" }
    };
    return isLowEffort ? replies[tone]?.lowEffort : replies[tone]?.default;
  };

  useEffect(() => {
    setIsAnalyzing(true);
    const timer = setTimeout(() => {
      setAnalysis(analyzeMessage(message));
      setSuggestedReply(generateReply(selectedTone, message));
      setIsAnalyzing(false);
    }, 400); // Slightly longer delay for realism
    return () => clearTimeout(timer);
  }, [message, selectedTone]);

  const tones = [
    { label: 'Confident 😎', value: 'Confident', color: 'from-blue-500/10 to-blue-600/5 border-blue-500/30 hover:border-blue-500/60' },
    { label: 'Funny 😂', value: 'Funny', color: 'from-yellow-500/10 to-yellow-600/5 border-yellow-500/30 hover:border-yellow-500/60' },
    { label: 'Savage 🔥', value: 'Savage', color: 'from-red-500/10 to-red-600/5 border-red-500/30 hover:border-red-500/60' },
    { label: 'Chill ❤️', value: 'Chill', color: 'from-pink-500/10 to-pink-600/5 border-pink-500/30 hover:border-pink-500/60' }
  ];

  return (
    <section ref={demoRef} className="py-24 relative">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">See it in action</h2>
          <p className="text-zinc-400 text-lg">Type any message and watch the AI decode it instantly</p>
        </div>
        
        <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-1 md:p-2 shadow-2xl relative overflow-hidden backdrop-blur-xl ring-1 ring-white/5">
          {/* Decorative gradient border effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 opacity-0 pointer-events-none" />
          
          <div className="bg-black/40 rounded-2xl p-6 md:p-8 min-h-[500px] flex flex-col md:flex-row gap-8 md:gap-12">
            {/* Left Column: Input */}
            <div className="flex-1 flex flex-col gap-6">
              <div className="flex-1 bg-zinc-900/50 rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors relative group">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  ✏️ Edit the message:
                </label>
                <textarea 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)} 
                  className="w-full bg-transparent text-white text-xl md:text-2xl outline-none resize-none placeholder-zinc-700 font-medium leading-relaxed h-40" 
                />
                <div className="absolute bottom-4 right-4 text-zinc-700 text-xs font-mono">Beta v1.0</div>
              </div>

              <div className="flex items-center gap-3 text-zinc-500 text-sm font-medium">
                <div className="h-px bg-white/10 flex-1" />
                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                  {isAnalyzing && <RefreshCw size={12} className="animate-spin text-indigo-400" />}
                  {isAnalyzing ? 'Decoding...' : 'Analysis Complete'}
                </div>
                <div className="h-px bg-white/10 flex-1" />
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900/20 to-purple-900/10 border border-indigo-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Brain size={64} /></div>
                <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><Brain size={14} /> AI Analysis</p>
                <p className="text-zinc-300 leading-relaxed text-sm md:text-base relative z-10">{analysis}</p>
              </div>
            </div>

            {/* Right Column: Output */}
            <div className="flex-1 flex flex-col gap-6">
              <div>
                <p className="text-sm text-zinc-400 font-bold uppercase tracking-wider mb-4">🎭 Select Vibe</p>
                <div className="grid grid-cols-2 gap-3">
                  {tones.map((tone) => (
                    <button 
                      key={tone.value} 
                      onClick={() => setSelectedTone(tone.value)} 
                      className={`p-3 rounded-xl border text-sm font-bold transition-all duration-200 text-zinc-300 ${
                        selectedTone === tone.value 
                          ? `bg-gradient-to-r ${tone.color} scale-[1.02] shadow-lg text-white` 
                          : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                      }`}
                    >
                      {tone.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 bg-zinc-900/50 rounded-2xl p-6 border border-white/10 relative group flex flex-col">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-pink-500 rounded-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 blur -z-10" />
                
                <div className="flex justify-between items-start mb-4">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Generated Reply</p>
                  <button 
                    onClick={async () => { 
                      await navigator.clipboard.writeText(suggestedReply); 
                      setCopied(true); 
                      setTimeout(() => setCopied(false), 2000); 
                    }} 
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-zinc-400 hover:text-white border border-white/5"
                  >
                    {copied ? <CheckCircle2 size={16} className="text-green-400" /> : <Copy size={16} />}
                  </button>
                </div>
                
                <div className="flex-1 flex items-center">
                  <p className="text-white text-lg leading-relaxed font-medium">{suggestedReply}</p>
                </div>

                <button className="mt-6 w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-300 flex items-center justify-center gap-2 group/btn">
                  <MessageSquare size={18} /> Use This Reply <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const FeaturesSection = () => (
  <section className="py-24 relative bg-zinc-950">
    <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/50 to-zinc-950 pointer-events-none" />
    <div className="max-w-7xl mx-auto px-6 relative z-10">
      <div className="text-center mb-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-4"><Sparkles size={12} /> Features</div>
        <h2 className="text-3xl md:text-5xl font-bold mb-4">Everything you need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">win</span></h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-lg">Powerful tools designed for the modern dating landscape.</p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        {[
          { icon: Brain, title: "Decode Messages", description: "Understand hidden meanings instantly. We analyze tone, timing, and phrasing to tell you the truth.", color: "from-indigo-500 to-blue-500", bg: "bg-indigo-500/10" },
          { icon: MessageSquare, title: "Generate Replies", description: "Get the perfect response for any situation. Switch between Confident, Funny, or Savage.", color: "from-purple-500 to-pink-500", bg: "bg-purple-500/10" },
          { icon: Share2, title: "Go Viral", description: "Share your decoded texts and roasts directly to social media. Create content that resonates.", color: "from-pink-500 to-rose-500", bg: "bg-pink-500/10" }
        ].map((feature, i) => (
          <div key={i} className="group p-8 rounded-3xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-all duration-500 hover:-translate-y-2 hover:bg-zinc-900/80 backdrop-blur-sm">
            <div className={`w-14 h-14 rounded-2xl ${feature.bg} bg-gradient-to-br ${feature.color} flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-black/50`}>
              <feature.icon className="text-white w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">{feature.title}</h3>
            <p className="text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const PricingSection = () => (
  <section className="py-24 relative overflow-hidden bg-zinc-950">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-xs font-bold uppercase tracking-wider mb-4"><Zap size={12} /> Pricing</div>
        <h2 className="text-3xl md:text-5xl font-bold mb-4">Simple pricing, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">real results</span></h2>
        <p className="text-zinc-400">No subscriptions. Credits never expire. Pay as you go.</p>
      </div>
      
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
        
        {/* Starter */}
        <div className="p-6 rounded-3xl bg-zinc-900/40 border border-white/5 hover:border-white/10 transition-all duration-300">
          <h3 className="text-lg font-bold mb-1 text-zinc-300">Starter</h3>
          <div className="text-3xl font-bold mb-1">$5</div>
          <p className="text-zinc-500 text-sm mb-6">50 Credits</p>
          <ul className="space-y-3 mb-8 text-sm">
            <li className="flex items-center text-zinc-400"><Check className="w-4 h-4 mr-2 text-zinc-600" /> Deep analysis</li>
            <li className="flex items-center text-zinc-400"><Check className="w-4 h-4 mr-2 text-zinc-600" /> All reply tones</li>
          </ul>
          <Link href="/auth" className="block w-full text-center py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all">Buy 50</Link>
        </div>

        {/* Popular (Highlighted) */}
        <div className="relative p-[1px] rounded-3xl bg-gradient-to-b from-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/20 lg:-translate-y-4">
          <div className="absolute inset-0 bg-zinc-950 m-[1px] rounded-[22px]" /> {/* Inner border mask */}
          <div className="relative h-full p-6 rounded-[22px] bg-zinc-900">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">Most Popular</div>
            <h3 className="text-lg font-bold mb-1 text-white">Popular</h3>
            <div className="text-4xl font-black mb-1 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">$10</div>
            <p className="text-indigo-300 text-sm mb-6 font-medium">120 Credits</p>
            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-center text-zinc-300"><Check className="w-4 h-4 mr-2 text-indigo-500" /> Priority AI speed</li>
              <li className="flex items-center text-zinc-300"><Check className="w-4 h-4 mr-2 text-indigo-500" /> Best value per $</li>
              <li className="flex items-center text-zinc-300"><Check className="w-4 h-4 mr-2 text-indigo-500" /> Everything in Starter</li>
            </ul>
            <Link href="/auth" className="block w-full text-center py-3 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-all">Get 120</Link>
          </div>
        </div>

        {/* Viral Pack (Impulse Buy) */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-orange-900/20 to-red-900/10 border border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Flame className="text-orange-500 w-24 h-24" /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2"><Flame size={14} className="text-orange-500"/><span className="text-orange-400 text-xs font-bold uppercase tracking-wider">Viral</span></div>
            <h3 className="text-lg font-bold mb-1 text-white">Impulse</h3>
            <div className="text-3xl font-bold mb-1">$2</div>
            <p className="text-orange-300 text-sm mb-6">15 Credits</p>
            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-center text-zinc-400"><Check className="w-4 h-4 mr-2 text-orange-500" /> Low friction</li>
              <li className="flex items-center text-zinc-400"><Check className="w-4 h-4 mr-2 text-orange-500" /> Test the waters</li>
            </ul>
            <Link href="/auth" className="block w-full text-center py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold transition-all shadow-lg shadow-orange-600/20">Get 15</Link>
          </div>
        </div>

        {/* Power User */}
        <div className="p-6 rounded-3xl bg-zinc-900/40 border border-white/5 hover:border-white/10 transition-all duration-300">
          <h3 className="text-lg font-bold mb-1 text-zinc-300">Power</h3>
          <div className="text-3xl font-bold mb-1">$20</div>
          <p className="text-zinc-500 text-sm mb-6">300 Credits</p>
          <ul className="space-y-3 mb-8 text-sm">
            <li className="flex items-center text-zinc-400"><Check className="w-4 h-4 mr-2 text-zinc-600" /> Bulk savings</li>
            <li className="flex items-center text-zinc-400"><Check className="w-4 h-4 mr-2 text-zinc-600" /> Heavy usage</li>
          </ul>
          <Link href="/auth" className="block w-full text-center py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all">Buy 300</Link>
        </div>

      </div>
      
      <p className="text-center text-zinc-600 text-sm mt-12 flex items-center justify-center gap-2">
        <CheckCircle2 size={14} /> Credits never expire. One-time purchase.
      </p>
    </div>
  </section>
);

const CTASection = () => (
  <section className="py-32 relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-t from-indigo-950 via-zinc-950 to-zinc-950 pointer-events-none" />
    {/* Animated Background Mesh */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] -z-10 animate-pulse" />
    
    <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-purple-300 text-xs font-bold uppercase tracking-wider mb-8"><Sparkles size={12} /> Join the Movement</div>
      <h2 className="text-4xl md:text-6xl font-bold mb-8 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent leading-tight">
        Stop guessing. <br/>Start knowing.
      </h2>
      <Link href="/auth" className="inline-flex items-center gap-2 bg-white text-black text-lg font-bold px-10 py-5 rounded-full hover:scale-105 hover:bg-zinc-200 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.2)] group">
        Get Started Free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>
  </section>
);

const Footer = () => (
  <footer className="border-t border-white/5 py-12 bg-zinc-950">
    <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
      <div className="flex items-center gap-2 cursor-pointer">
        <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 w-6 h-6 rounded-md flex items-center justify-center">
          <Sparkles className="text-white w-3.5 h-3.5 fill-white" />
        </div>
        <span className="font-bold text-lg text-white">SubText AI</span>
      </div>
      <p className="text-zinc-600 text-sm">© 2024 SubText AI. All rights reserved.</p>
      <div className="flex gap-6 text-sm text-zinc-500">
        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
      </div>
    </div>
  </footer>
);

const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const toggle = () => setIsVisible(window.pageYOffset > 400);
    window.addEventListener('scroll', toggle);
    return () => window.removeEventListener('scroll', toggle);
  }, []);
  if (!isVisible) return null;
  return (
    <button 
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
      className="fixed bottom-8 right-8 z-50 p-3 rounded-full bg-white text-black shadow-2xl hover:scale-110 transition-all duration-300 group"
    >
      <ChevronUp size={20} className="group-hover:-translate-y-0.5 transition-transform" />
    </button>
  );
};

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white selection:bg-indigo-500/30 selection:text-white overflow-x-hidden font-sans">
      <Navbar />
      <Hero />
      <DemoSection />
      <FeaturesSection />
      <PricingSection />
      <CTASection />
      <Footer />
      <ScrollToTop />
    </main>
  );
}