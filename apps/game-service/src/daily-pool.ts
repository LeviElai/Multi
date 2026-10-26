import {createHash} from 'node:crypto';
import {DailyQuestionSchema,DailyQuestionsSchema,type DailyQuestion} from './daily';
import {NUMERIC_FACTS,isApproximateFact} from './numeric-facts';
/** Reviewed against the primary source links, 2026-10-25. AI may select IDs;
 * it cannot rewrite a fact, answer, source, or difficulty during publication. */
const rows:[string,string,string[],string,DailyQuestion['difficulty'],string][]=[
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
];
export const DAILY_POOL:DailyQuestion[]=[...rows.map(([id,question,options,category,difficulty,sourceUrl])=>({id,question,options,answer:0,category,difficulty,sourceUrl,explanation:`${options[0]}. See the linked primary source.`})),...NUMERIC_FACTS.filter(f=>!isApproximateFact(f)&&!f.id.endsWith('-order')).map(f=>{
 const options=(f.answer>=1800&&f.answer<=2026?[f.answer,f.answer-20,f.answer-10,f.answer+10]:[f.answer,Math.max(1,Math.round(f.answer*.7)),Math.round(f.answer*1.3)+1,Math.round(f.answer*1.6)+3]).map(String);
 return {id:'number-'+f.id,question:f.question,options,answer:0,category:'Numbers',difficulty:f.difficulty,sourceUrl:f.sourceUrl,explanation:f.explanation};
})].map(q=>DailyQuestionSchema.parse(q));
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
/** Deterministic fallback: diverse categories, 3 easy / 5 medium / 2 challenging.
 * Recent IDs are avoided when the reviewed inventory supports the quota. */
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
