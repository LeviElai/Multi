/** Produce reviewable SQL only. Deployment operator applies after the v3 backend is live. */
import {writeFileSync} from 'node:fs';
import {selectDailyArcade} from '../apps/game-service/src/daily-arcade';
const day=process.argv[2];
if(!/^\d{4}-\d{2}-\d{2}$/.test(day??''))throw Error('Supply UTC day YYYY-MM-DD');
const questions=JSON.stringify(selectDailyArcade(day)).replaceAll("'","''");
const sql=`-- Apply only after the snapshot-aware speed-v3 backend is live and verified.
BEGIN;
LOCK TABLE multigame.daily_challenges, multigame.daily_attempts IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD') <> '${day}' THEN RAISE EXCEPTION 'Cutover date has changed'; END IF;
 IF EXISTS(SELECT 1 FROM multigame.daily_attempts WHERE day='${day}' AND ranked=1) THEN RAISE EXCEPTION 'Ranked attempts exist; preserve this event until reset'; END IF;
 IF NOT EXISTS(SELECT 1 FROM multigame.daily_challenges WHERE day='${day}' AND status='published') THEN RAISE EXCEPTION 'Expected published challenge missing'; END IF;
END $$;
-- Freeze any old practice starts created since the additive migration.
UPDATE multigame.daily_attempts a SET challenge_snapshot=jsonb_build_object('day',c.day,'version',c.version,'title',c.title,'questions',c.questions,'status',c.status,'scoring_version',c.scoring_version)::text FROM multigame.daily_challenges c WHERE a.day=c.day AND a.day='${day}' AND a.challenge_snapshot IS NULL;
UPDATE multigame.daily_challenges SET version=3,scoring_version='daily-speed-v3',questions='${questions}',prepared_at=to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') WHERE day='${day}';
COMMIT;
`;
writeFileSync('docs/rescue/release/daily-skill-cutover.sql',sql);
