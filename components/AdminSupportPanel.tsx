import React, { useState, useMemo, useEffect } from 'react';
import {
  Loader2,
  Search,
  Send,
  Image as ImageIcon,
  Clock,
  Circle,
  CheckCircle,
  ExternalLink,
  Inbox,
  Mail,
  User,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  useSupportTickets,
  type SupportReply,
  type SupportTicket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '@/hooks/useSupportTickets';
import { showToast, toastMessages } from '@/lib/toast';

const CATEGORY_META: Record<TicketCategory, { label: string; badge: string }> = {
  bug: { label: 'Bug', badge: 'bg-red-100 text-red-700' },
  question: { label: 'Question', badge: 'bg-blue-100 text-blue-700' },
  feedback: { label: 'Feedback', badge: 'bg-amber-100 text-amber-700' },
  feature_request: { label: 'Feature', badge: 'bg-purple-100 text-purple-700' },
};

const STATUS_META: Record<
  TicketStatus,
  { label: string; badge: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  open: { label: 'Open', badge: 'bg-emerald-100 text-emerald-700', Icon: Circle },
  in_progress: { label: 'In progress', badge: 'bg-blue-100 text-blue-700', Icon: Clock },
  resolved: { label: 'Resolved', badge: 'bg-gray-100 text-gray-700', Icon: CheckCircle },
  closed: { label: 'Closed', badge: 'bg-gray-200 text-gray-500', Icon: CheckCircle },
};

const PRIORITY_META: Record<TicketPriority, string> = {
  low: 'bg-gray-50 text-gray-600',
  normal: 'bg-gray-100 text-gray-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const STATUS_OPTIONS: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTIONS: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

export const AdminSupportPanel: React.FC = () => {
  const {
    tickets,
    loading,
    getReplies,
    addReply,
    updateTicketStatus,
    updateTicketPriority,
  } = useSupportTickets(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'all'>('all');
  const [searchText, setSearchText] = useState('');

  const filteredTickets = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (q) {
        const hay = `${t.subject} ${t.user_email} ${t.message}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, categoryFilter, searchText]);

  const stats = useMemo(() => {
    const open = tickets.filter((t) => t.status === 'open').length;
    const inProgress = tickets.filter((t) => t.status === 'in_progress').length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resolvedToday = tickets.filter(
      (t) => t.status === 'resolved' && new Date(t.updated_at) >= today
    ).length;
    return { open, inProgress, resolvedToday };
  }, [tickets]);

  const selected = tickets.find((t) => t.id === selectedId) || null;

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Open" value={stats.open} accent="bg-emerald-50 text-emerald-700" />
        <StatCard label="In progress" value={stats.inProgress} accent="bg-blue-50 text-blue-700" />
        <StatCard
          label="Resolved today"
          value={stats.resolvedToday}
          accent="bg-gray-50 text-gray-700"
        />
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search subject, email, message..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20 outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TicketStatus | 'all')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as TicketCategory | 'all')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="all">All categories</option>
            {(Object.keys(CATEGORY_META) as TicketCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Layout: list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4">
        {/* Ticket list */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              No tickets match the filters.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
              {filteredTickets.map((ticket) => {
                const status = STATUS_META[ticket.status];
                const StatusIcon = status.Icon;
                const cat = CATEGORY_META[ticket.category];
                const isSelected = ticket.id === selectedId;
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedId(ticket.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isSelected ? 'bg-[#e8f5e8]/40' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">
                        {ticket.subject}
                      </h4>
                      <span
                        className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${status.badge}`}
                      >
                        <StatusIcon className="w-2.5 h-2.5" />
                        {status.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mb-1 truncate">{ticket.user_email}</div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className={`px-1.5 py-0.5 rounded font-medium ${cat.badge}`}>
                        {cat.label}
                      </span>
                      {ticket.plan_tier && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                          {ticket.plan_tier}
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded font-medium ${PRIORITY_META[ticket.priority]}`}
                      >
                        {ticket.priority}
                      </span>
                      <span className="text-gray-400 ml-auto">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {selected ? (
            <TicketDetail
              key={selected.id}
              ticket={selected}
              getReplies={getReplies}
              addReply={addReply}
              updateTicketStatus={updateTicketStatus}
              updateTicketPriority={updateTicketPriority}
            />
          ) : (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center text-gray-500">
              <Inbox className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-sm">Select a ticket to view details and reply.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// Stat card
// ============================================
const StatCard: React.FC<{ label: string; value: number; accent: string }> = ({
  label,
  value,
  accent,
}) => (
  <div className="bg-white border border-gray-200 rounded-lg p-4">
    <div className="text-xs text-gray-500 mb-1">{label}</div>
    <div className={`inline-flex items-baseline gap-2 px-2 py-0.5 rounded ${accent}`}>
      <span className="text-2xl font-bold leading-none">{value}</span>
    </div>
  </div>
);

// ============================================
// Ticket Detail (admin side)
// ============================================
interface TicketDetailProps {
  ticket: SupportTicket;
  getReplies: (id: string) => Promise<SupportReply[]>;
  addReply: (
    id: string,
    message: string,
    isAdmin?: boolean
  ) => Promise<SupportReply | null>;
  updateTicketStatus: (id: string, status: TicketStatus) => Promise<void>;
  updateTicketPriority: (id: string, priority: TicketPriority) => Promise<void>;
}

const TicketDetail: React.FC<TicketDetailProps> = ({
  ticket,
  getReplies,
  addReply,
  updateTicketStatus,
  updateTicketPriority,
}) => {
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const cat = CATEGORY_META[ticket.category];
  const status = STATUS_META[ticket.status];
  const StatusIcon = status.Icon;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingReplies(true);
      const data = await getReplies(ticket.id);
      if (!cancelled) {
        setReplies(data);
        setLoadingReplies(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticket.id, getReplies]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const paths = ticket.attachment_urls;
      if (paths.length === 0) return;
      const entries = await Promise.all(
        paths.map(async (p) => {
          const { data } = await supabase.storage
            .from('support-attachments')
            .createSignedUrl(p, 60 * 60);
          return [p, data?.signedUrl || ''] as const;
        })
      );
      if (!cancelled) {
        setSignedUrls(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticket.attachment_urls]);

  // Realtime on replies for this ticket
  useEffect(() => {
    const channel = supabase
      .channel(`admin_support_replies_${ticket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_replies',
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          setReplies((prev) =>
            prev.some((r) => r.id === (payload.new as any).id)
              ? prev
              : [...prev, payload.new as SupportReply]
          );
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [ticket.id]);

  const handleSendReply = async () => {
    const msg = replyText.trim();
    if (!msg) return;
    setSending(true);
    try {
      const reply = await addReply(ticket.id, msg, true);
      if (reply) {
        setReplies((prev) =>
          prev.some((r) => r.id === reply.id) ? prev : [...prev, reply]
        );
        setReplyText('');
        showToast.success(toastMessages.supportTicket.replied);
      } else {
        showToast.error(toastMessages.supportTicket.replyError);
      }
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    await updateTicketStatus(ticket.id, newStatus);
    showToast.success(toastMessages.supportTicket.statusUpdated);
  };

  const handlePriorityChange = async (newPriority: TicketPriority) => {
    await updateTicketPriority(ticket.id, newPriority);
    showToast.success(toastMessages.supportTicket.priorityUpdated);
  };

  return (
    <div className="flex flex-col h-full max-h-[70vh]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-base font-semibold text-gray-900 flex-1">{ticket.subject}</h3>
          <span
            className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${status.badge}`}
          >
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </span>
        </div>

        {/* Context row */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
          <span className="inline-flex items-center gap-1">
            <User className="w-3 h-3" />
            <a
              href={`mailto:${ticket.user_email}`}
              className="hover:underline"
            >
              {ticket.user_email}
            </a>
          </span>
          <span>·</span>
          <span className={`px-1.5 py-0.5 rounded font-medium ${cat.badge}`}>{cat.label}</span>
          {ticket.plan_tier && (
            <>
              <span>·</span>
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                {ticket.plan_tier}
              </span>
            </>
          )}
          <span>·</span>
          <span>{new Date(ticket.created_at).toLocaleString()}</span>
        </div>

        {ticket.page_url && (
          <div className="text-[11px] text-gray-500 mt-1 truncate">
            <span className="font-medium">Page:</span>{' '}
            <a
              href={ticket.page_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline inline-flex items-center gap-0.5"
            >
              {ticket.page_url}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        )}
        {ticket.browser_info && (
          <div className="text-[11px] text-gray-400 mt-0.5 truncate" title={ticket.browser_info}>
            <span className="font-medium">Browser:</span> {ticket.browser_info}
          </div>
        )}

        {/* Admin controls */}
        <div className="flex flex-wrap gap-2 mt-3">
          <select
            value={ticket.status}
            onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                Status: {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <select
            value={ticket.priority}
            onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                Priority: {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Original */}
        <MessageBubble
          side="user"
          message={ticket.message}
          timestamp={ticket.created_at}
          attachments={ticket.attachment_urls}
          signedUrls={signedUrls}
        />

        {loadingReplies && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          </div>
        )}

        {replies.map((reply) => (
          <MessageBubble
            key={reply.id}
            side={reply.is_admin ? 'admin' : 'user'}
            message={reply.message}
            timestamp={reply.created_at}
            attachments={reply.attachment_urls}
            signedUrls={signedUrls}
          />
        ))}
      </div>

      {/* Reply */}
      {ticket.status !== 'closed' && (
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-end gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
              placeholder="Reply as SparkPlan Support... (⌘/Ctrl+Enter to send)"
              rows={3}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d3b2d] focus:border-transparent resize-none"
            />
            <button
              type="button"
              onClick={handleSendReply}
              disabled={sending || !replyText.trim()}
              className="bg-[#2d3b2d] hover:bg-[#1f2a1f] disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 text-sm"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
            <Mail className="w-3 h-3" />
            Reply will be emailed to {ticket.user_email} and shown in their widget.
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================
// Message bubble
// ============================================
interface MessageBubbleProps {
  side: 'user' | 'admin';
  message: string;
  timestamp: string;
  attachments: string[];
  signedUrls: Record<string, string>;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  side,
  message,
  timestamp,
  attachments,
  signedUrls,
}) => (
  <div className={`flex ${side === 'admin' ? 'justify-end' : 'justify-start'}`}>
    <div
      className={`max-w-[85%] rounded-lg px-3 py-2 ${
        side === 'admin'
          ? 'bg-[#2d3b2d] text-white rounded-br-sm'
          : 'bg-gray-100 text-gray-900 rounded-bl-sm'
      }`}
    >
      <p
        className={`text-[10px] font-semibold mb-0.5 ${
          side === 'admin' ? 'text-white/80' : 'text-[#2d3b2d]'
        }`}
      >
        {side === 'admin' ? 'You (Support)' : 'User'}
      </p>
      <p className="text-sm whitespace-pre-wrap">{message}</p>
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {attachments.map((path) => (
            <a
              key={path}
              href={signedUrls[path] || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="block aspect-video bg-black/10 rounded overflow-hidden"
            >
              {signedUrls[path] ? (
                <img
                  src={signedUrls[path]}
                  alt="attachment"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 opacity-60" />
                </div>
              )}
            </a>
          ))}
        </div>
      )}
      <p
        className={`text-[10px] mt-1 ${
          side === 'admin' ? 'text-white/70' : 'text-gray-500'
        }`}
      >
        {new Date(timestamp).toLocaleString()}
      </p>
    </div>
  </div>
);

export default AdminSupportPanel;
