import { useState } from 'react';
import { X } from 'lucide-react';
import Modal from './Modal';
import { submitFeedback } from '../api/feedback';
import { useToast } from '../context/ToastContext';
import { useSettingsSheet } from '../context/SettingsSheetContext';

export default function FeedbackModal() {
  const toast = useToast();
  const { feedbackOpen, closeFeedback } = useSettingsSheet();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setMessage('');
    closeFeedback();
  }

  async function handleSubmit() {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await submitFeedback(message.trim());
      toast.success('Feedback submitted — thank you!');
      setMessage('');
      closeFeedback();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit feedback');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={feedbackOpen}
      onClose={handleClose}
      title="Send feedback"
      align="bottom"
      panelClassName="card w-full max-w-[480px] rounded-b-none p-5 pb-8"
    >
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-[16px]">Feedback</div>
          <button onClick={handleClose} aria-label="Close" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>
        <div className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
          Tell us what to improve, or what features to add or remove. Your admin will read this.
        </div>
        <textarea
          className="input resize-none mb-4"
          style={{ minHeight: 120 }}
          rows={5}
          placeholder="Type your feedback…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex gap-2">
          <button className="btn btn-outline flex-1" onClick={handleClose}>Cancel</button>
          <button
            className="btn btn-blue flex-1"
            onClick={handleSubmit}
            disabled={!message.trim() || submitting}
          >
            {submitting ? 'Sending…' : 'Submit'}
          </button>
        </div>
    </Modal>
  );
}
