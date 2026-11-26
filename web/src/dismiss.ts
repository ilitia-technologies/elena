import {useEffect, type RefObject} from 'react';

/** Closes an open popover on a click outside `wrap` or on Escape (focus then goes back to `button`). */
export function useDismiss(open: boolean, close: () => void, wrap: RefObject<HTMLElement | null>, button?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
      button?.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close, wrap, button]);
}
