/**
 * Update Password (#330): shown after a recovery link signed the user in
 * (AppContent routes here on PASSWORD_RECOVERY). Sets the new password with
 * supabase.auth.updateUser and goes to the dashboard.
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from './AuthProvider';
import { updatePasswordSchema, type UpdatePasswordFormData } from '../../lib/validation';
import { showToast, toastMessages } from '../../lib/toast';
import { AlertCircle } from 'lucide-react';

export function UpdatePassword() {
  const { updatePassword } = useAuthContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema)
  });

  const onSubmit = async (data: UpdatePasswordFormData) => {
    setLoading(true);
    setError(null);
    const { error } = await updatePassword(data.password);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    showToast.success(toastMessages.auth.passwordUpdated);
    navigate('/', { replace: true });
  };

  const field = (id: 'password' | 'confirmPassword', label: string, placeholder: string) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[#1a1a1a] mb-2">
        {label}
      </label>
      <input
        id={id}
        type="password"
        autoComplete="new-password"
        {...register(id)}
        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d] outline-none transition-all ${
          errors[id] ? 'border-red-300' : 'border-[#e8e6e3]'
        }`}
        placeholder={placeholder}
      />
      {errors[id] && (
        <p className="text-[#c44] text-sm mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {errors[id]?.message}
        </p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-sm border border-[#e8e6e3] p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="font-serif text-2xl font-semibold text-[#1a1a1a]">⚡ SparkPlan</span>
            </div>
            <h2 className="font-serif text-xl text-[#666]">Set a new password</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {field('password', 'New password', 'At least 8 characters')}
            {field('confirmPassword', 'Confirm new password', 'Type it again')}
            <p className="text-xs text-[#888]">
              At least 8 characters, with an uppercase letter, a lowercase letter and a number.
            </p>

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
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
