/**
 * Signup Component
 * User registration form with Supabase Auth
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';
import { signupSchema, type SignupFormData } from '../../lib/validation';
import { AlertCircle } from 'lucide-react';

interface SignupProps {
  onSuccess?: () => void;
}

export function Signup({ onSuccess }: SignupProps) {
  const { signUp } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successEmail, setSuccessEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema)
  });

  const onSubmit = async (data: SignupFormData) => {
    setLoading(true);
    setError(null);

    const { error } = await signUp(data.email, data.password, data.email.split('@')[0]);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccessEmail(data.email);
      setSuccess(true);
      setLoading(false);
      onSuccess?.();
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Check your email</h2>
            <p className="text-slate-600 mb-6">
              We've sent you a confirmation link to <strong>{successEmail}</strong>. Please check your
              inbox and click the link to verify your account.
            </p>
            <Link
              to="/login"
              className="inline-block bg-electric text-slate-900 font-semibold py-2 px-6 rounded-lg hover:bg-yellow-400 transition-colors"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-electric rounded-lg flex items-center justify-center">
                <span className="text-2xl">⚡</span>
              </div>
              <span className="text-2xl font-bold text-slate-800">NEC Pro</span>
            </div>
            <h2 className="text-xl text-slate-600">Create your account</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-electric focus:border-electric outline-none transition-all ${
                  errors.email ? 'border-red-300' : 'border-slate-300'
                }`}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                {...register('password')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-electric focus:border-electric outline-none transition-all ${
                  errors.password ? 'border-red-300' : 'border-slate-300'
                }`}
                placeholder="At least 8 characters"
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password.message}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Must contain uppercase, lowercase, and number
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-electric focus:border-electric outline-none transition-all ${
                  errors.confirmPassword ? 'border-red-300' : 'border-slate-300'
                }`}
                placeholder="Re-enter your password"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-electric text-slate-900 font-semibold py-3 px-4 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="text-electric font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          <p className="text-xs text-slate-500 text-center mt-6">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
