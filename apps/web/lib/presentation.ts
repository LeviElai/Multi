/** Presentation-only helpers. They never calculate or replace authoritative scores. */
export function normalizePin(value: string): string { return value.replace(/\D/g, '').slice(0, 6); }
export function rarityZone(count: number): 'surface' | 'reef' | 'deep' { return count === 1 ? 'deep' : count <= 3 ? 'reef' : 'surface'; }
export function remainingSeconds(deadline: string | null | undefined, pausedMs: number | null | undefined, offset: number, now = Date.now()): number {
    return deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - now - offset) / 1000)) : Math.max(0, Math.ceil((pausedMs ?? 0) / 1000));
}
