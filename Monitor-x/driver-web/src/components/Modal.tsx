import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  title: string;
  /** Classes for the dialog panel (usually the `card` styling + width). */
  panelClassName?: string;
  /** Vertical placement of the panel. */
  align?: 'center' | 'bottom';
  /** 'alertdialog' for urgent, must-acknowledge dialogs (e.g. SOS). */
  role?: 'dialog' | 'alertdialog';
  /** Whether a backdrop click / Escape dismisses it (off for must-acknowledge dialogs). */
  dismissable?: boolean;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal for the mobile apps: role dialog/alertdialog + aria-modal,
 * focus moved in on open and restored on close, a contained Tab focus trap, and
 * (when dismissable) Escape / backdrop-click to close. Rendered in a portal.
 */
export default function Modal({
  open,
  onClose,
  title,
  panelClassName = '',
  align = 'center',
  role = 'dialog',
  dismissable = true,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const dismissableRef = useRef(dismissable);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissableRef.current = dismissable;
  });

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (!panel) return;
      if (!panel.contains(document.activeElement) && document.activeElement !== panel) return;
      if (e.key === 'Escape' && dismissableRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[10000] flex justify-center bg-black/60 ${
        align === 'bottom' ? 'items-end' : 'items-center p-4'
      }`}
      role="presentation"
      // Backdrop click-to-close is a pointer convenience; Escape is the keyboard path (handled above).
      onMouseDown={(e) => { if (dismissable && e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`outline-none ${panelClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
