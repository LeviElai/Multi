export async function sha256(text: string | Uint8Array): Promise<string> {
  const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)));
}
export function hex(bytes: Uint8Array): string { return [...bytes].map(value => value.toString(16).padStart(2, '0')).join(''); }
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
