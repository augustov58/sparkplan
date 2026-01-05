import React, { useState, useMemo } from 'react';
import {
  Zap,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  Plug,
  ThermometerSun,
  Droplets,
  ChefHat,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import {
  calculateCircuitSharing,
  getDefaultCircuitAmps,
  getDeviceDisplayName,
  shouldConsiderCircuitSharing
} from '../services/calculations/circuitSharing';
import type { CircuitSharingInput, CircuitShareDevice } from '../types';

interface CircuitSharingCalculatorProps {
  // Optional: Pre-populate from Service Upgrade Calculator
  initialServiceRating?: number;
  initialUtilization?: number;
  initialEVAmps?: number;
}

export const CircuitSharingCalculator: React.FC<CircuitSharingCalculatorProps> = ({
  initialServiceRating = 200,
  initialUtilization = 75,
  initialEVAmps = 48
}) => {
  // Input state
  const [serviceRating, setServiceRating] = useState(initialServiceRating);
  const [currentUtilization, setCurrentUtilization] = useState(initialUtilization);
  const [proposedEVChargerAmps, setProposedEVChargerAmps] = useState(initialEVAmps);
  const [shareWith, setShareWith] = useState<CircuitShareDevice>('dryer');
  const [existingCircuitAmps, setExistingCircuitAmps] = useState(30);
  const [dryerUsagePattern, setDryerUsagePattern] = useState<'daytime' | 'evening' | 'variable'>('evening');
  const [evChargingSchedule, setEvChargingSchedule] = useState<'overnight' | 'daytime' | 'flexible'>('overnight');

  // Update circuit amps when share device changes
  const handleShareWithChange = (device: CircuitShareDevice) => {
    setShareWith(device);
    setExistingCircuitAmps(getDefaultCircuitAmps(device));
  };

  // Calculate result
  const result = useMemo(() => {
    const input: CircuitSharingInput = {
      serviceRating,
      currentUtilization,
      proposedEVChargerAmps,
      shareWith,
      existingCircuitAmps,
      dryerUsagePattern,
      evChargingSchedule
    };
    return calculateCircuitSharing(input);
  }, [serviceRating, currentUtilization, proposedEVChargerAmps, shareWith, existingCircuitAmps, dryerUsagePattern, evChargingSchedule]);

  // Quick recommendation check
  const recommendation = useMemo(() =>
    shouldConsiderCircuitSharing(currentUtilization, proposedEVChargerAmps),
    [currentUtilization, proposedEVChargerAmps]
  );

  // Device icon mapping
  const getDeviceIcon = (device: CircuitShareDevice) => {
    switch (device) {
      case 'dryer':
        return <Zap className="w-5 h-5" />;
      case 'hvac':
        return <ThermometerSun className="w-5 h-5" />;
      case 'water_heater':
        return <Droplets className="w-5 h-5" />;
      case 'range':
        return <ChefHat className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Plug className="w-6 h-6 text-electric-500" />
          Circuit Sharing Calculator
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Install EV charger without panel upgrade - share circuit with dryer or HVAC
        </p>
      </div>

      {/* Quick Recommendation Banner */}
      <div className={`p-4 rounded-lg border-2 ${
        recommendation.recommend
          ? 'bg-green-50 border-green-300'
          : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-start gap-3">
          {recommendation.recommend ? (
            <Sparkles className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className={`font-medium ${recommendation.recommend ? 'text-green-700' : 'text-gray-700'}`}>
              {recommendation.recommend ? 'Circuit sharing recommended!' : 'Circuit sharing optional'}
            </p>
            <p className="text-sm text-gray-500 mt-1">{recommendation.reason}</p>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Configuration</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Service Info */}
          <div className="space-y-4">
            <h5 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Current Service</h5>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Size
              </label>
              <select
                value={serviceRating}
                onChange={e => setServiceRating(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 rounded-md focus:ring-electric-500 focus:border-electric-500"
              >
                <option value={100}>100A</option>
                <option value={125}>125A</option>
                <option value={150}>150A</option>
                <option value={200}>200A</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Utilization (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={30}
                  max={100}
                  value={currentUtilization}
                  onChange={e => setCurrentUtilization(Number(e.target.value))}
                  className="flex-1 accent-electric-500"
                />
                <span className={`text-lg font-bold min-w-[50px] text-right ${
                  currentUtilization > 90 ? 'text-red-600' :
                  currentUtilization > 75 ? 'text-orange-600' :
                  'text-green-600'
                }`}>
                  {currentUtilization}%
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Get this from Service Upgrade Calculator
              </p>
            </div>
          </div>

          {/* EV Charger */}
          <div className="space-y-4">
            <h5 className="text-sm font-medium text-gray-500 uppercase tracking-wide">EV Charger</h5>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Charger Size
              </label>
              <select
                value={proposedEVChargerAmps}
                onChange={e => setProposedEVChargerAmps(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 rounded-md focus:ring-electric-500 focus:border-electric-500"
              >
                <option value={24}>24A (Tesla Mobile Connector)</option>
                <option value={32}>32A (Level 2 Standard)</option>
                <option value={40}>40A (Level 2 Fast)</option>
                <option value={48}>48A (Tesla Wall Connector)</option>
                <option value={50}>50A (ChargePoint Home Flex)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                When will EV charge?
              </label>
              <select
                value={evChargingSchedule}
                onChange={e => setEvChargingSchedule(e.target.value as typeof evChargingSchedule)}
                className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 rounded-md focus:ring-electric-500 focus:border-electric-500"
              >
                <option value="overnight">Overnight (11pm-7am) - Recommended</option>
                <option value="daytime">Daytime (9am-5pm)</option>
                <option value="flexible">Flexible / Variable</option>
              </select>
            </div>
          </div>
        </div>

        {/* Share With Selection */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h5 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Share Circuit With
          </h5>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['dryer', 'hvac', 'water_heater', 'range'] as CircuitShareDevice[]).map(device => (
              <button
                key={device}
                onClick={() => handleShareWithChange(device)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  shareWith === device
                    ? 'border-electric-500 bg-electric-50 ring-2 ring-electric-500/30'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                } ${device === 'range' ? 'opacity-60' : ''}`}
              >
                <div className={`mb-2 ${shareWith === device ? 'text-electric-500' : 'text-gray-400'}`}>
                  {getDeviceIcon(device)}
                </div>
                <div className={`font-medium text-sm ${shareWith === device ? 'text-electric-600' : 'text-gray-900'}`}>
                  {getDeviceDisplayName(device)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {getDefaultCircuitAmps(device)}A circuit
                </div>
                {device === 'dryer' && (
                  <div className="text-xs text-green-600 mt-1 font-medium">Most common</div>
                )}
                {device === 'range' && (
                  <div className="text-xs text-red-600 mt-1 font-medium">Not recommended</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Usage Patterns */}
        <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              When do you use the {getDeviceDisplayName(shareWith).toLowerCase()}?
            </label>
            <select
              value={dryerUsagePattern}
              onChange={e => setDryerUsagePattern(e.target.value as typeof dryerUsagePattern)}
              className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 rounded-md focus:ring-electric-500 focus:border-electric-500"
            >
              <option value="daytime">Daytime (9am-6pm)</option>
              <option value="evening">Evening (6pm-11pm)</option>
              <option value="variable">Variable times</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Existing Circuit Size
            </label>
            <select
              value={existingCircuitAmps}
              onChange={e => setExistingCircuitAmps(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 rounded-md focus:ring-electric-500 focus:border-electric-500"
            >
              <option value={30}>30A (Standard dryer/water heater)</option>
              <option value={40}>40A (Large dryer/HVAC)</option>
              <option value={50}>50A (Range/Large HVAC)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Compatibility Status */}
          {result.isCompatible ? (
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-green-700 mb-2">
                    Circuit Sharing Compatible!
                  </h4>
                  <p className="text-green-600 mb-4">
                    Score: <span className="font-bold">{result.compatibilityScore}/100</span> -
                    You can install an EV charger by sharing the existing {getDeviceDisplayName(shareWith).toLowerCase()} circuit.
                  </p>

                  {/* Recommended Device */}
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h5 className="font-semibold text-gray-900">{result.deviceName}</h5>
                        <p className="text-sm text-gray-500">Recommended device</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-electric-600">
                          ${result.deviceCost.min}-${result.deviceCost.max}
                        </div>
                        <div className="text-xs text-gray-500">Device cost</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center pt-3 border-t border-gray-200">
                      <div>
                        <div className="text-lg font-bold text-gray-900">
                          {result.circuitRequirements.circuitAmps}A
                        </div>
                        <div className="text-xs text-gray-500">Circuit Required</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900">
                          {result.expectedChargingHours}h
                        </div>
                        <div className="text-xs text-gray-500">For ~30 miles</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900 capitalize">
                          {result.chargingPausesExpected}
                        </div>
                        <div className="text-xs text-gray-500">Pause frequency</div>
                      </div>
                    </div>
                  </div>

                  {/* Savings Comparison */}
                  <div className="mt-4 bg-green-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-700">Cost Savings</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-green-600">Circuit Sharing</div>
                        <div className="text-xl font-bold text-green-700">
                          ~${Math.round(result.costComparison.circuitSharingCost)}
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <span className="text-green-600 font-medium">vs</span>
                      </div>
                      <div>
                        <div className="text-sm text-green-600">Service Upgrade</div>
                        <div className="text-xl font-bold text-green-700">
                          ${result.costComparison.serviceUpgradeCost.min.toLocaleString()}-${result.costComparison.serviceUpgradeCost.max.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-300 text-center">
                      <span className="text-green-600">You save </span>
                      <span className="text-2xl font-bold text-green-700">
                        ${result.costComparison.savings.min.toLocaleString()}-${result.costComparison.savings.max.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-red-700 mb-2">
                    Circuit Sharing Not Recommended
                  </h4>
                  <p className="text-red-600 mb-4">
                    Score: <span className="font-bold">{result.compatibilityScore}/100</span>
                  </p>
                  {result.incompatibilityReason && (
                    <p className="text-red-600 mb-4">{result.incompatibilityReason}</p>
                  )}

                  {/* Alternative */}
                  {result.upgradeAlternative && (
                    <div className="bg-white rounded-lg p-4 border border-red-200">
                      <h5 className="font-semibold text-gray-900 mb-2">
                        Alternative: Service Upgrade
                      </h5>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Upgrade to:</span>
                          <div className="font-bold text-gray-900">{result.upgradeAlternative.newServiceSize}A</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Cost:</span>
                          <div className="font-bold text-gray-900">
                            ${result.upgradeAlternative.estimatedCost.min.toLocaleString()}-${result.upgradeAlternative.estimatedCost.max.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Timeline:</span>
                          <div className="font-bold text-gray-900">{result.upgradeAlternative.timeline}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Installation Notes */}
          {result.isCompatible && result.installationNotes.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="font-semibold text-blue-700 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Installation Notes
              </h5>
              <ul className="text-sm text-blue-600 space-y-1">
                {result.installationNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h5 className="font-semibold text-yellow-700 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Considerations
              </h5>
              <ul className="text-sm text-yellow-600 space-y-1">
                {result.warnings.map((warning, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-yellow-500">•</span>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Circuit Requirements */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h5 className="font-semibold text-gray-900 mb-3">Circuit Requirements</h5>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Circuit Size:</span>
                <div className="font-bold text-gray-900">{result.circuitRequirements.circuitAmps}A</div>
              </div>
              <div>
                <span className="text-gray-500">Wire Size:</span>
                <div className="font-bold text-gray-900">{result.circuitRequirements.wireSize}</div>
              </div>
              <div>
                <span className="text-gray-500">Breaker:</span>
                <div className="font-bold text-gray-900">{result.circuitRequirements.breakerType}</div>
              </div>
            </div>
          </div>

          {/* NEC References */}
          <div className="text-xs text-gray-500">
            <span className="font-medium">NEC References: </span>
            {result.necReferences.join(' • ')}
          </div>
        </div>
      )}
    </div>
  );
};
