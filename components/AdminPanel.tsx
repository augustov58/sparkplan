import React, { useState, useEffect, useCallback } from 'react';
import { Search, Shield, Loader2, CheckCircle, AlertCircle, UserPlus, Trash2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SubscriptionPlan } from '@/hooks/useSubscription';

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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add user form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPlan, setNewPlan] = useState<SubscriptionPlan>('free');
  const [creating, setCreating] = useState(false);

  // Load all users on mount
  const loadUsers = useCallback(async (emailFilter = '') => {
    setSearching(true);
    setMessage(null);

    const { data, error } = await supabase.rpc('admin_search_users', {
      search_email: emailFilter,
    });

    setSearching(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }

    if (data?.success) {
      setUsers(data.users || []);
    } else {
      setMessage({ type: 'error', text: data?.error || 'Unknown error' });
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = () => {
    loadUsers(searchEmail.trim());
  };

  const handleSetPlan = async (email: string, plan: SubscriptionPlan) => {
    setUpdating(email);
    setMessage(null);

    const { data, error } = await supabase.rpc('admin_set_user_plan', {
      target_email: email,
      new_plan: plan,
    });

    setUpdating(null);

    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }

    if (data?.success) {
      setMessage({ type: 'success', text: `Set ${email} to ${plan} plan.` });
      setUsers(prev =>
        prev.map(u => (u.email === email ? { ...u, plan, status: 'active', trial_end: null } : u))
      );
    } else {
      setMessage({ type: 'error', text: data?.error || 'Unknown error' });
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail.trim() || !newPassword.trim()) return;
    setCreating(true);
    setMessage(null);

    const { data, error } = await supabase.rpc('admin_create_user', {
      user_email: newEmail.trim(),
      user_password: newPassword.trim(),
      user_plan: newPlan,
    });

    setCreating(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }

    if (data?.success) {
      setMessage({ type: 'success', text: `Created user ${newEmail} with ${newPlan} plan.` });
      setNewEmail('');
      setNewPassword('');
      setNewPlan('free');
      setShowAddForm(false);
      loadUsers(searchEmail.trim());
    } else {
      setMessage({ type: 'error', text: data?.error || 'Unknown error' });
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (!confirm(`Permanently delete ${email}? This cannot be undone.`)) return;

    setDeleting(email);
    setMessage(null);

    const { data, error } = await supabase.rpc('admin_delete_user', {
      target_email: email,
    });

    setDeleting(null);

    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }

    if (data?.success) {
      setMessage({ type: 'success', text: `Deleted ${email}.` });
      setUsers(prev => prev.filter(u => u.email !== email));
    } else {
      setMessage({ type: 'error', text: data?.error || 'Unknown error' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-[#2d3b2d]" />
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-[#2d3b2d] hover:bg-[#2d3b2d] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-white border border-[#2d3b2d]/30 rounded-lg p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Create New User</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="Email"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none"
            />
            <input
              type="text"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Password"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none"
            />
            <select
              value={newPlan}
              onChange={e => setNewPlan(e.target.value as SubscriptionPlan)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {PLANS.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
            <button
              onClick={handleCreateUser}
              disabled={creating || !newEmail.trim() || !newPassword.trim()}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={searchEmail}
            onChange={e => setSearchEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Filter by email..."
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50 flex items-center gap-2"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {searchEmail.trim() ? 'Search' : 'Refresh'}
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

      {/* User count */}
      <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
        <Users className="w-4 h-4" />
        {users.length} user{users.length !== 1 ? 's' : ''}
      </div>

      {/* Users table */}
      {users.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 font-semibold text-gray-700">Email</th>
                <th className="text-left p-3 font-semibold text-gray-700">Plan</th>
                <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                <th className="text-left p-3 font-semibold text-gray-700">Joined</th>
                <th className="text-left p-3 font-semibold text-gray-700">Set Plan</th>
                <th className="text-left p-3 font-semibold text-gray-700 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs">{user.email}</td>
                  <td className="p-3">
                    <span className="capitalize font-medium">{user.plan || 'none'}</span>
                    {user.trial_end && (
                      <span className="ml-1 text-xs text-[#3d6b3d]">
                        (trial ends {new Date(user.trial_end).toLocaleDateString()})
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      user.status === 'active' ? 'bg-green-100 text-green-700' :
                      user.status === 'trialing' ? 'bg-[#e8f5e8] text-[#2d3b2d]' :
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
                  <td className="p-3">
                    {user.email !== 'augustovalbuena@gmail.com' && (
                      <button
                        onClick={() => handleDeleteUser(user.email)}
                        disabled={deleting === user.email}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        title={`Delete ${user.email}`}
                      >
                        {deleting === user.email ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!searching && users.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No users found.</p>
        </div>
      )}
    </div>
  );
};
