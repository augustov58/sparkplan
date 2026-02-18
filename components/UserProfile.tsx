/**
 * UserProfile (Account Settings page)
 * Route: /settings
 */

import React, { useState, useEffect } from 'react';
import { User, Building2, Hash, Save, Loader2 } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAuthContext } from '@/components/Auth/AuthProvider';

export const UserProfile: React.FC = () => {
  const { user } = useAuthContext();
  const { profile, loading, updateProfile } = useProfile();

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setCompanyName(profile.company_name ?? '');
      setLicenseNumber(profile.license_number ?? '');
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateProfile({
      full_name: fullName.trim() || null,
      company_name: companyName.trim() || null,
      license_number: licenseNumber.trim() || null,
    });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h2 className="heading-md">Account Settings</h2>
        <p className="text-sm text-muted mt-1">
          These details auto-fill permit packets and other documents.
        </p>
      </div>

      <form onSubmit={handleSave} className="card p-6 space-y-5">
        {/* Full Name */}
        <div>
          <label htmlFor="full_name" className="label">
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full pl-9"
            />
          </div>
        </div>

        {/* Company Name */}
        <div>
          <label htmlFor="company_name" className="label">
            Company Name
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
            <input
              id="company_name"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Smith Electrical Contractors"
              className="w-full pl-9"
            />
          </div>
        </div>

        {/* Contractor License */}
        <div>
          <label htmlFor="license_number" className="label">
            Contractor License Number
          </label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
            <input
              id="license_number"
              type="text"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="e.g., C-10 #123456"
              className="w-full pl-9"
            />
          </div>
          <p className="text-xs text-subtle mt-1">
            Auto-filled in permit packets. Required by most jurisdictions.
          </p>
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={user?.email ?? ''}
            readOnly
            className="w-full bg-paper text-muted cursor-not-allowed"
          />
          <p className="text-xs text-subtle mt-1">
            Managed by your account login.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};
