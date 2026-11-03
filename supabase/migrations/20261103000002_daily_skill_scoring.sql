-- Additive snapshot; old attempts keep their exact questions and scoring policy.
ALTER TABLE multigame.daily_attempts ADD COLUMN IF NOT EXISTS challenge_snapshot text;
UPDATE multigame.daily_attempts a SET challenge_snapshot=pg_catalog.jsonb_build_object('day',c.day,'version',c.version,'title',c.title,'questions',c.questions,'status',c.status,'scoring_version',c.scoring_version)::text FROM multigame.daily_challenges c WHERE c.day=a.day AND a.challenge_snapshot IS NULL;

-- Version new and unpublished challenges only; historical attempts are never rescored.
-- Rollback: restore publish_daily_challenges from 20261103000001; keep v3 readers until archived.
CREATE OR REPLACE FUNCTION multigame.publish_daily_challenges() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d date; canonical text; selected jsonb; chosen_mode record; picked jsonb; shuffled jsonb; answer_index integer;
 ts text:=to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('multigame-daily-publication'));
 FOR d IN SELECT (now() AT TIME ZONE 'UTC')::date + n FROM pg_catalog.generate_series(0,2) AS n LOOP
  canonical:=pg_catalog.to_char(d,'YYYY-MM-DD');
  IF NOT EXISTS(SELECT 1 FROM multigame.daily_challenges WHERE day=canonical AND (status='published' OR version>=3)) THEN
   selected:='[]'::jsonb;
   FOR chosen_mode IN
    SELECT mode FROM (
     SELECT m.mode,m.family,row_number() OVER(PARTITION BY m.family ORDER BY
      (SELECT count(*) FROM multigame.daily_challenges c,
       pg_catalog.jsonb_array_elements(c.questions::jsonb) q
       WHERE c.version>=2 AND c.day<canonical AND c.day>=pg_catalog.to_char(d-14,'YYYY-MM-DD') AND q->>'mode'=m.mode),
      pg_catalog.md5(canonical||':mode:'||m.mode)) AS position
     FROM (SELECT DISTINCT p.mode,CASE WHEN p.mode IN ('fish','claw','sling','drop') THEN 'action'
       WHEN p.mode IN ('draw','stack','amountle','size_it_up') THEN 'tactile' ELSE 'puzzle' END AS family
       FROM multigame.daily_arcade_pool p) m
    ) balanced
    WHERE (family='puzzle' AND position<=1) OR (family IN ('action','tactile') AND position<=2)
    ORDER BY pg_catalog.md5(canonical||':order:'||mode)
   LOOP
    SELECT p.question INTO picked FROM multigame.daily_arcade_pool p WHERE p.mode=chosen_mode.mode
    ORDER BY CASE WHEN EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(selected) q WHERE q->>'id'=p.id) THEN 1 ELSE 0 END,
      CASE WHEN EXISTS(SELECT 1 FROM multigame.daily_challenges c,
        pg_catalog.jsonb_array_elements(c.questions::jsonb) q
        WHERE c.version>=2 AND c.day<canonical AND c.day>=pg_catalog.to_char(d-4,'YYYY-MM-DD') AND q->>'id'=p.id) THEN 1 ELSE 0 END,
      pg_catalog.md5(canonical||p.mode||p.id) LIMIT 1;
    IF picked IS NULL THEN RAISE EXCEPTION 'Reviewed inventory missing for %',chosen_mode.mode; END IF;
    SELECT pg_catalog.jsonb_agg(option ORDER BY position),
       max(position-1) FILTER(WHERE ordinal=(picked->>'answer')::integer) INTO shuffled,answer_index
      FROM (SELECT option,ordinality-1 AS ordinal,
        row_number() OVER(ORDER BY pg_catalog.md5(canonical||(picked->>'id')||ordinality::text)) AS position
        FROM pg_catalog.jsonb_array_elements(picked->'options') WITH ORDINALITY AS choices(option,ordinality)) ranked_options;
    selected:=selected||pg_catalog.jsonb_build_array(pg_catalog.jsonb_set(pg_catalog.jsonb_set(picked,'{options}',shuffled),'{answer}',pg_catalog.to_jsonb(answer_index)));
   END LOOP;
   IF pg_catalog.jsonb_array_length(selected)<>5 THEN RAISE EXCEPTION 'Five reviewed games required for %',canonical; END IF;
   INSERT INTO multigame.daily_challenges(day,title,questions,version,scoring_version,prepared_at,status)
    VALUES(canonical,'The Daily Quest',selected::text,3,'daily-speed-v3',ts,'approved') ON CONFLICT(day) DO UPDATE
    SET questions=excluded.questions,version=3,scoring_version='daily-speed-v3',prepared_at=ts
    WHERE daily_challenges.status='approved' AND daily_challenges.version<3;
  END IF;
 END LOOP;
 UPDATE multigame.daily_challenges SET status='published',published_at=ts WHERE status='approved'
   AND day<=pg_catalog.to_char((now() AT TIME ZONE 'UTC')::date,'YYYY-MM-DD');
 UPDATE multigame.daily_attempts a SET completed_at=ts,
   question_index=pg_catalog.jsonb_array_length(c.questions::jsonb),
   response_ms=a.response_ms+(pg_catalog.jsonb_array_length(c.questions::jsonb)-a.question_index)*20000,
   revision=a.revision+1 FROM multigame.daily_challenges c WHERE a.day=c.day AND a.ranked=1
   AND a.completed_at IS NULL AND a.day<pg_catalog.to_char((now() AT TIME ZONE 'UTC')::date,'YYYY-MM-DD');
END $$;
REVOKE ALL ON FUNCTION multigame.publish_daily_challenges() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION multigame.publish_daily_challenges() TO postgres;
SELECT multigame.publish_daily_challenges();
