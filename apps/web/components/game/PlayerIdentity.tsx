'use client';
import {memo,useEffect,useRef,useState} from 'react';
import {avatarFor,LOOK_OPTIONS,type Avatar,type LookKey} from '../../../../packages/contracts/src/avatar';
import type {Member} from '../../../../packages/contracts/src/index';
import {post} from '../../lib/api';
import {playCue} from '../../lib/audio';
import {LoopSelector} from './LoopSelector';
export const SKINS=['#f7d6b0','#edbd96','#d9a276','#bd825e','#a66c4b','#88543e','#683f32','#4b302a'];
const HAIR=['#302b32','#654334','#ad7042','#e5bd6b','#d6d5c8','#a35c75','#bd6b3f','#759792'];
const CLOTH=['#83c4b2','#db969b','#89a9d7','#d5bd73','#b9a1cd','#df9d6c','#a9bc73','#c5d8d9'];
const LOWER=['#354a69','#61567a','#78604d','#42736b','#8c555d','#5c6979','#d2ba91','#38423d'];
const SHOE=['#243145','#634837','#9b6651','#ede0bd','#6f547f'];
export type Mood='still'|'idle'|'join'|'locked'|'waiting'|'happy'|'near'|'up'|'celebrate';
export const PixelCharacter=memo(function PixelCharacter({id,avatar,mood='still',crown=false,part}:{id:string;avatar?:Avatar;mood?:Mood;crown?:boolean;part?:LookKey}){
 const a=avatarFor(id,avatar),skin=SKINS[a.skin],hair=HAIR[a.hairColor],shirt=CLOTH[a.shirtColor],pants=LOWER[a.pantsColor],ink='#18263e',eye=a.skin>=6?'#ffe0b0':'#273449';
 const hairShape=[
 'M6 8h12v3H6',
 'M5 7h4V6h3v2h4V6h3v3h1v6h-3v-4H7v3H5Z',
 'M5 5h14v2h2v10h-4v-6H7v6H3V7h2Z',
 'M6 7h12v3h2v11h-4V11H8v10H4V10h2Z',
 'M6 7h12v3h2v17h-4V11H8v16H4V10h2Z',
 'M6 8h12v3H6m11 1h5v10h-3v-7h-2Z',
 'M6 8V5h3v3h3V3h3v5h3V5h2v6H6Z',
 'M6 8h7V6h5v5H9v3H6Z',
 'M10 3h4v8h-4Z',
 ''
 ][a.hair];
 const hats=['','M5 6h13v4h4v3h-7v-3H5Z','M6 5h12v2h2v4H4V7h2m5-4h3v2h-3Z','M10 1h4v3h2v3h2v3h4v2H2v-2h4V7h2V4h2Z','M4 7h3V5h10v2h3v5H4m6-5h4v3h-4Z','M6 4h3v2h6V4h3v4h4v3H2V8h4Z','M6 5h12v3h2v4H4V8h2Z','M6 4h12v3h2v10h-3v-6H7v6H4V7h2Z','M5 7h14v3h3v2H2v-2h3m5-7h3v2h-3Z'][a.hat%9];
 const hatColors=['', '#bb7666','#7caaa1','#9b87bc','#35465c','#b68e5f','#87a8bd','#9aabb4','#d8aa86'];
 const layers={hair:<path fill={hair} d={hairShape}/>,face:<> <path fill={skin} d="M7 9h10v10H7Z"/><path fill="#ffffff22" d="M7 10h3v6H7Z"/>
 <g className="character-face">
 {a.face===3?<path d="M8 13h2v1H8m6-1h2v1h-2" fill={eye}/>:a.face===4?<path d="M8 12h2v2H8m6-1h2v1h-2" fill={eye}/>:<path d="M8 12h2v2H8m6-2h2v2h-2" fill={eye}/>}
 {a.face===1?<path d="M10 16h4v2h-4" fill="#683d36"/>:a.face===2?<path d="M10 16h4v1h-4m1 1h2v1h-2" fill="#fff0c8"/>:a.face===5?<path d="M11 16h2v2h-2" fill="#683d36"/>:a.face===6?<path d="M10 17h4v1h-4" fill="#683d36"/>:<path d="M10 16h4v1h-4" fill="#683d36"/>}
 {a.face===6&&<path d="M8 10h2v1H8m4 0h4v1h-4" fill={eye}/>}
 {a.face===3&&<path d="M8 11h2v1H8m6-1h2v1h-2" fill={eye}/>}{a.face===7&&<path d="M8 15h2v1H8m6-1h2v1h-2" fill="#db8a80"/>}
 </g>
</>,shirt:<> <path fill={shirt} d="M5 20h14v7H5ZM3 22h3v4H3Zm15 0h3v4h-3Z"/>
 <path fill="#fff0c8" d="M10 20h4v3h-4Z"/>
 {a.shirt%8===1&&<path d="M5 23h14v1H5m0 2h14v1H5" fill="#fff0c8"/>}
 {a.shirt%8===2&&<><path d="M6 19h12v2H6m3 4h6v2H9" fill="#ffffff44"/><path d="M10 22h1v2h-1m3-2h1v2h-1" fill={ink}/></>}
 {a.shirt%8===3&&<path d="M5 20h4v7H5m10-7h4v7h-4m-3-4h1v4h-1" fill="#354b67"/>}
 {a.shirt%8===4&&<path d="M6 20h3v7H6m9-7h3v7h-3" fill="#65565d"/>}
 {a.shirt%8===5&&<path d="M7 20h2v4h6v-4h2v7H7m2-4h6v2H9" fill={pants}/>}
 {a.shirt%8===6&&<path d="M5 20h3v2H5m11-2h3v2h-3m-5 2h2v2h-2" fill="#fff0c8"/>}
 {a.shirt%8===7&&<path d="M4 25h16v3H4m7-5h2v2h-2" fill={shirt}/>}
</>,pants:<> <path fill={pants} d="M7 27h4v4H7Zm6 0h4v4h-4Z"/>
 {a.pants%5===1&&<path d="M7 29h4v2H7m6-2h4v2h-4" fill={skin}/>}
 {a.pants%5===2&&<path d="M6 27h2v2H6m10-2h2v2h-2" fill="#ffffff44"/>}
 {a.pants%5===3&&<path d="M6 27h12v3H6" fill={pants}/>}
 {a.pants%5===4&&<path d="M7 30h4v1H7m6-1h4v1h-4" fill="#fff0c8"/>}
</>,hat:<> {hats&&<path fill={hatColors[a.hat%9]} d={hats}/>}
 {a.hat%9===3&&<path d="M10 6h2v2h-2" fill="#ffdd94"/>}{a.hat%9===4&&<path d="M10 8h4v2h-4" fill="#fff0c8"/>}{a.hat%9===8&&<path d="M10 3h3v2h-3m-1-1h5v1H9" fill="#f2afbd"/>}
</>,accessory:<> {a.accessory===1&&<path d="M7 12h4v3H7m6-3h4v3h-4m-2-2h2" fill="none" stroke={ink} strokeWidth="1"/>}
 {a.accessory===2&&<path d="M7 12h4v3H7m6-3h4v3h-4m-2-2h2" fill={ink}/>}
 {a.accessory===3&&<path d="M8 15h3v-1h2v1h3v2h-3v-1h-2v1H8Z" fill={hair}/>}
</>,shoes:<> <path d="M7 31h4v1H7m6-1h4v1h-4" fill={SHOE[a.shoes]}/>
</>};
 const frames:Partial<Record<LookKey,string>>={hair:'5 5 23 27',face:'9 12 15 13',shirt:'6 22 21 12',pants:'9 29 15 8',hat:'4 3 25 15',accessory:'9 14 14 11',shoes:'10 33 13 5'};
 return <svg viewBox={part?frames[part]??'0 0 32 40':'0 0 32 40'} shapeRendering="crispEdges" aria-hidden="true" className={part?'character-item':'pixel-character mood-'+mood} data-look={Object.values(a).join('-')}>
 <g transform="translate(4 4)"><g className={part?'item-layer':'character-body'}>
 {part?layers[part as keyof typeof layers]:<>{layers.face}{layers.hair}{layers.shirt}<path d="M3 25h3v1H3m15-1h3v1h-3" fill={skin}/>{layers.pants}{layers.shoes}{layers.hat}{layers.accessory} {crown&&<><path fill="#bd7f3e" d="M5 1h3v3h3V0h3v4h3V1h3v8H5Z"/><path fill="#ffe195" d="M6 2h2v3h4V1h1v4h5V2h1v5H6Z"/><path fill="#ec8e9b" d="M11 5h3v2h-3Z"/></>}
</>}
 </g></g></svg>;
},(a,b)=>a.part===b.part&&a.id===b.id&&a.mood===b.mood&&a.crown===b.crown&&JSON.stringify(a.avatar)===JSON.stringify(b.avatar));
export function PlayerIdentity({id,name,avatar,mood='still'}:{id:string;name:string;avatar?:Avatar;mood?:Mood}){return <span className="player-identity"><PixelCharacter id={id} avatar={avatar} mood={mood}/><span className="identity-name">{name}</span></span>;}
export const LOOK_LABELS:Record<LookKey,string>={skin:'Skin tone',hair:'Hair',hairColor:'Hair color',shirt:'Shirt',shirtColor:'Shirt color',pants:'Pants',pantsColor:'Pants color',accessory:'Accessories',face:'Face',hat:'Hat',shoes:'Shoes'};
const ORDER:LookKey[]=['hair','hairColor','face','skin','shirt','shirtColor','pants','pantsColor','hat','accessory','shoes'];
const PALETTES:Partial<Record<LookKey,string[]>>={skin:SKINS,hairColor:HAIR,shirtColor:CLOTH,pantsColor:LOWER,shoes:SHOE};
export const ITEM_NAMES:Partial<Record<LookKey,string[]>>={skin:['Porcelain','Sand','Honey','Caramel','Warm brown','Chestnut','Deep brown','Ebony'],hairColor:['Black','Espresso','Chestnut','Blonde','Silver','Rosewood','Auburn','Slate'],shirtColor:['Mint','Coral','Sky','Gold','Plum','Peach','Sage','Cloud'],pantsColor:['Navy','Plum','Walnut','Teal','Berry','Slate','Sand','Charcoal'],shoes:['Midnight','Walnut','Clay','Cream','Plum'],hair:['Crop','Curls','Afro','Bob','Long','Ponytail','Spikes','Side part','Mohawk','No hair'],face:['Calm','Smile','Grin','Happy','Wink','Surprised','Determined','Rosy'],shirt:['Tee','Stripes','Hoodie','Jacket','Vest','Overalls','Jersey','Tunic'],pants:['Straight','Shorts','Cargo','Wide','Cuffed'],hat:['No hat','Cap','Beanie','Wizard','Pirate','Cowboy','Bucket','Helmet','Flower'],accessory:['No accessory','Glasses','Shades','Moustache']};
export function CharacterItem({detail,value,avatar}:{detail:LookKey;value:number;avatar:Avatar}){
 const palette=PALETTES[detail];
 if(palette)return <i className="item-swatch" style={{background:palette[value]}}/>;
 if((detail==='hat'||detail==='accessory')&&value===0||detail==='hair'&&value===9)return <svg className="item-none" viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges"><path fill="currentColor" d="M3 2h2v2h2v2h2V4h2V2h2v3h-2v2H9v2h2v2h2v3h-2v-2H9v-2H7v2H5v2H3v-3h2V9h2V7H5V5H3Z"/></svg>;
 return <PixelCharacter id="item-preview" avatar={{...avatar,[detail]:value}} part={detail}/>;
}
export function CharacterEditor({member,sessionId,onSaved}:{member:Member;sessionId:string;onSaved:()=>void}){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(()=>avatarFor(member.id,member.avatar)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reaction,setReaction]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(open)dialog.current?.showModal();else if(dialog.current?.open){dialog.current.close();trigger.current?.focus();}},[open]);
 async function save(){if(busy)return;setBusy(true);setError('');try{await post(`/sessions/${sessionId}/appearance?role=player`,{avatar:draft});onSaved();setOpen(false);}catch(e){setError(e instanceof Error?e.message:'Look not saved. Try again.');}finally{setBusy(false);}}
 function choose(key:LookKey,value:number){setDraft(v=>({...v,[key]:value}));setReaction(v=>v+1);playCue('adjust');}
 return <><button ref={trigger} className="btn btn-outline edit-look" onClick={()=>{setDraft(avatarFor(member.id,member.avatar));setReaction(0);setError('');setOpen(true);}}>Edit look</button>
 <dialog ref={dialog} className="look-editor dressing-room" onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)} aria-labelledby="look-title">
 <header><h2 id="look-title">Dressing room</h2><button aria-label="Close character editor" onClick={()=>setOpen(false)}>×</button></header>
 {open&&<><div className="dressing-selectors">{ORDER.map(detail=><LoopSelector key={detail} label={LOOK_LABELS[detail]} value={draft[detail]%LOOK_OPTIONS[detail]} count={LOOK_OPTIONS[detail]} name={value=>ITEM_NAMES[detail]?.[value]??String(value+1)} onChange={value=>choose(detail,value)} renderItem={value=><CharacterItem detail={detail} value={value} avatar={draft}/>}/>)}</div>
 <aside className="dressing-preview"><div className="dressing-mirror"><div key={reaction} className={reaction?'outfit-reaction':'outfit-greeting'}><PixelCharacter id={member.id} avatar={draft} mood="idle"/></div><div className="dressing-platform"/></div><strong>{member.nickname}</strong><span aria-live="polite" className="sr-only">{reaction?'Look updated':'Hello, '+member.nickname}</span></aside></>}
 <footer>{error&&<p className="dressing-error" role="alert">{error}</p>}<button className="btn btn-outline" disabled={busy} onClick={()=>{setDraft(avatarFor(crypto.randomUUID()));setReaction(v=>v+1);playCue('adjust');}}>Randomize</button><button className="btn btn-outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save'}</button></footer>
 </dialog></>;
}
