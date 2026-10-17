import type {CSSProperties} from 'react';
/** Original pixel-grid fish: separate tail, fins, belly, scales and expressive eyes. */
export function FishArt({species=0}:{species?:number}){
 const palettes=[['#f6aa55','#f8d68b','#b8643d'],['#7dc7bf','#d0efd5','#387d87'],['#dd91b0','#ffe2cb','#9f577b'],['#a1a5e5','#e0d8ff','#62679e'],['#d8cf6c','#fff1b2','#8e924f'],['#79b4d4','#d0ebef','#3f729e']];const [body,light,shade]=palettes[species%6];
 return <svg className={'illustrated-fish fish-species-'+species%3} viewBox="0 0 96 64" role="presentation" shapeRendering="crispEdges" style={{'--fish-tail':shade} as CSSProperties}>
 <g className="fish-tail"><path d="M25 27H17V21H9V15H3V49H9V43H17V37H25Z" fill={shade}/><path d="M5 25H13V30H20V34H13V39H5Z" fill={light}/></g>
 <path d="M33 21V13H43V7H59V12H65V23M40 45V55H56V49H67V42" fill={shade}/><path d="M45 14H57V20H45Z" fill={light}/>
 <path d={species%3===1?'M25 22H37V14H65V20H77V25H85V42H77V48H37V42H25Z':species%3===2?'M23 27H34V17H47V11H66V18H77V26H88V39H78V47H62V53H44V46H32V39H23Z':'M23 25H33V19H45V13H65V19H77V25H87V42H77V48H41V43H29V37H23Z'} fill={body}/>
 <path d="M33 34H43V40H55V44H75V48H41V43H29V37H25V31H33Z" fill={shade}/><path d="M37 23V19H48V16H61V20H45V25H37Z" fill={light}/>
 <path d="M49 29H56V34H61V39H51V35H45V31H49Z" fill={shade}/><path d="M45 28H51V33H56V36H49V33H45Z" fill={light}/>
 <path d="M67 22H77V25H80V35H76V38H66V34H63V25H67Z" fill="#fff2d5"/><path d="M73 25H79V33H73Z" fill="#183949"/><path d="M73 25H76V28H73Z" fill="#fff"/><path d="M83 39H89V42H83Z" fill={shade}/>
 <path d="M36 29H40V33H36ZM58 21H61V24H58ZM59 41H63V44H59Z" fill={light}/>
 </svg>;
}
