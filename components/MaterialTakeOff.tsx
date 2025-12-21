/**
 * Material Take-Off Component
 * Generates bill of materials from project design
 * Helps contractors estimate material costs and quantities
 */

import React, { useState, useMemo } from 'react';
import { Download, Package, FileText, DollarSign, CheckCircle } from 'lucide-react';
import { Project } from '../types';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';

interface MaterialItem {
  category: string;
  description: string;
  quantity: number;
  unit: string;
  size?: string;
  notes?: string;
}

interface MaterialTakeOffProps {
  project: Project;
}

export const MaterialTakeOff: React.FC<MaterialTakeOffProps> = ({ project }) => {
  const { panels } = usePanels(project.id);
  const { circuits } = useCircuits(project.id);

  const [includeConduit, setIncludeConduit] = useState(true);
  const [includeBoxes, setIncludeBoxes] = useState(true);
  const [includeFittings, setIncludeFittings] = useState(true);

  /**
   * Calculate material quantities from project data
   */
  const materials = useMemo(() => {
    const items: MaterialItem[] = [];

    // Panels and breakers
    panels.forEach((panel) => {
      items.push({
        category: 'Panels',
        description: `${panel.phase}-Phase Panel`,
        quantity: 1,
        unit: 'ea',
        size: `${panel.bus_rating}A`,
        notes: `${panel.name} - ${panel.voltage}V`
      });

      if (panel.main_breaker_amps) {
        items.push({
          category: 'Breakers',
          description: `${panel.phase}-Pole Main Breaker`,
          quantity: 1,
          unit: 'ea',
          size: `${panel.main_breaker_amps}A`,
          notes: `For ${panel.name}`
        });
      }
    });

    // Branch circuit breakers
    const breakerCounts: Record<string, number> = {};
    circuits.forEach((circuit) => {
      const key = `${circuit.breaker_amps}A-${circuit.pole}P`;
      breakerCounts[key] = (breakerCounts[key] || 0) + 1;
    });

    Object.entries(breakerCounts).forEach(([key, count]) => {
      const [amps, pole] = key.split('-');
      items.push({
        category: 'Breakers',
        description: `Branch Circuit Breaker`,
        quantity: count,
        unit: 'ea',
        size: key,
        notes: `${pole} pole`
      });
    });

    // Wire/Cable - aggregate by conductor size
    const wireCounts: Record<string, number> = {};
    circuits.forEach((circuit) => {
      if (circuit.conductor_size) {
        wireCounts[circuit.conductor_size] = (wireCounts[circuit.conductor_size] || 0) + 1;
      }
    });

    Object.entries(wireCounts).forEach(([size, count]) => {
      // Estimate 50 feet average per circuit
      const totalFeet = count * 50;
      items.push({
        category: 'Wire & Cable',
        description: 'THHN/THWN Copper Wire',
        quantity: Math.ceil(totalFeet / 100) * 100, // Round up to nearest 100'
        unit: 'ft',
        size: size,
        notes: `${count} circuits @ ~50ft avg`
      });
    });

    // Equipment Grounding Conductors
    const egcCounts: Record<string, number> = {};
    circuits.forEach((circuit) => {
      if (circuit.egc_size) {
        egcCounts[circuit.egc_size] = (egcCounts[circuit.egc_size] || 0) + 1;
      }
    });

    Object.entries(egcCounts).forEach(([size, count]) => {
      const totalFeet = count * 50;
      items.push({
        category: 'Wire & Cable',
        description: 'Bare or Green Equipment Grounding Conductor',
        quantity: Math.ceil(totalFeet / 100) * 100,
        unit: 'ft',
        size: size,
        notes: `${count} circuits @ ~50ft avg`
      });
    });

    // Conduit (if enabled)
    if (includeConduit) {
      // Estimate: 1 circuit per 10 feet of conduit for general use
      const estimatedConduitFeet = circuits.length * 10;
      items.push({
        category: 'Conduit',
        description: 'EMT Conduit',
        quantity: Math.ceil(estimatedConduitFeet / 10), // 10' sticks
        unit: 'sticks',
        size: '3/4"',
        notes: `Estimated ${estimatedConduitFeet} ft total`
      });

      items.push({
        category: 'Conduit',
        description: 'EMT Conduit',
        quantity: Math.ceil(estimatedConduitFeet * 0.3 / 10), // 30% use 1" conduit
        unit: 'sticks',
        size: '1"',
        notes: 'For larger wire sizes'
      });
    }

    // Boxes and fittings (if enabled)
    if (includeBoxes) {
      items.push({
        category: 'Boxes & Fittings',
        description: 'Single-Gang Outlet Box',
        quantity: Math.floor(circuits.length * 0.6), // 60% of circuits
        unit: 'ea',
        notes: 'Receptacle and switch boxes'
      });

      items.push({
        category: 'Boxes & Fittings',
        description: 'Junction Box (4" Square)',
        quantity: Math.floor(circuits.length * 0.2), // 20% of circuits
        unit: 'ea',
        notes: 'Splices and transitions'
      });
    }

    if (includeFittings) {
      items.push({
        category: 'Boxes & Fittings',
        description: 'EMT Set Screw Couplings',
        quantity: circuits.length * 2,
        unit: 'ea',
        size: 'Assorted',
        notes: '~2 per circuit'
      });

      items.push({
        category: 'Boxes & Fittings',
        description: 'EMT Set Screw Connectors',
        quantity: circuits.length * 2,
        unit: 'ea',
        size: 'Assorted',
        notes: '~2 per circuit'
      });

      items.push({
        category: 'Boxes & Fittings',
        description: 'Wire Nuts (Assorted)',
        quantity: Math.ceil(circuits.length / 10), // Boxes of 100
        unit: 'box',
        notes: '100 per box'
      });
    }

    // Grounding materials
    items.push({
      category: 'Grounding',
      description: 'Ground Rod (8ft)',
      quantity: 2,
      unit: 'ea',
      size: '5/8" x 8ft',
      notes: 'NEC 250.53(A)(2) - minimum 2 rods'
    });

    items.push({
      category: 'Grounding',
      description: 'Ground Rod Clamp',
      quantity: 2,
      unit: 'ea',
      notes: 'Acorn-style clamps'
    });

    // Sort by category
    return items.sort((a, b) => a.category.localeCompare(b.category));
  }, [panels, circuits, includeConduit, includeBoxes, includeFittings]);

  /**
   * Group materials by category
   */
  const groupedMaterials = useMemo(() => {
    const groups: Record<string, MaterialItem[]> = {};
    materials.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category]!.push(item);
    });
    return groups;
  }, [materials]);

  /**
   * Export to CSV
   */
  const exportToCSV = () => {
    const headers = ['Category', 'Description', 'Size', 'Quantity', 'Unit', 'Notes'];
    const rows = materials.map((item) => [
      item.category,
      item.description,
      item.size || '',
      item.quantity.toString(),
      item.unit,
      item.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${project.name.replace(/[^a-z0-9]/gi, '_')}_Material_TakeOff_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Print the material list
   */
  const printList = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Material Take-Off - ${project.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .category { margin-top: 30px; }
            .category-title { background: #f0f0f0; padding: 8px; font-weight: bold; border-bottom: 2px solid #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f9f9f9; font-weight: bold; }
            .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 10px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Material Take-Off</h1>
            <p><strong>Project:</strong> ${project.name}</p>
            <p><strong>Address:</strong> ${project.address}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Total Panels:</strong> ${panels.length} | <strong>Total Circuits:</strong> ${circuits.length}</p>
          </div>
          ${Object.entries(groupedMaterials).map(([category, items]) => `
            <div class="category">
              <div class="category-title">${category}</div>
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Size</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(item => `
                    <tr>
                      <td>${item.description}</td>
                      <td>${item.size || '-'}</td>
                      <td>${item.quantity}</td>
                      <td>${item.unit}</td>
                      <td>${item.notes || ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}
          <div class="footer">
            <p><strong>Note:</strong> Quantities are estimates based on typical installation practices. Actual quantities may vary depending on site conditions, routing, and installation methods. Add 10-15% waste factor for all materials.</p>
            <p>Generated by NEC Pro Compliance - ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Material Take-Off List</h2>
          <p className="text-sm text-gray-500 mt-1">
            Estimated material quantities for {project.name}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            <strong>Note:</strong> Quantities are estimates. Add 10-15% waste factor. Verify quantities before ordering.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium hover:bg-gray-50 text-gray-700"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={printList}
            className="flex items-center gap-2 px-4 py-2 bg-electric-400 text-black rounded-md text-sm font-medium hover:bg-electric-500"
          >
            <FileText className="w-4 h-4" />
            Print List
          </button>
        </div>
      </div>

      {/* Options */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-blue-600" />
          Include in Take-Off
        </h3>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeConduit}
              onChange={(e) => setIncludeConduit(e.target.checked)}
              className="rounded"
            />
            <span>Conduit & Raceways</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeBoxes}
              onChange={(e) => setIncludeBoxes(e.target.checked)}
              className="rounded"
            />
            <span>Boxes & Enclosures</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeFittings}
              onChange={(e) => setIncludeFittings(e.target.checked)}
              className="rounded"
            />
            <span>Fittings & Accessories</span>
          </label>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{materials.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">Categories</p>
              <p className="text-2xl font-bold text-gray-900">{Object.keys(groupedMaterials).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">Ready for</p>
              <p className="text-lg font-bold text-gray-900">Pricing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Materials Table */}
      {Object.entries(groupedMaterials).map(([category, items]) => (
        <div key={category} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="bg-gray-900 text-white px-4 py-3">
            <h3 className="font-semibold">{category}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
                <tr>
                  <th className="p-3 text-left">Description</th>
                  <th className="p-3 text-center">Size</th>
                  <th className="p-3 text-center">Quantity</th>
                  <th className="p-3 text-center">Unit</th>
                  <th className="p-3 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3">{item.description}</td>
                    <td className="p-3 text-center font-mono">{item.size || '-'}</td>
                    <td className="p-3 text-center font-semibold">{item.quantity}</td>
                    <td className="p-3 text-center">{item.unit}</td>
                    <td className="p-3 text-gray-600 text-xs">{item.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Empty State */}
      {materials.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">No materials to display</p>
          <p className="text-sm text-gray-400">Add panels and circuits to generate a material take-off list</p>
        </div>
      )}
    </div>
  );
};
