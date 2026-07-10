import { useState, useEffect, useCallback } from "react";
import { MessageSquare, CheckCircle, Clock } from "lucide-react";
import { getFeedback, markFeedbackRead } from "../api/feedback";
import type { FeedbackDTO } from "../api/types";
import { useToast } from "../context/ToastContext";
import { useRealtime } from "../context/RealtimeContext";

type Tab = 'all' | 'unread' | 'read';

const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
];

export default function Feedback() {
  const toast = useToast();
  const { on } = useRealtime();
  const [items, setItems] = useState<FeedbackDTO[]>([]);
  const [tab, setTab] = useState<Tab>('unread');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getFeedback()
      .then(setItems)
      .catch((err: Error) => toast.error(`Failed to load: ${err.message}`));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const off = on('feedback:new', load);
    return () => { off(); };
  }, [on, load]);

  const filtered = items.filter((f) => tab === 'all' || (tab === 'unread' ? !f.read : f.read));

  const counts = {
    unread: items.filter((f) => !f.read).length,
    read: items.filter((f) => f.read).length,
  };

  async function handleMarkRead(id: string) {
    setBusy(id);
    try {
      await markFeedbackRead(id);
      toast.success('Marked as read');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mark as read');
    } finally {
      setBusy(null);
    }
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="w-5 h-5 text-[#0047B2]" />
        <h1 className="text-[18px] font-semibold text-[#222222]">Employee Feedback</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777] mb-1">Unread</div>
          <div className="text-[24px] font-semibold text-[#E65100]">{counts.unread}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777] mb-1">Read</div>
          <div className="text-[24px] font-semibold text-[#18751C]">{counts.read}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777] mb-1">Total</div>
          <div className="text-[24px] font-semibold text-[#0047B2]">{items.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[#E0E4E9]">
        {TAB_LABELS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-[#0047B2] text-[#0047B2]'
                : 'border-transparent text-[#777] hover:text-[#222]'
            }`}
          >
            {t.label}
            {t.key !== 'all' && counts[t.key] > 0 && (
              <span className="ml-1.5 bg-[#E0E4E9] text-[#555] text-[11px] px-1.5 py-0.5 rounded-full">
                {counts[t.key as keyof typeof counts]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Feedback list */}
      {filtered.length === 0 ? (
        <div className="dashboard-card p-10 text-center text-[#777] text-[14px]">
          No {tab === 'all' ? '' : tab} feedback
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((f) => (
            <div key={f.id} className="dashboard-card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-semibold text-[#222]">{f.employee.name}</span>
                    <span className="text-[11px] text-[#777]">({f.employee.id})</span>
                    <span className="text-[11px] text-[#999]">·</span>
                    <span className="text-[11px] text-[#777]">{f.employee.contact}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#999]">
                    <Clock className="w-3 h-3" />
                    Submitted {timeAgo(f.submittedAt)}
                  </div>
                </div>
                <div className="shrink-0">
                  {f.read ? (
                    <span className="text-[11px] bg-[#E8F5E9] text-[#18751C] px-2 py-1 rounded-full font-medium">
                      ✓ Read
                    </span>
                  ) : (
                    <span className="text-[11px] bg-[#FFF3E0] text-[#E65100] px-2 py-1 rounded-full font-medium">
                      Unread
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 bg-[#F5F6FA] rounded-lg p-3 text-[13px] text-[#333] whitespace-pre-wrap">
                {f.message}
              </div>

              {!f.read && (
                <div className="mt-4">
                  <button
                    onClick={() => handleMarkRead(f.id)}
                    disabled={busy === f.id}
                    className="flex items-center gap-2 bg-[#18751C] text-white px-4 py-2 rounded text-[13px] hover:bg-[#145a18] disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {busy === f.id ? 'Marking…' : 'Mark as Read'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
