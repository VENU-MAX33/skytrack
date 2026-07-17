import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export default function FormField({ label, error, required, children }: FormFieldProps) {
  const generatedId = useId();
  const errorId = `${generatedId}-error`;
  const control = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const element = child as ReactElement<Record<string, unknown>>;
    return cloneElement(element, {
      id: generatedId,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? errorId : element.props['aria-describedby'],
      required: required || element.props.required || undefined,
    });
  });
  return (
    <div>
      <label htmlFor={generatedId} className="block text-[13px] text-[#595959] mb-1">
        {label}
        {required && <span className="text-[#D22630] ml-0.5">*</span>}
      </label>
      {control}
      {error && <p id={errorId} role="alert" className="text-[11px] text-[#D22630] mt-1">{error}</p>}
    </div>
  );
}
