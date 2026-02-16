/**
 * CalculationBreakdown Component
 * Displays detailed NEC calculation results with references and warnings
 */

import React from 'react';
import { AlertTriangle, CheckCircle, Info, BookOpen } from 'lucide-react';

export interface CalculationBreakdownProps {
  title: string;
  summary: {
    label: string;
    value: string | number;
    unit?: string;
    highlight?: boolean;
  }[];
  breakdown?: {
    category: string;
    items: {
      label: string;
      value: string | number;
      unit?: string;
      subtext?: string;
    }[];
  }[];
  necReferences: string[];
  warnings?: string[];
  notes?: string[];
  isCompliant?: boolean;
  complianceMessage?: string;
}

export const CalculationBreakdown: React.FC<CalculationBreakdownProps> = ({
  title,
  summary,
  breakdown,
  necReferences,
  warnings = [],
  notes = [],
  isCompliant,
  complianceMessage
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {summary.map((item, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border ${
                item.highlight
                  ? 'bg-electric-50 border-electric-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                {item.label}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {item.value}
                {item.unit && <span className="text-lg ml-1 text-gray-600">{item.unit}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Compliance Badge */}
        {isCompliant !== undefined && (
          <div className="flex items-center justify-center">
            {isCompliant ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-100 px-6 py-3 rounded-full text-sm font-bold">
                <CheckCircle className="w-5 h-5" />
                {complianceMessage || 'NEC Compliant'}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-700 bg-red-100 px-6 py-3 rounded-full text-sm font-bold">
                <AlertTriangle className="w-5 h-5" />
                {complianceMessage || 'Non-Compliant'}
              </div>
            )}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((warning, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 text-sm text-orange-800 bg-orange-50 p-4 rounded-lg border border-orange-200"
              >
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        {/* Detailed Breakdown */}
        {breakdown && breakdown.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Calculation Breakdown
            </div>
            {breakdown.map((category, catIdx) => (
              <div key={catIdx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="font-semibold text-gray-900 mb-3">{category.category}</div>
                <div className="space-y-2">
                  {category.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="text-sm text-gray-700">{item.label}</div>
                        {item.subtext && (
                          <div className="text-xs text-gray-500 mt-1">{item.subtext}</div>
                        )}
                      </div>
                      <div className="text-sm font-mono font-semibold text-gray-900 ml-4">
                        {item.value}
                        {item.unit && <span className="ml-1">{item.unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* NEC References */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-blue-900 mb-3">
            <BookOpen className="w-4 h-4" />
            NEC 2023 References
          </div>
          <ul className="space-y-1 text-sm text-blue-800">
            {necReferences.map((ref, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>{ref}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Notes */}
        {notes.length > 0 && (
          <div className="space-y-2">
            {notes.map((note, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200"
              >
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
                <span>{note}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
