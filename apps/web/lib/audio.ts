'use client';
export type Cue = 'submit'|'reveal'|'pour'|'win'|'adjust'|'letter'|'join'|'final'|'standings'|'click'|'error'|'tick';
let context: AudioContext | undefined;
let unlocked = false;
const last = new Map<Cue,number>();
const voices = new Set<{ oscillator:OscillatorNode; gain:GainNode }>();
export function unlockAudio() { unlocked = true; }
export function silenceAudio() {
  for (const voice of voices) { try { voice.oscillator.stop(); } catch {} }
  voices.clear();
}
/** Original short chip sounds. No media files, network, autoplay or score side effects. */
export function playCue(cue:Cue='submit',mode?:string,eventKey?:string) {
  if(typeof window==='undefined'||!unlocked||document.hidden) return;
  try {
    if(localStorage.getItem('multigame-sound')==='off') return;
    if(eventKey){const key='multigame-cue:'+eventKey;if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1');}
    if(voices.size>12)return;
    const now=Date.now();
    if(now-(last.get(cue)??0)<(cue==='pour'?75:cue==='adjust'?70:90)) return;
    last.set(cue,now);
    context??=new AudioContext();
    if(context.state==='suspended') void context.resume();
    const tunes:Record<Cue,number[]>={click:[740],letter:[520],adjust:[196],pour:[680,440],
      submit:[392,587,784],reveal:[262,330,392,523],win:[523,659,784],
      join:[330,440,659],final:[262,330,392,523,392,523,659,784,1047],
      standings:[392,523],error:[196,147],tick:[880]};
    const pitch=mode==='rare_answers'?.75:mode==='size_it_up'?.9:mode==='amountle'?1.15:mode==='word_puzzle'?1.25:1;
    tunes[cue].forEach((note,i)=>{
      const frequency=note*pitch;
      const oscillator=context!.createOscillator(),gain=context!.createGain();
      const short=['click','letter','adjust','pour','tick'].includes(cue);
      const duration=short?.055:cue==='final'?.18:.12;
      const t=context!.currentTime+i*(short?.025:cue==='final'?.105:.075);
      oscillator.type=cue==='pour'||cue==='adjust'?'triangle':'square';
      oscillator.frequency.setValueAtTime(frequency,t);
      if(cue==='pour')oscillator.frequency.exponentialRampToValueAtTime(frequency*.55,t+duration);
      gain.gain.setValueAtTime(0,t); gain.gain.linearRampToValueAtTime(short?.018:.025,t+.004);
      gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
      oscillator.connect(gain);gain.connect(context!.destination);
      const voice={oscillator,gain};voices.add(voice);
      oscillator.start(t);oscillator.stop(t+duration+.01);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();voices.delete(voice);};
    });
  } catch { /* Audio is optional, including when device permissions or storage are unavailable. */ }
}
