import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, MapPin, Users, Clock, Route as RouteIcon } from 'lucide-react';
import { getEmployeeProfile } from '../api/auth';
import type { EmployeeProfile as EmployeeProfileData } from '../api/types';
import { useToast } from '../context/ToastContext';

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
      <span style={{ color: 'var(--blue)' }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="text-[14px] font-medium truncate">{value || '—'}</div>
      </div>
    </div>
  );
}

export default function EmployeeProfile() {
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState<EmployeeProfileData | null>(null);

  useEffect(() => {
    getEmployeeProfile()
      .then(setProfile)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load profile'));
  }, [toast]);

  return (
    <div className="app-shell pb-10">
      <header className="bg-[#004b87] text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1">
          <ArrowLeft size={22} />
        </button>
        <div className="font-bold">Employee Profile</div>
      </header>

      {!profile ? (
        <div className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <div className="card m-3 p-4">
          <Row icon={<Phone size={18} />} label="Contact" value={profile.contact} />
          <Row icon={<Mail size={18} />} label="Email" value={profile.email} />
          <Row icon={<RouteIcon size={18} />} label="Route" value={profile.route} />
          <Row icon={<MapPin size={18} />} label="Nodal Point" value={profile.nodalPoint || profile.location} />
          <Row icon={<Users size={18} />} label="Manager" value={profile.manager} />
          <Row icon={<Clock size={18} />} label="Shift" value={`${profile.shiftLogin || '—'} - ${profile.shiftLogout || '—'}`} />
        </div>
      )}
    </div>
  );
}
