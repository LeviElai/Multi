import { z } from 'zod';

export const MODES = ['amountle','fermi','word_puzzle','draw','size_it_up','claw','drop','sling','fish','stack','crack'] as const;
export const STORED_MODES = [...MODES,'answer','rare_answers'] as const;
export type ModeId = typeof STORED_MODES[number];
export const MODE_META: Record<ModeId,{name:string;verb:string;color:string;description:string;symbol:string}> = {
  fermi:{name:'Estimate',verb:'How close can you get?',color:'#c6b4ff',description:'Lock in a number. Get as close as you can.',symbol:'↗'},
  rare_answers:{name:'Review required',verb:'Update this question',color:'#7de1ce',description:'This legacy question needs a supported answer format.',symbol:'!'},
  draw:{name:'Draw',verb:'Put pen to paper',color:'#f4d4a3',description:'Draw a number, check it, then seal the page.',symbol:'✎'},
  claw:{name:'Claw',verb:'Pick your prize',color:'#f6b4d0',description:'Move the claw and grab your answer.',symbol:'⌁'},
  drop:{name:'Drop',verb:'Choose your landing',color:'#c6b4ff',description:'Drop a ball into True or False.',symbol:'●'},
  sling:{name:'Sling',verb:'Ready, aim, answer',color:'#bde597',description:'Pull back and launch at your answer.',symbol:'Y'},
  fish:{name:'Fish',verb:'Catch your answer',color:'#7de1ce',description:'Choose your answer, then reel it in.',symbol:'⋊'},
  stack:{name:'Stack',verb:'Build your answer',color:'#ffc778',description:'Drop numbered blocks to build your total.',symbol:'▤'},
  crack:{name:'Crack',verb:'Unlock the vault',color:'#a8bcea',description:'Find the code that opens the vault.',symbol:'▣'},
  answer:{name:'Question setup',verb:'Finish your question',color:'#a8bcea',description:'Add an answer and choices to find a game.',symbol:'?'},
  word_puzzle:{name:'Guess',verb:'One letter at a time',color:'#f6b4d0',description:'Find the hidden word. Every guess gives you a clue.',symbol:'W'},
  size_it_up:{name:'Size',verb:'Trust your eye',color:'#bde597',description:'Drag to resize. Match the real-world proportions.',symbol:'↔'},
  amountle:{name:'Count',verb:'Ready, steady, drop!',color:'#ffc778',description:'Drop sweets to estimate the answer. Tap or hold to pour.',symbol:'⠿'},
};
export const ProvenanceSchema=z.enum(['verified_factual','creator_confirmed','host_judged','needs_review']);
export type Provenance=z.infer<typeof ProvenanceSchema>;
const finite=z.number().finite().min(-1e15).max(1e15);
export const QuestionMetadataSchema=z.object({answerProvided:z.boolean().optional(),questionType:z.enum(['single','multiple','boolean']).optional(),answerStructure:z.enum(['integer','approximate','decimal','boolean','choice','word','multiple','list','size','text']).optional(),scoringPolicy:z.enum(['exact','proximity']).optional()});
const common={id:z.string().uuid(),schemaVersion:z.literal(1),question:z.string().trim().min(1).max(500),timerSeconds:z.number().int().min(10).max(300),maxPoints:z.literal(1000),provenance:ProvenanceSchema,sourceUrl:z.string().max(2048).optional(),explanation:z.string().max(1500).optional(),allowRevision:z.boolean().default(true),answerProvided:z.boolean().optional(),questionType:z.enum(['single','multiple','boolean']).optional(),answerStructure:z.enum(['integer','approximate','decimal','boolean','choice','word','multiple','list','size','text']).optional(),scoringPolicy:z.enum(['exact','proximity']).optional()};
export const FermiSchema=z.object({...common,mode:z.literal('fermi'),publicConfig:z.object({unit:z.string().max(30),errorMode:z.enum(['proportional','absolute']),min:finite,max:finite,tolerance:z.number().positive().max(1e15),step:z.number().positive().default(1)}),secretConfig:z.object({answer:finite})});
export const RareSchema=z.object({...common,mode:z.literal('rare_answers'),publicConfig:z.object({rarityMethod:z.literal('live_room'),adjudication:z.enum(['allowlist','host_review']),locale:z.literal('en'),normalizationVersion:z.literal('nfkc-en-v1')}),secretConfig:z.object({answers:z.array(z.object({canonical:z.string().min(1).max(100),aliases:z.array(z.string().max(100)).max(30)})).max(500)})});
export const WordSchema=z.object({...common,mode:z.literal('word_puzzle'),publicConfig:z.object({length:z.number().int().min(3).max(12),maxAttempts:z.number().int().min(3).max(8),locale:z.literal('en'),dictionaryPolicy:z.enum(['custom','unrestricted_valid_chars'])}),secretConfig:z.object({answer:z.string().min(1).max(100),allowedGuesses:z.array(z.string().max(100)).max(5000)})});
export const SizeSchema=z.object({...common,mode:z.literal('size_it_up'),publicConfig:z.object({unit:z.string().max(20),axis:z.enum(['width','height']),referenceSize:z.number().positive().max(1e9),referenceLabel:z.string().min(1).max(60),targetLabel:z.string().min(1).max(60),asset:z.enum(['tower','bottle','circle','rocket','block','tree','person','car']),referenceAsset:z.enum(['tower','bottle','circle','rocket','block','tree','person','car']).optional(),minRatio:z.number().positive(),maxRatio:z.number().positive().max(1000),calibration:z.object({version:z.literal(1),intrinsicDimension:z.number().positive(),start:z.number().min(0),end:z.number().positive()})}),secretConfig:z.object({targetSize:z.number().positive().max(1e12)})});
export const AmountSchema=z.object({...common,mode:z.literal('amountle'),publicConfig:z.object({unit:z.string().max(30),maxCount:z.number().int().min(1).max(10000),allowRemove:z.boolean(),steps:z.array(z.union([z.literal(1),z.literal(10),z.literal(100)])).min(1).max(3),showCount:z.literal(true),tolerance:z.number().positive().max(10000)}),secretConfig:z.object({answer:z.number().int().min(0).max(10000)})});
const arcadePublic=z.object({crackScoring:z.literal('deduction-v1').optional(),selectionScoring:z.literal('balanced-v1').optional(),requiredCount:z.number().int().min(1).max(30).optional(),unit:z.string().max(30).default(''),min:finite.default(0),max:finite.default(999999),step:z.number().positive().default(1),tolerance:z.number().positive().max(1e15).default(100),codeLength:z.number().int().min(1).max(8).default(4),blockValues:z.array(z.number().int().positive().max(1e9)).min(1).max(5).default([1,5,10,25]),options:z.array(z.object({id:z.string().min(1).max(40),label:z.string().trim().min(1).max(80)})).max(6).default([]),kind:z.enum(['number','choice','boolean','text','multiple','list']).default('number')});
const arcadeSecret=z.object({answer:z.union([finite,z.string().max(3000),z.boolean()]),acceptedAlternatives:z.array(z.string().max(100)).max(30).default([]),correctOptionIds:z.array(z.string().max(40)).max(6).default([])});
const arcade=<T extends string>(mode:T)=>z.object({...common,mode:z.literal(mode),publicConfig:mode==='answer'?arcadePublic.extend({options:z.array(z.object({id:z.string().min(1).max(40),label:z.string().trim().min(1).max(100)})).max(256).default([])}):arcadePublic,secretConfig:mode==='answer'?arcadeSecret.extend({correctOptionIds:z.array(z.string().max(40)).max(256).default([])}):arcadeSecret});
export const DrawSchema=arcade('draw'),ClawSchema=arcade('claw'),DropSchema=arcade('drop'),SlingSchema=arcade('sling'),FishSchema=arcade('fish'),StackSchema=arcade('stack'),CrackSchema=arcade('crack'),AnswerSchema=arcade('answer');
export const RoundSchema=z.discriminatedUnion('mode',[FermiSchema,RareSchema,WordSchema,SizeSchema,AmountSchema,DrawSchema,ClawSchema,DropSchema,SlingSchema,FishSchema,StackSchema,CrackSchema,AnswerSchema]);
export type ArcadeRound=z.infer<typeof DrawSchema>|z.infer<typeof ClawSchema>|z.infer<typeof DropSchema>|z.infer<typeof SlingSchema>|z.infer<typeof FishSchema>|z.infer<typeof StackSchema>|z.infer<typeof CrackSchema>|z.infer<typeof AnswerSchema>;
export type Round=z.infer<typeof RoundSchema>;
export type PublicRound={id:string;mode:ModeId;schemaVersion:1;question:string;timerSeconds:number;maxPoints:1000;allowRevision:boolean;publicConfig:Round['publicConfig'];scoringPolicy?:'exact'|'proximity';fillTarget?:number};
export const QuizInputSchema=z.object({title:z.string().trim().min(1).max(100),description:z.string().max(500).default(''),language:z.literal('en').default('en'),audienceContext:z.enum(['adult_private','general']).default('adult_private'),theme:z.enum(['studio','midnight']).default('studio'),rounds:z.array(RoundSchema).max(40)});
// Drafts may contain unfinished text. Published versions still require the strict schema above.
const draftQuestion={question:z.string().max(500)};
export const DraftRoundSchema=z.discriminatedUnion('mode',[
 FermiSchema.extend(draftQuestion),RareSchema.extend(draftQuestion),
 WordSchema.extend({...draftQuestion,secretConfig:WordSchema.shape.secretConfig.extend({answer:z.string().max(100)})}),
 SizeSchema.extend({...draftQuestion,publicConfig:SizeSchema.shape.publicConfig.extend({referenceLabel:z.string().max(60),targetLabel:z.string().max(60)})}),AmountSchema.extend(draftQuestion),
 DrawSchema.extend(draftQuestion),ClawSchema.extend(draftQuestion),DropSchema.extend(draftQuestion),SlingSchema.extend(draftQuestion),FishSchema.extend(draftQuestion),StackSchema.extend(draftQuestion),CrackSchema.extend(draftQuestion),AnswerSchema.extend(draftQuestion)
]);
export const DraftQuizInputSchema=QuizInputSchema.extend({title:z.string().max(100),rounds:z.array(DraftRoundSchema).max(40)});
export type QuizInput=z.infer<typeof QuizInputSchema>;
export type Quiz=QuizInput & {id:string;ownerId:string;revision:number;status:'draft'|'published'|'archived';publishedVersionId?:string;createdAt:string;updatedAt:string};
export type QuizVersion={id:string;quizId:string;version:number;title:string;theme:string;rounds:Round[];createdAt:string};
export type ValidationIssue={roundId?:string;field:string;message:string;severity:'error'|'warning'};
export const STATES=['LOBBY','ROUND_PREPARE','ROUND_COUNTDOWN','ROUND_ACTIVE','PAUSED','ROUND_LOCKED','ROUND_EVALUATING','REVIEW_REQUIRED','ROUND_SCORED','ROUND_REVEAL','INTERMISSION','SESSION_COMPLETED','SESSION_ABORTED'] as const;
export type SessionState=typeof STATES[number];
export type Principal={role:'host';id:string}|{role:'player';id:string;sessionId:string}|{role:'display';id:string;sessionId:string};
export type Member={id:string;nickname:string;joinedAt:string;status:'active'|'kicked';avatar?:import('./avatar').Avatar};
export const InkSchema=z.array(z.array(z.object({x:z.number().int().min(0).max(640),y:z.number().int().min(0).max(240)}).strict()).min(2).max(64)).min(1).max(32);
export type Ink=z.infer<typeof InkSchema>;
export type Submission={id:string;roundId:string;participantId:string;clientMutationId:string;revision:number;payload:{value?:number;text?:string;count?:number;ratio?:number;choiceId?:string;choices?:string[];ink?:Ink;crackAttempts?:number;crackPoints?:number;crackHint?:'higher'|'lower'|'solved';locked?:boolean};acceptedAt:string};
export type WordAttempt={id:string;roundId:string;participantId:string;clientMutationId:string;attempt:number;guess:string;feedback:('exact'|'present'|'absent')[];solved:boolean;acceptedAt:string};
export type Adjudication={id:string;roundId:string;answerKey:string;decision:'accept'|'reject';canonical:string;actorId:string;createdAt:string};
export type Award={roundId:string;participantId:string;points:number;reason:string;scoringRevision:number;detail:Record<string,unknown>};
export type Leader={participantId:string;nickname:string;points:number;rank:number;roundPoints:number;avatar?:import('./avatar').Avatar};
export type ReviewItem={answerKey:string;text:string;count:number};
export type SessionRecord={id:string;versionId:string;hostId:string;pinDigest:string;pin:string;state:SessionState;stateVersion:number;roundIndex:number;deadlineAt:string|null;pausedRemainingMs:number|null;extensionCount:number;joinLocked:boolean;createdAt:string;completedAt:string|null;lastMutationId:string;latestSeq:number;maxPlayers:number};
export type SessionData={readingSeconds?:number;reviewTimeoutRoundId?:string;automatic?:boolean;pausedPhase?:SessionState;session:SessionRecord;quiz:QuizVersion;members:Member[];submissions:Submission[];attempts:WordAttempt[];adjudications:Adjudication[];awards:Award[];voidRoundIds:string[]};
export type Reveal={correctOptionIds?:string[];answer:string|number;unit?:string;explanation?:string;sourceUrl?:string;provenance:Provenance;skipped:boolean;distribution?:{label:string;value:number;points:number}[];groups?:{answer:string;count:number;points:number}[];trueRatio?:number};
export type Snapshot={completedAt?:string;automatic?:boolean;phase?:'reading'|'play'|'reveal'|'placements';phaseId?:string;finishedCount?:number;id:string;title:string;theme:string;role:Principal['role'];state:SessionState;stateVersion:number;serverTime:string;latestSeq:number;deadlineAt:string|null;pausedRemainingMs:number|null;roundIndex:number;roundCount:number;round:PublicRound|null;pin?:string;joinLocked:boolean;members:Member[];participantId?:string;ownSubmission?:Submission;ownAttempts:WordAttempt[];ownPoints?:number;answerCount:number;solvedCount:number;leaderboard:Leader[];previousLeaderboard?:Leader[];reveal?:Reveal;roundAwards?:Award[];revealStartedAt?:string;resultStage?:'reveal'|'podium'|'standings';review?:ReviewItem[];maxPlayers:number};
export const HostActionSchema=z.object({action:z.enum(['ADVANCE','START','PAUSE','RESUME','EXTEND','LOCK','REVEAL','NEXT','SKIP','END','LOCK_JOIN','UNLOCK_JOIN','KICK','RESULT_STAGE']),expectedStateVersion:z.number().int().min(0),args:z.object({stage:z.enum(['reveal','podium','standings','auto']).optional(),seconds:z.number().int().min(1).max(60).optional(),participantId:z.string().uuid().optional(),reason:z.string().max(200).optional()}).optional()});
export type HostAction=z.infer<typeof HostActionSchema>;
export const SubmitSchema=z.object({roundId:z.string().uuid(),clientMutationId:z.string().uuid(),revision:z.number().int().positive(),payload:z.object({value:finite.optional(),text:z.string().max(100).optional(),count:z.number().int().min(0).max(10000).optional(),ratio:z.number().positive().max(1000).optional(),choiceId:z.string().max(40).optional(),choices:z.array(z.string().max(100)).max(30).optional(),ink:InkSchema.optional(),locked:z.boolean().optional()}).strict()});
export const WordGuessSchema=z.object({roundId:z.string().uuid(),clientMutationId:z.string().uuid(),guess:z.string().max(100)});
export type Ack={clientMutationId:string;accepted:true;serverRevision:number;acceptedAt:string;acceptedCount?:number;feedback?:WordAttempt['feedback'];solved?:boolean;attempt?:number;potentialPoints?:number;direction?:'higher'|'lower'|'solved'};
export type SessionEvent={eventId:string;sessionId:string;seq:number;type:string;occurredAt:string;stateVersion:number;payload:Record<string,unknown>};
export type ApiError={error:{code:string;message:string;requestId:string;details?:unknown}};
export class DomainError extends Error {code:string;status:number;details?:unknown;constructor(code:string,message:string,status=400,details?:unknown){super(message);this.code=code;this.status=status;this.details=details;}}
export type Features={auth?:'credentials'|'chatgpt';ai:boolean;billing:boolean;ads:boolean;stage:'development'|'private_alpha'|'beta'|'public';transport:'socket'|'polling'};
export type Profile={id:string;displayName:string;features:Features;plan:'free'|'premium';quotaRemaining:number};
