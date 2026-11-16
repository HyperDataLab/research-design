import { useEffect, useState } from 'react';

/** Whether a media query matches now, kept up to date. False where `matchMedia` is missing (tests). */
export function useMediaQuery(query: string): boolean {
  const read = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    const change = () => setMatches(list.matches);
    change();
    list.addEventListener('change', change);
    return () => list.removeEventListener('change', change);
  }, [query]);
  return matches;
}
