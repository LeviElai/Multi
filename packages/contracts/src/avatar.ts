import {z} from 'zod';
export const LOOK_OPTIONS={skin:8,hair:10,hairColor:8,shirt:8,shirtColor:8,pants:5,pantsColor:8,face:8,hat:9,accessory:4,shoes:5} as const;
export type LookKey=keyof typeof LOOK_OPTIONS;
const fields=Object.fromEntries(Object.entries(LOOK_OPTIONS).map(([key,count])=>[key,z.number().int().min(0).max(Math.max(count-1,key==='shirt'?9:key==='pants'?7:key==='hat'?11:0))])) as Record<LookKey,z.ZodNumber>;
// New layers default cleanly when loading a previously saved character.
export const AvatarSchema=z.object({...fields,pantsColor:fields.pantsColor.default(0),accessory:fields.accessory.default(0)}).strict();
export type Avatar=z.infer<typeof AvatarSchema>;
/** Version-one appearance is keyed by identity, never name, rank, or render order. */
export function avatarFor(id:string,custom?:Avatar):Avatar{
 if(custom)return {...custom,pantsColor:custom.pantsColor??custom.pants%8,accessory:custom.accessory??0};
 let seed=2166136261;for(const c of id){seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;}
 const next=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
 const look=Object.fromEntries(Object.entries(LOOK_OPTIONS).map(([key,count])=>[key,next()%count])) as Avatar;
 // Curated outfit pairings; skin is sampled independently of outfit or role.
 const pairings=[0,5,1,4,2,7,3,6];
 look.pantsColor=pairings[look.shirtColor];
 look.accessory=next()%3===0?look.accessory:0;
 look.hat=next()%2===0?look.hat:0;
 return look;
}
