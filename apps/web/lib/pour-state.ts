/** A pour is visible only after the server acknowledges it. Queueing never awards objects. */
export class PourQueue {
  accepted: number;
  requested: number;
  pending = false;
  failed = false;
  private active = true;
  get enabled() { return this.active; }
  set enabled(value: boolean) {
    if (!value) this.requested = this.accepted;
    this.active = value;
  }
  constructor(initial: number, private send: (count: number) => Promise<number>, private changed: () => void, private confirmed = true) {
    this.accepted = this.requested = initial;
  }
  reconcile(count: number) {
    this.confirmed = true;
    this.accepted = Math.max(this.accepted, count);
    this.requested = Math.max(this.requested, this.accepted);
    this.changed();
  }
  add(amount: number, maximum: number) {
    if (!this.enabled) return;
    this.requested = Math.min(maximum, this.requested + amount);
    void this.flush();
  }
  async flush(): Promise<void> {
    if (!this.enabled || this.pending || (this.confirmed && this.requested <= this.accepted)) return;
    this.pending = true;
    this.failed = false;
    this.changed();
    try {
      while (this.enabled && (!this.confirmed || this.requested > this.accepted)) {
        const sent = this.requested;
        const accepted = await this.send(sent);
        this.confirmed = true;
        this.accepted = Math.max(this.accepted, accepted);
        this.requested = Math.max(this.requested, this.accepted);
        this.changed();
      }
    } catch {
      this.failed = true;
    } finally {
      this.pending = false;
      this.changed();
    }
  }
}
/** A bounded visual representation with exact represented mass; no hidden truncation. */
export function pourRepresentation(count: number) {
  const unit = count <= 96 ? 1 : 10 ** Math.ceil(Math.log10(count / 96));
  const pieces = Math.ceil(count / unit);
  const finalFraction = pieces ? (count - (pieces - 1) * unit) / unit : 0;
  return {unit, pieces, finalFraction};
}

/** Hold rate depends on elapsed time, not browser frame/timer delivery frequency. */
export function holdPourTotal(elapsedMs:number,flow=1) {
  return elapsedMs<300?1:1+(1+Math.floor((elapsedMs-300)/100))*flow;
}
