-- All objects are confined to MULTIGAME. Existing ELIX objects are untouched.
CREATE TABLE IF NOT EXISTS multigame.daily_verified_pool(id text PRIMARY KEY,question jsonb NOT NULL);
ALTER TABLE multigame.daily_verified_pool ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON multigame.daily_verified_pool FROM PUBLIC,anon,authenticated;
INSERT INTO multigame.daily_verified_pool(id,question) VALUES
('taj-country','{"id":"taj-country","question":"In which country is the Taj Mahal?","options":["India","Nepal","Pakistan","Bangladesh"],"answer":0,"category":"Geography","difficulty":"easy","sourceUrl":"https://whc.unesco.org/en/list/252","explanation":"India. See the linked primary source."}'::jsonb),
('taj-city','{"id":"taj-city","question":"Which city is home to the Taj Mahal?","options":["Agra","Mumbai","Jaipur","Delhi"],"answer":0,"category":"Culture","difficulty":"medium","sourceUrl":"https://whc.unesco.org/en/list/252","explanation":"Agra. See the linked primary source."}'::jsonb),
('taj-material','{"id":"taj-material","question":"Which material gives the Taj Mahal its famous white exterior?","options":["Marble","Limestone","Granite","Sandstone"],"answer":0,"category":"Culture","difficulty":"medium","sourceUrl":"https://whc.unesco.org/en/list/252","explanation":"Marble. See the linked primary source."}'::jsonb),
('angkor-country','{"id":"angkor-country","question":"In which country would you visit Angkor?","options":["Cambodia","Thailand","Vietnam","Laos"],"answer":0,"category":"Geography","difficulty":"medium","sourceUrl":"https://whc.unesco.org/en/list/668/","explanation":"Cambodia. See the linked primary source."}'::jsonb),
('angkor-kingdom','{"id":"angkor-kingdom","question":"Angkor was a major centre of which kingdom?","options":["Khmer","Inca","Mali","Aztec"],"answer":0,"category":"History","difficulty":"challenging","sourceUrl":"https://whc.unesco.org/en/list/668/","explanation":"Khmer. See the linked primary source."}'::jsonb),
('machu-country','{"id":"machu-country","question":"In which country is Machu Picchu?","options":["Peru","Chile","Bolivia","Ecuador"],"answer":0,"category":"Geography","difficulty":"easy","sourceUrl":"https://whc.unesco.org/en/list/274","explanation":"Peru. See the linked primary source."}'::jsonb),
('machu-civilization','{"id":"machu-civilization","question":"Which civilization built Machu Picchu?","options":["Inca","Maya","Aztec","Olmec"],"answer":0,"category":"History","difficulty":"medium","sourceUrl":"https://whc.unesco.org/en/list/274","explanation":"Inca. See the linked primary source."}'::jsonb),
('great-wall','{"id":"great-wall","question":"The Great Wall is a landmark of which country?","options":["China","Japan","Mongolia","South Korea"],"answer":0,"category":"Geography","difficulty":"easy","sourceUrl":"https://whc.unesco.org/en/list/438","explanation":"China. See the linked primary source."}'::jsonb),
('nobel-first','{"id":"nobel-first","question":"In which year were the first Nobel Prizes awarded?","options":["1901","1895","1912","1920"],"answer":0,"category":"History","difficulty":"challenging","sourceUrl":"https://www.nobelprize.org/nobel_organizations/nobelfoundation/history/","explanation":"1901. See the linked primary source."}'::jsonb),
('nobel-founder','{"id":"nobel-founder","question":"Whose will established the Nobel Prizes?","options":["Alfred Nobel","Albert Einstein","Marie Curie","Thomas Edison"],"answer":0,"category":"Culture","difficulty":"medium","sourceUrl":"https://www.nobelprize.org/nobel_organizations/nobelfoundation/history/","explanation":"Alfred Nobel. See the linked primary source."}'::jsonb),
('nobel-month','{"id":"nobel-month","question":"In which month are Nobel laureates traditionally announced?","options":["October","January","June","December"],"answer":0,"category":"Culture","difficulty":"challenging","sourceUrl":"https://www.nobelprize.org/nobel_organizations/nobelfoundation/history/","explanation":"October. See the linked primary source."}'::jsonb),
('olympic-city','{"id":"olympic-city","question":"Which city hosted the first modern Olympic Games in 1896?","options":["Athens","Paris","Rome","London"],"answer":0,"category":"Sport","difficulty":"medium","sourceUrl":"https://olympicgames.culture.gov.gr/en/revival.html","explanation":"Athens. See the linked primary source."}'::jsonb),
('olympic-rings','{"id":"olympic-rings","question":"How many interlocking rings form the Olympic symbol?","options":["5","4","6","7"],"answer":0,"category":"Sport","difficulty":"easy","sourceUrl":"https://www.hoc.gr/en/olympic-games-symbols/","explanation":"5. See the linked primary source."}'::jsonb),
('olympic-winter','{"id":"olympic-winter","question":"In which year were the first Winter Olympic Games held?","options":["1924","1896","1936","1948"],"answer":0,"category":"Sport","difficulty":"challenging","sourceUrl":"https://olympicgames.culture.gov.gr/en/revival.html","explanation":"1924. See the linked primary source."}'::jsonb),
('olympic-together','{"id":"olympic-together","question":"Which word was added to the Olympic motto in 2021?","options":["Together","Forever","Braver","Fairer"],"answer":0,"category":"Sport","difficulty":"medium","sourceUrl":"https://www.hoc.gr/en/olympic-games-symbols/","explanation":"Together. See the linked primary source."}'::jsonb),
('planet-nearest','{"id":"planet-nearest","question":"Which planet orbits closest to the Sun?","options":["Mercury","Venus","Earth","Mars"],"answer":0,"category":"Space","difficulty":"easy","sourceUrl":"https://science.nasa.gov/solar-system/planets/","explanation":"Mercury. See the linked primary source."}'::jsonb),
('planet-smallest','{"id":"planet-smallest","question":"Which of the eight planets is the smallest?","options":["Mercury","Mars","Venus","Neptune"],"answer":0,"category":"Space","difficulty":"medium","sourceUrl":"https://science.nasa.gov/solar-system/planets/","explanation":"Mercury. See the linked primary source."}'::jsonb),
('planet-largest','{"id":"planet-largest","question":"Which planet is the largest in our solar system?","options":["Jupiter","Saturn","Neptune","Uranus"],"answer":0,"category":"Space","difficulty":"easy","sourceUrl":"https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/","explanation":"Jupiter. See the linked primary source."}'::jsonb),
('pluto-year','{"id":"pluto-year","question":"In which year was Pluto reclassified as a dwarf planet?","options":["2006","1999","2012","1986"],"answer":0,"category":"Space","difficulty":"medium","sourceUrl":"https://science.nasa.gov/solar-system/planets/","explanation":"2006. See the linked primary source."}'::jsonb),
('ceres-location','{"id":"ceres-location","question":"The dwarf planet Ceres lies in the asteroid belt between which planets?","options":["Mars and Jupiter","Earth and Mars","Jupiter and Saturn","Saturn and Uranus"],"answer":0,"category":"Space","difficulty":"medium","sourceUrl":"https://science.nasa.gov/solar-system/planets/","explanation":"Mars and Jupiter. See the linked primary source."}'::jsonb),
('mars-moons','{"id":"mars-moons","question":"How many natural moons does Mars have?","options":["2","1","3","4"],"answer":0,"category":"Numbers","difficulty":"medium","sourceUrl":"https://science.nasa.gov/mars/facts/","explanation":"2. See the linked primary source."}'::jsonb),
('mars-phobos','{"id":"mars-phobos","question":"Phobos and Deimos orbit which planet?","options":["Mars","Venus","Jupiter","Neptune"],"answer":0,"category":"Space","difficulty":"medium","sourceUrl":"https://science.nasa.gov/mars/facts/","explanation":"Mars. See the linked primary source."}'::jsonb),
('mars-volcano','{"id":"mars-volcano","question":"What is the name of the largest volcano in the solar system?","options":["Olympus Mons","Mauna Loa","Mount Etna","Mount Fuji"],"answer":0,"category":"Space","difficulty":"challenging","sourceUrl":"https://science.nasa.gov/mars/facts/","explanation":"Olympus Mons. See the linked primary source."}'::jsonb),
('venus-hot','{"id":"venus-hot","question":"Which planet has the hottest surface in our solar system?","options":["Venus","Mercury","Mars","Jupiter"],"answer":0,"category":"Space","difficulty":"medium","sourceUrl":"https://science.nasa.gov/venus/venus-facts/","explanation":"Venus. See the linked primary source."}'::jsonb),
('venus-gas','{"id":"venus-gas","question":"Which gas makes up most of the atmosphere of Venus?","options":["Carbon dioxide","Oxygen","Hydrogen","Helium"],"answer":0,"category":"Science","difficulty":"challenging","sourceUrl":"https://science.nasa.gov/venus/venus-facts/","explanation":"Carbon dioxide. See the linked primary source."}'::jsonb),
('venus-name','{"id":"venus-name","question":"Venus is named after the Roman goddess of what?","options":["Love and beauty","War","Wisdom","The hunt"],"answer":0,"category":"Culture","difficulty":"medium","sourceUrl":"https://science.nasa.gov/venus/venus-facts/","explanation":"Love and beauty. See the linked primary source."}'::jsonb),
('reef-country','{"id":"reef-country","question":"The Great Barrier Reef lies off the coast of which country?","options":["Australia","Indonesia","South Africa","Mexico"],"answer":0,"category":"Nature","difficulty":"easy","sourceUrl":"https://whc.unesco.org/en/list/154/","explanation":"Australia. See the linked primary source."}'::jsonb),
('dugong-name','{"id":"dugong-name","question":"Which marine animal is also known as a sea cow?","options":["Dugong","Dolphin","Sea lion","Walrus"],"answer":0,"category":"Nature","difficulty":"medium","sourceUrl":"https://whc.unesco.org/en/list/154/","explanation":"Dugong. See the linked primary source."}'::jsonb),
('number-gold-number','{"id":"number-gold-number","question":"What is the atomic number of gold?","options":["79","55","104","129"],"answer":0,"category":"Numbers","difficulty":"challenging","sourceUrl":"https://periodic-table.rsc.org/element/79/Gold","explanation":"Gold has atomic number 79."}'::jsonb),
('number-gold-purity','{"id":"number-gold-purity","question":"How many carats describe pure gold?","options":["24","17","32","41"],"answer":0,"category":"Numbers","difficulty":"easy","sourceUrl":"https://periodic-table.rsc.org/element/79/Gold","explanation":"Pure gold is 24-carat gold."}'::jsonb),
('number-un-foundation','{"id":"number-un-foundation","question":"In what year was the United Nations founded?","options":["1945","1925","1935","1955"],"answer":0,"category":"Numbers","difficulty":"easy","sourceUrl":"https://www.un.org/en/about-us","explanation":"The United Nations was founded in 1945."}'::jsonb),
('number-un-original-members','{"id":"number-un-original-members","question":"How many member states did the United Nations have when it was founded in 1945?","options":["51","36","67","85"],"answer":0,"category":"Numbers","difficulty":"challenging","sourceUrl":"https://www.un.org/en/about-us","explanation":"The UN began with 51 member states in 1945."}'::jsonb),
('number-carbon-number','{"id":"number-carbon-number","question":"What is the atomic number of carbon?","options":["6","4","9","13"],"answer":0,"category":"Numbers","difficulty":"easy","sourceUrl":"https://periodic-table.rsc.org/element/6/carbon","explanation":"The Royal Society of Chemistry lists atomic number 6."}'::jsonb),
('number-oxygen-number','{"id":"number-oxygen-number","question":"What is the atomic number of oxygen?","options":["8","6","11","16"],"answer":0,"category":"Numbers","difficulty":"easy","sourceUrl":"https://periodic-table.rsc.org/element/8/oxygen","explanation":"The Royal Society of Chemistry lists atomic number 8."}'::jsonb)
ON CONFLICT(id) DO NOTHING;

CREATE OR REPLACE FUNCTION multigame.preserve_daily_history() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.status='published' THEN RAISE EXCEPTION 'Published daily challenges are immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION multigame.preserve_daily_history() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER daily_history_immutable BEFORE UPDATE OR DELETE ON multigame.daily_challenges FOR EACH ROW EXECUTE FUNCTION multigame.preserve_daily_history();
-- Database fallback uses only the reviewed pool. The AI worker may prepare dates first.
CREATE OR REPLACE FUNCTION multigame.publish_daily_challenges() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d date; canonical text; selected jsonb; ts text:=to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('multigame-daily-publication'));
 FOR d IN SELECT (now() AT TIME ZONE 'UTC')::date + n FROM generate_series(0,2) AS n LOOP
  canonical:=to_char(d,'YYYY-MM-DD');
  IF NOT EXISTS(SELECT 1 FROM multigame.daily_challenges WHERE day=canonical) THEN
   SELECT jsonb_agg(
      jsonb_set(jsonb_set(question,'{options}',shuffled.options),'{answer}',to_jsonb(shuffled.answer))
      ORDER BY md5(canonical||id||'order')) INTO selected FROM (
    SELECT id,question,row_number() OVER(PARTITION BY question->>'difficulty' ORDER BY md5(canonical||id)) AS n FROM multigame.daily_verified_pool
   ) q CROSS JOIN LATERAL (
     SELECT jsonb_agg(option ORDER BY position) AS options,
            max(position-1) FILTER(WHERE original_index=(q.question->>'answer')::int) AS answer
     FROM (SELECT option,ordinality-1 AS original_index,
           row_number() OVER(ORDER BY md5(canonical||q.id||ordinality::text)) AS position
           FROM jsonb_array_elements(q.question->'options') WITH ORDINALITY AS choices(option,ordinality)) shuffled_choices
   ) shuffled WHERE n<=CASE question->>'difficulty' WHEN 'easy' THEN 3 WHEN 'medium' THEN 5 ELSE 2 END;
   IF jsonb_array_length(selected)=10 THEN
    INSERT INTO multigame.daily_challenges(day,title,questions,prepared_at,status) VALUES(canonical,'The Daily Quest',selected::text,ts,'approved') ON CONFLICT DO NOTHING;
   ELSE RAISE EXCEPTION 'Reviewed daily fallback inventory is insufficient'; END IF;
  END IF;
 END LOOP;
 UPDATE multigame.daily_challenges SET status='published',published_at=ts WHERE status='approved' AND day<=to_char((now() AT TIME ZONE 'UTC')::date,'YYYY-MM-DD');
 UPDATE multigame.daily_attempts SET completed_at=ts,question_index=10,response_ms=response_ms+(10-question_index)*20000,revision=revision+1 WHERE ranked=1 AND completed_at IS NULL AND day<to_char((now() AT TIME ZONE 'UTC')::date,'YYYY-MM-DD');
END $$;
REVOKE ALL ON FUNCTION multigame.publish_daily_challenges() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION multigame.publish_daily_challenges() TO postgres;
SELECT multigame.publish_daily_challenges();
