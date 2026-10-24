/** Editorial facts checked against the linked primary sources on 2026-10-24.
 * Models select IDs; they never supply the published question or answer.
 * Deliberately small: unsupported topics fail closed rather than invent evidence.
 */
export const NUMERIC_FACTS = [
 {id:'gold-number',question:'What is the atomic number of gold?',answer:79,unit:'',tags:'science chemistry elements gold',difficulty:'challenging',sourceUrl:'https://periodic-table.rsc.org/element/79/Gold',explanation:'Gold has atomic number 79.'},
 {id:'gold-purity',question:'How many carats describe pure gold?',answer:24,unit:'carats',tags:'science chemistry gold jewellery',difficulty:'easy',sourceUrl:'https://periodic-table.rsc.org/element/79/Gold',explanation:'Pure gold is 24-carat gold.'},
 {id:'gold-melting',question:'To the nearest degree Celsius, at what temperature does gold melt?',answer:1064,unit:'°C',tags:'science chemistry elements gold temperature',difficulty:'challenging',sourceUrl:'https://periodic-table.rsc.org/element/79/Gold',explanation:'The Royal Society of Chemistry lists 1064.18 °C, rounded here to 1064 °C.'},
 {id:'earth-diameter',question:'Approximately how many kilometres is Earth’s equatorial diameter?',answer:12756,unit:'km',tags:'science space astronomy earth planets geography',difficulty:'challenging',sourceUrl:'https://science.nasa.gov/earth/facts/',explanation:'NASA gives an equatorial diameter of 12,756 km. The polar diameter is different.'},
 {id:'earth-sun-distance',question:'Approximately how many million kilometres is Earth’s average distance from the Sun?',answer:150,unit:'million km',tags:'science space astronomy earth planets sun',difficulty:'challenging',sourceUrl:'https://science.nasa.gov/earth/facts/',explanation:'NASA rounds Earth’s average distance from the Sun to 150 million km.'},
 {id:'venus-diameter',question:'Approximately how many kilometres is Venus’s equatorial diameter?',answer:12104,unit:'km',tags:'science space astronomy venus planets',difficulty:'challenging',sourceUrl:'https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/',explanation:'NASA gives an equatorial diameter of about 12,104 km.'},
 {id:'un-foundation',question:'In what year was the United Nations founded?',answer:1945,unit:'year',tags:'history politics united nations world',difficulty:'easy',sourceUrl:'https://www.un.org/en/about-us',explanation:'The United Nations was founded in 1945.'},
 {id:'un-original-members',question:'How many member states did the United Nations have when it was founded in 1945?',answer:51,unit:'member states',tags:'history politics united nations world',difficulty:'challenging',sourceUrl:'https://www.un.org/en/about-us',explanation:'The UN began with 51 member states in 1945.'},
] as const;

export const NUMERIC_MODES = new Set(['fermi','amountle','draw','stack','crack']);
export function eligibleNumericFacts(topic:string,difficulty:string,mode?:string){
 const words=topic.toLowerCase().match(/[a-z]+/g)??[];
 const general=words.length>0&&words.every(w=>['general','numbers','trivia','everything','knowledge','facts','quiz'].includes(w));
 return NUMERIC_FACTS.filter(f=>(general||words.some(w=>w.length>2&&f.tags.split(' ').includes(w)))
  &&(difficulty==='mixed'||f.difficulty===difficulty)
  &&(mode!=='amountle'||f.answer<=1000));
}
