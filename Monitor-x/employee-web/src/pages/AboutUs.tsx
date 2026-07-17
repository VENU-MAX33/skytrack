import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getCompanyConfig } from '../api/trips';
import type { CompanyConfig } from '../api/types';

const APP_VERSION = '1.0.0';

export default function AboutUs() {
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanyConfig | null>(null);

  useEffect(() => {
    getCompanyConfig().then(setCompany).catch(() => { /* company config is optional here */ });
  }, []);

  return (
    <div className="app-shell pb-10">
      <header className="bg-[#004b87] text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1">
          <ArrowLeft size={22} />
        </button>
        <div className="font-bold">About Us</div>
      </header>

      <div className="card m-3 p-4 space-y-4">
        <div>
          <div className="font-bold text-[16px]">SkyTrack Employee</div>
          <div className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Cab dashboard for employees — see your trips, share your live location, and request
            pickup location changes.
          </div>
        </div>
        {company?.name && (
          <div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Operated by</div>
            <div className="text-[14px] font-medium">{company.name}</div>
            {company.address && <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{company.address}</div>}
          </div>
        )}
        <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Version {APP_VERSION}</div>
      </div>
    </div>
  );
}
