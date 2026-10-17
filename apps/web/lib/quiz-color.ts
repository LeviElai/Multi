export const QUIZ_COLORS=['#efaca0','#efc298','#afcfbb','#b4cddd','#c8b8de','#dfb4c5','#e3d29b','#94c2bf'];
/** Quiz identity is independent of list position and first game mode. */
export function quizColor(id:string){let n=2166136261;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return QUIZ_COLORS[n%QUIZ_COLORS.length];}
