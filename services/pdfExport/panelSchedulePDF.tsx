/**
 * Panel Schedule PDF Export Service
 * Generates professional panel schedules in industry-standard format
 * Uses @react-pdf/renderer for PDF generation
 */

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import type { Panel, Circuit } from '../../lib/database.types';
import { PanelScheduleDocument, MultiPanelDocument } from './PanelScheduleDocuments';

/**
 * Generate and download a single panel schedule PDF
 */
export const exportPanelSchedulePDF = async (
  panel: Panel,
  circuits: Circuit[],
  projectName: string,
  projectAddress?: string
) => {
  try {
    // Validate panel data
    if (!panel || !panel.name || !panel.voltage || !panel.phase || !panel.bus_rating) {
      throw new Error('Invalid panel data. Missing required fields.');
    }

    console.log('Generating PDF for panel:', panel.name);

    const blob = await pdf(
      <PanelScheduleDocument
        panel={panel}
        circuits={circuits}
        projectName={projectName}
        projectAddress={projectAddress}
      />
    ).toBlob();

    console.log('PDF blob generated, size:', blob.size);

    if (!blob || blob.size === 0) {
      throw new Error('Failed to generate PDF blob');
    }

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `${panel.name.replace(/[^a-z0-9]/gi, '_')}_Schedule_${new Date().toISOString().split('T')[0]}.pdf`;
    link.download = fileName;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 100);

    console.log('PDF download triggered:', fileName);
  } catch (error) {
    console.error('Error in exportPanelSchedulePDF:', error);
    throw error;
  }
};

/**
 * Generate multi-panel PDF with page breaks
 */
export const exportAllPanelsPDF = async (
  panels: Panel[],
  circuitsByPanel: Map<string, Circuit[]>,
  projectName: string,
  projectAddress?: string
) => {
  try {
    // Validate panels data
    if (!panels || panels.length === 0) {
      throw new Error('No panels to export');
    }

    console.log(`Generating PDF for ${panels.length} panels`);

    const blob = await pdf(
      <MultiPanelDocument
        panels={panels}
        circuitsByPanel={circuitsByPanel}
        projectName={projectName}
        projectAddress={projectAddress}
      />
    ).toBlob();

    console.log('Multi-panel PDF blob generated, size:', blob.size);

    if (!blob || blob.size === 0) {
      throw new Error('Failed to generate PDF blob');
    }

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `All_Panels_${projectName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    link.download = fileName;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 100);

    console.log('Multi-panel PDF download triggered:', fileName);
  } catch (error) {
    console.error('Error in exportAllPanelsPDF:', error);
    throw error;
  }
};
