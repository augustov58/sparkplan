/**
 * Login Component
 * Email/password authentication form with Supabase
 */

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';
import { loginSchema, type LoginFormData } from '../../lib/validation';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface LoginProps {
  onSuccess?: () => void;
}

export function Login({ onSuccess }: LoginProps) {
  const { signIn } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect Supabase error_description in the URL hash.
  // When a confirmation link is expired or already consumed (common with corporate
  // email scanners like Office 365 Safe Links), Supabase 303-redirects the user to:
  //   {emailRedirectTo}#error=unauthorized_client&error_description=Email+link+is+invalid+or+has+expired
  // We catch this and show a friendly message instead of leaving the user confused.
  const [linkExpiredNotice, setLinkExpiredNotice] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('error_description=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const desc = params.get('error_description') || '';
      if (desc.toLowerCase().includes('expired') || desc.toLowerCase().includes('invalid')) {
        setLinkExpiredNotice(true);
      }
      // Clean the hash so refreshing doesn't re-show the notice
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError(null);

    const { error } = await signIn(data.email, data.password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      onSuccess?.();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-sm border border-[#e8e6e3] p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="font-serif text-2xl font-semibold text-[#1a1a1a]">⚡ SparkPlan</span>
            </div>
            <h2 className="font-serif text-xl text-[#666]">Sign in to your account</h2>
          </div>

          {linkExpiredNotice && (
            <div className="bg-[#e8f5e8] border border-[#b8dab8] text-[#2d5a2d] px-4 py-3 rounded-lg text-sm mb-4 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold mb-1">Your email is already confirmed</p>
                <p className="text-xs text-[#3d6b3d]">
                  The confirmation link was already used (this is common with corporate email
                  security scanners). Your account is active — just sign in with your password below.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#1a1a1a] mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d] outline-none transition-all ${
                  errors.email ? 'border-red-300' : 'border-[#e8e6e3]'
                }`}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="text-[#c44] text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#1a1a1a] mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                {...register('password')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d] outline-none transition-all ${
                  errors.password ? 'border-red-300' : 'border-[#e8e6e3]'
                }`}
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="text-[#c44] text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {error && (
              <div className="bg-[#ffeaea] border border-[#c44]/30 text-[#c44] px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2d3b2d] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#3d4f3d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#666]">
              Don't have an account?{' '}
              <Link to="/signup" className="text-[#c9a227] font-semibold hover:underline">
                Sign up
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center">
            <Link to="/reset-password" className="text-sm text-[#888] hover:text-[#1a1a1a]">
              Forgot your password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
