import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getToken } from '../api/client';

const SOCKET_URL =
  (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? '';

/**
 * Opens a single authenticated Socket.IO connection while `enabled` is true.
 * The socket joins its role room server-side based on the JWT.
 */
export function useSocket(enabled: boolean): React.MutableRefObject<Socket | null> {
  const ref = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const token = getToken();
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
  }, [enabled]);

  return ref;
}
