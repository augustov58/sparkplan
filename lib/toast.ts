/**
 * Toast notification utilities
 * Provides consistent toast messages across the app
 */

import toast from 'react-hot-toast';

export const showToast = {
  // Success messages
  success: (message: string) => toast.success(message),

  // Error messages
  error: (message: string) => toast.error(message),

  // Loading messages (returns toast ID for dismissal)
  loading: (message: string) => toast.loading(message),

  // Dismiss a toast
  dismiss: (toastId?: string) => toast.dismiss(toastId),

  // Promise-based toast (shows loading, then success/error)
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => toast.promise(promise, messages),
};

// Pre-configured toast messages for common operations
export const toastMessages = {
  // Projects
  project: {
    created: 'Project created successfully!',
    updated: 'Project updated',
    deleted: 'Project deleted',
    error: 'Failed to update project',
  },

  // Panels
  panel: {
    created: 'Panel added to diagram',
    updated: 'Panel updated',
    deleted: 'Panel removed',
    error: 'Failed to update panel',
    deleteError: 'Failed to delete panel',
  },

  // Circuits
  circuit: {
    created: 'Circuit added',
    updated: 'Circuit updated',
    deleted: 'Circuit removed',
    bulkCreated: (count: number) => `${count} circuits added`,
    error: 'Failed to update circuit',
  },

  // Transformers
  transformer: {
    created: 'Transformer added',
    updated: 'Transformer updated',
    deleted: 'Transformer removed',
    error: 'Failed to update transformer',
    deleteError: 'Failed to delete transformer',
  },

  // Meter Stacks
  meterStack: {
    created: 'Meter stack added',
    updated: 'Meter stack updated',
    deleted: 'Meter stack removed',
    error: 'Failed to update meter stack',
  },

  // Meters
  meter: {
    created: 'Meter added',
    updated: 'Meter updated',
    deleted: 'Meter removed',
    error: 'Failed to update meter',
  },

  // Feeders
  feeder: {
    created: 'Feeder created',
    updated: 'Feeder updated',
    deleted: 'Feeder removed',
    recalculated: 'Feeder recalculated',
    error: 'Failed to update feeder',
  },

  // RFIs
  rfi: {
    created: 'RFI created',
    updated: 'RFI updated',
    deleted: 'RFI deleted',
    answered: 'RFI marked as answered',
    closed: 'RFI closed',
    error: 'Failed to update RFI',
  },

  // Site Visits
  siteVisit: {
    created: 'Site visit logged',
    updated: 'Site visit updated',
    deleted: 'Site visit deleted',
    completed: 'Site visit marked as complete',
    error: 'Failed to update site visit',
  },

  // Permits
  permit: {
    created: 'Permit created',
    updated: 'Permit updated',
    deleted: 'Permit removed',
    statusAdvanced: 'Permit status updated',
    error: 'Failed to update permit',
    deleteError: 'Failed to delete permit',
  },

  // Permit Inspections
  inspection: {
    created: 'Inspection scheduled',
    updated: 'Inspection updated',
    deleted: 'Inspection removed',
    passed: 'Inspection marked passed',
    failed: 'Inspection marked failed',
    error: 'Failed to update inspection',
    deleteError: 'Failed to delete inspection',
  },

  // Calendar
  calendar: {
    created: 'Event added to calendar',
    updated: 'Event updated',
    deleted: 'Event deleted',
    error: 'Failed to update calendar',
  },

  // Exports
  export: {
    pdf: 'PDF exported successfully',
    png: 'PNG exported successfully',
    svg: 'SVG exported successfully',
    json: 'Project exported as JSON',
    error: 'Failed to export',
  },

  // Import
  import: {
    success: 'Project imported successfully',
    error: 'Failed to import project',
  },

  // Grounding
  grounding: {
    saved: 'Grounding configuration saved',
    error: 'Failed to save grounding',
  },

  // Calculations
  calculation: {
    saved: 'Calculation saved',
    deleted: 'Calculation deleted',
    error: 'Calculation failed',
  },

  // Auth
  auth: {
    signedIn: 'Welcome back!',
    signedOut: 'Signed out successfully',
    signUp: 'Account created! Welcome to SparkPlan',
    error: 'Authentication failed',
  },

  // User Profile
  userProfile: {
    updated: 'Profile saved',
    error: 'Failed to save profile',
  },

  // Estimates
  estimate: {
    created: 'Estimate created',
    updated: 'Estimate updated',
    deleted: 'Estimate deleted',
    cloned: 'Revision created from estimate',
    statusChanged: 'Estimate status updated',
    pdfGenerated: 'Bid PDF generated',
    pdfError: 'Failed to generate bid PDF',
    error: 'Failed to update estimate',
    deleteError: 'Failed to delete estimate',
    autoTakeoff: (count: number) =>
      count === 0
        ? 'No source rows yet — add panels or feeders to your project for auto-takeoff'
        : `Auto-takeoff added ${count} line item${count === 1 ? '' : 's'} from project`,
  },

  // Estimate line items
  estimateLineItem: {
    created: 'Line item added',
    updated: 'Line item updated',
    deleted: 'Line item removed',
    bulkCreated: (count: number) => `${count} line items added`,
    error: 'Failed to update line item',
  },

  // Support Tickets
  supportTicket: {
    created: "Support ticket submitted! We'll get back to you soon.",
    replied: 'Reply sent',
    resolved: 'Ticket marked as resolved',
    closed: 'Ticket closed',
    statusUpdated: 'Ticket status updated',
    priorityUpdated: 'Ticket priority updated',
    attachmentUploadError: 'Failed to upload attachment',
    error: 'Failed to submit support ticket',
    replyError: 'Failed to send reply',
  },

  // Generic
  saved: 'Changes saved',
  copied: 'Copied to clipboard',
  error: 'Something went wrong',
};
