import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText,
  Building2,
  Zap,
  CheckCircle,
  AlertCircle,
  Download,
  ExternalLink,
  Info
} from 'lucide-react';
import type { Project, Panel, Circuit, Transformer } from '@/types';
import type {
  UtilityInterconnectionForm as InterconnectionFormType,
  UtilityProvider
} from '@/types/utilityInterconnection';
import { UTILITY_REQUIREMENTS } from '@/types/utilityInterconnection';
import {
  autoPopulateInterconnectionForm,
  validateInterconnectionForm,
  calculateApplicationFees
} from '@/services/utilityInterconnection/formGenerator';

interface UtilityInterconnectionFormProps {
  project: Project;
  panels: Panel[];
  circuits: Circuit[];
  transformers: Transformer[];
}

export const UtilityInterconnectionForm: React.FC<UtilityInterconnectionFormProps> = ({
  project,
  panels,
  circuits,
  transformers
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<InterconnectionFormType>>({});
  const [errors, setErrors] = useState<string[]>([]);

  // Auto-populate form on mount
  useEffect(() => {
    const initialData = autoPopulateInterconnectionForm(
      { project, panels, circuits, transformers },
      'PG&E' // Default utility
    );
    setFormData(initialData);
  }, [project.id]);

  const handleUtilityChange = (utility: UtilityProvider) => {
    const updated = autoPopulateInterconnectionForm(
      { project, panels, circuits, transformers },
      utility
    );
    setFormData(updated);
  };

  const handleNext = () => {
    const validation = validateInterconnectionForm(formData);
    if (validation.isValid || currentStep < 3) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
      setErrors([]);
    } else {
      setErrors(validation.errors);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const utilityReq = formData.utilityProvider ?
    UTILITY_REQUIREMENTS[formData.utilityProvider] :
    UTILITY_REQUIREMENTS['Other'];

  const fees = calculateApplicationFees(formData);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-7 h-7 text-electric-500" />
          <h1 className="text-2xl font-bold text-gray-900">
            Utility Interconnection Application
          </h1>
        </div>
        <p className="text-sm text-gray-600">
          Auto-generate Rule 21 interconnection applications for PG&E, SCE, and SDG&E
        </p>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: 'Utility Selection' },
            { num: 2, label: 'Applicant Info' },
            { num: 3, label: 'System Details' },
            { num: 4, label: 'Review & Export' }
          ].map((step, idx) => (
            <React.Fragment key={step.num}>
              <div className="flex items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    currentStep === step.num
                      ? 'bg-electric-500 text-white'
                      : currentStep > step.num
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {currentStep > step.num ? <CheckCircle className="w-5 h-5" /> : step.num}
                </div>
                <span
                  className={`text-sm font-medium ${
                    currentStep >= step.num ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < 3 && (
                <div className={`flex-1 h-1 mx-2 ${currentStep > step.num ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {/* Step 1: Utility Selection */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Select Your Utility Provider</h2>
              <p className="text-sm text-gray-600 mb-6">
                Choose the utility company that serves your project location
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['PG&E', 'SCE', 'SDG&E'] as UtilityProvider[]).map(utility => (
                <button
                  key={utility}
                  onClick={() => handleUtilityChange(utility)}
                  className={`p-6 border-2 rounded-lg text-left transition-all ${
                    formData.utilityProvider === utility
                      ? 'border-electric-500 bg-electric-50'
                      : 'border-gray-200 hover:border-electric-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-5 h-5 text-electric-500" />
                    <h3 className="font-bold text-gray-900">{utility}</h3>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    {utility === 'PG&E' && 'Pacific Gas & Electric - Northern & Central California'}
                    {utility === 'SCE' && 'Southern California Edison - Los Angeles & Orange County'}
                    {utility === 'SDG&E' && 'San Diego Gas & Electric - San Diego County'}
                  </p>
                  <div className="text-xs text-gray-500">
                    Application Fee: ${UTILITY_REQUIREMENTS[utility].applicationFee}
                  </div>
                  <div className="text-xs text-gray-500">
                    Processing Time: ~{UTILITY_REQUIREMENTS[utility].processingTimeDays} days
                  </div>
                </button>
              ))}
            </div>

            {formData.utilityProvider && formData.utilityProvider !== 'Other' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 mb-1">Utility Requirements</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Application Fee: ${utilityReq.applicationFee}</li>
                      <li>• Study Deposit: ${utilityReq.studyDeposit || 0} (for systems &gt;10kW)</li>
                      <li>• Processing Time: {utilityReq.processingTimeDays} days</li>
                      {utilityReq.requiresParcelNumber && <li>• Parcel Number (APN) Required</li>}
                      {utilityReq.requiresShortCircuitStudy && <li>• Short Circuit Study Required (&gt;10kW)</li>}
                    </ul>
                    <div className="mt-3 space-x-2">
                      {utilityReq.formUrl && (
                        <a
                          href={utilityReq.formUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-700 hover:text-blue-900 underline inline-flex items-center gap-1"
                        >
                          Application Form <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {utilityReq.guideUrl && (
                        <a
                          href={utilityReq.guideUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-700 hover:text-blue-900 underline inline-flex items-center gap-1"
                        >
                          Interconnection Guide <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Applicant Info */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Applicant Information</h2>
              <p className="text-sm text-gray-600 mb-6">
                Provide contact and site details for the interconnection application
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.applicant?.contactName || ''}
                  onChange={e => setFormData({
                    ...formData,
                    applicant: { ...formData.applicant!, contactName: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
                  placeholder="John Doe"
                />
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name (if applicable)
                </label>
                <input
                  type="text"
                  value={formData.applicant?.companyName || ''}
                  onChange={e => setFormData({
                    ...formData,
                    applicant: { ...formData.applicant!, companyName: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
                  placeholder="ABC Electric Company"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.applicant?.phone || ''}
                  onChange={e => setFormData({
                    ...formData,
                    applicant: { ...formData.applicant!, phone: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
                  placeholder="(555) 123-4567"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.applicant?.email || ''}
                  onChange={e => setFormData({
                    ...formData,
                    applicant: { ...formData.applicant!, email: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
                  placeholder="john@example.com"
                />
              </div>

              {/* Site Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Site Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.applicant?.siteAddress || ''}
                  onChange={e => setFormData({
                    ...formData,
                    applicant: { ...formData.applicant!, siteAddress: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
                  placeholder="123 Main Street"
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.applicant?.city || ''}
                  onChange={e => setFormData({
                    ...formData,
                    applicant: { ...formData.applicant!, city: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
                  placeholder="San Francisco"
                />
              </div>

              {/* ZIP */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.applicant?.zip || ''}
                  onChange={e => setFormData({
                    ...formData,
                    applicant: { ...formData.applicant!, zip: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
                  placeholder="94102"
                />
              </div>

              {/* Parcel Number (if required) */}
              {utilityReq.requiresParcelNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parcel Number (APN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.applicant?.parcelNumber || ''}
                    onChange={e => setFormData({
                      ...formData,
                      applicant: { ...formData.applicant!, parcelNumber: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
                    placeholder="123-456-789"
                  />
                </div>
              )}

              {/* Utility Account Number (if required) */}
              {utilityReq.requiresUtilityAccountNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Utility Account Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.applicant?.utilityAccountNumber || ''}
                    onChange={e => setFormData({
                      ...formData,
                      applicant: { ...formData.applicant!, utilityAccountNumber: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
                    placeholder="1234567890"
                  />
                </div>
              )}

              {/* Contractor License (if required) */}
              {utilityReq.requiresContractorLicense && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contractor License Number
                  </label>
                  <input
                    type="text"
                    value={formData.applicant?.contractorLicense || ''}
                    onChange={e => setFormData({
                      ...formData,
                      applicant: { ...formData.applicant!, contractorLicense: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
                    placeholder="C-10 #123456"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: System Details */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">System Specifications</h2>
              <p className="text-sm text-gray-600 mb-6">
                Auto-populated from your project data - verify and adjust as needed
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900 mb-1">Auto-Populated Data</h4>
                  <p className="text-sm text-green-800">
                    The following fields have been automatically filled from your project:
                  </p>
                  <ul className="text-sm text-green-800 mt-2 space-y-1">
                    <li>• System Size: {formData.system?.systemSizeKw} kW</li>
                    <li>• Interconnection Type: {formData.system?.interconnectionType?.replace(/_/g, ' ')}</li>
                    <li>• Service: {formData.system?.voltage}V, {formData.system?.phase}-phase, {formData.system?.existingServiceAmps}A</li>
                    {formData.system?.numberOfChargers && formData.system.numberOfChargers > 0 && (
                      <li>• EV Chargers: {formData.system.numberOfChargers} units @ {formData.system.chargerPowerKw} kW each</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* System Size */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total System Size (kW) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.system?.systemSizeKw || 0}
                  onChange={e => setFormData({
                    ...formData,
                    system: { ...formData.system!, systemSizeKw: parseFloat(e.target.value) }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Will Export Power to Grid?
                </label>
                <select
                  value={formData.system?.willExportPower ? 'yes' : 'no'}
                  onChange={e => setFormData({
                    ...formData,
                    system: { ...formData.system!, willExportPower: e.target.value === 'yes' }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
                >
                  <option value="no">No (Charging Only)</option>
                  <option value="yes">Yes (Net Metering/V2G)</option>
                </select>
              </div>

              {/* Equipment Details */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Equipment Manufacturer
                </label>
                <input
                  type="text"
                  value={formData.system?.equipmentManufacturer || ''}
                  onChange={e => setFormData({
                    ...formData,
                    system: { ...formData.system!, equipmentManufacturer: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
                  placeholder="Tesla, ChargePoint, etc."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Equipment Model
                </label>
                <input
                  type="text"
                  value={formData.system?.equipmentModel || ''}
                  onChange={e => setFormData({
                    ...formData,
                    system: { ...formData.system!, equipmentModel: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
                  placeholder="Model number"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review & Export */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Review & Export Application</h2>
              <p className="text-sm text-gray-600 mb-6">
                Review your application details and export to PDF
              </p>
            </div>

            {/* Summary Card */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="font-bold text-gray-900 mb-4">Application Summary</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Utility Provider:</span>
                  <span className="ml-2 text-gray-900">{formData.utilityProvider}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">System Size:</span>
                  <span className="ml-2 text-gray-900">{formData.system?.systemSizeKw} kW</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Applicant:</span>
                  <span className="ml-2 text-gray-900">{formData.applicant?.contactName}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Site Address:</span>
                  <span className="ml-2 text-gray-900">{formData.applicant?.siteAddress}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Interconnection Type:</span>
                  <span className="ml-2 text-gray-900">
                    {formData.system?.interconnectionType?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Export Power:</span>
                  <span className="ml-2 text-gray-900">
                    {formData.system?.willExportPower ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Estimated Fees */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-900 mb-2">Estimated Application Fees</h4>
              <div className="text-sm text-yellow-800 space-y-1">
                <div className="flex justify-between">
                  <span>Application Fee:</span>
                  <span className="font-medium">${fees.applicationFee}</span>
                </div>
                <div className="flex justify-between">
                  <span>Engineering Study Deposit:</span>
                  <span className="font-medium">${fees.studyFee}</span>
                </div>
                <div className="flex justify-between border-t border-yellow-300 pt-2 mt-2">
                  <span className="font-bold">Total Estimated:</span>
                  <span className="font-bold">${fees.totalFee}</span>
                </div>
              </div>
            </div>

            {/* Validation Errors */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900 mb-1">Please Fix These Issues</h4>
                    <ul className="text-sm text-red-800 space-y-1">
                      {errors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Export Button */}
            <button
              onClick={() => {
                const validation = validateInterconnectionForm(formData);
                if (validation.isValid) {
                  alert('PDF export coming soon! This will generate a completed Rule 21 application form.');
                } else {
                  setErrors(validation.errors);
                }
              }}
              className="w-full bg-electric-500 text-white py-3 rounded-lg font-medium hover:bg-electric-600 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export Application as PDF
            </button>

            {formData.utilityProvider && utilityReq.submissionEmail && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Next Steps</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Export the completed application as PDF</li>
                  <li>Gather required supporting documents (single-line diagram, equipment specs, etc.)</li>
                  <li>Email to: <a href={`mailto:${utilityReq.submissionEmail}`} className="underline font-medium">{utilityReq.submissionEmail}</a></li>
                  <li>Mail payment of ${fees.totalFee} to: {utilityReq.submissionAddress}</li>
                  <li>Allow {utilityReq.processingTimeDays} days for review</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              currentStep === 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={currentStep === 4}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              currentStep === 4
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-electric-500 text-white hover:bg-electric-600'
            }`}
          >
            {currentStep === 4 ? 'Completed' : 'Next'}
          </button>
        </div>
      </div>

      {/* Sources Footer */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600">
        <p className="font-medium mb-2">Sources:</p>
        <ul className="space-y-1">
          <li>
            • <a href="https://www.cpuc.ca.gov/Rule21/" target="_blank" rel="noopener noreferrer" className="text-electric-600 hover:underline">Electric Rule 21: Generating Facility Interconnections</a>
          </li>
          <li>
            • <a href="https://www.pge.com/tariffs/assets/pdf/tariffbook/ELEC_FORMS_79-1174-03.pdf" target="_blank" rel="noopener noreferrer" className="text-electric-600 hover:underline">PG&E Rule 21 Generator Interconnection Application (Form 79-1174-03)</a>
          </li>
          <li>
            • <a href="https://www.sce.com/clean-energy-efficiency/solar-generating-your-own-power/solar-power-basics/grid-interconnections" target="_blank" rel="noopener noreferrer" className="text-electric-600 hover:underline">SCE Generator Interconnection Processes</a>
          </li>
          <li>
            • <a href="https://www.sdge.com/more-information/customer-generation/electric-rule-21" target="_blank" rel="noopener noreferrer" className="text-electric-600 hover:underline">SDG&E Electric Rule 21</a>
          </li>
        </ul>
      </div>
    </div>
  );
};
