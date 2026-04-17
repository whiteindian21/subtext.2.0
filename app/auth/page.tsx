'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  Mail, 
  Lock, 
  User, 
  ArrowLeft, 
  Loader2, 
  Eye, 
  EyeOff,
  Sparkles,
  CheckCircle,
  AlertCircle,
  ArrowRight
} from 'lucide-react';

// --- Styles ---
const globalStyles = `
  @keyframes fade-in-up {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slide-in {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes float-particle {
    0%, 100% { transform: translate(0, 0); opacity: 0.2; }
    50% { transform: translate(10px, -20px); opacity: 0.5; }
  }
  .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
  .animate-slide-in { animation: slide-in 0.3s ease-out forwards; }
  .animate-float-particle { animation: float-particle 10s infinite ease-in-out; }
`;

export default function AuthPage() {
  const router = useRouter();
  
  // UI State
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [emailSentTo, setEmailSentTo] = useState<string>('');
  const [passwordStrength, setPasswordStrength] = useState<{ score: number, text: string, color: string }>({ score: 0, text: '', color: '' });
  
  // Fix for hydration error: only render particles on client
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  });

  // Form validation errors
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});

  // Helper: clear session and redirect to auth on token error
  const handleInvalidSession = async () => {
    await supabase.auth.signOut();
    // Clear any stale tokens from storage (Supabase does this automatically on signOut)
    setMessage({
      type: 'error',
      text: 'Your session is invalid or expired. Please sign in again.'
    });
    // Force reload to reset all state
    router.refresh();
  };

  // Check existing session with error handling for refresh token issues
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // If there's an error related to refresh token, clear session
        if (error) {
          console.error('Session check error:', error);
          if (error.message?.includes('Invalid Refresh Token') || 
              error.message?.includes('Refresh Token Not Found')) {
            await handleInvalidSession();
          }
          return;
        }

        if (session) {
          const user = session.user;
          if (user.email_confirmed_at) {
            router.push('/dashboard');
          } else {
            await supabase.auth.signOut();
            setMessage({
              type: 'error',
              text: 'Please verify your email address before logging in.'
            });
          }
        }
      } catch (err: any) {
        console.error('Unexpected session error:', err);
        if (err.message?.includes('refresh_token')) {
          await handleInvalidSession();
        }
      }
    };
    
    checkSession();
  }, [router]);

  // Password strength checker (unchanged)
  useEffect(() => {
    if (!formData.password) {
      setPasswordStrength({ score: 0, text: '', color: '' });
      return;
    }
    let score = 0;
    if (formData.password.length >= 8) score++;
    if (formData.password.match(/[a-z]/) && formData.password.match(/[A-Z]/)) score++;
    if (formData.password.match(/\d/)) score++;
    if (formData.password.match(/[^a-zA-Z\d]/)) score++;
    
    const levels = [
      { text: 'Weak', color: 'bg-red-500' },
      { text: 'Fair', color: 'bg-orange-500' },
      { text: 'Good', color: 'bg-blue-500' },
      { text: 'Strong', color: 'bg-emerald-500' }
    ];
    
    const level = levels[Math.min(score, 3)] || levels[0];
    setPasswordStrength({ score, text: level.text, color: level.color.replace('bg-', 'text-') });
  }, [formData.password]);

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};
    if (!isLogin && !formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!isLogin && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setMessage(null);
    if (errors[e.target.name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [e.target.name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setMessage(null);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          if (error.message.includes('Email not confirmed')) {
            throw new Error('Please verify your email address before logging in.');
          }
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Invalid email or password.');
          }
          // Handle refresh token errors from sign-in attempt
          if (error.message.includes('Invalid Refresh Token')) {
            await handleInvalidSession();
            throw new Error('Session error. Please try again.');
          }
          throw error;
        }

        // Verify that we actually have a session after sign-in
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Could not establish session. Please try again.');
        }

        if (data.user && !data.user.email_confirmed_at) {
          await supabase.auth.signOut();
          throw new Error('Please verify your email address before logging in.');
        }

        // Small delay to ensure tokens are fully written to storage
        await new Promise(resolve => setTimeout(resolve, 100));
        router.push('/dashboard');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
            },
          },
        });

        if (error) {
          if (error.message.includes('User already registered')) {
            throw new Error('An account with this email already exists.');
          }
          throw error;
        }

        const user = data.user;
        if (user && !user.email_confirmed_at) {
          setEmailSentTo(formData.email);
          setMessage({
            type: 'success',
            text: `Verification email sent to ${formData.email}. Please check your inbox.`
          });
          setFormData(prev => ({ ...prev, password: '' }));
          setIsLogin(true);
        } else {
          setMessage({
            type: 'success',
            text: 'Account created successfully! Redirecting...'
          });
          setTimeout(() => router.push('/dashboard'), 1500);
        }
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'An error occurred. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmationEmail = async () => {
    if (!formData.email) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: formData.email,
    });
    if (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to resend verification email.'
      });
    } else {
      setMessage({
        type: 'success',
        text: `Verification email resent to ${formData.email}.`
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-purple-500/30">
      <style>{globalStyles}</style>

      {/* Ambient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[100px]" />
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)`, backgroundSize: `40px 40px` }}
        />

        {/* Floating Particles - Client Side only */}
        {isMounted && (
          <>
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white/30 rounded-full animate-float-particle"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${10 + Math.random() * 10}s`,
                }}
              />
            ))}
          </>
        )}
      </div>

      <div className="w-full max-w-[420px] relative z-10 animate-fade-in-up">
        
        <button 
          onClick={() => router.push('/')} 
          className="group absolute -top-14 left-0 flex items-center text-zinc-500 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform duration-300" />
          Back to Home
        </button>

        <div className="bg-zinc-900/60 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl shadow-black/50 relative overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 mb-4 shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform duration-300">
              <Sparkles className="text-white w-6 h-6 fill-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
              {isLogin ? 'Welcome back' : 'Create Account'}
            </h1>
            <p className="text-zinc-400 text-sm">
              {isLogin ? 'Enter your credentials to access your account' : 'Join SubText AI and start decoding today'}
            </p>
          </div>

          <div className="flex bg-black/40 p-1 rounded-xl mb-8 border border-white/5 relative">
            <div 
              className={`absolute top-1 bottom-1 w-1/2 bg-zinc-800 rounded-lg shadow-sm transition-all duration-300 ease-out ${isLogin ? 'left-1' : 'left-[calc(50%-4px)]'}`}
            />
            <button
              onClick={() => { setIsLogin(true); setMessage(null); setErrors({}); }}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 relative z-10 ${isLogin ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Login
            </button>
            <button
              onClick={() => { setIsLogin(false); setMessage(null); setErrors({}); }}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 relative z-10 ${!isLogin ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-1.5 animate-slide-in">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                  Full Name
                </label>
                <div className="relative group">
                  <User className="absolute left-3 top-3 text-zinc-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="e.g. Alex Morgan"
                    className={`w-full bg-black/30 border ${errors.fullName ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-purple-500/50'} rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500/20 transition-all`}
                    required={!isLogin}
                  />
                </div>
                {errors.fullName && <p className="text-red-400 text-[10px] ml-1 mt-1">{errors.fullName}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3 text-zinc-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="you@example.com"
                  className={`w-full bg-black/30 border ${errors.email ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-purple-500/50'} rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500/20 transition-all`}
                  required
                />
              </div>
              {errors.email && <p className="text-red-400 text-[10px] ml-1 mt-1">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Password
                </label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => router.push('/reset-password')}
                    className="text-[10px] font-medium text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              
              <div className="relative group">
                <Lock className="absolute left-3 top-3 text-zinc-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  className={`w-full bg-black/30 border ${errors.password ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-purple-500/50'} rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500/20 transition-all`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-zinc-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {!isLogin && formData.password && (
                <div className="mt-2 px-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ease-out ${
                          passwordStrength.score === 0 ? 'w-0' :
                          passwordStrength.score === 1 ? 'w-1/4 bg-red-500' :
                          passwordStrength.score === 2 ? 'w-2/4 bg-orange-500' :
                          passwordStrength.score === 3 ? 'w-3/4 bg-blue-500' : 'w-full bg-emerald-500'
                        }`}
                      />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${passwordStrength.color}`}>
                      {passwordStrength.text}
                    </span>
                  </div>
                </div>
              )}
              {errors.password && <p className="text-red-400 text-[10px] ml-1 mt-1">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group w-full bg-white text-black font-bold text-sm py-3.5 rounded-xl hover:bg-zinc-200 transition-all duration-300 transform active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] mt-2 relative overflow-hidden"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Processing...
                </>
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {message?.type === 'success' && message.text.includes('Verification email sent') && (
            <div className="mt-6 text-center animate-slide-in">
              <button
                onClick={resendConfirmationEmail}
                disabled={loading}
                className="text-xs text-purple-400 hover:text-purple-300 underline underline-offset-4 transition-all"
              >
                Didn't receive the email? Resend
              </button>
            </div>
          )}

          {message && (
            <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 animate-slide-in ${
              message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 
              'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              <div className="mt-0.5 flex-shrink-0">
                {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              </div>
              <p className="text-xs leading-relaxed font-medium">{message.text}</p>
            </div>
          )}
        </div>
        
        <p className="text-center text-[10px] text-zinc-600 mt-6 uppercase tracking-wider font-medium">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}