import { PixelSprite } from '../apps/web/components/world/Sprites';

export default function Loading() {
  return <main className="page auth-check" aria-busy="true" role="status">
    <PixelSprite kind="star"/><h1>Opening MULTIGAME…</h1>
    <div className="loading-blocks" aria-hidden="true"><i/><i/><i/></div>
  </main>;
}
