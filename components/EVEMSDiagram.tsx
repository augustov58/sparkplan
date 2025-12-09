/**
 * EVEMS System Architecture Diagram
 * Visual representation of EV Energy Management System integration
 */

import React from 'react';

interface EVEMSDiagramProps {
  /** Service size in amps */
  serviceAmps?: number;
  /** Service voltage */
  serviceVoltage?: number;
  /** Number of EV chargers */
  numChargers?: number;
  /** Whether EVEMS is enabled */
  evemsEnabled?: boolean;
  /** Existing load percentage */
  existingLoadPercent?: number;
}

export const EVEMSDiagram: React.FC<EVEMSDiagramProps> = ({
  serviceAmps = 200,
  serviceVoltage = 240,
  numChargers = 2,
  evemsEnabled = true,
  existingLoadPercent = 60,
}) => {
  const svgWidth = 600;
  const svgHeight = 500;

  // Calculate positions
  const panelX = svgWidth / 2;
  const panelY = 80;
  const evemsX = svgWidth / 2;
  const evemsY = 180;
  const meterX = svgWidth / 2;
  const meterY = 280;
  const chargerY = 380;
  const chargerSpacing = 80;
  const chargerStartX = svgWidth / 2 - ((numChargers - 1) * chargerSpacing) / 2;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="mb-4">
        <h4 className="font-semibold text-gray-900 text-sm mb-1">EVEMS System Architecture</h4>
        <p className="text-xs text-gray-600">
          {evemsEnabled 
            ? 'EVEMS monitors total load and manages EV charging capacity'
            : 'Without EVEMS: All chargers operate at full capacity'}
        </p>
      </div>
      
      <svg
        width="100%"
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="overflow-visible"
      >
        {/* Main Service Feed (Vertical Line) */}
        <line
          x1={panelX}
          y1={panelY + 40}
          x2={panelX}
          y2={evemsY - 20}
          stroke="#1f2937"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Main Panel */}
        <rect
          x={panelX - 50}
          y={panelY}
          width="100"
          height="60"
          fill="#6b7280"
          stroke="#374151"
          strokeWidth="2"
          rx="4"
        />
        {/* Panel Bus Bars */}
        {[0, 1, 2].map((i) => (
          <line
            key={i}
            x1={panelX - 30 + i * 30}
            y1={panelY + 10}
            x2={panelX - 30 + i * 30}
            y2={panelY + 50}
            stroke="#9ca3af"
            strokeWidth="3"
          />
        ))}
        <text
          x={panelX}
          y={panelY - 10}
          textAnchor="middle"
          className="text-xs font-semibold fill-gray-700"
        >
          Main Panel
        </text>
        <text
          x={panelX}
          y={panelY + 80}
          textAnchor="middle"
          className="text-xs fill-gray-600"
        >
          {serviceAmps}A {serviceVoltage}V
        </text>

        {/* Connection to EVEMS */}
        <line
          x1={panelX}
          y1={panelY + 60}
          x2={evemsX}
          y2={evemsY - 20}
          stroke="#1f2937"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* EVEMS Controller / Main Breaker */}
        <rect
          x={evemsX - 40}
          y={evemsY - 20}
          width="80"
          height="50"
          fill={evemsEnabled ? "#dc2626" : "#9ca3af"}
          stroke="#374151"
          strokeWidth="2"
          rx="4"
        />
        <text
          x={evemsX}
          y={evemsY - 30}
          textAnchor="middle"
          className="text-xs font-semibold fill-gray-700"
        >
          {evemsEnabled ? 'EVEMS Controller' : 'Main Breaker'}
        </text>
        {evemsEnabled && (
          <text
            x={evemsX}
            y={evemsY - 15}
            textAnchor="middle"
            className="text-xs fill-white"
          >
            Demand Monitor
          </text>
        )}

        {/* Connection to Meter Stack */}
        <line
          x1={evemsX}
          y1={evemsY + 30}
          x2={meterX}
          y2={meterY - 20}
          stroke="#1f2937"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Meter Stack */}
        <rect
          x={meterX - 60}
          y={meterY - 20}
          width="120"
          height="80"
          fill="#e5e7eb"
          stroke="#9ca3af"
          strokeWidth="2"
          rx="4"
        />
        {/* Individual Meters */}
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={meterX - 30 + i * 30}
            cy={meterY + 10}
            r="12"
            fill="#ffffff"
            stroke="#6b7280"
            strokeWidth="2"
          />
        ))}
        <text
          x={meterX}
          y={meterY - 30}
          textAnchor="middle"
          className="text-xs font-semibold fill-gray-700"
        >
          Meter Stack
        </text>

        {/* Connections to Residential Units (from meters) */}
        {[0, 1, 2].map((i) => (
          <line
            key={i}
            x1={meterX - 30 + i * 30}
            y1={meterY + 60}
            x2={meterX - 30 + i * 30 + 40}
            y2={meterY + 80}
            stroke="#9ca3af"
            strokeWidth="2"
            strokeDasharray="4,4"
          />
        ))}

        {/* EV Charger Connections (from EVEMS) */}
        {Array.from({ length: numChargers }).map((_, i) => {
          const chargerX = chargerStartX + i * chargerSpacing;
          return (
            <g key={i}>
              {/* Connection Line */}
              <line
                x1={evemsX}
                y1={evemsY + 30}
                x2={chargerX}
                y2={chargerY - 20}
                stroke={evemsEnabled ? "#dc2626" : "#6b7280"}
                strokeWidth="3"
                strokeDasharray={evemsEnabled ? "0" : "4,4"}
                strokeLinecap="round"
              />
              
              {/* EV Charger */}
              <ellipse
                cx={chargerX}
                cy={chargerY}
                rx="35"
                ry="20"
                fill="#4b5563"
                stroke="#1f2937"
                strokeWidth="2"
              />
              <text
                x={chargerX}
                y={chargerY + 5}
                textAnchor="middle"
                className="text-xs fill-white font-medium"
              >
                EVSE
              </text>
              <text
                x={chargerX}
                y={chargerY + 35}
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                Charger {i + 1}
              </text>

              {/* Charging Cable */}
              <line
                x1={chargerX + 20}
                y1={chargerY + 10}
                x2={chargerX + 50}
                y2={chargerY + 10}
                stroke="#1f2937"
                strokeWidth="3"
                strokeLinecap="round"
              />
              
              {/* EV Vehicle */}
              <rect
                x={chargerX + 50}
                y={chargerY - 5}
                width="40"
                height="30"
                fill="#9ca3af"
                stroke="#6b7280"
                strokeWidth="2"
                rx="4"
              />
              {/* Car windows */}
              <rect
                x={chargerX + 55}
                y={chargerY}
                width="8"
                height="8"
                fill="#d1d5db"
              />
              <rect
                x={chargerX + 68}
                y={chargerY}
                width="8"
                height="8"
                fill="#d1d5db"
              />
              {/* Charging port indicator */}
              <circle
                cx={chargerX + 50}
                cy={chargerY + 10}
                r="3"
                fill="#10b981"
              />
            </g>
          );
        })}

        {/* Load Indicator Bar */}
        {evemsEnabled && (
          <g>
            <rect
              x={panelX - 60}
              y={panelY + 65}
              width="120"
              height="8"
              fill="#e5e7eb"
              stroke="#9ca3af"
              strokeWidth="1"
              rx="4"
            />
            <rect
              x={panelX - 60}
              y={panelY + 65}
              width={`${existingLoadPercent}%`}
              height="8"
              fill="#3b82f6"
              rx="4"
            />
            <text
              x={panelX}
              y={panelY + 88}
              textAnchor="middle"
              className="text-xs fill-gray-600"
            >
              Existing Load: {existingLoadPercent}%
            </text>
            <text
              x={panelX}
              y={panelY + 100}
              textAnchor="middle"
              className="text-xs fill-gray-600"
            >
              Available for EV: {100 - existingLoadPercent}%
            </text>
          </g>
        )}

        {/* EVEMS Status Indicator */}
        {evemsEnabled && (
          <g>
            <circle
              cx={evemsX + 60}
              cy={evemsY + 5}
              r="8"
              fill="#10b981"
            />
            <text
              x={evemsX + 60}
              y={evemsY + 9}
              textAnchor="middle"
              className="text-xs fill-white font-bold"
            >
              ✓
            </text>
            <text
              x={evemsX + 75}
              y={evemsY + 9}
              className="text-xs fill-gray-700 font-medium"
            >
              Active
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 bg-gray-600 rounded"></div>
              <span className="text-gray-700">Main Panel</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 bg-red-600 rounded"></div>
              <span className="text-gray-700">EVEMS Controller</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-300 rounded"></div>
              <span className="text-gray-700">Meter Stack</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 bg-gray-700 rounded-full"></div>
              <span className="text-gray-700">EV Charger (EVSE)</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-gray-700">Load Monitor</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span className="text-gray-700">EV Vehicle</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

