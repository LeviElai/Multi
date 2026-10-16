import type { Store } from '../../../packages/db/src/types';
import { GameEngine } from '../../game-service/src/engine';

/** Call on an interval or platform scheduled trigger. Also run on game-service
 * startup; any number of workers may call it safely because transitions use CAS. */
export async function reconcileOverdueSessions(store: Store, now = Date.now()): Promise<{ reconciled: number }> {
  return new GameEngine(store, () => now).reconcile();
}
