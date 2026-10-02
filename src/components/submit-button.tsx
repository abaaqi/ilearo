"use client";

import { useFormStatus } from "react-dom";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string };

/** A submit button that disables itself while its form's action runs. */
export function SubmitButton({ children, pendingLabel, disabled, ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" {...rest} disabled={disabled || pending} aria-disabled={disabled || pending}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
