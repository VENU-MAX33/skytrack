import { useState, useEffect, useCallback } from "react";
import { MapPin, CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";
import { getLocationRequests, approveLocationRequest, rejectLocationRequest } from "../api/locationRequests";
import type { LocationRequestDTO } from "../api/types";
import { useToast } from "../context/ToastContext";
import { useRealtime } from "../context/RealtimeContext";

type Tab = 'all' | 'pending' | 'approved' | 'rejected';

const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function LocationRequests() {
  const toast = useToast();
  const { on } = useRealtime();
  const [requests, setRequests] = useState<LocationRequestDTO[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(() => {
    getLocationRequests()
      .then(setRequests)
      .catch((err: Error) => toast.error(`Failed to load: ${err.message}`));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const off = on('location:request:new', load);
    const offApproved = on('location:request:approved', load);
    return () => { off(); offApproved(); };
  }, [on, load]);

  const filtered = requests.filter((r) => tab === 'all' || r.status === tab);

  const counts = {
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  };

  async function handleApprove(id: string) {
    setBusy(id);
    try {
      await approveLocationRequest(id);
      toast.success('Location request approved — employee record updated');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not approve');
    } finally {
      setBusy(null);
    }
  }

  async function handleReject(id: string) {
    setBusy(id);
    try {
      await rejectLocationRequest(id, rejectNote);
      toast.success('Request rejected');
      setRejectId(null);
      setRejectNote('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reject');
    } finally {
      setBusy(null);
    }
  }

  function mapsLink(latLong: string) {
    const trimmed = latLong.trim();
    if (!trimmed) return null;
    return `https://maps.google.com/?q=${encodeURIComponent(trimmed)}`;
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
        <MapPin className="w-5 h-5 text-[#0047B2]" />
        <h1 className="text-[18px] font-semibold text-[#222222]">Employee Location Requests</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777] mb-1">Pending Review</div>
          <div className="text-[24px] font-semibold text-[#E65100]">{counts.pending}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777] mb-1">Approved</div>
          <div className="text-[24px] font-semibold text-[#18751C]">{counts.approved}</div>
        </div>
        <div className="dashboard-card p-4">
          <div className="text-[12px] text-[#777] mb-1">Rejected</div>
          <div className="text-[24px] font-semibold text-[#D22630]">{counts.rejected}</div>
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

      {/* Request list */}
      {filtered.length === 0 ? (
        <div className="dashboard-card p-10 text-center text-[#777] text-[14px]">
          No {tab === 'all' ? '' : tab} location requests
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <div key={r.id} className="dashboard-card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* Employee info */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-semibold text-[#222]">{r.employee.name}</span>
                    <span className="text-[11px] text-[#777]">({r.employee.id})</span>
                    <span className="text-[11px] text-[#999]">·</span>
                    <span className="text-[11px] text-[#777]">{r.employee.contact}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#999]">
                    <Clock className="w-3 h-3" />
                    Submitted {timeAgo(r.requestedAt)}
                    {r.reviewedBy && (
                      <span className="ml-2">· Reviewed by {r.reviewedBy}</span>
                    )}
                  </div>
                  {r.note && (
                    <div className="mt-1 text-[12px] text-[#555] italic">Note: {r.note}</div>
                  )}
                </div>

                {/* Status badge */}
                <div className="shrink-0">
                  {r.status === 'pending' && (
                    <span className="text-[11px] bg-[#FFF3E0] text-[#E65100] px-2 py-1 rounded-full font-medium">
                      Pending
                    </span>
                  )}
                  {r.status === 'approved' && (
                    <span className="text-[11px] bg-[#E8F5E9] text-[#18751C] px-2 py-1 rounded-full font-medium">
                      ✓ Approved
                    </span>
                  )}
                  {r.status === 'rejected' && (
                    <span className="text-[11px] bg-[#FFEBEE] text-[#D22630] px-2 py-1 rounded-full font-medium">
                      Rejected
                    </span>
                  )}
                </div>
              </div>

              {/* Location comparison */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-[#F5F6FA] rounded-lg p-3">
                  <div className="text-[11px] text-[#777] font-medium uppercase tracking-wide mb-2">
                    Current Location
                  </div>
                  <div className="text-[12px] text-[#444] mb-1">{r.currentAddress || '—'}</div>
                  {r.currentLatLong && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#777] font-mono">{r.currentLatLong}</span>
                      {mapsLink(r.currentLatLong) && (
                        <a
                          href={mapsLink(r.currentLatLong)!}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#0047B2]"
                          title="Open on Google Maps"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <div className="bg-[#E8F5E9] rounded-lg p-3 border border-[#c8e6c9]">
                  <div className="text-[11px] text-[#18751C] font-medium uppercase tracking-wide mb-2">
                    Requested Location
                  </div>
                  <div className="text-[12px] text-[#444] mb-1">{r.requestedAddress || '—'}</div>
                  {r.requestedLatLong && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#777] font-mono">{r.requestedLatLong}</span>
                      {mapsLink(r.requestedLatLong) && (
                        <a
                          href={mapsLink(r.requestedLatLong)!}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#0047B2]"
                          title="Open on Google Maps"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions for pending */}
              {r.status === 'pending' && (
                <div className="mt-4 flex items-start gap-3 flex-wrap">
                  <button
                    onClick={() => handleApprove(r.id)}
                    disabled={busy === r.id}
                    className="flex items-center gap-2 bg-[#18751C] text-white px-4 py-2 rounded text-[13px] hover:bg-[#145a18] disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {busy === r.id ? 'Approving…' : 'Approve & Update'}
                  </button>
                  {rejectId === r.id ? (
                    <div className="flex gap-2 items-start flex-1">
                      <input
                        className="border border-[#E0E4E9] rounded px-3 py-2 text-[12px] flex-1 min-w-[180px]"
                        placeholder="Reason for rejection (optional)"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        autoFocus
                      />
                      <button
                        onClick={() => handleReject(r.id)}
                        disabled={busy === r.id}
                        className="bg-[#D22630] text-white px-3 py-2 rounded text-[13px] disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => { setRejectId(null); setRejectNote(''); }}
                        className="border border-[#E0E4E9] px-3 py-2 rounded text-[13px] text-[#777]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRejectId(r.id)}
                      className="flex items-center gap-2 border border-[#D22630] text-[#D22630] px-4 py-2 rounded text-[13px] hover:bg-[#FFEBEE]"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
