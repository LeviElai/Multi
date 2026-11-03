'use client';
import { Header, Footer } from './Brand';
import JoinForm from './JoinForm';
import { PixelSprite } from './world/Sprites';
import styles from './Join.module.css';

export default function Join({ initialPin = '' }: { initialPin?: string }) {
  return <div className={styles.page}><Header/><main className={styles.content}>
    <section className={styles.card} aria-labelledby="join-title">
      <div className={styles.title}><PixelSprite kind="fish"/><h1 id="join-title">Join a game</h1></div>
      <JoinForm initialPin={initialPin}/>
    </section>
  </main><Footer/></div>;
}
