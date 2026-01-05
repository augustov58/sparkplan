/**
 * Login Component
 * Industrial Schematic Design - Blueprint meets Power Grid
 * Email/password authentication form with Supabase
 */

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';
import { loginSchema, type LoginFormData } from '../../lib/validation';
import { AlertCircle, Zap, Lock, Mail, ArrowRight } from 'lucide-react';

interface LoginProps {
  onSuccess?: () => void;
}

// Animated circuit path component
const CircuitTrace = ({ delay, d, duration }: { delay: number; d: string; duration: number }) => (
  <path
    d={d}
    fill="none"
    stroke="url(#circuit-gradient)"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="circuit-trace"
    style={{
      strokeDasharray: 1000,
      strokeDashoffset: 1000,
      animation: `energize ${duration}s ease-out ${delay}s forwards`,
    }}
  />
);

// Voltage meter component
const VoltageMeter = ({ active }: { active: boolean }) => (
  <div className="flex items-center gap-2">
    <div className="flex gap-1">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-4 rounded-sm transition-all duration-300 ${
            active && i < 3
              ? i < 2
                ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                : 'bg-amber-400/60'
              : 'bg-slate-700'
          }`}
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
      {active ? '120V' : 'Standby'}
    </span>
  </div>
);

export function Login({ onSuccess }: LoginProps) {
  const { signIn } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [formFocused, setFormFocused] = useState(false);

  useEffect(() => {
    setMounted(true);
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
    <div className="min-h-screen relative overflow-hidden bg-slate-950">
      {/* Blueprint grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(251, 191, 36, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(251, 191, 36, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Subtle radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-slate-900/0 via-slate-950/50 to-slate-950" />

      {/* Animated circuit SVG background */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="circuit-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0" />
            <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Circuit traces */}
        <g filter="url(#glow)" className={mounted ? 'opacity-100' : 'opacity-0'}>
          <CircuitTrace delay={0.2} duration={2} d="M 0 200 H 150 V 300 H 250 V 250 H 350" />
          <CircuitTrace delay={0.5} duration={2.5} d="M 100 0 V 100 H 200 V 180 H 280" />
          <CircuitTrace delay={0.8} duration={2} d="M 400 100 H 300 V 200 H 250" />
          <CircuitTrace delay={1.0} duration={3} d="M 0 400 H 100 V 350 H 180 V 400 H 250" />
          <CircuitTrace delay={0.3} duration={2.5} d="M 500 300 H 400 V 250 H 350 V 320" />

          {/* Right side circuits */}
          <CircuitTrace delay={0.6} duration={2} d="M 800 150 H 700 V 250 H 600 V 200" />
          <CircuitTrace delay={0.9} duration={2.5} d="M 900 400 H 800 V 350 H 720 V 280" />
          <CircuitTrace delay={1.2} duration={2} d="M 750 0 V 80 H 650 V 150 H 580" />
        </g>

        {/* Connection nodes */}
        <g className={mounted ? 'opacity-100' : 'opacity-0'}>
          {[[250, 250], [280, 180], [350, 320], [600, 200], [720, 280]].map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="4"
              fill="#fbbf24"
              className="animate-pulse"
              style={{
                animationDelay: `${i * 0.3 + 1.5}s`,
                filter: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.8))'
              }}
            />
          ))}
        </g>
      </svg>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div
          className={`w-full max-w-md transform transition-all duration-700 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          {/* Control panel header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Zap className="w-7 h-7 text-slate-900" strokeWidth={2.5} />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  NEC PRO
                </h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Compliance System</p>
              </div>
            </div>
            <VoltageMeter active={formFocused || loading} />
          </div>

          {/* Main panel */}
          <div
            className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-lg overflow-hidden"
            style={{
              boxShadow: formFocused
                ? '0 0 0 1px rgba(251, 191, 36, 0.3), 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
                : '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
              transition: 'box-shadow 0.3s ease'
            }}
          >
            {/* Panel top bar */}
            <div className="h-10 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="text-[10px] font-mono text-slate-500 uppercase">
                  {loading ? 'Authenticating...' : 'Secure Access Terminal'}
                </span>
              </div>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              </div>
            </div>

            {/* Form content */}
            <div className="p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-white mb-2">Access Portal</h2>
                <p className="text-sm text-slate-400">Enter credentials to access your compliance dashboard</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Email field */}
                <div className="space-y-2">
                  <label htmlFor="email" className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    <Mail className="w-3.5 h-3.5" />
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      {...register('email')}
                      onFocus={() => setFormFocused(true)}
                      onBlur={() => setFormFocused(false)}
                      className={`w-full px-4 py-3 bg-slate-800/50 border rounded-md text-white placeholder-slate-600 outline-none transition-all font-mono text-sm ${
                        errors.email
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-slate-700 focus:border-amber-400/50 focus:bg-slate-800'
                      }`}
                      placeholder="operator@facility.com"
                      style={{ caretColor: '#fbbf24' }}
                    />
                    {errors.email && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      </div>
                    )}
                  </div>
                  {errors.email && (
                    <p className="text-red-400 text-xs flex items-center gap-1.5 font-mono">
                      <span className="text-red-500">!</span>
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password field */}
                <div className="space-y-2">
                  <label htmlFor="password" className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    <Lock className="w-3.5 h-3.5" />
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type="password"
                      {...register('password')}
                      onFocus={() => setFormFocused(true)}
                      onBlur={() => setFormFocused(false)}
                      className={`w-full px-4 py-3 bg-slate-800/50 border rounded-md text-white placeholder-slate-600 outline-none transition-all font-mono text-sm ${
                        errors.password
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-slate-700 focus:border-amber-400/50 focus:bg-slate-800'
                      }`}
                      placeholder="••••••••••••"
                      style={{ caretColor: '#fbbf24' }}
                    />
                    {errors.password && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      </div>
                    )}
                  </div>
                  {errors.password && (
                    <p className="text-red-400 text-xs flex items-center gap-1.5 font-mono">
                      <span className="text-red-500">!</span>
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Error message */}
                {error && (
                  <div className="bg-red-950/50 border border-red-900/50 text-red-400 px-4 py-3 rounded-md text-sm font-mono flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-semibold py-3.5 px-4 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                  style={{
                    boxShadow: '0 4px 14px rgba(251, 191, 36, 0.25), inset 0 1px 0 rgba(255,255,255,0.2)'
                  }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Authenticating...
                      </>
                    ) : (
                      <>
                        Initialize Session
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-300 to-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </form>

              {/* Footer links */}
              <div className="mt-8 pt-6 border-t border-slate-800">
                <div className="flex items-center justify-between text-sm">
                  <Link
                    to="/signup"
                    className="text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1.5"
                  >
                    <span className="text-amber-400/60">+</span>
                    Create Account
                  </Link>
                  <Link
                    to="/reset-password"
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Reset Password
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom info */}
          <div className="mt-6 flex items-center justify-center gap-4 text-[10px] text-slate-600 uppercase tracking-wider font-mono">
            <span>NEC 2023</span>
            <span className="text-slate-700">|</span>
            <span>256-bit Encrypted</span>
            <span className="text-slate-700">|</span>
            <span>SOC 2 Type II</span>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        @keyframes energize {
          to {
            stroke-dashoffset: 0;
          }
        }

        .bg-gradient-radial {
          background: radial-gradient(ellipse at center, var(--tw-gradient-stops));
        }

        .circuit-trace {
          filter: drop-shadow(0 0 3px rgba(251, 191, 36, 0.4));
        }
      `}</style>
    </div>
  );
}
