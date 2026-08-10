import React, { useState, useCallback, useRef } from 'react';
import { TooltippedIconButton } from '../mui-extras';

enum CopyStatus { None, Copying, Copied, Disabled }

export function CopyButton(props: { value: string; className?: string }): JSX.Element {
  const isCopyDisabled = navigator.clipboard === undefined;
  const [copyStatus, setCopyStatus] = useState(isCopyDisabled ? CopyStatus.Disabled : CopyStatus.None);
  const timeoutId = useRef<number | null>(null);

  const copy = useCallback(async () => {
    if (copyStatus === CopyStatus.Copying) return;
    try { await navigator.clipboard.writeText(props.value); } catch { setCopyStatus(CopyStatus.None); return; }
    setCopyStatus(CopyStatus.Copied);
    if (timeoutId.current) clearTimeout(timeoutId.current);
    timeoutId.current = window.setTimeout(() => setCopyStatus(CopyStatus.None), 1000);
  }, [copyStatus, props.value]);

  const tooltip = { [CopyStatus.None]: 'Copy to clipboard', [CopyStatus.Copying]: 'Copying...', [CopyStatus.Copied]: 'Copied!', [CopyStatus.Disabled]: 'Copy disabled' }[copyStatus];

  return (
    <TooltippedIconButton disabled={isCopyDisabled} className={props.className} tooltip={tooltip} placement="top"
      onClick={copy} aria-label="Copy to clipboard" inputToolbar={false}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
    </TooltippedIconButton>
  );
}
