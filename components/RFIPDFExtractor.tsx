import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, FileText, Loader, AlertCircle, CheckCircle } from 'lucide-react';

interface ExtractedRFI {
  rfi_number?: string;
  subject: string;
  question: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  assigned_to?: string;
  requested_by?: string;
  due_date?: string;
}

interface RFIPDFExtractorProps {
  onDataExtracted: (data: ExtractedRFI) => void;
  onCancel: () => void;
}

export const RFIPDFExtractor: React.FC<RFIPDFExtractorProps> = ({ onDataExtracted, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!extracting) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (extracting) return;

    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;

    if (droppedFile.type !== 'application/pdf') {
      setError('Please drop a PDF file');
      return;
    }

    if (droppedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setFile(droppedFile);
    setError(null);
  };

  const extractRFIFromPDF = async (pdfFile: File) => {
    setExtracting(true);
    setError(null);
    setProgress('Reading PDF...');

    try {
      // Convert PDF to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          // Remove data:application/pdf;base64, prefix
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });

      reader.readAsDataURL(pdfFile);
      const base64Data = await base64Promise;

      setProgress('Analyzing with AI...');

      // Call Gemini via our proxy to extract RFI information
      const { data, error: functionError } = await supabase.functions.invoke('gemini-proxy', {
        body: {
          prompt: `You are an expert at extracting RFI (Request for Information) data from construction and electrical project documents.

IMPORTANT: Carefully analyze the attached PDF document. RFI documents typically contain:
- An RFI number (e.g., "RFI-001", "RFI #58", "N0125_RFI-058")
- A subject/title line describing the issue
- A detailed question or request for clarification
- Names of people involved (submitter, recipient, contractor, engineer)
- Dates (submission date, required response date, due date)
- Priority indicators (may be explicit or implied by language like "urgent", "critical", "ASAP")

Extract the following information from the attached PDF document:

1. **RFI Number**: The RFI identifier. Look for:
   - Labels: "RFI #", "RFI Number:", "RFI-", "RFI_"
   - Format examples: "RFI #58", "RFI-058", "N0125_RFI 58"
   - May be in the header, title, or first line
   - Extract just the number/identifier (e.g., "58" or "RFI-058")
   - If not found, use null

2. **Subject**: The main title or topic of the RFI. Look for:
   - The RFI title/header (often after "RFI #XX:")
   - Labeled sections like "Subject:", "Title:", "RE:", "Regarding:"
   - The first prominent heading after the RFI number
   - Should be a brief phrase (5-15 words)
   - Example: "New chain-link fence around ODUs"

2. **Question**: The detailed question or information request. Look for:
   - Sections labeled "Question:", "Request:", "Description:", "Issue:", "Activity"
   - The main body text explaining what information is needed
   - Should capture the complete request, including context and specific details needed
   - Include technical details, locations, reference drawings if mentioned

3. **Priority**: Determine urgency level. Look for:
   - Explicit labels: "Priority:", "Urgency:", "Level:"
   - Keywords indicating urgency: "critical", "urgent", "ASAP", "immediate", "high priority"
   - Keywords indicating low priority: "when available", "at your convenience", "routine"
   - Default to "Medium" if unclear

4. **Assigned To**: Person or role who should respond. Look for:
   - Labels: "To:", "Assigned To:", "Recipient:", "Attention:", "ATTN:"
   - Format: "Name (Company)" like "Brian Muni (GRAEF-USA)"
   - Roles: "Architect", "Engineer", "Project Manager", "General Contractor"
   - Names with company/organization in parentheses

5. **Requested By**: Person or company submitting the RFI. Look for:
   - Labels: "From:", "Submitted By:", "Requestor:", "Contractor:"
   - Format: "Name (Company)" like "Samuel Garrido (BISHOP CONSTRUCTION GROUP, INC)"
   - Look for "Question from [Name] [Company]" patterns
   - Signatures at the bottom
   - Company names in headers

6. **Due Date**: When response is needed. Look for:
   - Labels: "Due Date:", "Response Required By:", "Target Date:", "Deadline:"
   - Date formats: "Jan 24, 2025", "01/24/2025", "2025-01-24"
   - Convert ALL dates to YYYY-MM-DD format (e.g., "2025-01-24")
   - If only submission date is present, set due_date to null

Return ONLY a valid JSON object (no markdown, no code blocks, no explanation):
{
  "rfi_number": "string or null",
  "subject": "string",
  "question": "string (complete detailed question)",
  "priority": "Low" | "Medium" | "High" | "Urgent",
  "assigned_to": "string or null",
  "requested_by": "string or null",
  "due_date": "YYYY-MM-DD or null"
}

VALIDATION RULES:
- rfi_number should be extracted if present, null if not found
- subject MUST be present and < 100 characters
- question MUST be present and > 10 characters
- priority MUST be one of: Low, Medium, High, Urgent
- due_date MUST be in YYYY-MM-DD format or null
- If you cannot find a field, use null (not empty string)

Analyze the attached PDF document now.`,
          pdfData: base64Data, // Send PDF separately
          model: 'gemini-2.0-flash-exp'
        }
      });

      if (functionError) throw functionError;

      setProgress('Parsing extracted data...');

      // Parse the response
      let extractedData: ExtractedRFI;
      try {
        // Gemini might return markdown code blocks, so extract JSON
        const responseText = data.response;

        // Try to extract JSON from markdown code blocks or raw response
        let jsonText = responseText;

        // Remove markdown code blocks if present
        const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1];
        } else {
          // Try to find raw JSON object
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
        }

        if (!jsonText || jsonText.trim() === '') {
          throw new Error('No JSON found in AI response');
        }

        extractedData = JSON.parse(jsonText);

        // Validate required fields
        if (!extractedData.subject || extractedData.subject.trim() === '') {
          throw new Error('Missing required field: subject');
        }

        if (!extractedData.question || extractedData.question.trim() === '') {
          throw new Error('Missing required field: question');
        }

        // Validate subject length
        if (extractedData.subject.length > 100) {
          extractedData.subject = extractedData.subject.substring(0, 97) + '...';
        }

        // Validate question length
        if (extractedData.question.length < 10) {
          throw new Error('Question is too short. AI may not have extracted correctly.');
        }

        // Ensure priority is valid
        const validPriorities: Array<'Low' | 'Medium' | 'High' | 'Urgent'> = ['Low', 'Medium', 'High', 'Urgent'];
        if (!validPriorities.includes(extractedData.priority)) {
          console.warn(`Invalid priority "${extractedData.priority}", defaulting to Medium`);
          extractedData.priority = 'Medium';
        }

        // Validate date format if present
        if (extractedData.due_date) {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(extractedData.due_date)) {
            console.warn(`Invalid date format "${extractedData.due_date}", clearing due_date`);
            extractedData.due_date = undefined;
          }
        }

        // Clean up null strings (convert "null" to undefined)
        if (extractedData.rfi_number === 'null' || extractedData.rfi_number === '') {
          extractedData.rfi_number = undefined;
        }
        if (extractedData.assigned_to === 'null' || extractedData.assigned_to === '') {
          extractedData.assigned_to = undefined;
        }
        if (extractedData.requested_by === 'null' || extractedData.requested_by === '') {
          extractedData.requested_by = undefined;
        }

      } catch (parseError: any) {
        console.error('Parse error:', parseError);
        console.error('Raw AI response:', data.response);
        throw new Error(`Failed to parse AI response: ${parseError.message}. The PDF format may not be compatible.`);
      }

      setProgress('Extraction complete!');
      setTimeout(() => {
        onDataExtracted(extractedData);
      }, 500);

    } catch (err: any) {
      console.error('RFI extraction error:', err);
      setError(err.message || 'Failed to extract RFI data from PDF');
      setExtracting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      setError('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleExtract = () => {
    if (!file) return;
    extractRFIFromPDF(file);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-electric-500" />
          <h3 className="font-medium text-gray-900">Extract RFI from PDF</h3>
        </div>
        <button
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          disabled={extracting}
        >
          Cancel
        </button>
      </div>

      <div className="space-y-4">
        {/* File Upload */}
        {!file ? (
          <label className="cursor-pointer">
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
                isDragging
                  ? 'border-electric-500 bg-electric-100'
                  : 'border-gray-300 hover:border-electric-400 hover:bg-electric-50'
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-12 h-12 text-gray-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">
                    Click to upload RFI PDF
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PDF format, max 10MB
                  </p>
                </div>
              </div>
            </div>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-electric-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              {!extracting && (
                <button
                  onClick={() => setFile(null)}
                  className="text-sm text-red-600 hover:text-red-700 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        )}

        {/* Progress/Status */}
        {extracting && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Loader className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900">Extracting RFI data...</p>
                <p className="text-xs text-blue-700 mt-1">{progress}</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Extraction failed</p>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {progress === 'Extraction complete!' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-sm font-medium text-green-900">
                RFI data extracted successfully!
              </p>
            </div>
          </div>
        )}

        {/* Extract Button */}
        {file && !extracting && progress !== 'Extraction complete!' && (
          <button
            onClick={handleExtract}
            className="w-full bg-electric-500 text-black px-6 py-3 rounded-lg text-sm font-bold hover:bg-electric-400 transition-colors flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Extract RFI Data with AI
          </button>
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <p>💡 Tip: Upload an RFI PDF and our AI will automatically extract the subject, question, priority, and other details to create the RFI record.</p>
      </div>
    </div>
  );
};
