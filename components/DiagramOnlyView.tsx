/**
 * Diagram-Only View Component
 *
 * Displays only the One-Line Diagram without circuit/panel creation tools.
 * Useful for presentation, printing, or focused diagram viewing.
 */

import React from 'react';
import { Maximize2, Download } from 'lucide-react';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';
import { useTransformers } from '../hooks/useTransformers';
import { Project } from '../types';

interface DiagramOnlyViewProps {
  project: Project;
}

export const DiagramOnlyView: React.FC<DiagramOnlyViewProps> = ({ project }) => {
  const { panels } = usePanels(project.id);
  const { circuits } = useCircuits(project.id);
  const { transformers } = useTransformers(project.id);

  // Find MDP (Main Distribution Panel)
  const mdp = panels.find(p => p.panel_type === 'MDP');

  // Helper function to get downstream elements (panels/transformers) from a panel
  const getDownstreamElements = (panelId: string) => {
    const downstreamPanels = panels.filter(p =>
      p.fed_from_type === 'panel' && p.fed_from === panelId
    );
    const downstreamTransformers = transformers.filter(t =>
      t.fed_from_panel_id === panelId
    );
    return { panels: downstreamPanels, transformers: downstreamTransformers };
  };

  // Get panels fed from transformers
  const getPanelsFedFromTransformer = (transformerId: string) => {
    return panels.filter(p =>
      p.fed_from_type === 'transformer' && p.fed_from_transformer_id === transformerId
    );
  };

  // Diagram rendering constants
  const DIAGRAM_CONSTANTS = {
    VIEWBOX_WIDTH: 800,
    VIEWBOX_HEIGHT: 750,
    SERVICE_Y: 50,
    METER_Y: 90,
    MDP_Y: 170,
    BUS_BAR_Y: 250,
    LEVEL_1_Y: 320,
    LEVEL_1_BUS_Y: 390,
    LEVEL_2_Y: 450,
    LEVEL_2_BUS_Y: 525,
    LEVEL_3_Y: 580,
    HORIZONTAL_SPACING: 120,
    CENTER_X: 400
  };

  // Render horizontal bus bar with vertical drops
  const renderBusBar = (
    parentX: number,
    busY: number,
    downstreamElements: Array<{ x: number; y: number; name: string }>,
    color: string = '#3B82F6'
  ) => {
    if (downstreamElements.length === 0) return null;
    if (downstreamElements.length === 1) {
      // Single element - direct vertical line
      const elem = downstreamElements[0];
      return (
        <line
          x1={parentX}
          y1={busY - 40}
          x2={elem.x}
          y2={elem.y - 40}
          stroke={color}
          strokeWidth="2"
        />
      );
    }

    // Multiple elements - horizontal bus with vertical drops
    const leftmostX = Math.min(...downstreamElements.map(e => e.x));
    const rightmostX = Math.max(...downstreamElements.map(e => e.x));

    return (
      <>
        {/* Vertical line from parent to bus */}
        <line
          x1={parentX}
          y1={busY - 40}
          x2={parentX}
          y2={busY}
          stroke={color}
          strokeWidth="2"
        />
        {/* Horizontal bus bar */}
        <line
          x1={leftmostX}
          y1={busY}
          x2={rightmostX}
          y2={busY}
          stroke={color}
          strokeWidth="4"
        />
        {/* Vertical drops to each downstream element */}
        {downstreamElements.map((elem, idx) => (
          <line
            key={idx}
            x1={elem.x}
            y1={busY}
            x2={elem.x}
            y2={elem.y - 40}
            stroke={color}
            strokeWidth="2"
          />
        ))}
      </>
    );
  };

  // Render panel rectangle
  const renderPanel = (x: number, y: number, name: string, isMDP: boolean = false) => {
    const color = isMDP ? '#DC2626' : '#3B82F6';
    return (
      <g key={name}>
        <rect
          x={x - 50}
          y={y}
          width="100"
          height="40"
          fill="white"
          stroke={color}
          strokeWidth={isMDP ? "3" : "2"}
          rx="4"
        />
        <text
          x={x}
          y={y + 25}
          textAnchor="middle"
          fill={color}
          fontSize="12"
          fontWeight={isMDP ? "bold" : "normal"}
        >
          {name}
        </text>
      </g>
    );
  };

  // Render transformer
  const renderTransformer = (x: number, y: number, name: string) => {
    return (
      <g key={name}>
        <polygon
          points={`${x},${y} ${x - 40},${y + 35} ${x + 40},${y + 35}`}
          fill="white"
          stroke="#F59E0B"
          strokeWidth="2"
        />
        <text
          x={x}
          y={y + 25}
          textAnchor="middle"
          fill="#F59E0B"
          fontSize="11"
          fontWeight="bold"
        >
          {name}
        </text>
      </g>
    );
  };

  // Get Level 1 elements (fed from MDP)
  const level1Elements = mdp ? getDownstreamElements(mdp.id) : { panels: [], transformers: [] };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">One-Line Electrical Diagram</h1>
            <p className="text-sm text-gray-600 mt-1">
              IEEE Std 315 Compliant - {project.name}
            </p>
          </div>
          <button
            onClick={() => {
              // Export diagram as SVG
              const svgElement = document.querySelector('#diagram-svg');
              if (svgElement) {
                const svgData = new XMLSerializer().serializeToString(svgElement);
                const blob = new Blob([svgData], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${project.name.replace(/\s+/g, '_')}_diagram.svg`;
                link.click();
                URL.revokeObjectURL(url);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export SVG
          </button>
        </div>
      </div>

      {/* Diagram */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex justify-center">
          <svg
            id="diagram-svg"
            viewBox={`0 0 ${DIAGRAM_CONSTANTS.VIEWBOX_WIDTH} ${DIAGRAM_CONSTANTS.VIEWBOX_HEIGHT}`}
            className="w-full max-w-4xl border border-gray-200 rounded bg-gray-50"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Utility Service Entrance */}
            <g>
              <circle
                cx={DIAGRAM_CONSTANTS.CENTER_X}
                cy={DIAGRAM_CONSTANTS.SERVICE_Y}
                r="15"
                fill="white"
                stroke="#000"
                strokeWidth="2"
              />
              <text
                x={DIAGRAM_CONSTANTS.CENTER_X}
                y={DIAGRAM_CONSTANTS.SERVICE_Y + 5}
                textAnchor="middle"
                fontSize="12"
                fill="#000"
              >
                ⚡
              </text>
              <text
                x={DIAGRAM_CONSTANTS.CENTER_X}
                y={DIAGRAM_CONSTANTS.SERVICE_Y - 25}
                textAnchor="middle"
                fontSize="11"
                fill="#4B5563"
              >
                Utility Service
              </text>
              <text
                x={DIAGRAM_CONSTANTS.CENTER_X}
                y={DIAGRAM_CONSTANTS.SERVICE_Y - 12}
                textAnchor="middle"
                fontSize="10"
                fill="#6B7280"
              >
                {project.serviceVoltage}V, {project.servicePhase}Φ
              </text>
            </g>

            {/* Service Entrance to Meter */}
            <line
              x1={DIAGRAM_CONSTANTS.CENTER_X}
              y1={DIAGRAM_CONSTANTS.SERVICE_Y + 15}
              x2={DIAGRAM_CONSTANTS.CENTER_X}
              y2={DIAGRAM_CONSTANTS.METER_Y}
              stroke="#000"
              strokeWidth="2"
            />

            {/* Meter */}
            <g>
              <rect
                x={DIAGRAM_CONSTANTS.CENTER_X - 35}
                y={DIAGRAM_CONSTANTS.METER_Y}
                width="70"
                height="30"
                fill="white"
                stroke="#000"
                strokeWidth="2"
                rx="4"
              />
              <text
                x={DIAGRAM_CONSTANTS.CENTER_X}
                y={DIAGRAM_CONSTANTS.METER_Y + 19}
                textAnchor="middle"
                fontSize="11"
                fill="#000"
              >
                Meter
              </text>
            </g>

            {/* Meter to MDP */}
            <line
              x1={DIAGRAM_CONSTANTS.CENTER_X}
              y1={DIAGRAM_CONSTANTS.METER_Y + 30}
              x2={DIAGRAM_CONSTANTS.CENTER_X}
              y2={DIAGRAM_CONSTANTS.MDP_Y}
              stroke="#DC2626"
              strokeWidth="3"
            />

            {/* MDP (Main Distribution Panel) */}
            {mdp && renderPanel(DIAGRAM_CONSTANTS.CENTER_X, DIAGRAM_CONSTANTS.MDP_Y, mdp.name, true)}

            {/* Bus Bar for Level 1 elements */}
            {level1Elements && (level1Elements.panels.length + level1Elements.transformers.length > 0) && (() => {
              const allLevel1 = [
                ...level1Elements.panels.map((p, i) => ({
                  x: DIAGRAM_CONSTANTS.CENTER_X + (i - level1Elements.panels.length / 2) * DIAGRAM_CONSTANTS.HORIZONTAL_SPACING,
                  y: DIAGRAM_CONSTANTS.LEVEL_1_Y,
                  name: p.name
                })),
                ...level1Elements.transformers.map((t, i) => ({
                  x: DIAGRAM_CONSTANTS.CENTER_X + ((level1Elements.panels.length + i) - (level1Elements.panels.length + level1Elements.transformers.length) / 2) * DIAGRAM_CONSTANTS.HORIZONTAL_SPACING,
                  y: DIAGRAM_CONSTANTS.LEVEL_1_Y,
                  name: t.name
                }))
              ];
              return renderBusBar(DIAGRAM_CONSTANTS.CENTER_X, DIAGRAM_CONSTANTS.BUS_BAR_Y, allLevel1, '#DC2626');
            })()}

            {/* Level 1 Panels */}
            {level1Elements.panels.map((panel, idx) => {
              const x = DIAGRAM_CONSTANTS.CENTER_X + (idx - level1Elements.panels.length / 2) * DIAGRAM_CONSTANTS.HORIZONTAL_SPACING;
              return renderPanel(x, DIAGRAM_CONSTANTS.LEVEL_1_Y, panel.name);
            })}

            {/* Level 1 Transformers */}
            {level1Elements.transformers.map((xfmr, idx) => {
              const x = DIAGRAM_CONSTANTS.CENTER_X + ((level1Elements.panels.length + idx) - (level1Elements.panels.length + level1Elements.transformers.length) / 2) * DIAGRAM_CONSTANTS.HORIZONTAL_SPACING;
              return renderTransformer(x, DIAGRAM_CONSTANTS.LEVEL_1_Y, xfmr.name);
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-red-600 rounded"></div>
            <span className="text-gray-600">Main Distribution Panel</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 rounded"></div>
            <span className="text-gray-600">Sub-Panel</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[12px] border-b-orange-500"></div>
            <span className="text-gray-600">Transformer</span>
          </div>
        </div>
      </div>

      {/* System Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Summary</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Service</p>
            <p className="font-medium">{project.serviceVoltage}V, {project.servicePhase}Φ</p>
          </div>
          <div>
            <p className="text-gray-600">Panels</p>
            <p className="font-medium">{panels.length}</p>
          </div>
          <div>
            <p className="text-gray-600">Transformers</p>
            <p className="font-medium">{transformers.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
