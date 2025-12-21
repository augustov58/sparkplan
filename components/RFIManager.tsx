import React, { useState } from 'react';
import { Project, RFI } from '../types';
import {
  MessageSquare,
  Search,
  Filter,
  Plus,
  Trash2,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  FileText
} from 'lucide-react';
import { useRFIs } from '../hooks/useRFIs';
import { RFIPDFExtractor } from './RFIPDFExtractor';

interface RFIManagerProps {
  project: Project;
}

export const RFIManager: React.FC<RFIManagerProps> = ({ project }) => {
  const {
    rfis,
    loading,
    error,
    createRFI,
    updateRFI,
    deleteRFI,
    answerRFI,
    closeRFI,
    generateRFINumber
  } = useRFIs(project.id);

  const [filter, setFilter] = useState<'All' | 'Pending' | 'Answered' | 'Closed'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [usePDFExtraction, setUsePDFExtraction] = useState(false);
  const [isAnswering, setIsAnswering] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [respondedBy, setRespondedBy] = useState('');

  const [newRFI, setNewRFI] = useState({
    rfi_number: '',
    subject: '',
    question: '',
    assigned_to: '',
    requested_by: '',
    due_date: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent'
  });

  const handleCreate = async () => {
    if (!newRFI.subject || !newRFI.question) return;

    // Use extracted RFI number if available, otherwise generate new one
    const rfiNumber = newRFI.rfi_number || await generateRFINumber();

    const result = await createRFI({
      project_id: project.id,
      rfi_number: rfiNumber,
      subject: newRFI.subject,
      question: newRFI.question,
      assigned_to: newRFI.assigned_to || undefined,
      requested_by: newRFI.requested_by || undefined,
      due_date: newRFI.due_date || undefined,
      priority: newRFI.priority,
      status: 'Pending'
    });

    if (result) {
      setNewRFI({
        rfi_number: '',
        subject: '',
        question: '',
        assigned_to: '',
        requested_by: '',
        due_date: '',
        priority: 'Medium'
      });
      setIsCreating(false);
    }
  };

  const handleAnswer = async (rfiId: string) => {
    if (!answerText || !respondedBy) return;

    await answerRFI(rfiId, answerText, respondedBy);
    setIsAnswering(null);
    setAnswerText('');
    setRespondedBy('');
  };

  const filteredRFIs = rfis.filter(rfi => {
    const matchesFilter = filter === 'All' || rfi.status === filter;
    const matchesSearch =
      rfi.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rfi.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rfi.rfi_number.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-700';
      case 'High': return 'bg-orange-100 text-orange-700';
      case 'Medium': return 'bg-blue-50 text-blue-600';
      case 'Low': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'Answered': return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'Closed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-light text-gray-900">RFI Tracking</h2>
          <p className="text-gray-500 mt-1">Request for Information management and tracking.</p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 hover:bg-black transition-colors"
        >
          <Plus className="w-4 h-4" /> Create RFI
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium">Error: {error}</p>
        </div>
      )}

      {/* Create RFI Form */}
      {isCreating && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">New Request for Information</h3>

            {/* Toggle between manual and PDF extraction */}
            <div className="flex gap-2">
              <button
                onClick={() => setUsePDFExtraction(false)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  !usePDFExtraction
                    ? 'bg-electric-500 text-black'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                Manual Entry
              </button>
              <button
                onClick={() => setUsePDFExtraction(true)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                  usePDFExtraction
                    ? 'bg-electric-500 text-black'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                <FileText className="w-3 h-3" />
                Extract from PDF
              </button>
            </div>
          </div>

          {usePDFExtraction ? (
            <RFIPDFExtractor
              onDataExtracted={(data) => {
                setNewRFI({
                  ...newRFI,
                  rfi_number: data.rfi_number || '',
                  subject: data.subject,
                  question: data.question,
                  priority: data.priority,
                  assigned_to: data.assigned_to || '',
                  requested_by: data.requested_by || '',
                  due_date: data.due_date || ''
                });
                setUsePDFExtraction(false);
              }}
              onCancel={() => setUsePDFExtraction(false)}
            />
          ) : (
            <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RFI Number
                  {!newRFI.rfi_number && (
                    <span className="text-xs text-gray-500 ml-2">(Auto-generated if left empty)</span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="Auto-generated (or enter from PDF)..."
                  className="input-std w-full"
                  value={newRFI.rfi_number}
                  onChange={e => setNewRFI({ ...newRFI, rfi_number: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="Brief subject of the RFI..."
                  className="input-std w-full"
                  value={newRFI.subject}
                  onChange={e => setNewRFI({ ...newRFI, subject: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                <textarea
                  placeholder="Detailed question or information request..."
                  className="input-std w-full min-h-[100px]"
                  value={newRFI.question}
                  onChange={e => setNewRFI({ ...newRFI, question: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <input
                  type="text"
                  placeholder="Name or role..."
                  className="input-std w-full"
                  value={newRFI.assigned_to}
                  onChange={e => setNewRFI({ ...newRFI, assigned_to: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requested By</label>
                <input
                  type="text"
                  placeholder="Your name..."
                  className="input-std w-full"
                  value={newRFI.requested_by}
                  onChange={e => setNewRFI({ ...newRFI, requested_by: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  className="input-std w-full"
                  value={newRFI.priority}
                  onChange={e => setNewRFI({ ...newRFI, priority: e.target.value as any })}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  className="input-std w-full"
                  value={newRFI.due_date}
                  onChange={e => setNewRFI({ ...newRFI, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="bg-electric-500 text-black px-6 py-2 rounded text-sm font-bold hover:bg-electric-400 transition-colors"
              >
                Create RFI
              </button>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex gap-4 items-center bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            placeholder="Search RFIs by subject, number, or question..."
            className="w-full pl-10 pr-4 py-2 text-sm border-none focus:ring-0"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-1 pr-2">
          {(['All', 'Pending', 'Answered', 'Closed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                filter === f ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* RFI List */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-12 text-gray-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 animate-pulse" />
            <p>Loading RFIs...</p>
          </div>
        )}

        {!loading && filteredRFIs.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No RFIs found matching your criteria.</p>
            {filter === 'All' && searchTerm === '' && (
              <p className="text-sm mt-1">Create your first RFI to get started.</p>
            )}
          </div>
        )}

        {!loading && filteredRFIs.map(rfi => (
          <div
            key={rfi.id}
            className={`bg-white border rounded-lg p-4 transition-all hover:shadow-md ${
              rfi.status === 'Closed'
                ? 'border-gray-100 opacity-60'
                : rfi.status === 'Pending'
                ? 'border-l-4 border-l-yellow-500 border-y-gray-100 border-r-gray-100'
                : 'border-l-4 border-l-blue-500 border-y-gray-100 border-r-gray-100'
            }`}
          >
            {/* RFI Header */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(rfi.status)}
                <span className="font-mono font-bold text-sm text-gray-900">{rfi.rfi_number}</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getPriorityColor(rfi.priority)}`}>
                  {rfi.priority}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  rfi.status === 'Pending' ? 'bg-yellow-50 text-yellow-700' :
                  rfi.status === 'Answered' ? 'bg-blue-50 text-blue-700' :
                  'bg-green-50 text-green-700'
                }`}>
                  {rfi.status}
                </span>
              </div>

              <button
                onClick={() => deleteRFI(rfi.id)}
                className="text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Subject */}
            <h3 className="font-medium text-gray-900 mb-2">{rfi.subject}</h3>

            {/* Question */}
            <div className="bg-gray-50 rounded p-3 mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">QUESTION:</p>
              <p className="text-sm text-gray-700">{rfi.question}</p>
            </div>

            {/* Answer (if exists) */}
            {rfi.answer && (
              <div className="bg-blue-50 rounded p-3 mb-3">
                <p className="text-xs font-medium text-blue-600 mb-1">ANSWER:</p>
                <p className="text-sm text-gray-700">{rfi.answer}</p>
                {rfi.responded_by && (
                  <p className="text-xs text-gray-500 mt-2">Responded by: {rfi.responded_by}</p>
                )}
                {rfi.response_date && (
                  <p className="text-xs text-gray-500">
                    Date: {new Date(rfi.response_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
              {rfi.assigned_to && (
                <span>Assigned to: <span className="font-medium text-gray-700">{rfi.assigned_to}</span></span>
              )}
              {rfi.requested_by && (
                <span>Requested by: <span className="font-medium text-gray-700">{rfi.requested_by}</span></span>
              )}
              {rfi.due_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Due: <span className="font-medium text-gray-700">{new Date(rfi.due_date).toLocaleDateString()}</span>
                </span>
              )}
            </div>

            {/* Answer Modal Trigger */}
            {isAnswering === rfi.id && (
              <div className="bg-white border-t border-gray-200 -mx-4 -mb-4 mt-3 p-4 rounded-b-lg animate-in slide-in-from-top-2">
                <h4 className="font-medium text-gray-900 mb-3">Provide Answer</h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Answer</label>
                    <textarea
                      placeholder="Provide detailed answer..."
                      className="input-std w-full min-h-[80px]"
                      value={answerText}
                      onChange={e => setAnswerText(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Responded By</label>
                    <input
                      type="text"
                      placeholder="Your name..."
                      className="input-std w-full"
                      value={respondedBy}
                      onChange={e => setRespondedBy(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setIsAnswering(null);
                        setAnswerText('');
                        setRespondedBy('');
                      }}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAnswer(rfi.id)}
                      className="bg-blue-500 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                      Submit Answer
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!isAnswering && (
              <div className="flex gap-2">
                {rfi.status === 'Pending' && (
                  <button
                    onClick={() => setIsAnswering(rfi.id)}
                    className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Answer
                  </button>
                )}
                {rfi.status === 'Answered' && (
                  <button
                    onClick={() => closeRFI(rfi.id)}
                    className="text-xs px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                  >
                    Close RFI
                  </button>
                )}
                {rfi.status !== 'Closed' && (
                  <button
                    onClick={() => setIsAnswering(rfi.id)}
                    className="text-xs px-3 py-1.5 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {rfi.status === 'Answered' ? 'Edit Answer' : 'Add Note'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
