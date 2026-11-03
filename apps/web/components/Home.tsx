'use client';
import Link from 'next/link';
import {Header,Footer} from './Brand';
import {DailyEntrance} from './DailyChallenge';
import {PixelSprite} from './world/Sprites';
import styles from './Home.module.css';
export default function Home(){
 return <div className={styles.world}><Header/><main className={styles.menu} aria-label="Game menu"><DailyEntrance/><section className={styles.friends}><div className={styles.friendsArt} aria-hidden="true"><PixelSprite kind="fish"/><PixelSprite kind="word_puzzle"/><PixelSprite kind="claw"/></div><h1>Play with friends</h1><div className={styles.actions}><Link className="btn btn-primary" href="/join">Join a game</Link><Link className="btn btn-outline" href="/community">Host a game</Link></div></section></main><Footer/></div>;
}
