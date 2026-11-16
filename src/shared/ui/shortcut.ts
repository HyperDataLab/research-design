/** The palette shortcut as this platform writes it. */
export const SEARCH_SHORTCUT =
  typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
