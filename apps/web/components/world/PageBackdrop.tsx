'use client';

import { usePathname } from 'next/navigation';
import styles from './PageBackdrop.module.css';

/** One viewport-sized world, independent of the length of the page above it. */
export function PageBackdrop() {
  const path = usePathname() || '/';
  const theme = path === '/' ? 'plaza'
    : path === '/join' ? 'harbor'
    : path.startsWith('/daily/archive') ? 'journal'
    : path.startsWith('/daily') ? 'quest'
    : /^\/(community|library|create|quiz)(\/|$)/.test(path) ? 'library'
    : /^\/(account|login|register|reset-password)(\/|$)/.test(path) ? 'workshop'
    : 'quiet';
  return <div className={`${styles.world} ${styles[theme]}`} aria-hidden="true">
    <div className={styles.art}/>
    {theme !== 'quiet' && <div className={styles.lights}><i/><i/><i/><i/></div>}
  </div>;
}
