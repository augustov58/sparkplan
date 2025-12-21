import React, { useState } from 'react';
import { Project, SiteVisit } from '../types';
import {
  MapPin,
  Search,
  Filter,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Users,
  CheckCircle,
  AlertTriangle,
  ClipboardList,
  Image as ImageIcon
} from 'lucide-react';
import { useSiteVisits } from '../hooks/useSiteVisits';
import { PhotoUploader } from './PhotoUploader';

interface SiteVisitManagerProps {
  project: Project;
}

export const SiteVisitManager: React.FC<SiteVisitManagerProps> = ({ project }) => {
  const {
    visits,
    loading,
    error,
    createVisit,
    updateVisit,
    deleteVisit,
    completeVisit
  } = useSiteVisits(project.id);

  const [filter, setFilter] = useState<'All' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [newVisit, setNewVisit] = useState({
    title: '',
    description: '',
    visit_date: new Date().toISOString().slice(0, 16), // datetime-local format
    visit_type: 'Site Inspection',
    weather_conditions: '',
    attendees: [] as string[],
    inspector_name: '',
    issues_found: [] as string[],
    action_items: [] as string[],
    next_visit_date: '',
    duration_hours: '',
    photos: [] as string[],
    status: 'Scheduled' as 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled'
  });

  const [attendeeInput, setAttendeeInput] = useState('');
  const [issueInput, setIssueInput] = useState('');
  const [actionInput, setActionInput] = useState('');

  const handleCreate = async () => {
    if (!newVisit.title || !newVisit.description) return;

    const result = await createVisit({
      project_id: project.id,
      title: newVisit.title,
      description: newVisit.description,
      visit_date: newVisit.visit_date,
      visit_type: newVisit.visit_type,
      weather_conditions: newVisit.weather_conditions || undefined,
      attendees: newVisit.attendees.length > 0 ? newVisit.attendees : undefined,
      inspector_name: newVisit.inspector_name || undefined,
      issues_found: newVisit.issues_found.length > 0 ? newVisit.issues_found : undefined,
      action_items: newVisit.action_items.length > 0 ? newVisit.action_items : undefined,
      next_visit_date: newVisit.next_visit_date || undefined,
      duration_hours: newVisit.duration_hours ? parseFloat(newVisit.duration_hours) : undefined,
      photos: newVisit.photos.length > 0 ? newVisit.photos : undefined,
      status: newVisit.status
    });

    if (result) {
      setNewVisit({
        title: '',
        description: '',
        visit_date: new Date().toISOString().slice(0, 16),
        visit_type: 'Site Inspection',
        weather_conditions: '',
        attendees: [],
        inspector_name: '',
        issues_found: [],
        action_items: [],
        next_visit_date: '',
        duration_hours: '',
        photos: [],
        status: 'Scheduled'
      });
      setIsCreating(false);
    }
  };

  const addAttendee = () => {
    if (attendeeInput.trim()) {
      setNewVisit({
        ...newVisit,
        attendees: [...newVisit.attendees, attendeeInput.trim()]
      });
      setAttendeeInput('');
    }
  };

  const removeAttendee = (index: number) => {
    setNewVisit({
      ...newVisit,
      attendees: newVisit.attendees.filter((_, i) => i !== index)
    });
  };

  const addIssue = () => {
    if (issueInput.trim()) {
      setNewVisit({
        ...newVisit,
        issues_found: [...newVisit.issues_found, issueInput.trim()]
      });
      setIssueInput('');
    }
  };

  const removeIssue = (index: number) => {
    setNewVisit({
      ...newVisit,
      issues_found: newVisit.issues_found.filter((_, i) => i !== index)
    });
  };

  const addAction = () => {
    if (actionInput.trim()) {
      setNewVisit({
        ...newVisit,
        action_items: [...newVisit.action_items, actionInput.trim()]
      });
      setActionInput('');
    }
  };

  const removeAction = (index: number) => {
    setNewVisit({
      ...newVisit,
      action_items: newVisit.action_items.filter((_, i) => i !== index)
    });
  };

  const filteredVisits = visits.filter(visit => {
    const matchesFilter = filter === 'All' || visit.status === filter;
    const matchesSearch =
      visit.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.visit_type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-50 text-blue-700';
      case 'In Progress': return 'bg-yellow-50 text-yellow-700';
      case 'Completed': return 'bg-green-50 text-green-700';
      case 'Cancelled': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Scheduled': return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'In Progress': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'Completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'Cancelled': return <AlertTriangle className="w-4 h-4 text-gray-500" />;
      default: return <MapPin className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-light text-gray-900">Site Visit Logging</h2>
          <p className="text-gray-500 mt-1">Track site visits, inspections, and field observations.</p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 hover:bg-black transition-colors"
        >
          <Plus className="w-4 h-4" /> Log Site Visit
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium">Error: {error}</p>
        </div>
      )}

      {/* Create Site Visit Form */}
      {isCreating && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 animate-in slide-in-from-top-2">
          <h3 className="font-medium text-gray-900 mb-4">New Site Visit</h3>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Visit Title</label>
                <input
                  type="text"
                  placeholder="Brief title of the visit..."
                  className="input-std w-full"
                  value={newVisit.title}
                  onChange={e => setNewVisit({ ...newVisit, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visit Type</label>
                <select
                  className="input-std w-full"
                  value={newVisit.visit_type}
                  onChange={e => setNewVisit({ ...newVisit, visit_type: e.target.value })}
                >
                  <option value="Site Inspection">Site Inspection</option>
                  <option value="Client Meeting">Client Meeting</option>
                  <option value="Progress Check">Progress Check</option>
                  <option value="Final Walkthrough">Final Walkthrough</option>
                  <option value="Code Inspection">Code Inspection</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  className="input-std w-full"
                  value={newVisit.status}
                  onChange={e => setNewVisit({ ...newVisit, status: e.target.value as any })}
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date & Time</label>
                <input
                  type="datetime-local"
                  className="input-std w-full"
                  value={newVisit.visit_date}
                  onChange={e => setNewVisit({ ...newVisit, visit_date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="e.g., 2.5"
                  className="input-std w-full"
                  value={newVisit.duration_hours}
                  onChange={e => setNewVisit({ ...newVisit, duration_hours: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inspector Name</label>
                <input
                  type="text"
                  placeholder="Inspector's name..."
                  className="input-std w-full"
                  value={newVisit.inspector_name}
                  onChange={e => setNewVisit({ ...newVisit, inspector_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weather Conditions</label>
                <input
                  type="text"
                  placeholder="e.g., Sunny, 72°F"
                  className="input-std w-full"
                  value={newVisit.weather_conditions}
                  onChange={e => setNewVisit({ ...newVisit, weather_conditions: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  placeholder="Detailed description of the visit..."
                  className="input-std w-full min-h-[100px]"
                  value={newVisit.description}
                  onChange={e => setNewVisit({ ...newVisit, description: e.target.value })}
                />
              </div>

              {/* Attendees */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Attendees</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Add attendee name..."
                    className="input-std flex-1"
                    value={attendeeInput}
                    onChange={e => setAttendeeInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addAttendee())}
                  />
                  <button
                    type="button"
                    onClick={addAttendee}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newVisit.attendees.map((attendee, i) => (
                    <span key={i} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                      {attendee}
                      <button onClick={() => removeAttendee(i)} className="text-blue-500 hover:text-blue-700">×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Issues Found */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Issues Found</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Add issue..."
                    className="input-std flex-1"
                    value={issueInput}
                    onChange={e => setIssueInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addIssue())}
                  />
                  <button
                    type="button"
                    onClick={addIssue}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-1">
                  {newVisit.issues_found.map((issue, i) => (
                    <div key={i} className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm flex items-center justify-between">
                      <span>{issue}</span>
                      <button onClick={() => removeIssue(i)} className="text-red-500 hover:text-red-700">×</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Items */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Action Items</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Add action item..."
                    className="input-std flex-1"
                    value={actionInput}
                    onChange={e => setActionInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addAction())}
                  />
                  <button
                    type="button"
                    onClick={addAction}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-1">
                  {newVisit.action_items.map((action, i) => (
                    <div key={i} className="bg-yellow-50 text-yellow-700 px-3 py-2 rounded text-sm flex items-center justify-between">
                      <span>{action}</span>
                      <button onClick={() => removeAction(i)} className="text-yellow-600 hover:text-yellow-800">×</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Photo Upload */}
              <div className="md:col-span-2">
                <PhotoUploader
                  projectId={project.id}
                  onPhotosUploaded={(urls) => setNewVisit({ ...newVisit, photos: urls })}
                  existingPhotos={newVisit.photos}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Visit Date (optional)</label>
                <input
                  type="date"
                  className="input-std w-full"
                  value={newVisit.next_visit_date}
                  onChange={e => setNewVisit({ ...newVisit, next_visit_date: e.target.value })}
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
                Save Visit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex gap-4 items-center bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            placeholder="Search site visits by title, type, or description..."
            className="w-full pl-10 pr-4 py-2 text-sm border-none focus:ring-0"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-1 pr-2">
          {(['All', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'] as const).map(f => (
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

      {/* Site Visits List */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-12 text-gray-400">
            <MapPin className="w-8 h-8 mx-auto mb-2 animate-pulse" />
            <p>Loading site visits...</p>
          </div>
        )}

        {!loading && filteredVisits.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No site visits found matching your criteria.</p>
            {filter === 'All' && searchTerm === '' && (
              <p className="text-sm mt-1">Log your first site visit to get started.</p>
            )}
          </div>
        )}

        {!loading && filteredVisits.map(visit => (
          <div
            key={visit.id}
            className={`bg-white border rounded-lg p-4 transition-all hover:shadow-md ${
              visit.status === 'Completed'
                ? 'border-gray-100 opacity-80'
                : visit.status === 'Scheduled'
                ? 'border-l-4 border-l-blue-500 border-y-gray-100 border-r-gray-100'
                : visit.status === 'In Progress'
                ? 'border-l-4 border-l-yellow-500 border-y-gray-100 border-r-gray-100'
                : 'border-gray-100'
            }`}
          >
            {/* Visit Header */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(visit.status)}
                <h3 className="font-medium text-gray-900">{visit.title}</h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${getStatusColor(visit.status)}`}>
                  {visit.status}
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {visit.visit_type}
                </span>
              </div>

              <button
                onClick={() => deleteVisit(visit.id)}
                className="text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Visit Metadata */}
            <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(visit.visit_date).toLocaleString()}
              </span>
              {visit.duration_hours && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {visit.duration_hours} hours
                </span>
              )}
              {visit.inspector_name && (
                <span className="flex items-center gap-1">
                  Inspector: <span className="font-medium text-gray-700">{visit.inspector_name}</span>
                </span>
              )}
              {visit.weather_conditions && (
                <span>Weather: {visit.weather_conditions}</span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-gray-700 mb-3">{visit.description}</p>

            {/* Photos */}
            {visit.photos && visit.photos.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> PHOTOS:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {visit.photos.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Site photo ${i + 1}`}
                      className="w-full h-24 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(url, '_blank')}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Attendees */}
            {visit.attendees && visit.attendees.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> ATTENDEES:
                </p>
                <div className="flex flex-wrap gap-2">
                  {visit.attendees.map((attendee, i) => (
                    <span key={i} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                      {attendee}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Issues Found */}
            {visit.issues_found && visit.issues_found.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-red-600 mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> ISSUES FOUND:
                </p>
                <ul className="space-y-1">
                  {visit.issues_found.map((issue, i) => (
                    <li key={i} className="bg-red-50 text-red-700 px-3 py-1 rounded text-xs">
                      • {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Items */}
            {visit.action_items && visit.action_items.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-yellow-600 mb-1 flex items-center gap-1">
                  <ClipboardList className="w-3 h-3" /> ACTION ITEMS:
                </p>
                <ul className="space-y-1">
                  {visit.action_items.map((action, i) => (
                    <li key={i} className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded text-xs">
                      • {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next Visit */}
            {visit.next_visit_date && (
              <div className="text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  Next visit scheduled: <span className="font-medium text-gray-700">
                    {new Date(visit.next_visit_date).toLocaleDateString()}
                  </span>
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              {visit.status !== 'Completed' && (
                <button
                  onClick={() => completeVisit(visit.id)}
                  className="text-xs px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                >
                  Mark Completed
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
