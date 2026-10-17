import {z} from 'zod';
export const LOOK_OPTIONS={skin:8,hair:8,hairColor:6,shirt:10,shirtColor:8,pants:8,face:6,hat:12,shoes:5} as const;
export type LookKey=keyof typeof LOOK_OPTIONS;
export const AvatarSchema=z.object(Object.fromEntries(Object.entries(LOOK_OPTIONS).map(([key,count])=>[key,z.number().int().min(0).max(count-1)])) as Record<LookKey,z.ZodNumber>).strict();
export type Avatar=z.infer<typeof AvatarSchema>;
/** Version-one appearance is keyed by identity, never name, rank, or render order. */
export function avatarFor(id:string,custom?:Avatar):Avatar{
 if(custom)return custom;
 let seed=2166136261;for(const c of id){seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;}
 const next=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
 return Object.fromEntries(Object.entries(LOOK_OPTIONS).map(([key,count])=>[key,next()%count])) as Avatar;
}
