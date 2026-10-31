import {createHash} from 'node:crypto';
import {DailyQuestionSchema,DailyQuestionsSchema,type DailyQuestion} from './daily';
import {NUMERIC_FACTS,isApproximateFact} from './numeric-facts';
/** Reviewed against the primary source links, 2026-10-25. AI may select IDs;
 * it cannot rewrite a fact, answer, source, or difficulty during publication. */
const rows:[string,string,string[],string,DailyQuestion['difficulty'],string][]=[
 ['petra-country','The rock-cut city of Petra is in which country?',['Jordan','Egypt','Greece','Turkey'],'Geography','medium','https://whc.unesco.org/en/list/326/'],
 ['petra-people','Which people made Petra an important caravan city?',['Nabataeans','Vikings','Incas','Mongols'],'History','challenging','https://whc.unesco.org/en/list/326/'],
 ['acropolis-city','Which city is home to the Acropolis and Parthenon?',['Athens','Rome','Istanbul','Alexandria'],'Culture','easy','https://whc.unesco.org/en/list/404'],
 ['curie-birthplace','In which city was Marie Curie born?',['Warsaw','Paris','Vienna','Prague'],'History','medium','https://www.nobelprize.org/prizes/physics/1903/marie-curie/facts/'],
 ['curie-fields','Marie Curie won Nobel Prizes in which two fields?',['Physics and chemistry','Chemistry and medicine','Physics and peace','Medicine and literature'],'Science','medium','https://www.nobelprize.org/womenwhochangedscience/stories/marie-curie.'],
 ['saturn-size','Which is the second-largest planet in our solar system?',['Saturn','Neptune','Uranus','Earth'],'Space','medium','https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/'],
 ['uranus-position','Counting outward from the Sun, which planet is seventh?',['Uranus','Neptune','Saturn','Jupiter'],'Space','challenging','https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/'],
 ['ice-giants','Which pair of planets are classified as ice giants?',['Uranus and Neptune','Jupiter and Saturn','Earth and Mars','Mercury and Venus'],'Science','medium','https://science.nasa.gov/solar-system/solar-system-facts/'],

 ['taj-country','In which country is the Taj Mahal?',['India','Nepal','Pakistan','Bangladesh'],'Geography','easy','https://whc.unesco.org/en/list/252'],
 ['taj-city','Which city is home to the Taj Mahal?',['Agra','Mumbai','Jaipur','Delhi'],'Culture','medium','https://whc.unesco.org/en/list/252'],
 ['taj-material','Which material gives the Taj Mahal its famous white exterior?',['Marble','Limestone','Granite','Sandstone'],'Culture','medium','https://whc.unesco.org/en/list/252'],
 ['angkor-country','In which country would you visit Angkor?',['Cambodia','Thailand','Vietnam','Laos'],'Geography','medium','https://whc.unesco.org/en/list/668/'],
 ['angkor-kingdom','Angkor was a major centre of which kingdom?',['Khmer','Inca','Mali','Aztec'],'History','challenging','https://whc.unesco.org/en/list/668/'],
 ['machu-country','In which country is Machu Picchu?',['Peru','Chile','Bolivia','Ecuador'],'Geography','easy','https://whc.unesco.org/en/list/274'],
 ['machu-civilization','Which civilization built Machu Picchu?',['Inca','Maya','Aztec','Olmec'],'History','medium','https://whc.unesco.org/en/list/274'],
 ['great-wall','The Great Wall is a landmark of which country?',['China','Japan','Mongolia','South Korea'],'Geography','easy','https://whc.unesco.org/en/list/438'],
 ['nobel-first','In which year were the first Nobel Prizes awarded?',['1901','1895','1912','1920'],'History','challenging','https://www.nobelprize.org/nobel_organizations/nobelfoundation/history/'],
 ['nobel-founder','Whose will established the Nobel Prizes?',['Alfred Nobel','Albert Einstein','Marie Curie','Thomas Edison'],'Culture','medium','https://www.nobelprize.org/nobel_organizations/nobelfoundation/history/'],
 ['nobel-month','In which month are Nobel laureates traditionally announced?',['October','January','June','December'],'Culture','challenging','https://www.nobelprize.org/nobel_organizations/nobelfoundation/history/'],
 ['olympic-city','Which city hosted the first modern Olympic Games in 1896?',['Athens','Paris','Rome','London'],'Sport','medium','https://olympicgames.culture.gov.gr/en/revival.html'],
 ['olympic-rings','How many interlocking rings form the Olympic symbol?',['5','4','6','7'],'Sport','easy','https://www.hoc.gr/en/olympic-games-symbols/'],
 ['olympic-winter','In which year were the first Winter Olympic Games held?',['1924','1896','1936','1948'],'Sport','challenging','https://olympicgames.culture.gov.gr/en/revival.html'],
 ['olympic-together','Which word was added to the Olympic motto in 2021?',['Together','Forever','Braver','Fairer'],'Sport','medium','https://www.hoc.gr/en/olympic-games-symbols/'],
 ['planet-nearest','Which planet orbits closest to the Sun?',['Mercury','Venus','Earth','Mars'],'Space','easy','https://science.nasa.gov/solar-system/planets/'],
 ['planet-smallest','Which of the eight planets is the smallest?',['Mercury','Mars','Venus','Neptune'],'Space','medium','https://science.nasa.gov/solar-system/planets/'],
 ['planet-largest','Which planet is the largest in our solar system?',['Jupiter','Saturn','Neptune','Uranus'],'Space','easy','https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/'],
 ['pluto-year','In which year was Pluto reclassified as a dwarf planet?',['2006','1999','2012','1986'],'Space','medium','https://science.nasa.gov/solar-system/planets/'],
 ['ceres-location','The dwarf planet Ceres lies in the asteroid belt between which planets?',['Mars and Jupiter','Earth and Mars','Jupiter and Saturn','Saturn and Uranus'],'Space','medium','https://science.nasa.gov/solar-system/planets/'],
 ['mars-moons','How many natural moons does Mars have?',['2','1','3','4'],'Numbers','medium','https://science.nasa.gov/mars/facts/'],
 ['mars-phobos','Phobos and Deimos orbit which planet?',['Mars','Venus','Jupiter','Neptune'],'Space','medium','https://science.nasa.gov/mars/facts/'],
 ['mars-volcano','What is the name of the largest volcano in the solar system?',['Olympus Mons','Mauna Loa','Mount Etna','Mount Fuji'],'Space','challenging','https://science.nasa.gov/mars/facts/'],
 ['venus-hot','Which planet has the hottest surface in our solar system?',['Venus','Mercury','Mars','Jupiter'],'Space','medium','https://science.nasa.gov/venus/venus-facts/'],
 ['venus-gas','Which gas makes up most of the atmosphere of Venus?',['Carbon dioxide','Oxygen','Hydrogen','Helium'],'Science','challenging','https://science.nasa.gov/venus/venus-facts/'],
 ['venus-name','Venus is named after the Roman goddess of what?',['Love and beauty','War','Wisdom','The hunt'],'Culture','medium','https://science.nasa.gov/venus/venus-facts/'],
 ['reef-country','The Great Barrier Reef lies off the coast of which country?',['Australia','Indonesia','South Africa','Mexico'],'Nature','easy','https://whc.unesco.org/en/list/154/'],
 ['dugong-name','Which marine animal is also known as a sea cow?',['Dugong','Dolphin','Sea lion','Walrus'],'Nature','medium','https://whc.unesco.org/en/list/154/'],
 ['rapa-country','Rapa Nui, also called Easter Island, is part of which country?',['Chile','Peru','New Zealand','Ecuador'],'Geography','medium','https://whc.unesco.org/en/list/715'],
 ['rapa-figures','What are the monumental stone figures of Rapa Nui called?',['Moai','Totems','Obelisks','Dolmens'],'Culture','medium','https://whc.unesco.org/en/list/715'],
 ['rapa-ocean','Rapa Nui is an island in which ocean?',['Pacific','Atlantic','Indian','Arctic'],'Geography','easy','https://whc.unesco.org/en/list/715'],
 ['serengeti-country','In which country is Serengeti National Park?',['Tanzania','Kenya','Namibia','Botswana'],'Geography','medium','https://whc.unesco.org/en/list/156/'],
 ['serengeti-migration','Which animal is especially famous for its mass migration across the Serengeti?',['Wildebeest','Polar bear','Panda','Kangaroo'],'Nature','medium','https://whc.unesco.org/en/list/156/'],
 ['galapagos-country','Which country includes the Galápagos Islands?',['Ecuador','Colombia','Chile','Costa Rica'],'Geography','medium','https://whc.unesco.org/en/list/001/'],
 ['stonehenge-period','Stonehenge is best known as a monument from which broad period?',['Prehistory','The Renaissance','The Industrial Age','The Middle Ages'],'History','easy','https://whc.unesco.org/en/list/373'],
 ['stonehenge-partner','Which site shares a UNESCO World Heritage listing with Stonehenge?',['Avebury','Hadrian’s Wall','Pompeii','Petra'],'History','challenging','https://whc.unesco.org/en/list/373'],
 ['penicillin-prize','The 1945 Nobel Prize in Medicine honoured the discovery and medical use of what?',['Penicillin','Insulin','Aspirin','Vaccination'],'Science','medium','https://www.nobelprize.org/prizes/medicine/1945/summary/'],
 ['penicillin-fleming','Who shared the 1945 Medicine Nobel Prize for work on penicillin?',['Alexander Fleming','Louis Pasteur','Charles Darwin','Gregor Mendel'],'Science','medium','https://www.nobelprize.org/prizes/medicine/1945/summary/'],
 ['mandela-peace','Nelson Mandela shared the 1993 Nobel Peace Prize with whom?',['F. W. de Klerk','Desmond Tutu','Kofi Annan','Mikhail Gorbachev'],'History','challenging','https://www.nobelprize.org/prizes/peace/1993/press-release/'],
 ['ancient-olympic-combat','Which ancient Olympic sport combined wrestling and boxing?',['Pankration','Pentathlon','Fencing','Judo'],'Sport','challenging','https://www.olympics.com/ioc/ancient-olympic-games/the-sports-events'],
 ['ancient-olympic-horses','Where did ancient Olympic chariot races take place?',['Hippodrome','Colosseum','Parthenon','Agora'],'Sport','challenging','https://www.olympics.com/ioc/ancient-olympic-games/the-sports-events'],
 ['earth-third','Earth is which planet from the Sun?',['Third','Second','Fourth','Fifth'],'Space','easy','https://science.nasa.gov/earth/facts/'],
 ['moon-titan','Which moon has a thick atmosphere?',['Titan','Phobos','Deimos','Io'],'Space','challenging','https://science.nasa.gov/solar-system/moons/facts/'],
 ['neptune-triton','Triton is a moon of which planet?',['Neptune','Saturn','Mars','Venus'],'Space','medium','https://science.nasa.gov/neptune/moons/facts/'],
 ['flamenco-heartland','Which region of Spain is the heartland of flamenco?',['Andalusia','Catalonia','Galicia','Navarre'],'Music','medium','https://ich.unesco.org/en/RL/flamenco-00363'],
 ['flamenco-forms','Flamenco brings together song, dance and what else?',['Instrumental music','Painting','Pottery','Sculpture'],'Music','medium','https://ich.unesco.org/en/RL/flamenco-00363'],
 ['tango-cities','Tango developed in Buenos Aires and which other city?',['Montevideo','Lima','Santiago','Havana'],'Music','challenging','https://ich.unesco.org/en/RL/tango-00258'],
 ['tango-region','Which river basin is associated with the birth of tango?',['Río de la Plata','Nile','Danube','Mekong'],'Music','challenging','https://ich.unesco.org/en/RL/tango-00258'],
 ['reggae-country','Reggae music originated in which country?',['Jamaica','Cuba','Ghana','Brazil'],'Music','easy','https://ich.unesco.org/en/RL/reggae-music-of-jamaica-01398'],
 ['mariachi-country','Mariachi is a musical tradition of which country?',['Mexico','Spain','Argentina','Colombia'],'Music','easy','https://ich.unesco.org/en/RL/mariachi-string-music-song-and-trumpet-00575'],
 ['mariachi-bass','Which large bass guitar is part of modern mariachi?',['Guitarrón','Sitar','Balalaika','Mandolin'],'Music','challenging','https://ich.unesco.org/en/RL/mariachi-string-music-song-and-trumpet-00575'],
 ['washoku-country','Washoku is a traditional food culture of which country?',['Japan','China','Thailand','Vietnam'],'Culture','medium','https://ich.unesco.org/en/RL/washoku-traditional-dietary-culture-of-the-japanese-notably-for-the-celebration-of-new-year-00869'],
 ['washoku-festival','Washoku is especially associated with celebrating which occasion?',['New Year','The summer solstice','Harvest moon','Spring equinox'],'Culture','challenging','https://ich.unesco.org/en/RL/washoku-traditional-dietary-culture-of-the-japanese-notably-for-the-celebration-of-new-year-00869'],
 ['web-inventor','Who invented the World Wide Web while working at CERN?',['Tim Berners-Lee','Alan Turing','Steve Jobs','Bill Gates'],'Technology','medium','https://home.cern/science/computing/the-birth-of-the-web/short-history-web/'],
 ['web-year','In which year did Tim Berners-Lee propose the World Wide Web?',['1989','1975','1999','2005'],'Technology','challenging','https://home.cern/science/computing/the-birth-of-the-web/short-history-web/'],
 ['web-first-site','Which laboratory hosted the world’s first website?',['CERN','NASA','MIT','Bell Labs'],'Technology','medium','https://home.cern/science/computing/the-birth-of-the-web/short-history-web/'],
 ['earth-air','Which gas makes up most of Earth’s atmosphere?',['Nitrogen','Oxygen','Carbon dioxide','Hydrogen'],'Science','medium','https://science.nasa.gov/earth/facts/'],
 ['earth-ocean','About how much of Earth’s surface is covered by ocean?',['71%','29%','50%','90%'],'Nature','medium','https://science.nasa.gov/earth/facts/'],
 ['marathon-distance','What is the official marathon distance in kilometres?',['42.195','40','50','36.2'],'Sport','challenging','https://www.olympics.com/ioc/news/olympic-marathon-innovations'],
];
export const DAILY_POOL:DailyQuestion[]=[...rows.map(([id,question,options,category,difficulty,sourceUrl])=>({id,question,options,answer:0,category,difficulty,sourceUrl,explanation:`${options[0]}. See the linked primary source.`})),...NUMERIC_FACTS.filter(f=>!isApproximateFact(f)&&!f.id.endsWith('-order')).map(f=>{
 const options=(f.answer>=1800&&f.answer<=2026?[f.answer,f.answer-20,f.answer-10,f.answer+10]:[f.answer,Math.max(1,Math.round(f.answer*.7)),Math.round(f.answer*1.3)+1,Math.round(f.answer*1.6)+3]).map(String);
 return {id:'number-'+f.id,question:f.question,options,answer:0,category:'Numbers',difficulty:f.difficulty,sourceUrl:f.sourceUrl,explanation:f.explanation};
})].map(q=>DailyQuestionSchema.parse(q));
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
/** Deterministic fallback: diverse categories, 3 easy / 5 medium / 2 challenging.
 * The four most recent days are avoided when the reviewed inventory supports it. */
export function selectDaily(day:string,recent:ReadonlySet<string>=new Set(),preferred:readonly string[]=[]){
 const selected:DailyQuestion[]=[],categories=new Map<string,number>();
 for(const [difficulty,count] of [['easy',3],['medium',5],['challenging',2]] as const){
  const candidates=DAILY_POOL.filter(q=>q.difficulty===difficulty).sort((a,b)=>Number(recent.has(a.id))-Number(recent.has(b.id))||Number(!preferred.includes(a.id))-Number(!preferred.includes(b.id))||hash(day+a.id).localeCompare(hash(day+b.id)));
  for(let i=0;i<count;i++){
   const eligible=candidates.filter(q=>!selected.includes(q)&&(categories.get(q.category)??0)<3);
   const q=eligible.find(q=>!selected.some(old=>old.sourceUrl===q.sourceUrl))??eligible[0];if(!q)throw new Error('Insufficient reviewed daily inventory');
   selected.push(q);categories.set(q.category,(categories.get(q.category)??0)+1);
  }
 }
 return DailyQuestionsSchema.parse(selected.sort((a,b)=>hash(day+':order:'+a.id).localeCompare(hash(day+':order:'+b.id))).map(q=>{
  const options=q.options.map((text,index)=>({text,index})).sort((a,b)=>hash(day+q.id+a.text).localeCompare(hash(day+q.id+b.text)));
  return {...q,options:options.map(o=>o.text),answer:options.findIndex(o=>o.index===q.answer)};
 }));
}
