import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export default function FormField({ label, error, required, children }: FormFieldProps) {
  return (
    <div>
      <label className="block text-[13px] text-[#777777] mb-1">
        {label}
        {required && <span className="text-[#D22630] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-[#D22630] mt-1">{error}</p>}
    </div>
  );
}
