import type {Quiz,QuizInput,QuizVersion,SessionData,SessionRecord,Principal,SessionEvent} from '../../contracts/src/index';
export type SqlValue=string|number|null;
export interface SqlStatement {sql:string;params?:SqlValue[]}
export interface SqlResult<T=Record<string,unknown>> {rows:T[];changes:number}
export interface SqlDatabase {query<T=Record<string,unknown>>(sql:string,params?:SqlValue[]):Promise<SqlResult<T>>;batch(statements:SqlStatement[]):Promise<SqlResult[]>;dialect:'sqlite'|'postgres'}
export type MutationResult<T>={data:SessionData;result:T;eventType:string;audit?:{action:string;targetId?:string;detail:Record<string,unknown>}};
export interface Store {
  db:SqlDatabase;
  ensureUser(externalId:string,displayName:string):Promise<{id:string;displayName:string}>;
  listQuizzes(ownerId:string):Promise<Quiz[]>;
  getQuiz(id:string,ownerId:string):Promise<Quiz>;
  createQuiz(ownerId:string,input:QuizInput,id?:string,idempotencyKey?:string):Promise<Quiz>;
  saveQuiz(id:string,ownerId:string,expectedRevision:number,input:QuizInput):Promise<Quiz>;
  archiveQuiz(id:string,ownerId:string):Promise<void>;
  publishQuiz(id:string,ownerId:string,expectedRevision:number,idempotencyKey?:string):Promise<QuizVersion>;
  getVersion(id:string,ownerId?:string):Promise<QuizVersion>;
  createSession(record:SessionRecord):Promise<void>;
  getSession(id:string):Promise<SessionData>;
  findSessionByPinDigest(digest:string):Promise<SessionData|null>;
  findPlayer(sessionId:string,tokenDigest:string):Promise<Principal|null>;
  addPlayer(sessionId:string,nickname:string,tokenDigest:string,maxPlayers:number):Promise<{participantId:string}>;
  createDisplay(sessionId:string,tokenDigest:string,expiresAt:string):Promise<void>;
  findDisplay(tokenDigest:string):Promise<Principal|null>;
  revokeDisplays(sessionId:string):Promise<void>;
  mutate<T>(sessionId:string,expectedVersion:number|undefined,principalId:string,mutationId:string,fn:(data:SessionData)=>MutationResult<T>):Promise<T>;
  overdueSessions(now:string):Promise<string[]>;
  events(sessionId:string,after:number):Promise<SessionEvent[]>;
}
