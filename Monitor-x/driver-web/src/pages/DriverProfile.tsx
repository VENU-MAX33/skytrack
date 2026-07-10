import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// BadgeCheck stands in for IdCard, which doesn't exist in lucide-react 0.378
import { ArrowLeft, Phone, Mail, Building2, BadgeCheck, Car } from 'lucide-react';
import { getDriverProfile } from '../api/auth';
import type { DriverProfile as DriverProfileData } from '../api/types';
import { useToast } from '../context/ToastContext';

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
      <span style={{ color: 'var(--purple)' }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="text-[14px] font-medium truncate">{value || '—'}</div>
      </div>
    </div>
  );
}

export default function DriverProfile() {
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState<DriverProfileData | null>(null);

  useEffect(() => {
    getDriverProfile()
      .then(setProfile)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load profile'));
  }, [toast]);

  return (
    <div className="app-shell pb-10">
      <header className="bg-[#6a5ca1] text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1">
          <ArrowLeft size={22} />
        </button>
        <div className="font-bold">Driver Profile</div>
      </header>

      {!profile ? (
        <div className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <div className="card m-3 p-4">
          <Row icon={<Phone size={18} />} label="Contact" value={profile.contact} />
          <Row icon={<Mail size={18} />} label="Email" value={profile.email} />
          <Row icon={<Building2 size={18} />} label="Vendor" value={profile.vendor} />
          <Row
            icon={<BadgeCheck size={18} />}
            label={profile.badgeNumber ? 'Badge No.' : 'DL No.'}
            value={profile.badgeNumber || profile.dlNumber}
          />
          <div className="flex items-center gap-3 py-3">
            <span style={{ color: 'var(--purple)' }}><Car size={18} /></span>
            <div className="min-w-0">
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Vehicle</div>
              <div className="text-[14px] font-medium truncate">
                {profile.vehicle ? `${profile.vehicle.rtoNo} · ${profile.vehicle.model}` : 'No vehicle assigned'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
