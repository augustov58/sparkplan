/**
 * Project Export/Import Component
 * UI for backing up and restoring projects as JSON
 */

import React, { useState, useRef } from 'react';
import { Download, Upload, FileJson, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { exportProjectToJSON, importProjectFromJSON } from '../services/projectExportImport';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/Button';
import { showToast } from '../lib/toast';

interface ProjectExportImportProps {
  /** Current project ID (for export) */
  projectId?: string;
  /** Current project name (for export) */
  projectName?: string;
  /** Callback after successful import */
  onImportSuccess?: (projectId: string, projectName: string) => void;
  /** Show only export (for project-specific export) */
  exportOnly?: boolean;
}

export const ProjectExportImport: React.FC<ProjectExportImportProps> = ({
  projectId,
  projectName,
  onImportSuccess,
  exportOnly = false
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!projectId || !projectName) {
      showToast.error('No project selected for export');
      return;
    }

    setIsExporting(true);
    try {
      await exportProjectToJSON(projectId, projectName);
      showToast.success(`Project "${projectName}" exported successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      showToast.error('Failed to export project');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.json')) {
      setImportError('Please select a JSON file');
      return;
    }

    if (!user) {
      setImportError('You must be logged in to import projects');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const { projectId: newProjectId, projectName: newProjectName } = await importProjectFromJSON(
        file,
        user.id
      );

      showToast.success(`Project "${newProjectName}" imported successfully!`);
      onImportSuccess?.(newProjectId, newProjectName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import project';
      setImportError(message);
      showToast.error(message);
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Export Section */}
      {projectId && projectName && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Download className="w-4 h-4 text-electric-500" />
                <h4 className="font-semibold text-sm text-gray-900">Export Project</h4>
              </div>
              <p className="text-xs text-gray-600">
                Download this project as JSON for backup or transfer. Includes panels, circuits, feeders, and all project data.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Export JSON'}
            </Button>
          </div>
        </div>
      )}

      {/* Import Section */}
      {!exportOnly && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Upload className="w-4 h-4 text-electric-500" />
                <h4 className="font-semibold text-sm text-gray-900">Import Project</h4>
              </div>
              <p className="text-xs text-gray-600">
                Restore a project from a previously exported JSON file. Creates a new project with "(Imported)" suffix.
              </p>

              {importError && (
                <div className="mt-2 bg-red-50 border border-red-200 rounded px-3 py-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{importError}</p>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              onClick={handleImportClick}
              disabled={isImporting}
            >
              {isImporting ? 'Importing...' : 'Import JSON'}
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="font-semibold mb-1">Backup Best Practices:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              <li>Export projects regularly to prevent data loss</li>
              <li>Store backup files in a secure location (cloud storage, external drive)</li>
              <li>Imported projects create new records (doesn't overwrite existing)</li>
              <li>Site visit photos are NOT included in exports (database links only)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Compact version for dropdown menus
 */
export const ProjectExportImportCompact: React.FC<ProjectExportImportProps> = ({
  projectId,
  projectName,
  onImportSuccess
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    if (!projectId || !projectName) return;
    setIsExporting(true);
    try {
      await exportProjectToJSON(projectId, projectName);
      showToast.success('Project exported');
    } catch (error) {
      showToast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    try {
      const { projectId: newProjectId, projectName: newProjectName } = await importProjectFromJSON(file, user.id);
      showToast.success(`"${newProjectName}" imported`);
      onImportSuccess?.(newProjectId, newProjectName);
    } catch (error) {
      showToast.error('Import failed');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex gap-2">
      {projectId && projectName && (
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export
        </button>
      )}

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
      >
        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        Import
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
