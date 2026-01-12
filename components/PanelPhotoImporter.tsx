/**
 * Panel Photo Importer Component
 *
 * Allows users to upload panel photos and extract circuit information
 * using Gemini Vision AI. Provides an editable table for corrections
 * before importing circuits.
 */

import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, Camera, Loader2, AlertTriangle, Plus, Trash2, ZoomIn } from 'lucide-react';
import { extractCircuitsFromPhoto, ExtractedCircuit, ExtractionResult } from '@/services/panelOcrService';

interface PanelPhotoImporterProps {
  panelId: string;
  panelName: string;
  maxCircuits: number;
  existingCircuitCount: number;
  onImport: (circuits: ExtractedCircuit[]) => Promise<void>;
  onClose: () => void;
}

type ImportStep = 'upload' | 'analyzing' | 'review';

const STANDARD_BREAKER_SIZES = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200];
const LOAD_TYPE_OPTIONS = [
  { value: 'L', label: 'L - Lighting' },
  { value: 'R', label: 'R - Receptacles' },
  { value: 'M', label: 'M - Motor' },
  { value: 'H', label: 'H - Heating' },
  { value: 'C', label: 'C - Cooling/HVAC' },
  { value: 'W', label: 'W - Water Heater' },
  { value: 'D', label: 'D - Dryer' },
  { value: 'K', label: 'K - Kitchen' },
  { value: 'O', label: 'O - Other' },
];

export const PanelPhotoImporter: React.FC<PanelPhotoImporterProps> = ({
  panelId,
  panelName,
  maxCircuits,
  existingCircuitCount,
  onImport,
  onClose,
}) => {
  const [step, setStep] = useState<ImportStep>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [circuits, setCircuits] = useState<ExtractedCircuit[]>([]);
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file is too large. Please use an image under 10MB.');
      return;
    }

    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);

      // Extract base64 data (remove data URL prefix)
      const base64 = dataUrl.split(',')[1];
      setImageBase64(base64);

      // Start analysis
      setStep('analyzing');

      try {
        const result: ExtractionResult = await extractCircuitsFromPhoto(base64, panelName, maxCircuits);

        if (result.error) {
          setError(result.error);
          setStep('upload');
          return;
        }

        setCircuits(result.circuits);
        setConfidence(result.confidence);
        setWarnings(result.warnings);
        setStep('review');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to analyze image');
        setStep('upload');
      }
    };
    reader.readAsDataURL(file);
  }, [panelName, maxCircuits]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const updateCircuit = (index: number, field: keyof ExtractedCircuit, value: any) => {
    setCircuits(prev => prev.map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    ));
  };

  const deleteCircuit = (index: number) => {
    setCircuits(prev => prev.filter((_, i) => i !== index));
  };

  const addCircuit = () => {
    // Find next available circuit number
    const usedNumbers = new Set(circuits.map(c => c.circuit_number));
    let nextNumber = 1;
    while (usedNumbers.has(nextNumber) && nextNumber <= maxCircuits) {
      nextNumber++;
    }

    if (nextNumber > maxCircuits) {
      setWarnings(prev => [...prev, 'No more circuit slots available']);
      return;
    }

    setCircuits(prev => [...prev, {
      circuit_number: nextNumber,
      description: null,
      breaker_amps: 20,
      load_watts: null,
      load_type: 'O',
      pole: 1,
      conductor_size: null,
    }]);
  };

  const handleImport = async () => {
    if (circuits.length === 0) {
      setError('No circuits to import');
      return;
    }

    setImporting(true);
    try {
      await onImport(circuits);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import circuits');
    } finally {
      setImporting(false);
    }
  };

  const resetToUpload = () => {
    setStep('upload');
    setImagePreview(null);
    setImageBase64(null);
    setCircuits([]);
    setWarnings([]);
    setError(null);
  };

  const getConfidenceColor = () => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-red-600 bg-red-50';
    }
  };

  const getConfidenceDots = () => {
    const filled = confidence === 'high' ? 5 : confidence === 'medium' ? 3 : 1;
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${
              i <= filled
                ? confidence === 'high' ? 'bg-green-500' : confidence === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Camera className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-semibold">Import Circuits from Photo</h2>
              <p className="text-sm text-gray-300">{panelName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Step */}
          {step === 'upload' && (
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging ? 'border-electric-500 bg-electric-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Upload Panel Photo
              </h3>
              <p className="text-gray-600 mb-4">
                Take a clear photo of the panel schedule/directory card
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleInputChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2 bg-electric-600 text-white rounded-lg hover:bg-electric-700 transition-colors"
              >
                Choose Photo
              </button>
              <p className="text-sm text-gray-500 mt-4">
                or drag and drop an image here
              </p>
            </div>
          )}

          {/* Analyzing Step */}
          {step === 'analyzing' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 mx-auto text-electric-600 animate-spin mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Analyzing Panel Photo...
              </h3>
              <p className="text-gray-600">
                Extracting circuit information from the image
              </p>
            </div>
          )}

          {/* Review Step */}
          {step === 'review' && (
            <div className="flex gap-6">
              {/* Image Preview */}
              <div className="w-64 flex-shrink-0">
                <div className="sticky top-0">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Panel Photo</h3>
                  {imagePreview && (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Panel"
                        className="w-full rounded-lg border border-gray-200 cursor-pointer"
                        onClick={() => setShowImageZoom(true)}
                      />
                      <button
                        onClick={() => setShowImageZoom(true)}
                        className="absolute bottom-2 right-2 p-1 bg-black bg-opacity-50 rounded text-white hover:bg-opacity-70"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={resetToUpload}
                    className="mt-3 text-sm text-electric-600 hover:text-electric-700"
                  >
                    Upload different photo
                  </button>
                </div>
              </div>

              {/* Editable Table */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">
                    Extracted Circuits ({circuits.length} found)
                  </h3>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${getConfidenceColor()}`}>
                    <span>Confidence:</span>
                    {getConfidenceDots()}
                    <span className="capitalize">{confidence}</span>
                  </div>
                </div>

                {/* Warnings */}
                {warnings.length > 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-700 font-medium mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      Warnings
                    </div>
                    <ul className="text-sm text-yellow-700 list-disc list-inside">
                      {warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Circuit Table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 w-16">#</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Description</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 w-20">Amps</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 w-32">Type</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 w-16">Pole</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-700 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {circuits.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                            No circuits extracted. Add circuits manually below.
                          </td>
                        </tr>
                      ) : (
                        circuits.map((circuit, index) => (
                          <tr key={index} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={1}
                                max={maxCircuits}
                                value={circuit.circuit_number}
                                onChange={(e) => updateCircuit(index, 'circuit_number', parseInt(e.target.value) || 1)}
                                className="w-14 px-2 py-1 border border-gray-300 rounded text-center focus:ring-1 focus:ring-electric-500 focus:border-electric-500"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={circuit.description || ''}
                                onChange={(e) => updateCircuit(index, 'description', e.target.value || null)}
                                placeholder="Circuit description"
                                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-electric-500 focus:border-electric-500"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={circuit.breaker_amps || 20}
                                onChange={(e) => updateCircuit(index, 'breaker_amps', parseInt(e.target.value))}
                                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-electric-500 focus:border-electric-500"
                              >
                                {STANDARD_BREAKER_SIZES.map(size => (
                                  <option key={size} value={size}>{size}A</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={circuit.load_type || 'O'}
                                onChange={(e) => updateCircuit(index, 'load_type', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-electric-500 focus:border-electric-500"
                              >
                                {LOAD_TYPE_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={circuit.pole}
                                onChange={(e) => updateCircuit(index, 'pole', parseInt(e.target.value))}
                                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-electric-500 focus:border-electric-500"
                              >
                                <option value={1}>1P</option>
                                <option value={2}>2P</option>
                                <option value={3}>3P</option>
                              </select>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => deleteCircuit(index)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete circuit"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Add Row Button */}
                  <div className="border-t border-gray-200 p-2 bg-gray-50">
                    <button
                      onClick={addCircuit}
                      className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:text-electric-600 hover:bg-electric-50 rounded transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Circuit
                    </button>
                  </div>
                </div>

                {/* Existing Circuits Warning */}
                {existingCircuitCount > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-700">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>
                      This will replace <strong>{existingCircuitCount}</strong> existing circuit{existingCircuitCount !== 1 ? 's' : ''} in this panel
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          {step === 'review' && (
            <button
              onClick={handleImport}
              disabled={circuits.length === 0 || importing}
              className="px-6 py-2 bg-electric-600 text-white rounded-lg hover:bg-electric-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              Import {circuits.length} Circuit{circuits.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {/* Image Zoom Modal */}
      {showImageZoom && imagePreview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-8"
          onClick={() => setShowImageZoom(false)}
        >
          <button
            onClick={() => setShowImageZoom(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={imagePreview}
            alt="Panel (zoomed)"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
};

export default PanelPhotoImporter;
