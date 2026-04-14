import React, { useState, useEffect, useRef } from 'react';

/**
 * NumberInput — controlled numeric input that fixes two UX bugs of plain
 * <input type="number"> paired with Number(e.target.value):
 *
 *   1. Can't clear the field to empty: Number('') coerces to 0 and the input
 *      snaps back to "0".
 *   2. Typing produces leading zeros (e.g. "10" → "010"): when initial value
 *      is 0 and the user types before/after it, the Number() roundtrip can
 *      visually desync from the underlying string.
 *
 * The fix is to keep a LOCAL STRING buffer for the input while the user is
 * typing, and only flush to the parent's numeric state when the string parses
 * to a valid number. Blur re-syncs the display to the parent value.
 *
 * Pass all remaining props (className, placeholder, step, min, max...) through
 * to the underlying <input>.
 */
export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onChange: (value: number) => void;
  /** Value used when the input is cleared (blank). Defaults to 0. */
  emptyValue?: number;
  /** Allow decimals (default true). Set false for integer-only fields. */
  allowDecimal?: boolean;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  emptyValue = 0,
  allowDecimal = true,
  onBlur,
  onFocus,
  ...rest
}) => {
  const [buffer, setBuffer] = useState<string>(() => String(value));
  const isFocused = useRef(false);

  // Sync external value → buffer, but only when NOT focused. This prevents
  // the parent's onChange echo from rewriting the user's partially-typed text.
  useEffect(() => {
    if (!isFocused.current) {
      setBuffer(String(value));
    } else {
      // If user's current buffer parses to a different number than the incoming
      // external value (e.g. parent did a hard reset), accept the new value.
      const parsed = Number(buffer);
      if (!Number.isNaN(parsed) && parsed !== value && buffer !== '-') {
        // Only sync if meaningful change from parent (e.g. programmatic reset)
        // We detect this via onChange not matching — but simpler: just trust
        // the focused buffer and let blur reconcile.
      }
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setBuffer(raw);

    // Allow empty string or sign-only while typing
    if (raw === '' || raw === '-' || raw === '.') {
      onChange(emptyValue);
      return;
    }

    // Reject non-numeric input silently (type="number" browsers will usually
    // have already filtered this, but we guard anyway).
    const parsed = allowDecimal ? parseFloat(raw) : parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      onChange(parsed);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocused.current = true;
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocused.current = false;
    // On blur, normalize the buffer to match the parent's value.
    // This strips leading zeros ("010" → "10") and empties → emptyValue.
    if (buffer === '' || buffer === '-' || buffer === '.') {
      setBuffer(String(emptyValue));
      onChange(emptyValue);
    } else {
      const parsed = allowDecimal ? parseFloat(buffer) : parseInt(buffer, 10);
      if (Number.isFinite(parsed)) {
        setBuffer(String(parsed));
      } else {
        setBuffer(String(value));
      }
    }
    onBlur?.(e);
  };

  return (
    <input
      type="number"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={buffer}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...rest}
    />
  );
};
