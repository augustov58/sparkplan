import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  LifeBuoy,
  X,
  Bug,
  HelpCircle,
  Heart,
  Sparkles,
  Send,
  Upload,
  Loader,
  Image as ImageIcon,
  ArrowLeft,
  CheckCircle,
  Clock,
  Circle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from './Auth/AuthProvider';
import { useSubscription } from '../hooks/useSubscription';
import {
  useSupportTickets,
  type SupportReply,
  type SupportTicket,
  type TicketCategory,
} from '../hooks/useSupportTickets';
import {
  supportTicketSchema,
  type SupportTicketFormData,
} from '../lib/validation-schemas';
import { showToast, toastMessages } from '../lib/toast';

type View = 'form' | 'history' | 'detail';

const CATEGORIES: Array<{
  value: TicketCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { value: 'bug', label: 'Bug', icon: Bug, color: 'bg-red-50 text-red-700 border-red-200' },
  {
    value: 'question',
    label: 'Question',
    icon: HelpCircle,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    value: 'feedback',
    label: 'Feedback',
    icon: Heart,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    value: 'feature_request',
    label: 'Feature',
    icon: Sparkles,
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
];

const CATEGORY_META: Record<TicketCategory, { label: string; badge: string }> = {
  bug: { label: 'Bug', badge: 'bg-red-100 text-red-700' },
  question: { label: 'Question', badge: 'bg-blue-100 text-blue-700' },
  feedback: { label: 'Feedback', badge: 'bg-amber-100 text-amber-700' },
  feature_request: { label: 'Feature', badge: 'bg-purple-100 text-purple-700' },
};

const STATUS_META: Record<
  SupportTicket['status'],
  { label: string; badge: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  open: { label: 'Open', badge: 'bg-emerald-100 text-emerald-700', Icon: Circle },
  in_progress: { label: 'In progress', badge: 'bg-blue-100 text-blue-700', Icon: Clock },
  resolved: { label: 'Resolved', badge: 'bg-gray-100 text-gray-700', Icon: CheckCircle },
  closed: { label: 'Closed', badge: 'bg-gray-100 text-gray-500', Icon: CheckCircle },
};

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

async function uploadAttachments(userId: string, files: File[]): Promise<string[]> {
  const uploadPromises = files.map(async (file) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`${file.name} is larger than 10MB`);
    }
    const ext = file.name.split('.').pop() || 'png';
    const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('support-attachments')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;
    return path;
  });
  return Promise.all(uploadPromises);
}

function useSignedUrls(paths: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = paths.filter((p) => !urls[p]);
      if (missing.length === 0) return;
      const entries = await Promise.all(
        missing.map(async (p) => {
          const { data } = await supabase.storage
            .from('support-attachments')
            .createSignedUrl(p, 60 * 60);
          return [p, data?.signedUrl || ''] as const;
        })
      );
      if (!cancelled) {
        setUrls((prev) => {
          const next = { ...prev };
          for (const [p, url] of entries) next[p] = url;
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join('|')]);

  return urls;
}

export const SupportWidget: React.FC = () => {
  const { user } = useAuthContext();
  const { effectivePlan } = useSubscription();
  const {
    tickets,
    loading,
    createTicket,
    getReplies,
    addReply,
  } = useSupportTickets(false);

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>('form');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<TicketCategory>('bug');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupportTicketFormData>({
    resolver: zodResolver(supportTicketSchema),
    defaultValues: { category: 'bug', subject: '', message: '' },
  });

  // Keep form category in sync with clicked pill
  useEffect(() => {
    reset({ category: selectedCategory, subject: '', message: '' });
  }, [selectedCategory, reset]);

  const unreadAdminReplies = 0; // placeholder — future: count replies since last-seen timestamp

  const onSubmit = async (data: SupportTicketFormData) => {
    if (!user) return;
    setSubmitting(true);
    try {
      let uploaded: string[] = [];
      if (attachments.length > 0) {
        try {
          uploaded = await uploadAttachments(user.id, attachments);
        } catch (err: any) {
          showToast.error(err.message || toastMessages.supportTicket.attachmentUploadError);
          setSubmitting(false);
          return;
        }
      }

      const ticket = await createTicket({
        category: data.category,
        subject: data.subject,
        message: data.message,
        attachment_urls: uploaded,
        plan_tier: effectivePlan,
      });

      if (!ticket) {
        showToast.error(toastMessages.supportTicket.error);
        setSubmitting(false);
        return;
      }

      showToast.success(toastMessages.supportTicket.created);
      setAttachments([]);
      reset({ category: selectedCategory, subject: '', message: '' });
      setView('history');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setAttachments((prev) => [...prev, ...incoming].slice(0, MAX_ATTACHMENTS));
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-50 bg-[#2d3b2d] hover:bg-[#1f2a1f] text-white rounded-full shadow-lg hover:shadow-xl transition-all w-14 h-14 flex items-center justify-center group"
          aria-label="Open support"
        >
          <LifeBuoy className="w-6 h-6 group-hover:scale-110 transition-transform" />
          {unreadAdminReplies > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadAdminReplies}
            </span>
          )}
        </button>
      )}

      {/* Slide-up Panel */}
      {isOpen && (
        <div className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-50 w-[calc(100vw-2rem)] md:w-96 max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ maxHeight: 'min(85vh, 640px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#2d3b2d] text-white">
            <div className="flex items-center gap-2">
              {view === 'detail' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTicketId(null);
                    setView('history');
                  }}
                  className="p-1 hover:bg-white/10 rounded"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <LifeBuoy className="w-5 h-5" />
              <h3 className="font-semibold text-sm">
                {view === 'form' && 'Contact Support'}
                {view === 'history' && 'My Tickets'}
                {view === 'detail' && 'Ticket Details'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab bar */}
          {view !== 'detail' && (
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => setView('form')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  view === 'form'
                    ? 'text-[#2d3b2d] border-b-2 border-[#2d3b2d]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                New message
              </button>
              <button
                type="button"
                onClick={() => setView('history')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  view === 'history'
                    ? 'text-[#2d3b2d] border-b-2 border-[#2d3b2d]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                My tickets {tickets.length > 0 && `(${tickets.length})`}
              </button>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {view === 'form' && (
              <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-3">
                {/* Category pills */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    What's this about?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(({ value, label, icon: Icon, color }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSelectedCategory(value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                          selectedCategory === value
                            ? `${color} ring-2 ring-offset-1 ring-[#2d3b2d]`
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" {...register('category')} value={selectedCategory} />
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Subject
                  </label>
                  <input
                    {...register('subject')}
                    placeholder="Brief summary"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d3b2d] focus:border-transparent"
                  />
                  {errors.subject && (
                    <p className="mt-1 text-xs text-red-600">{errors.subject.message}</p>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Message
                  </label>
                  <textarea
                    {...register('message')}
                    placeholder="Tell us what's happening..."
                    rows={5}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d3b2d] focus:border-transparent resize-none"
                  />
                  {errors.message && (
                    <p className="mt-1 text-xs text-red-600">{errors.message.message}</p>
                  )}
                </div>

                {/* Attachments */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Screenshots (optional)
                  </label>
                  <label
                    className="cursor-pointer block"
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(true);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                      handleFiles(e.dataTransfer.files);
                    }}
                  >
                    <div
                      className={`border-2 border-dashed rounded-lg p-3 transition-colors text-center ${
                        isDragging
                          ? 'border-[#2d3b2d] bg-[#e8f5e8]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">
                        Drop images or click to upload
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Up to {MAX_ATTACHMENTS} images · 10MB each
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleFiles(e.target.files)}
                      className="hidden"
                    />
                  </label>
                  {attachments.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="relative group">
                          <div className="aspect-square rounded bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden">
                            <img
                              src={URL.createObjectURL(file)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setAttachments((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Context footer */}
                <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                  We'll include your plan ({effectivePlan}) and current page with this ticket to
                  help us respond faster.
                </p>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#2d3b2d] hover:bg-[#1f2a1f] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {submitting ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send message
                    </>
                  )}
                </button>
              </form>
            )}

            {view === 'history' && (
              <TicketHistory
                tickets={tickets}
                loading={loading}
                onSelect={(id) => {
                  setSelectedTicketId(id);
                  setView('detail');
                }}
                onStartNew={() => setView('form')}
              />
            )}

            {view === 'detail' && selectedTicketId && (
              <TicketDetail
                ticketId={selectedTicketId}
                ticket={tickets.find((t) => t.id === selectedTicketId)}
                getReplies={getReplies}
                addReply={addReply}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
};

// ============================================
// Ticket History sub-component
// ============================================

interface TicketHistoryProps {
  tickets: SupportTicket[];
  loading: boolean;
  onSelect: (ticketId: string) => void;
  onStartNew: () => void;
}

const TicketHistory: React.FC<TicketHistoryProps> = ({
  tickets,
  loading,
  onSelect,
  onStartNew,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="p-6 text-center">
        <LifeBuoy className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-600 mb-3">You haven't sent any messages yet.</p>
        <button
          type="button"
          onClick={onStartNew}
          className="text-sm text-[#2d3b2d] hover:underline font-medium"
        >
          Send your first message →
        </button>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {tickets.map((ticket) => {
        const cat = CATEGORY_META[ticket.category];
        const status = STATUS_META[ticket.status];
        const StatusIcon = status.Icon;
        return (
          <button
            key={ticket.id}
            type="button"
            onClick={() => onSelect(ticket.id)}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="text-sm font-medium text-gray-900 line-clamp-1">
                {ticket.subject}
              </h4>
              <span
                className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${status.badge}`}
              >
                <StatusIcon className="w-2.5 h-2.5" />
                {status.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <span className={`px-1.5 py-0.5 rounded font-medium ${cat.badge}`}>
                {cat.label}
              </span>
              <span>·</span>
              <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ============================================
// Ticket Detail sub-component
// ============================================

interface TicketDetailProps {
  ticketId: string;
  ticket: SupportTicket | undefined;
  getReplies: (id: string) => Promise<SupportReply[]>;
  addReply: (id: string, message: string, isAdmin?: boolean) => Promise<SupportReply | null>;
}

const TicketDetail: React.FC<TicketDetailProps> = ({
  ticketId,
  ticket,
  getReplies,
  addReply,
}) => {
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const attachmentPaths = useMemo(() => ticket?.attachment_urls || [], [ticket]);
  const signedUrls = useSignedUrls(attachmentPaths);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingReplies(true);
      const data = await getReplies(ticketId);
      if (!cancelled) {
        setReplies(data);
        setLoadingReplies(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId, getReplies]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [replies.length]);

  // Realtime: listen for new replies on this ticket
  useEffect(() => {
    const channel = supabase
      .channel(`support_replies_${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_replies',
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          setReplies((prev) => {
            if (prev.some((r) => r.id === (payload.new as any).id)) return prev;
            return [...prev, payload.new as SupportReply];
          });
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [ticketId]);

  const handleSendReply = async () => {
    const msg = replyText.trim();
    if (!msg) return;
    setSending(true);
    try {
      const reply = await addReply(ticketId, msg, false);
      if (reply) {
        setReplies((prev) =>
          prev.some((r) => r.id === reply.id) ? prev : [...prev, reply]
        );
        setReplyText('');
      } else {
        showToast.error(toastMessages.supportTicket.replyError);
      }
    } finally {
      setSending(false);
    }
  };

  if (!ticket) {
    return <div className="p-4 text-sm text-gray-500">Ticket not found.</div>;
  }

  const cat = CATEGORY_META[ticket.category];
  const status = STATUS_META[ticket.status];
  const StatusIcon = status.Icon;

  return (
    <div className="flex flex-col h-full">
      {/* Ticket header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">{ticket.subject}</h4>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className={`px-1.5 py-0.5 rounded font-medium ${cat.badge}`}>{cat.label}</span>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${status.badge}`}
          >
            <StatusIcon className="w-2.5 h-2.5" />
            {status.label}
          </span>
          <span className="text-gray-500">· {new Date(ticket.created_at).toLocaleString()}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Original message */}
        <div className="flex justify-end">
          <div className="max-w-[85%] bg-[#2d3b2d] text-white rounded-lg rounded-br-sm px-3 py-2">
            <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
            {ticket.attachment_urls.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                {ticket.attachment_urls.map((path) => (
                  <a
                    key={path}
                    href={signedUrls[path] || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-video bg-white/10 rounded overflow-hidden"
                  >
                    {signedUrls[path] ? (
                      <img
                        src={signedUrls[path]}
                        alt="attachment"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-white/60" />
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {loadingReplies && (
          <div className="flex justify-center py-2">
            <Loader className="w-4 h-4 text-gray-400 animate-spin" />
          </div>
        )}

        {replies.map((reply) => (
          <div
            key={reply.id}
            className={`flex ${reply.is_admin ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                reply.is_admin
                  ? 'bg-gray-100 text-gray-900 rounded-bl-sm'
                  : 'bg-[#2d3b2d] text-white rounded-br-sm'
              }`}
            >
              {reply.is_admin && (
                <p className="text-[10px] font-semibold text-[#2d3b2d] mb-0.5">
                  SparkPlan Support
                </p>
              )}
              <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
              <p
                className={`text-[10px] mt-1 ${
                  reply.is_admin ? 'text-gray-500' : 'text-white/70'
                }`}
              >
                {new Date(reply.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      {ticket.status !== 'closed' && (
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-end gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
              placeholder="Follow up..."
              rows={1}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d3b2d] focus:border-transparent resize-none"
            />
            <button
              type="button"
              onClick={handleSendReply}
              disabled={sending || !replyText.trim()}
              className="bg-[#2d3b2d] hover:bg-[#1f2a1f] disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
              aria-label="Send"
            >
              {sending ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportWidget;
