import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle2, RotateCw } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || 'your email';
  const navigate = useNavigate();

  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('Failed to send verification email. Please try again later.');

  const handleResend = async () => {
    setResendStatus('loading');
    setErrorMsg('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setResendStatus('error');
        setErrorMsg(data?.detail || 'Failed to send verification email. Please try again later.');
        return;
      }

      setResendStatus('success');
    } catch (err) {
      console.error('Failed to resend verification email:', err);
      setResendStatus('error');
      setErrorMsg('Failed to send verification email. Please try again later.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark relative overflow-hidden px-4">
      {/* Background glows */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-primary-650/8 dark:bg-primary-600/5 rounded-full filter blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-20 left-1/4 w-80 h-80 bg-blue-800/10 dark:bg-blue-800/5 rounded-full filter blur-[100px] animate-pulse" style={{ animationDelay: '2.5s' }}></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="text-primary transition-transform group-hover:scale-105">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z" fill="currentColor" />
              </svg>
            </div>
            <span className="text-xl font-medium tracking-tight text-gray-900 dark:text-white">LegalEase</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white/70 dark:bg-gray-950/40 backdrop-blur-md rounded-2xl border border-gray-150 dark:border-gray-850 p-8 shadow-sm">
          <div className="mb-6 flex flex-col gap-4">
            <Link
              to="/"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-transform duration-300 hover:-translate-x-2 inline-flex items-center"
            >
              ← Back to home
            </Link>
            
            <div className="flex justify-center mt-2">
              <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl text-primary border border-blue-100/50 dark:border-blue-900/30">
                <Mail size={48} className="stroke-[1.5]" />
              </div>
            </div>

            <div className="text-center mt-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">Verify Your Email</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your account has been created successfully.</p>
            </div>
          </div>

          {/* Info Alert Box */}
          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/50 flex gap-3 text-left">
            <AlertCircle size={20} className="text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              We've sent a verification email to{' '}
              <span className="font-bold text-primary dark:text-primary-400">{email}</span>. Please check your inbox and click the verification link to activate your account.
            </p>
          </div>

          {/* Error Alert Box */}
          {resendStatus === 'error' && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/5 border border-red-500/15 flex gap-3 text-left text-red-600 dark:text-red-400">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium leading-relaxed">
                {errorMsg}
              </p>
            </div>
          )}

          {/* Success Alert Box */}
          {resendStatus === 'success' && (
            <div className="mt-4 p-4 rounded-xl bg-green-500/5 border border-green-500/15 flex gap-3 text-left text-green-600 dark:text-green-400">
              <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium leading-relaxed">
                Verification email sent successfully!
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-primary hover:bg-primary-500 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-primary-500/15"
            >
              I Have the Link
            </button>
            <button
              onClick={handleResend}
              disabled={resendStatus === 'loading'}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-white hover:bg-gray-50 dark:bg-gray-950/20 dark:hover:bg-gray-950/40 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendStatus === 'loading' ? (
                <RotateCw size={16} className="animate-spin" />
              ) : null}
              Resend Verification Email
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-150 dark:border-gray-850/60 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Didn't receive an email? Check your spam folder or{' '}
              <button 
                onClick={handleResend} 
                disabled={resendStatus === 'loading'}
                className="text-primary font-semibold hover:underline bg-transparent border-none p-0 inline cursor-pointer disabled:opacity-50"
              >
                request a new link
              </button>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
