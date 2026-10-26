import {DAILY_POOL} from '../apps/game-service/src/daily-pool';
import {writeFileSync} from 'node:fs';
// Reviewed, source-backed inventory, never player-generated text.
const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
writeFileSync(process.argv[2],`INSERT INTO multigame.daily_verified_pool(id,question) VALUES\n${DAILY_POOL.map(q=>`(${quote(q.id)},${quote(JSON.stringify(q))}::jsonb)`).join(',\n')}\nON CONFLICT(id) DO NOTHING;\n`);
