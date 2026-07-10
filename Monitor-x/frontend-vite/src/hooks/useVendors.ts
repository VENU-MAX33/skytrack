import { useEffect, useState } from 'react';
import { getCompanyConfig } from '../api';

/**
 * Vendor (cab company) names managed by the admin in Route Management.
 * Falls back to the legacy default so existing data stays selectable.
 */
export function useVendors(): string[] {
  const [vendors, setVendors] = useState<string[]>([]);
  useEffect(() => {
    getCompanyConfig()
      .then((c) => setVendors(c.vendors ?? []))
      .catch(() => { /* keep fallback */ });
  }, []);
  return vendors.length > 0 ? vendors : ['RGL'];
}
