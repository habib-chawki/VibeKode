import { type InputHTMLAttributes, useId } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function TextField({ label, hint, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-describedby={hintId}
        className="h-11 rounded-lg border border-fur/75 bg-surface px-3 text-base text-ink placeholder:text-fur focus-visible:border-ink focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-eye-line"
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-fur">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
