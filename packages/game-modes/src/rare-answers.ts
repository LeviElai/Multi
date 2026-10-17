import { assertPlainText, compareText, invalid, issue, normalizeAnswer, points } from './shared';
import type { RareRound } from './shared';
import type { Adjudication, ReviewItem, ValidationIssue } from '../../contracts/src/index';

type Canonical = { key: string; label: string };
type Resolution = { status: 'accepted'; canonical: Canonical } | { status: 'rejected' | 'pending' };

export function sanitizeRare(text: unknown): string {
  const clean = assertPlainText(text);
  if (!normalizeAnswer(clean) || !/[\p{L}\p{N}]/u.test(clean)) invalid('Enter an answer containing letters or numbers.');
  return clean;
}

export function validateRare(round: RareRound): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const aliases = new Map<string, string>();
  if (round.publicConfig.adjudication === 'allowlist' && !round.secretConfig.answers.length) {
    errors.push(issue(round, 'secretConfig.answers', 'An allowlist round needs at least one approved answer.'));
  }
  round.secretConfig.answers.forEach((entry, index) => {
    let canonical: string;
    try { canonical = normalizeAnswer(sanitizeRare(entry.canonical)); }
    catch { errors.push(issue(round, `secretConfig.answers.${index}.canonical`, 'Canonical answers must contain safe, visible text.')); return; }
    [entry.canonical, ...entry.aliases].forEach((alias, aliasIndex) => {
      let key: string;
      try { key = normalizeAnswer(sanitizeRare(alias)); }
      catch { errors.push(issue(round, `secretConfig.answers.${index}.${aliasIndex ? `aliases.${aliasIndex - 1}` : 'canonical'}`, 'Aliases must contain safe, visible text.')); return; }
      const existing = aliases.get(key);
      if (existing && existing !== canonical) {
        errors.push(issue(round, `secretConfig.answers.${index}.aliases`, `“${alias}” maps to more than one canonical answer.`));
      } else aliases.set(key, canonical);
    });
  });
  return errors;
}

function makeCatalog(round: RareRound): Map<string, Canonical> {
  const catalog = new Map<string, Canonical>();
  round.secretConfig.answers.forEach(entry => {
    const label = sanitizeRare(entry.canonical);
    const canonical = { key: normalizeAnswer(label), label };
    [entry.canonical, ...entry.aliases].forEach(alias => catalog.set(normalizeAnswer(alias), canonical));
  });
  return catalog;
}

/** One insertion, deletion, substitution or adjacent swap; never fuzzy-match numbers
 * or very short names. Ambiguous corrections require a host decision. */
function minorTypo(a:string,b:string):boolean{
  if(Math.min(a.length,b.length)<4||Math.abs(a.length-b.length)>1||/\d/u.test(a+b))return false;
  if(Math.min(a.length,b.length)<6&&a[0]!==b[0])return false;
  if(a.length===b.length){
    const different:number[]=[];
    for(let i=0;i<a.length;i++)if(a[i]!==b[i]){different.push(i);if(different.length>2)return false;}
    if(different.length===1)return true;
    const [i,j]=different;
    return different.length===2&&j===i+1&&a[i]===b[j]&&a[j]===b[i];
  }
  const shorter=a.length<b.length?a:b,longer=a.length<b.length?b:a;
  let i=0;while(i<shorter.length&&shorter[i]===longer[i])i++;
  return shorter.slice(i)===longer.slice(i+1);
}
function typoMatch(key:string,catalog:Map<string,Canonical>):Resolution|null{
  const candidates=new Map<string,Canonical>();
  for(const [alias,canonical]of catalog)if(minorTypo(key,alias))candidates.set(canonical.key,canonical);
  return candidates.size===1?{status:'accepted',canonical:[...candidates.values()][0]}:candidates.size>1?{status:'pending'}:null;
}

/** Latest decision wins; tie order is deterministic and independent of array order. */
function latestDecisions(round: RareRound, adjudications: Adjudication[]): Map<string, Adjudication> {
  const result = new Map<string, Adjudication>();
  const sorted = adjudications.filter(item => item.roundId === round.id).slice()
    .sort((a, b) => compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id));
  sorted.forEach(item => result.set(normalizeAnswer(item.answerKey), item));
  return result;
}

function resolve(key: string, round: RareRound, catalog: Map<string, Canonical>, decisions: Map<string, Adjudication>, reviewAmbiguous:boolean): Resolution {
  let current = key;
  let approved = false;
  let label = key;
  const seen: string[] = [];
  for (;;) {
    if (seen.includes(current)) {
      // Accepted alias cycles are one canonical bucket, never multiple rewards.
      const canonicalKey = seen.slice(seen.indexOf(current)).sort(compareText)[0];
      return { status: 'accepted', canonical: { key: canonicalKey, label: catalog.get(canonicalKey)?.label ?? canonicalKey } };
    }
    seen.push(current);
    const decision = decisions.get(current);
    if (decision?.decision === 'reject') return { status: 'rejected' };
    if (decision?.decision === 'accept') {
      try { label = sanitizeRare(decision.canonical); }
      catch { return { status: 'pending' }; }
      const next = normalizeAnswer(label);
      approved = true;
      if (next === current) return { status: 'accepted', canonical: catalog.get(current) ?? { key: current, label } };
      current = next;
      continue;
    }
    const known = catalog.get(current);
    if (known) return { status: 'accepted', canonical: known };
    if (approved) return { status: 'accepted', canonical: { key: current, label } };
    const corrected=typoMatch(current,catalog);
    if(corrected)return corrected.status==='pending'&&!reviewAmbiguous?{status:'rejected'}:corrected;
    return { status: round.publicConfig.adjudication === 'host_review' ? 'pending' : 'rejected' };
  }
}

export function scoreRare(
  round: RareRound,
  submitted: Map<string, string>,
  adjudications: Adjudication[],
  reviewAmbiguous=true,
): {
  results: Map<string, { points: number; reason: string; canonical?: string; frequency?: number; acceptedPlayers?: number }>;
  review: ReviewItem[];
  groups: { answer: string; count: number; points: number }[];
} {
  const catalog = makeCatalog(round);
  const decisions = latestDecisions(round, adjudications);
  const resolved = new Map<string, Resolution>();
  const reviewMap = new Map<string, ReviewItem>();
  const frequencies = new Map<string, { label: string; count: number }>();
  for (const [participantId, text] of submitted) {
    const key = normalizeAnswer(text);
    const resolution = resolve(key, round, catalog, decisions, reviewAmbiguous);
    resolved.set(participantId, resolution);
    if (resolution.status === 'pending') {
      const previous = reviewMap.get(key);
      reviewMap.set(key, { answerKey: key, text: previous?.text ?? text, count: (previous?.count ?? 0) + 1 });
    } else if (resolution.status === 'accepted') {
      const { key: canonicalKey, label } = resolution.canonical;
      const previous = frequencies.get(canonicalKey);
      frequencies.set(canonicalKey, { label, count: (previous?.count ?? 0) + 1 });
    }
  }
  const review = [...reviewMap.values()].sort((a, b) => compareText(a.answerKey, b.answerKey));
  const acceptedPlayers = [...frequencies.values()].reduce((sum, group) => sum + group.count, 0);
  // A valid answer earns 200. Two virtual matches soften the rarity bonus when
  // the sample is small: two different valid answers earn 400 each, not 1000.
  const scoreFrequency = (frequency: number) => review.length ? 0
    : points(200 + 800 * (acceptedPlayers - frequency) / (acceptedPlayers + 2));
  const results = new Map<string, { points: number; reason: string; canonical?: string; frequency?: number; acceptedPlayers?: number }>();
  for (const [participantId, resolution] of resolved) {
    if (review.length) {
      results.set(participantId, { points: 0, reason: 'awaiting_review' });
    } else if (resolution.status === 'accepted') {
      const frequency = frequencies.get(resolution.canonical.key)!.count;
      results.set(participantId, { points: scoreFrequency(frequency), reason: 'accepted_rare', canonical: resolution.canonical.label, frequency, acceptedPlayers });
    } else results.set(participantId, { points: 0, reason: 'invalid_answer' });
  }
  const groups = [...frequencies.values()].sort((a, b) => a.count - b.count || compareText(a.label, b.label))
    .map(group => ({ answer: group.label, count: group.count, points: scoreFrequency(group.count) }));
  return { results, review, groups };
}
