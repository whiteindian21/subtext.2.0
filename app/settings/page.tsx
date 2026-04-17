
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { 
  User, Mail, Zap, Save, ArrowLeft, Loader2, CheckCircle, 
  Trash2, AlertCircle, CreditCard, Calendar, Check, LogOut,
  Shield, Clock, UserCircle, Edit3, Sparkles
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [credits, setCredits] = useState<number>(0);
  const [emailConfirmed, setEmailConfirmed] = useState<boolean>(false);
  const [createdAt, setCreatedAt] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [resendingEmail, setResendingEmail] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Fetch User Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push('/auth');
        return;
      }

      setUser(session.user);
      setEmail(session.user.email || '');
      setEmailConfirmed(!!session.user.email_confirmed_at);
      if (session.user.created_at) {
        setCreatedAt(new Date(session.user.created_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric'
        }));
      }

      // Fetch Profile Data
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setFullName(data.full_name || '');
        setCredits(data.credits || 0);
        setAvatarUrl(data.avatar_url || null);
      } else if (error && error.code !== 'PGRST116') {
        console.error(error);
      }
      setLoading(false);
    };

    fetchData();
  }, [router]);

  // Handle Save Profile
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setMessage({ type: 'error', text: 'Full name cannot be empty' });
      return;
    }
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Resend verification email
  const handleResendVerification = async () => {
    setResendingEmail(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });
    
    if (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to resend verification email.' });
    } else {
      setMessage({ type: 'success', text: `Verification email resent to ${email}. Check your inbox.` });
    }
    setResendingEmail(false);
    setTimeout(() => setMessage(null), 5000);
  };

  // Handle Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-purple-500" size={48} />
        <p className="text-zinc-500 text-sm">Loading your settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-purple-500/30 relative overflow-x-hidden">
      
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-zinc-950 to-zinc-950 opacity-50" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)`, backgroundSize: `40px 40px` }} />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/70 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/60">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center text-zinc-400 hover:text-white transition gap-2 group text-sm font-medium">
            <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
              <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            </div>
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
            <Shield size={14} className="text-purple-400" />
            <h1 className="font-bold text-sm tracking-wide bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Settings</h1>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-2xl mx-auto px-6 py-12 space-y-8">
        
        {/* Profile Section */}
        <section className="bg-zinc-900/40 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-xl shadow-black/20">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <UserCircle size={24} className="text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold">Profile Information</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Name Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Full Name</label>
              <div className="relative group">
                <User className="absolute left-4 top-3.5 text-zinc-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pl-12 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                  placeholder="Your display name"
                />
              </div>
            </div>

            {/* Email Input (Read Only) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 text-zinc-500" size={18} />
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 pl-12 text-zinc-500 cursor-not-allowed focus:outline-none"
                />
              </div>
              
              {/* Verification Status */}
              <div className="mt-3">
                {!emailConfirmed ? (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={18} className="text-yellow-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-yellow-100">Email not verified</p>
                        <p className="text-xs text-yellow-500/80 mt-1">Check your inbox to activate your account features.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendingEmail}
                      className="text-xs font-bold bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 px-3 py-1.5 rounded-lg transition flex items-center gap-2 whitespace-nowrap"
                    >
                      {resendingEmail ? <Loader2 className="animate-spin w-3 h-3" /> : <Mail size={12} />}
                      Resend Email
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                    <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                    <p className="text-sm font-medium text-emerald-200">Email verified successfully</p>
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-white text-black font-bold px-6 py-3 rounded-xl hover:bg-zinc-200 hover:scale-[1.02] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/10"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </section>

        {/* Usage & Credits Section */}
        <section className="bg-zinc-900/40 border border-purple-500/20 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl shadow-purple-900/10 relative overflow-hidden">
          {/* Decorative Glow */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-600/20 rounded-full blur-[60px]" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                <Zap size={24} className="text-yellow-400" />
              </div>
              <h2 className="text-xl font-bold">Usage & Credits</h2>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
              <div>
                <p className="text-zinc-400 text-sm font-medium">Available Credits</p>
                <p className="text-6xl font-black text-white mt-2 tracking-tight">{credits}</p>
                <div className="flex items-center gap-2 mt-3 text-xs text-zinc-500">
                  <Clock size={12} /> Credits never expire
                </div>
              </div>
              
              <Link 
                href="/pricing" 
                className="group bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 flex items-center gap-2"
              >
                <CreditCard size={16} /> Buy More Credits <ArrowLeft size={14} className="rotate-[-45deg] group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            
            <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-3 text-xs text-zinc-400 bg-black/20 p-3 rounded-lg">
              <Sparkles size={12} className="text-purple-400" />
              <span>1 credit = 1 message decode + reply generation</span>
            </div>
          </div>
        </section>

        {/* Account Info */}
        <section className="bg-zinc-900/40 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <Calendar size={24} className="text-blue-400" />
            </div>
            <h2 className="text-xl font-bold">Account Details</h2>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between items-center py-4 border-b border-white/5">
              <span className="text-zinc-400 text-sm">Member since</span>
              <span className="text-white font-medium">{createdAt || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-white/5">
              <span className="text-zinc-400 text-sm">User ID</span>
              <span className="text-xs text-zinc-500 font-mono bg-black/30 px-2 py-1 rounded-md border border-white/5">
                {user?.id?.slice(0, 8)}...{user?.id?.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between items-center py-4">
              <span className="text-zinc-400 text-sm">Authentication</span>
              <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                <Check size={10} /> Secure
              </span>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="border-t border-white/10 pt-8">
          <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-5 hover:border-red-500/20 transition-colors">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <LogOut size={18} className="text-red-400" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Log out of your account</p>
                  <p className="text-sm text-zinc-500 mt-0.5">You can always log back in anytime.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowLogoutConfirm(true)}
                className="text-red-400 hover:text-red-300 border border-red-500/30 hover:bg-red-500/10 px-5 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2"
              >
                Log Out
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" 
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="relative bg-zinc-900 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Confirm Logout</h3>
              <button 
                onClick={() => setShowLogoutConfirm(false)} 
                className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <p className="text-zinc-400 mb-8 leading-relaxed">Are you sure you want to log out? You will need to sign in again to access your dashboard.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 transition text-white font-medium text-sm shadow-lg shadow-red-900/20"
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {message && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-8 duration-500 z-50 backdrop-blur-md border ${
          message.type === 'success' 
            ? 'bg-emerald-500/90 border-emerald-500/20 text-white' 
            : 'bg-red-500/90 border-red-500/20 text-white'
        }`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}
    </div>
  );
}
