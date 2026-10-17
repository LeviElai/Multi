'use client';
import {useState,useRef,useEffect} from 'react';
import {api} from '../../lib/api';
import {MODE_META,type ModeId,type Round} from '../../../../packages/contracts/src/index';
import {answerFromRound,recommend,roundFromAnswer,QUESTION_TYPES,type QuestionAnswer,type AnswerKind} from '../../../../packages/game-modes/src/question';
import {PixelSprite} from '../world/Sprites';
import {SimpleModeEditor} from './SimpleModeEditor';

export function QuestionEditor({round,recent,onChange}:{round:Round;recent:ModeId[];onChange:(r:Round)=>void}){
 const [generating,setGenerating]=useState(false),[aiMessage,setAiMessage]=useState('');const aiAbort=useRef<AbortController|null>(null),aiBusy=useRef(false);
 useEffect(()=>()=>{aiAbort.current?.abort();},[]);
 const [legacy,setLegacy]=useState(round.mode==='rare_answers');
 const [q,setQ]=useState(()=>answerFromRound(round)),[format,setFormat]=useState<AnswerKind|'auto'>((['choice','word','approximate','size','list','multiple'].includes(round.answerStructure??'')?round.answerStructure:'auto')??'auto'),[manual,setManual]=useState<ModeId|null>(round.questionType?round.mode:null),[changing,setChanging]=useState(false),[distractorText,setDistractorText]=useState(()=>answerFromRound(round).distractors.join('\n'));
 const suggestion=recommend(q,recent),compatible=suggestion.games,chosen=manual&&compatible.includes(manual)?manual:compatible[0];
 const latestQ=useRef(q);latestQ.current=q;
 async function suggestChoices(){
  if(aiBusy.current||!q.answer.trim()||q.text.trim().length<3)return;
  aiBusy.current=true;setGenerating(true);setAiMessage('');const controller=new AbortController();aiAbort.current=controller;
  const original={...q};
  try{
   const job=await api<{id:string}>('/ai/generate',{method:'POST',signal:controller.signal,body:JSON.stringify({topic:q.text.slice(0,300),count:1,modes:['fish'],instructions:'Keep the supplied question and correct answer exactly. Suggest 2 or 3 distinct incorrect options. Never add another correct answer.',distractorFor:{question:q.text,answer:q.answer}})});
   let result:{status:string;quizId?:string;message?:string}|undefined;
   for(let i=0;i<35;i++){
    if(controller.signal.aborted)return;
    result=await api('/ai/jobs/'+job.id,{signal:controller.signal});
    if(result?.status==='done'||result?.status==='failed'||result?.status==='rejected')break;
    await new Promise(resolve=>setTimeout(resolve,1800));
   }
   if(result?.status!=='done'||!result.quizId)throw new Error(result?.message??'Your request is still saved. Check My quizzes shortly; do not start another request.');
   const quiz=await api<{id:string;rounds:Round[]}>('/quizzes/'+result.quizId,{signal:controller.signal});
   const item=quiz.rounds[0];if(!('options' in item.publicConfig)||!('correctOptionIds' in item.secretConfig))throw new Error('Check the generated draft in My quizzes.');
   const correctIds=item.secretConfig.correctOptionIds;const labels=item.publicConfig.options.filter(o=>!correctIds.includes(o.id)).map(o=>o.label);
   if(JSON.stringify(latestQ.current)!==JSON.stringify(original)){setAiMessage('Your question changed. The suggestions are saved as a private draft in My quizzes.');return;}
   setDistractorText(labels.join('\n'));setFormat('choice');setManual(null);update({distractors:labels,kind:'choice'},'choice',null,true);
   await api('/quizzes/'+quiz.id,{method:'DELETE',signal:controller.signal});
   setAiMessage('Suggestions added · 1 question credit used. Review every option before publishing.');
  }catch(e){if(!controller.signal.aborted)setAiMessage(e instanceof Error?e.message:'Could not suggest choices.');}
  finally{aiBusy.current=false;if(!controller.signal.aborted)setGenerating(false);}
 }
 function update(patch:Partial<QuestionAnswer>,nextFormat=format,nextManual=manual,needsReview=false){
  const next={...q,...patch};
  if(next.type==='boolean'){next.kind='boolean';next.exact=true;}
  else if(next.type==='multiple'){next.kind=nextFormat==='list'?'list':'multiple';next.exact=true;}
  else if(nextFormat==='auto')next.kind=next.distractors.some(s=>s.trim())?'choice':/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(next.answer.trim())?(Number.isInteger(Number(next.answer))?'integer':'decimal'):'text';
  else next.kind=nextFormat;
  if(nextFormat==='approximate'&&format!=='approximate')next.exact=false;
  const rec=recommend(next,recent),mode=nextManual&&rec.games.includes(nextManual)?nextManual:rec.games[0];
  setQ(next);onChange({...roundFromAnswer(next,mode,round),provenance:needsReview?'needs_review':round.provenance});
 }
 const number=['integer','decimal','approximate'].includes(q.kind);
 if(legacy)return <div className="notice"><h3>Review this question’s answer format</h3><p>{round.question}</p><p>Preserved answers: {q.answer.split('|').join(', ')}</p><p>The old rarity game is retired. Decide what players should do before converting this question.</p><div className="button-row"><button className="btn btn-outline" onClick={()=>{setLegacy(false);setFormat('list');update({type:'multiple',kind:'list'},'list',null);}}>Require the complete list</button><button className="btn btn-outline" onClick={()=>{setLegacy(false);setFormat('multiple');update({type:'multiple',kind:'multiple'},'multiple',null);}}>Select every correct option</button></div><small>Both formats keep the original answer set. Review the wording to match your choice.</small></div>;
 return <div className="question-first-editor">
 {round.mode==='rare_answers'&&<div className="notice" role="status"><strong>This old question needs your review.</strong><p>Its accepted answers are preserved below. Choose whether players must list them all or select correct options. It will not be published until updated.</p></div>}
 <div className="question-type-tabs" role="group" aria-label="Question type">{QUESTION_TYPES.map(t=><button className={q.type===t.id?'selected':''} key={t.id} aria-pressed={q.type===t.id} onClick={()=>{setManual(null);setFormat('auto');update({type:t.id,answer:'',distractors:[]},'auto',null);setDistractorText('');}}>{t.name}</button>)}</div>
 <label className="creator-field"><span>{q.type==='boolean'?'Statement':'Your question'}</span><textarea className="field question-field" rows={3} maxLength={500} value={q.text} placeholder={q.type==='boolean'?'Write a statement players can judge.':'What would you like to ask?'} onChange={e=>update({text:e.target.value})}/></label>
 {q.type==='single'&&<label className="creator-field answer-format"><span>Answer format</span><select className="field" value={format} onChange={e=>{const kind=e.target.value as AnswerKind|'auto';setFormat(kind);setManual(null);update({},kind,null);}}><option value="auto">Automatic · number or short text</option><option value="choice">One correct choice</option><option value="word">Hidden word and clue</option><option value="approximate">Numerical estimate</option><option value="size">Calibrated size comparison</option></select></label>}
 {q.type==='multiple'&&<label className="creator-field"><span>How should players respond?</span><select className="field" value={q.kind==='list'?'list':'multiple'} onChange={e=>{setFormat(e.target.value as AnswerKind);update({},e.target.value as AnswerKind);}}><option value="multiple">Select every correct option</option><option value="list">Enter every required answer</option></select><small>These use a simple answer input. Single-choice games cannot represent several correct answers.</small></label>}
 {q.type==='multiple'&&q.kind==='list'&&<div className="creator-two-col"><label className="creator-field"><span>Required responses</span><select className="field" value={q.requiredCount===undefined?'all':'some'} onChange={e=>update({requiredCount:e.target.value==='all'?undefined:1})}><option value="all">Every answer in my list</option><option value="some">Any set number from my list</option></select></label>{q.requiredCount!==undefined&&<label className="creator-field"><span>How many?</span><input className="field" type="number" min={1} max={30} value={q.requiredCount} onChange={e=>update({requiredCount:Number(e.target.value)})}/></label>}</div>}
 {q.type==='boolean'?<fieldset className="boolean-author"><legend>Correct answer</legend>{['true','false'].map(v=><button type="button" key={v} className="btn btn-outline" aria-pressed={q.answer===v} onClick={()=>update({answer:v})}>{v==='true'?'True':'False'}</button>)}</fieldset>:q.kind==='size'?null:<label className="creator-field"><span>{q.type==='multiple'?'Correct answers · one per line':q.kind==='word'?'Hidden word':'Correct answer'}</span>{q.type==='multiple'?<textarea className="field" rows={3} maxLength={3000} value={q.answer.split('|').join('\n')} onChange={e=>update({answer:e.target.value.split('\n').join('|')})}/>:<input className="field correct-answer" autoComplete="off" maxLength={100} value={q.answer} placeholder={q.kind==='word'?'3–12 letters':'Enter the answer'} onChange={e=>update({answer:e.target.value})}/>}</label>}
 {(q.kind==='choice'||q.kind==='multiple'||(q.type==='single'&&q.kind==='text'))&&<label className="creator-field"><span>{q.kind==='multiple'?'Incorrect choices':'Other choices · optional'}</span><textarea className="field" rows={3} maxLength={500} value={distractorText} placeholder="One incorrect choice per line" onChange={e=>{setDistractorText(e.target.value);update({distractors:e.target.value.split('\n')});}}/><small>Review every choice. Adding alternatives unlocks Fish, Claw and Sling for a single answer.</small></label>}
 {q.type==='single'&&['choice','text'].includes(q.kind)&&<div className="choice-suggestions"><button className="btn btn-outline" disabled={generating||!q.answer.trim()||q.text.trim().length<3} onClick={()=>void suggestChoices()}>{generating?'Suggesting…':'Generate incorrect options · 1 credit'}</button>{aiMessage&&<p role="status" className="creator-help">{aiMessage}</p>}</div>}
 {q.type==='single'&&q.kind==='text'&&<details><summary>Other accepted spellings · optional</summary><label className="creator-field"><span>Accepted alternatives · one per line</span><textarea className="field" rows={2} maxLength={1000} value={q.alternatives.join('\n')} onChange={e=>update({alternatives:e.target.value.split('\n').filter(s=>s.trim())})}/></label></details>}
 {number&&<div className="creator-two-col"><label className="creator-field"><span>Unit · optional</span><input className="field" maxLength={30} value={q.unit} placeholder="people, km, years…" onChange={e=>update({unit:e.target.value})}/></label><label className="creator-field"><span>Scoring</span><select className="field" value={q.exact?'exact':'proximity'} onChange={e=>update({exact:e.target.value==='exact'})}><option value="exact">Exact answer only</option><option value="proximity">Closer earns more</option></select></label></div>}
 <div className="suggested-interaction"><PixelSprite kind={chosen}/><div><small>{manual?'Selected interaction':'MULTIGAME suggests'}</small><strong>{MODE_META[chosen].name}</strong><p>{suggestion.reason}</p></div><button className="text-link" aria-expanded={changing} onClick={()=>setChanging(v=>!v)}>Change</button></div>
 {changing&&<div className="compatible-games" role="group" aria-label="Compatible games">{compatible.map(mode=><button key={mode} aria-pressed={chosen===mode} onClick={()=>{setManual(mode);onChange(roundFromAnswer(q,mode,round));}}><PixelSprite kind={mode}/><strong>{MODE_META[mode].name}</strong><small>{MODE_META[mode].description}</small></button>)}<button className="text-link" onClick={()=>{setManual(null);onChange(roundFromAnswer(q,suggestion.games[0],round));}}>Choose automatically</button></div>}
 {suggestion.missing&&<p className="creator-help">{suggestion.missing}</p>}
 {q.kind==='size'&&round.mode==='size_it_up'&&<SimpleModeEditor round={round} onChange={r=>onChange({...r,answerProvided:true})}/>}
 <p className="question-preview-hint">▶ Try the playable preview before adding your next question.</p>
 </div>;
}
