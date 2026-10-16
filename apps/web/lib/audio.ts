'use client';
let context: AudioContext | undefined;
const last = new Map<Cue,number>();
export type Cue = 'submit' | 'reveal' | 'pour' | 'win' | 'adjust' | 'letter' | 'join' | 'final' | 'standings';
/** One lazy, reusable audio context; sound is opt-in and never gates gameplay. */
export function playCue(cue: Cue = 'submit') {
    if (typeof window === 'undefined')
        return;
    try {
        if (localStorage.getItem('multigame-sound') !== 'on')
            return;
        if (Date.now() - (last.get(cue)??0) < (cue==='pour'?240:120))
            return;
        last.set(cue,Date.now());
        context ??= new window.AudioContext();
        if (context.state === 'suspended')
            void context.resume();
        const notes = cue === 'reveal' ? [261.63, 329.63, 392, 523.25] : cue === 'win' ? [392, 523.25, 659.25] : cue === 'pour' ? [440] : cue === 'adjust' ? [220] : cue === 'letter' ? [600] : cue === 'final' ? [392,523,659,784] : cue === 'standings' ? [330,440] : [392, 523.25];
        notes.forEach((frequency, i) => { const oscillator = context!.createOscillator(), gain = context!.createGain(); const t = context!.currentTime + i * .1; oscillator.type = cue === 'reveal' ? 'sine' : 'triangle'; oscillator.frequency.setValueAtTime(frequency, t); gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.035, t + .012); gain.gain.exponentialRampToValueAtTime(.001, t + .25); oscillator.connect(gain); gain.connect(context!.destination); oscillator.start(t); oscillator.stop(t + .27); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); }; });
    }
    catch { /* Sound stays optional. */ }
}
