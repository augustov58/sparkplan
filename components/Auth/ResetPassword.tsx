/**
 * Reset Password (#330): asks for the account's email and sends Supabase's
 * recovery link. The link signs the user in and the app routes them to
 * /update-password (AppContent, on PASSWORD_RECOVERY).
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useAuthContext } from './AuthProvider';
import { resetPasswordSchema, type ResetPasswordFormData } from '../../lib/validation';
import { AlertCircle, CheckCircle } from 'lucide-react';

export function ResetPassword() {
  const { resetPassword } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema)
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setLoading(true);
    setError(null);
    const { error } = await resetPassword(data.email);
    setLoading(false);
    // Supabase answers the same for unknown addresses; so does this page.
    if (error) setError(error.message);
    else setSentTo(data.email);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-sm border border-[#e8e6e3] p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="font-serif text-2xl font-semibold text-[#1a1a1a]">⚡ SparkPlan</span>
            </div>
            <h2 className="font-serif text-xl text-[#666]">Reset your password</h2>
          </div>

          {sentTo ? (
            <div className="bg-[#e8f5e8] border border-[#b8dab8] text-[#2d5a2d] px-4 py-3 rounded-lg text-sm mb-4 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold mb-1">Check your email</p>
                <p className="text-xs text-[#3d6b3d]">
                  If an account exists for {sentTo}, we've sent a link to reset your password.
                  It can take a few minutes; check your spam folder too.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <p className="text-sm text-[#666]">
                Enter the email you sign in with and we'll send you a link to set a new password.
              </p>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
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
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-[#888] hover:text-[#1a1a1a]">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
