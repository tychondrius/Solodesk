import { useEffect } from 'react';

let openModalCount = 0;

/**
 * Locks background page scrolling while a modal or drawer is open,
 * using CSS classes so nested modals (e.g. ConfirmDialog inside a Drawer)
 * release the lock only when the last overlay closes.
 */
export function useLockBodyScroll(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    openModalCount += 1;
    document.documentElement.classList.add('modal-open');

    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        document.documentElement.classList.remove('modal-open');
      }
    };
  }, [isOpen]);
}
