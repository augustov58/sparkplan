import React, { useState } from 'react';
import { Search, Shield, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SubscriptionPlan } from '@/hooks/useSubscription';

const ADMIN_EMAIL = 'augustovalbuena@gmail.com';
const PLANS: SubscriptionPlan[] = ['free', 'starter', 'pro', 'business', 'enterprise'];

interface UserResult {
  id: string;
  email: string;
  user_created_at: string;
  plan: SubscriptionPlan | null;
  status: string | null;
  trial_end: string | null;
  stripe_subscription_id: string | null;
}

export const AdminPanel: React.FC = () => {
  const [searchEmail, setSearchEmail] = useState('');
  const [users, setUsers] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setMessage(null);

    const { data, error } = await supabase.rpc('admin_search_users', {
      search_email: searchEmail.trim(),
    });

    setSearching(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }

    if (data?.success) {
      setUsers(data.users || []);
      if ((data.users || []).length === 0) {
        setMessage({ type: 'error', text: 'No users found.' });
      }
    } else {
      setMessage({ type: 'error', text: data?.error || 'Unknown error' });
    }
  };

  const handleSetPlan = async (email: string, newPlan: SubscriptionPlan) => {
    setUpdating(email);
    setMessage(null);

    const { data, error } = await supabase.rpc('admin_set_user_plan', {
      target_email: email,
      new_plan: newPlan,
    });

    setUpdating(null);

    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }

    if (data?.success) {
      setMessage({ type: 'success', text: `Set ${email} to ${newPlan} plan.` });
      // Refresh user list
      setUsers(prev =>
        prev.map(u => (u.email === email ? { ...u, plan: newPlan, status: 'active', trial_end: null } : u))
      );
    } else {
      setMessage({ type: 'error', text: data?.error || 'Unknown error' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-electric-500" />
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
      </div>

      {/* Search */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Search Users</h2>
        <div className="flex gap-3">
          <input
            type="email"
            value={searchEmail}
            onChange={e => setSearchEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search by email..."
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !searchEmail.trim()}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50 flex items-center gap-2"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg mb-6 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Results */}
      {users.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 font-semibold text-gray-700">Email</th>
                <th className="text-left p-3 font-semibold text-gray-700">Plan</th>
                <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                <th className="text-left p-3 font-semibold text-gray-700">Joined</th>
                <th className="text-left p-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs">{user.email}</td>
                  <td className="p-3">
                    <span className="capitalize font-medium">{user.plan || 'none'}</span>
                    {user.trial_end && (
                      <span className="ml-1 text-xs text-amber-600">
                        (trial ends {new Date(user.trial_end).toLocaleDateString()})
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      user.status === 'active' ? 'bg-green-100 text-green-700' :
                      user.status === 'trialing' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {user.status || 'none'}
                    </span>
                    {user.stripe_subscription_id && (
                      <span className="ml-1 text-xs text-gray-400" title="Has Stripe subscription">$</span>
                    )}
                  </td>
                  <td className="p-3 text-gray-500 text-xs">
                    {user.user_created_at ? new Date(user.user_created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="p-3">
                    <select
                      value=""
                      onChange={e => {
                        if (e.target.value) handleSetPlan(user.email, e.target.value as SubscriptionPlan);
                      }}
                      disabled={updating === user.email}
                      className="border border-gray-200 rounded px-2 py-1 text-xs bg-white"
                    >
                      <option value="">Set plan...</option>
                      {PLANS.map(p => (
                        <option key={p} value={p} disabled={p === user.plan}>
                          {p.charAt(0).toUpperCase() + p.slice(1)} {p === user.plan ? '(current)' : ''}
                        </option>
                      ))}
                    </select>
                    {updating === user.email && <Loader2 className="w-3 h-3 animate-spin inline ml-2" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
