import Link from 'next/link';
export function ScreenLinks(){return <nav className="screen-links"><Link href="/leaderboard">Leaderboard</Link><Link href="/leaderboard?view=rules">Regler</Link><Link href="/leaderboard?view=info">Info</Link></nav>}
export function Brand(){return <Link className="brand" href="/" aria-label="Odense Bulldogs · til spillet"><img src="/assets/bulldogs-logo.png" alt="Odense Bulldogs"/><span>ODENSE BULLDOGS<small>PAUSESPILLET</small></span></Link>;}
export function Footer(){return <footer><span>ÉT HOLD. ÉN BY. ODENSE.</span><nav><Link href="/leaderboard">Storskærm</Link><Link href="/leaderboard?view=rules">Regler</Link><Link href="/leaderboard?view=info">Info</Link><Link href="/admin">Personale</Link></nav></footer>;}
