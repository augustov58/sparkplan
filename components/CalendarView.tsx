import React, { useState } from 'react';
import { Project, CalendarEvent, CalendarEventType } from '../types';
import {
  Calendar,
  Plus,
  Trash2,
  X,
  CheckCircle,
  Clock,
  MapPin,
  FileText,
  Users,
  AlertCircle
} from 'lucide-react';
import { useCalendarEvents } from '../hooks/useCalendarEvents';

interface CalendarViewProps {
  project?: Project; // Optional - if not provided, shows all projects
}

export const CalendarView: React.FC<CalendarViewProps> = ({ project }) => {
  const {
    events,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    markCompleted,
    markUncompleted
  } = useCalendarEvents(project?.id);

  const [isCreating, setIsCreating] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'Deadline' as CalendarEventType,
    event_date: '',
    location: ''
  });

  const handleCreate = async () => {
    if (!newEvent.title || !newEvent.event_date || !project) return;

    const result = await createEvent({
      project_id: project.id,
      title: newEvent.title,
      description: newEvent.description || undefined,
      event_type: newEvent.event_type,
      event_date: new Date(newEvent.event_date).toISOString(),
      location: newEvent.location || undefined,
      completed: false
    });

    if (result) {
      setNewEvent({
        title: '',
        description: '',
        event_type: 'Deadline',
        event_date: '',
        location: ''
      });
      setIsCreating(false);
    }
  };

  const getEventIcon = (type: CalendarEventType) => {
    switch (type) {
      case 'Inspection':
        return <CheckCircle className="w-4 h-4" />;
      case 'Meeting':
        return <Users className="w-4 h-4" />;
      case 'Milestone':
        return <AlertCircle className="w-4 h-4" />;
      case 'Site Visit':
        return <MapPin className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getEventColor = (type: CalendarEventType) => {
    switch (type) {
      case 'Inspection':
        return 'text-blue-600 bg-blue-50';
      case 'Meeting':
        return 'text-purple-600 bg-purple-50';
      case 'Milestone':
        return 'text-green-600 bg-green-50';
      case 'Site Visit':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) >= new Date();
  };

  // Separate upcoming and past events
  const upcomingEvents = events.filter(e => !e.completed && isUpcoming(e.event_date));
  const pastEvents = events.filter(e => e.completed || !isUpcoming(e.event_date));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3 animate-pulse" />
          <p className="text-gray-500">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-electric-500" />
            {project ? `${project.name} - Calendar` : 'All Projects Calendar'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {project
              ? 'Track deadlines, inspections, and important dates for this project'
              : 'View all calendar events across all your projects'
            }
          </p>
        </div>
        {project && (
          <button
            onClick={() => setIsCreating(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Create Event Form */}
      {isCreating && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">New Calendar Event</h3>
            <button
              onClick={() => setIsCreating(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  placeholder="Event title..."
                  className="input-std w-full"
                  value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                <select
                  className="input-std w-full"
                  value={newEvent.event_type}
                  onChange={e => setNewEvent({ ...newEvent, event_type: e.target.value as CalendarEventType })}
                >
                  <option value="Deadline">Deadline</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Milestone">Milestone</option>
                  <option value="Site Visit">Site Visit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  className="input-std w-full"
                  value={newEvent.event_date}
                  onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Location (Optional)</label>
                <input
                  type="text"
                  placeholder="Meeting room, job site, etc..."
                  className="input-std w-full"
                  value={newEvent.location}
                  onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Event details..."
                  className="input-std w-full min-h-[80px]"
                  value={newEvent.description}
                  onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setIsCreating(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="btn-primary"
                disabled={!newEvent.title || !newEvent.event_date}
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Upcoming Events</h3>
          <div className="space-y-3">
            {upcomingEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                showProject={!project}
                onDelete={() => deleteEvent(event.id)}
                onToggleComplete={() => event.completed ? markUncompleted(event.id) : markCompleted(event.id)}
                getEventIcon={getEventIcon}
                getEventColor={getEventColor}
                formatEventDate={formatEventDate}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past/Completed Events */}
      {pastEvents.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Past Events</h3>
          <div className="space-y-3 opacity-60">
            {pastEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                showProject={!project}
                onDelete={() => deleteEvent(event.id)}
                onToggleComplete={() => event.completed ? markUncompleted(event.id) : markCompleted(event.id)}
                getEventIcon={getEventIcon}
                getEventColor={getEventColor}
                formatEventDate={formatEventDate}
              />
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && !isCreating && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No events scheduled</h3>
          <p className="text-gray-500 mb-4">
            {project
              ? 'Add your first event to start tracking deadlines and meetings'
              : 'No events found across your projects'
            }
          </p>
          {project && (
            <button
              onClick={() => setIsCreating(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Event Card Component
interface EventCardProps {
  event: CalendarEvent & { projects?: { id: string; name: string } | null };
  showProject?: boolean;
  onDelete: () => void;
  onToggleComplete: () => void;
  getEventIcon: (type: CalendarEventType) => React.ReactNode;
  getEventColor: (type: CalendarEventType) => string;
  formatEventDate: (dateString: string) => string;
}

const EventCard: React.FC<EventCardProps> = ({
  event,
  showProject = false,
  onDelete,
  onToggleComplete,
  getEventIcon,
  getEventColor,
  formatEventDate
}) => {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${
      event.completed ? 'opacity-50' : ''
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`p-2 rounded ${getEventColor(event.event_type)}`}>
              {getEventIcon(event.event_type)}
            </span>
            <div>
              <h4 className={`font-medium text-gray-900 ${event.completed ? 'line-through' : ''}`}>
                {event.title}
              </h4>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">{event.event_type}</p>
                {showProject && event.projects && (
                  <>
                    <span className="text-xs text-gray-400">•</span>
                    <p className="text-xs font-medium text-electric-600">{event.projects.name}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1 text-sm text-gray-600 ml-10">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              {formatEventDate(event.event_date)}
            </div>
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3" />
                {event.location}
              </div>
            )}
            {event.description && (
              <div className="flex items-start gap-2 mt-2">
                <FileText className="w-3 h-3 mt-0.5" />
                <p className="text-xs">{event.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onToggleComplete}
            className={`p-2 rounded transition-colors ${
              event.completed
                ? 'text-gray-400 hover:text-gray-600'
                : 'text-green-600 hover:text-green-700 hover:bg-green-50'
            }`}
            title={event.completed ? 'Mark as incomplete' : 'Mark as complete'}
          >
            <CheckCircle className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
            title="Delete event"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
