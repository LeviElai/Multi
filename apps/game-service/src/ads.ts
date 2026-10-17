import { DomainError } from '../../../packages/contracts/src/index';
import type { Store } from '../../../packages/db/src/types';
import { quotaPeriod } from './ai';
import { idempotentId } from './security';

export type AdsConfig={unitPath:string;consentReady:boolean;approved:boolean};
export function adsReady(config?:AdsConfig){return !!config?.approved&&config.consentReady&&/^\/\d+\/[A-Za-z0-9_./-]+$/.test(config.unitPath);}
export async function rewardTicket(store:Store,owner:string,key:string,config?:AdsConfig,now=new Date()){
 if(!adsReady(config))throw new DomainError('ADS_UNAVAILABLE','Rewarded ads are not available yet. Your free monthly questions are unaffected.',503);
 const id=await idempotentId('ad-reward',owner,key),day=now.toISOString().slice(0,10),period=quotaPeriod(now);
 // A slot attempt consumes one of three daily opportunities, preventing refresh/replay farming.
 await store.db.batch([
  {sql:'INSERT INTO ai_usage_periods (owner_id,period,allowance,reserved,consumed) VALUES (?,?,20,0,0) ON CONFLICT(owner_id,period) DO NOTHING',params:[owner,period]},
  {sql:'UPDATE ai_usage_periods SET mutation_token=? WHERE owner_id=? AND period=?',params:[crypto.randomUUID(),owner,period]},
  {sql:"INSERT INTO ad_reward_tickets (id,owner_id,period,day,status,created_at,expires_at) SELECT ?,?,?,?,'issued',?,? WHERE (SELECT COUNT(*) FROM ad_reward_tickets WHERE owner_id=? AND day=?)<3 ON CONFLICT(id) DO NOTHING",params:[id,owner,period,day,now.toISOString(),new Date(now.getTime()+600000).toISOString(),owner,day]}
 ]);
 const row=(await store.db.query<{status:string;expires_at:string}>('SELECT status,expires_at FROM ad_reward_tickets WHERE id=? AND owner_id=?',[id,owner])).rows[0];
 if(!row)throw new DomainError('AD_LIMIT','Three ad opportunities per day. Try again tomorrow.',429);
 return {id,unitPath:config!.unitPath,expiresAt:row.expires_at,reward:5};
}
export async function claimReward(store:Store,owner:string,id:string,config?:AdsConfig,now=new Date()){
 if(!adsReady(config))throw new DomainError('ADS_UNAVAILABLE','Rewarded ads are unavailable.',503);
 const period=quotaPeriod(now),token=crypto.randomUUID();
 // Google GPT web supplies a browser event, not a signed SSV receipt. This is deliberately
 // bounded to 15 questions/day. Never describe it as cryptographic ad verification.
 await store.db.batch([
  {sql:'INSERT INTO ai_usage_periods (owner_id,period,allowance,reserved,consumed) VALUES (?,?,20,0,0) ON CONFLICT(owner_id,period) DO NOTHING',params:[owner,period]},
  {sql:"UPDATE ad_reward_tickets SET status='claimed',claim_token=? WHERE id=? AND owner_id=? AND period=? AND status='issued' AND expires_at>?",params:[token,id,owner,period,now.toISOString()]},
  {sql:'UPDATE ai_usage_periods SET allowance=allowance+5 WHERE owner_id=? AND period=? AND EXISTS(SELECT 1 FROM ad_reward_tickets WHERE id=? AND claim_token=?)',params:[owner,period,id,token]}
 ]);
 const ticket=(await store.db.query<{status:string}>('SELECT status FROM ad_reward_tickets WHERE id=? AND owner_id=? AND period=?',[id,owner,period])).rows[0];
 if(ticket?.status!=='claimed')throw new DomainError('REWARD_EXPIRED','This ad reward has expired. No questions were added.',409);
 return {granted:true,questions:5};
}
