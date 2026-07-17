import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { TOKEN_KEY } from '../api/client';

const SOCKET_URL =
  (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? '';

/** Opens a single authenticated Socket.IO connection while `enabled` is true. */
export function useSocket(enabled: boolean, sessionKey = ''): React.MutableRefObject<Socket | null> {
  const ref = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !SOCKET_URL) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    ref.current = socket;

    return () => {
      socket.disconnect();
      ref.current = null;
    };
  }, [enabled, sessionKey]);

  return ref;
}
