import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function SignupPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await signup(email, password, firstName, lastName);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Try a different email address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-[#09090b] dark:to-[#020205]">
      {/* Decorative Blur Background Circles */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/10 dark:bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-secondary/15 dark:bg-secondary/5 blur-[140px] pointer-events-none" />

      {/* Main Glassmorphic Container */}
      <div className="relative w-full max-w-md p-8 md:p-10 rounded-[32px] bg-white/70 dark:bg-white/[0.02] backdrop-blur-2xl border border-gray-200/50 dark:border-white/[0.05] shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Logo and Greeting */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-primary/10 dark:bg-primary/10 text-primary mb-4">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z" fill="currentColor" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Create your account</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Get started with a secure documents workspace</p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-sm text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-2 duration-200">
            {error}
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* First Name & Last Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                First Name
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 group-focus-within:text-primary transition-colors">
                  <User size={16} />
                </span>
                <input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Sarah"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] text-gray-950 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label htmlFor="lastName" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Last Name
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 group-focus-within:text-primary transition-colors">
                  <User size={16} />
                </span>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Johnson"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] text-gray-950 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Email Address
            </label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 group-focus-within:text-primary transition-colors">
                <Mail size={16} />
              </span>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] text-gray-950 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Password
            </label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 group-focus-within:text-primary transition-colors">
                <Lock size={16} />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] text-gray-950 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="relative w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/95 shadow-xl shadow-primary/25 hover:shadow-primary/35 active:scale-[0.98] transform transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none mt-4 overflow-hidden"
          >
            {loading ? (
              <span className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            ) : (
              <>
                Create Account <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Login Redirect */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200/50 dark:border-white/[0.05] pt-6">
          Already have an account?{' '}
          <NavLink to="/login" className="font-semibold text-primary hover:underline">
            Sign In
          </NavLink>
        </div>
      </div>
    </div>
  );
}
