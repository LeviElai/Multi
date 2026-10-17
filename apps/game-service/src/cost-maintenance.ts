import type {Store} from '../../../packages/db/src/types';
/** Hourly, in the existing service. Never deletes quizzes, accounts, scores or game events. */
export async function compactTemporaryData(store:Store,now=new Date()){
 const sevenDays=new Date(now.getTime()-7*86400000).toISOString(),thirtyTwoDays=new Date(now.getTime()-32*86400000).toISOString();
 return store.db.batch([
  // Keep IDs, hashes, quota counts and usage telemetry so retries remain idempotent.
  {sql:"UPDATE creator_generations SET request_json='{}',result_json=NULL WHERE status IN ('done','failed','rejected') AND updated_at<? AND (request_json<>'{}' OR result_json IS NOT NULL)",params:[sevenDays]},
  // A prior-month expired ticket can never award a current-month reward.
  {sql:'DELETE FROM ad_reward_tickets WHERE expires_at<?',params:[thirtyTwoDays]},
  {sql:'DELETE FROM rate_limits WHERE reset_at<?',params:[sevenDays]}
 ]);
}
