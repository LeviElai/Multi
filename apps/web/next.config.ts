// The Sites adapter and self-hosted Next deployment intentionally share one app
// source tree at the repository root. Package scripts pass that root explicitly.
// Root next.config.ts is the authoritative configuration for both commands.
export { default } from '../../next.config';
