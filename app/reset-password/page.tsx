'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  Mail,
  KeyRound,
  Lock,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  
  // Flow state: 'email' -> 'otp' -> 'reset'
  const [step, setStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  
  // For rate limiting / resend
  const [canResend, setCanResend] = useState(true);
  const [countdown, setCountdown] = useState(0);

  // Step 1: Send password reset email with OTP
  const sendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email address.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }
    
    setLoading(true);
    setMessage(null);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        if (error.message.includes('User not found')) {
          throw new Error('If an account exists, a reset PIN has been sent.');
        }
        throw error;
      }
      
      setMessage({
        type: 'success',
        text: `A one-time PIN has been sent to ${email}. Please check your inbox.`
      });
      setStep('otp');
      
      // Start countdown for resend
      setCanResend(false);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to send reset PIN. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Step 2: Verify OTP (supports 6-8 digit codes)
  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    // Accept 6-8 digit numeric codes (Supabase configurable)
    const cleanedOtp = otp.trim();
    if (!/^\d{6,8}$/.test(cleanedOtp)) {
      setMessage({ type: 'error', text: 'Please enter the verification code (6-8 digits) sent to your email.' });
      return;
    }
    
    setLoading(true);
    setMessage(null);
    
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: cleanedOtp,
        type: 'email',
      });
      
      if (error) throw error;
      
      if (data.session) {
        setMessage({
          type: 'success',
          text: 'Code verified! Now you can set a new password.'
        });
        setStep('reset');
      } else {
        throw new Error('Invalid code. Please try again.');
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Invalid or expired code. Please request a new one.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Step 3: Update password
  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword) {
      setMessage({ type: 'error', text: 'Please enter a new password.' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    
    setLoading(true);
    setMessage(null);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      setMessage({
        type: 'success',
        text: 'Password reset successfully! Redirecting to login...'
      });
      
      await supabase.auth.signOut();
      
      setTimeout(() => {
        router.push('/auth');
      }, 2000);
      
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to reset password. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Resend reset email
  const resendResetEmail = async () => {
    if (!canResend) return;
    
    setLoading(true);
    setMessage(null);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      
      setMessage({
        type: 'success',
        text: `A new reset code has been sent to ${email}.`
      });
      
      setCanResend(false);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to resend code. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const goBack = () => {
    if (step === 'otp') {
      setStep('email');
      setOtp('');
      setMessage(null);
    } else if (step === 'reset') {
      setStep('otp');
      setNewPassword('');
      setConfirmPassword('');
      setMessage(null);
    }
  };
  
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[100px]" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)`, backgroundSize: `40px 40px` }} />
      </div>
      
      <div className="w-full max-w-[420px] relative z-10 animate-fade-in-up">
        <button
          onClick={() => step === 'email' ? router.push('/auth') : goBack()}
          className="group absolute -top-14 left-0 flex items-center text-zinc-500 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform duration-300" />
          {step === 'email' ? 'Back to Login' : 'Go Back'}
        </button>
        
        <div className="bg-zinc-900/60 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl shadow-black/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 mb-4 shadow-lg shadow-purple-500/20">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
              {step === 'email' && 'Reset Password'}
              {step === 'otp' && 'Enter Verification Code'}
              {step === 'reset' && 'Create New Password'}
            </h1>
            <p className="text-zinc-400 text-sm">
              {step === 'email' && "We'll send a one-time code to your email"}
              {step === 'otp' && `Check ${email} for your verification code`}
              {step === 'reset' && 'Your new password must be at least 6 characters'}
            </p>
          </div>
          
          {step === 'email' && (
            <form onSubmit={sendResetEmail} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                  Email Address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-3 text-zinc-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-black/30 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="group w-full bg-white text-black font-bold text-sm py-3.5 rounded-xl hover:bg-zinc-200 transition-all duration-300 transform active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Sending Code...
                  </>
                ) : (
                  <>
                    Send Reset Code
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}
          
          {step === 'otp' && (
            <form onSubmit={verifyOTP} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                  Verification Code
                </label>
                <div className="relative group">
                  <KeyRound className="absolute left-3 top-3 text-zinc-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="000000"
                    className="w-full bg-black/30 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all font-mono tracking-wider text-center text-2xl"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-zinc-500 ml-1 mt-1">
                  Enter the code (6-8 digits) sent to {email}
                </p>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="group w-full bg-white text-black font-bold text-sm py-3.5 rounded-xl hover:bg-zinc-200 transition-all duration-300 transform active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify Code
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
              
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={resendResetEmail}
                  disabled={!canResend || loading}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!canResend ? `Resend code in ${countdown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}
          
          {step === 'reset' && (
            <form onSubmit={resetPassword} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                  New Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3 text-zinc-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/30 border border-white/5 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                    required
                    disabled={loading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-zinc-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">
                  Confirm New Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3 text-zinc-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/30 border border-white/5 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="group w-full bg-white text-black font-bold text-sm py-3.5 rounded-xl hover:bg-zinc-200 transition-all duration-300 transform active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Resetting Password...
                  </>
                ) : (
                  <>
                    Reset Password
                    <CheckCircle size={16} className="group-hover:scale-110 transition-transform" />
                  </>
                )}
              </button>
            </form>
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
          A verification code will be sent to your email for security.
        </p>
      </div>
      
      <style jsx>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}