// Google web rewards are client events, not signed server-to-server receipts.
// Server tickets add expiry, ownership, replay protection and a strict daily cap.
type Slot=object;
type RewardEvent={slot:Slot;makeRewardedVisible?:()=>boolean};
type PubAds={addEventListener:(name:string,fn:(e:RewardEvent)=>void)=>void;removeEventListener:(name:string,fn:(e:RewardEvent)=>void)=>void;setPrivacySettings:(settings:{nonPersonalizedAds:boolean;restrictDataProcessing:boolean})=>void};
type GPT={cmd:{push:(fn:()=>void)=>void};enums:{OutOfPageFormat:{REWARDED:unknown}};defineOutOfPageSlot:(path:string,format:unknown)=>{addService:(service:PubAds)=>Slot}|null;pubads:()=>PubAds;enableServices:()=>void;display:(slot:Slot)=>void;destroySlots:(slots:Slot[])=>void};
declare global{interface Window{googletag?:GPT;__tcfapi?:(command:string,version:number,callback:(data:{gdprApplies?:boolean;eventStatus?:string;purpose?:{consents?:Record<string,boolean>};vendor?:{consents?:Record<string,boolean>};listenerId?:number},success:boolean)=>void,parameter?:number)=>void;}}
async function consentReady(){
 if(!window.__tcfapi)return; // Deployment gate ADS_CONSENT_READY covers applicable non-TCF regional requirements.
 await new Promise<void>((resolve,reject)=>{let settled=false;const timer=setTimeout(()=>finish(false),5000);const finish=(ok:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);ok?resolve():reject(new Error('Please finish your advertising privacy choices before watching an ad.'));};window.__tcfapi!('addEventListener',2,(data,success)=>{if(data.listenerId)window.__tcfapi?.('removeEventListener',2,()=>{},data.listenerId);finish(success&&(data.gdprApplies===false||(['tcloaded','useractioncomplete'].includes(data.eventStatus??'')&&!!data.purpose?.consents?.['1']&&!!data.vendor?.consents?.['755'])));});});
}
let loading:Promise<void>|undefined;
export async function showRewardedAd(unitPath:string,onGranted:()=>Promise<void>):Promise<boolean>{
 await consentReady();
 loading??=new Promise<void>((resolve,reject)=>{window.googletag??={cmd:[]} as unknown as GPT;const script=document.createElement('script');script.src='https://securepubads.g.doubleclick.net/tag/js/gpt.js';script.async=true;script.crossOrigin='anonymous';const fail=()=>{loading=undefined;script.remove();reject(new Error('The ad could not load. Your free questions are still available.'));};const timeout=setTimeout(fail,12000);script.onload=()=>{clearTimeout(timeout);resolve();};script.onerror=()=>{clearTimeout(timeout);fail();};document.head.appendChild(script);});
 await loading;
 return new Promise<boolean>((resolve,reject)=>{const g=window.googletag!;let slot:Slot|undefined,service:PubAds,granted=false,settled=false;let claim:Promise<void>|undefined;let visible=false;
  const handlers: [string,(e:RewardEvent)=>void][]=[];
  const cleanup=()=>{clearTimeout(timer);if(service)for(const [name,fn]of handlers)service.removeEventListener(name,fn);if(slot)g.destroySlots([slot]);};
  const finish=(error?:Error)=>{if(settled)return;settled=true;cleanup();if(error)reject(error);else resolve(granted);};
  const timer=setTimeout(()=>finish(new Error(visible?'The ad reward could not be confirmed. Refresh your quota before trying again.':'No ad is available right now. Try again later.')),180000);
  g.cmd.push(()=>{try{service=g.pubads();service.setPrivacySettings({nonPersonalizedAds:true,restrictDataProcessing:true});const definition=g.defineOutOfPageSlot(unitPath,g.enums.OutOfPageFormat.REWARDED);if(!definition){finish(new Error('Rewarded ads are not supported on this screen.'));return;}slot=definition.addService(service);
   const listen=(name:string,fn:(e:RewardEvent)=>void)=>{handlers.push([name,fn]);service.addEventListener(name,fn);};
   listen('rewardedSlotReady',e=>{if(e.slot===slot){visible=!!e.makeRewardedVisible?.();if(!visible)finish(new Error('The ad could not open.'));}});
   listen('rewardedSlotGranted',e=>{if(e.slot===slot&&!claim){claim=onGranted().then(()=>{granted=true;});claim.catch(()=>{});}});
   listen('rewardedSlotClosed',e=>{if(e.slot===slot)void (claim??Promise.resolve()).then(()=>finish()).catch(()=>finish(new Error('Reward confirmation was interrupted. Refresh to check your quota.')));});
   g.enableServices();g.display(slot);
  }catch{finish(new Error('The ad could not load. Please try again later.'));}});
 });
}
