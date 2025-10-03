import React, { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'

/**
 * Compact UI update:
 * - Introduces <CollapsiblePanel/> "drawer" component with smooth height animation
 * - Drums, Synth (piano roll + controls), and Sampler live inside collapsible drawers
 * - Panel open/closed state is persisted in localStorage (so your layout sticks)
 * - "Collapse/Expand All" convenience in the global controls row
 */

// ---------------- Utility: CollapsiblePanel (aka Drawer) ----------------
function CollapsiblePanel({
  id,
  title,
  accent,
  defaultOpen = false,
  right,
  children,
}: {
  id: string;                     // unique id for localStorage
  title: React.ReactNode;
  accent?: string;                // small color dot
  defaultOpen?: boolean;
  right?: React.ReactNode;        // stuff to the right of the header (e.g., counters)
  children: React.ReactNode;
}) {
  const key = `drawer:${id}:open`;
  const [open, setOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem(key);
    return saved === null ? defaultOpen : saved === '1';
  });
  useEffect(() => { localStorage.setItem(key, open ? '1' : '0'); }, [open]);

  // height animation via inline style (measure once per toggle)
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [animH, setAnimH] = useState<number | 'auto'>(open ? 'auto' : 0);
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (open) {
      const h = el.scrollHeight;
      setAnimH(h);
      const t = setTimeout(() => setAnimH('auto'), 180);
      return () => clearTimeout(t);
    } else {
      const h = el.scrollHeight;
      // set current height, then next frame set to 0 for transition
      setAnimH(h);
      requestAnimationFrame(() => setAnimH(0));
    }
  }, [open]); // ← remove `children` to prevent flicker during playback rerenders

  return (
    <div className="panel" style={{ marginTop: 12, borderRadius: 10, overflow: 'hidden' }}>
      <button
        className="row"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 12px',
          background: 'var(--panelSub, #0f1518)',
          cursor: 'pointer',
          border: 'none',
          color: '#e7f1ff', // higher-contrast header text
        }}
      >
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          {accent && <div style={{ width: 12, height: 12, borderRadius: 6, background: accent }} />}
          <strong style={{ fontSize: 14, color: '#e7f1ff' }}>{title}</strong>
        </div>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          {right}
          <span aria-hidden style={{ color: '#e7f1ff' }}>{open ? '▾' : '▸'}</span>
        </div>
      </button>

      <div
        style={{
          height: animH === 'auto' ? 'auto' : animH,
          transition: 'height 180ms ease',
        }}
      >
        <div ref={innerRef} style={{ padding: '10px 12px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------- Existing App ----------------
const STEPS = 16

const TRACKS = [
  { id: 'kick',  name: 'Kick',  color: '#34d399' as const },
  { id: 'snare', name: 'Snare', color: '#fb7185' as const },
  { id: 'hihat', name: 'Hi-Hat',color: '#f59e0b' as const },
  { id: 'perc',  name: 'Perc',  color: '#60a5fa' as const },
] as const

type TrackId = typeof TRACKS[number]['id']

// Low-ish notes for a bassy feel (top row is lowest visually)
const ROLL_NOTES = ['C3','B2','A#2','A2','G#2','G2','F#2','F2','E2','D#2','D2','C2'] as const

type RollIndex = number | null

type Oversample = 'none' | '2x' | '4x'

type SynthPreset = {
  name: string
  params: {
    wave: 'sine'|'triangle'|'square'|'sawtooth'
    cutoff: number
    resonance: number
    attack: number
    decay: number
    sustain: number
    release: number
    detune: number
    porta: number
    distOn: boolean
    distAmount: number
    distWet: number
    distOversample: Oversample
    drive: number
    makeup: number
  }
}

const SYNTH_PRESETS: SynthPreset[] = [
  {
    name: 'House Bass',
    params: { wave: 'sawtooth', cutoff: 1200, resonance: 1.2, attack: 0.003, decay: 0.12, sustain: 0.1, release: 0.18, detune: 0, porta: 0.02, distOn: true, distAmount: 0.45, distWet: 0.65, distOversample: '2x', drive: 2.2, makeup: 0.9 },
  },
  {
    name: 'Techno Rumble',
    params: { wave: 'sine', cutoff: 700, resonance: 1.8, attack: 0.002, decay: 0.22, sustain: 0.0, release: 0.4, detune: -5, porta: 0.03, distOn: true, distAmount: 0.65, distWet: 0.85, distOversample: '4x', drive: 3.2, makeup: 0.8 },
  },
  {
    name: 'Hip-Hop Sub',
    params: { wave: 'sine', cutoff: 500, resonance: 0.8, attack: 0.004, decay: 0.35, sustain: 0.15, release: 0.5, detune: 0, porta: 0.08, distOn: false, distAmount: 0.2, distWet: 0.0, distOversample: '2x', drive: 1.4, makeup: 0.95 },
  },
  {
    name: 'UKG Reese',
    params: { wave: 'square', cutoff: 1600, resonance: 1.4, attack: 0.003, decay: 0.25, sustain: 0.25, release: 0.28, detune: 12, porta: 0.04, distOn: true, distAmount: 0.5, distWet: 0.6, distOversample: '2x', drive: 2.8, makeup: 0.85 },
  },
  {
    name: 'Acid Squelch',
    params: { wave: 'sawtooth', cutoff: 900, resonance: 6.0, attack: 0.002, decay: 0.18, sustain: 0.0, release: 0.16, detune: 0, porta: 0.0, distOn: true, distAmount: 0.7, distWet: 0.75, distOversample: '4x', drive: 3.5, makeup: 0.8 },
  },
]

type MarkerIndex = number | null; // 0..15 or null
const MAX_MARKERS = 16;

type PatternState = {
  drums: Record<TrackId, boolean[]>
  synthRoll: RollIndex[]
  samplerRoll: MarkerIndex[]
}

function makeEmpty(): PatternState {
  const drums = TRACKS.reduce(
    (acc, t) => ({ ...acc, [t.id]: Array(STEPS).fill(false) }),
    {} as Record<TrackId, boolean[]>
  );
  const synthRoll = Array<RollIndex>(STEPS).fill(null);
  const samplerRoll = Array<MarkerIndex>(STEPS).fill(null);
  return { drums, synthRoll, samplerRoll };
}

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [bpm, setBpm] = useState(120)
  const [swing, setSwing] = useState(0)
  const [accentEvery, setAccentEvery] = useState(4)
  const [playerReady, setPlayerReady] = useState(false);

  // --- Drawers: global expand/collapse convenience ---
  const [allOpenVersion, setAllOpenVersion] = useState(0); // bump to re-open/close all via events
  function expandAll() {
    ['drums','synth','sampler'].forEach(id=>localStorage.setItem(`drawer:${id}:open`,'1'));
    setAllOpenVersion(v=>v+1);
  }
  function collapseAll() {
    ['drums','synth','sampler'].forEach(id=>localStorage.setItem(`drawer:${id}:open`,'0'));
    setAllOpenVersion(v=>v+1);
  }

  // --- Presets state & helpers ---
  const [presetIndex, setPresetIndex] = useState(0)
  function applyPreset(i: number) {
    const p = SYNTH_PRESETS[(i + SYNTH_PRESETS.length) % SYNTH_PRESETS.length].params
    setWave(p.wave); setCutoff(p.cutoff); setResonance(p.resonance); setAttack(p.attack); setDecay(p.decay);
    setSustain(p.sustain); setRelease(p.release); setDetune(p.detune); setPorta(p.porta);
    setDistOn(p.distOn); setDistAmount(p.distAmount); setDistWet(p.distWet); setDistOversample(p.distOversample);
    setDrive(p.drive); setMakeup(p.makeup)
  }
  function nextPreset() { setPresetIndex(i=>{ const n=(i+1)%SYNTH_PRESETS.length; applyPreset(n); return n; }) }
  function prevPreset() { setPresetIndex(i=>{ const n=(i-1+SYNTH_PRESETS.length)%SYNTH_PRESETS.length; applyPreset(n); return n; }) }

  const COLS = 8;
  const isPlayingCol = (i:number) => isPlaying && i === step;

  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  function nextTrack() { setCurrentTrackIndex(i => (i + 1) % TRACKS.length) }
  function prevTrack() { setCurrentTrackIndex(i => (i - 1 + TRACKS.length) % TRACKS.length) }

  const [pianoPage, setPianoPage] = useState(0)
  const [followRoll, setFollowRoll] = useState(true)
  function nextPianoPage() { setFollowRoll(false); setPianoPage(p => (p + 1) % 2); }
  function prevPianoPage() { setFollowRoll(false); setPianoPage(p => (p - 1 + 2) % 2); }

  function clearSamplerPattern() { setState(prev => ({ ...prev, samplerRoll: Array(STEPS).fill(null) })) }

  // ---- Synth parameter presets/randomizer ----
  function resetSynthParams() { setWave('sawtooth'); setCutoff(1200); setResonance(1.2); setAttack(0.005); setDecay(0.12); setSustain(0.1); setRelease(0.2); setDetune(0); setPorta(0.0) }
  function randomizeSynthParams() {
    const waves: typeof wave[] = ['sine','triangle','square','sawtooth'];
    setWave(waves[Math.floor(Math.random()*waves.length)]);
    setDistOn(true); setDistAmount(parseFloat((0.2 + Math.random()*0.7).toFixed(3))); setDistWet(parseFloat((0.5 + Math.random()*0.5).toFixed(3)));
    setDistOversample(['none','2x','4x'][Math.floor(Math.random()*3)] as any); setDrive(parseFloat((1.4 + Math.random()*1.6).toFixed(2)));
    setMakeup(parseFloat((0.7 + Math.random()*0.4).toFixed(2)));
    const wantBrighter = Math.random() < 0.7; const minCut = wantBrighter ? 3000 : 1200;
    setCutoff(Math.round(minCut + Math.random() * (8000 - minCut))); setResonance(parseFloat((0.6 + Math.random()*6).toFixed(2)));
    setAttack(parseFloat((0.001 + Math.random()*0.12).toFixed(3))); setDecay(parseFloat((0.04 + Math.random()*0.5).toFixed(3)));
    setSustain(parseFloat((Math.random()*0.8).toFixed(2))); setRelease(parseFloat((0.06 + Math.random()*0.9).toFixed(3)));
    setDetune(Math.round((Math.random()*2-1) * 40)); setPorta(parseFloat((Math.random()*0.25).toFixed(3)));
  }

  const [distOn, setDistOn] = useState(true);
  const [distAmount, setDistAmount] = useState(0.3);
  const [distWet, setDistWet] = useState(0.4);
  const [distOversample, setDistOversample] = useState<'none'|'2x'|'4x'>('2x');
  const [drive, setDrive] = useState(1.8);
  const [makeup, setMakeup] = useState(0.85);

  // --- Sampler state ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sampleUrlRef = useRef<string | null>(null);
  const playerRef = useRef<Tone.Player | null>(null);
  const [markers, setMarkers] = useState<number[]>([]);

  // ---- Helpers for musical randomization ----
  const SCALES: Record<string, number[]> = {
    major: [0,2,4,5,7,9,11], minor: [0,2,3,5,7,8,10], pentatonic: [0,3,5,7,10], blues: [0,3,5,6,7,10]
  };
  function noteToMidi(n: string): { midi: number; pc: number } { const m = n.match(/^([A-Ga-g])([#b]?)(-?\d+)$/); if (!m) return { midi: 60, pc: 0 }; const L = m[1].toUpperCase(); const acc = m[2]; const oct = parseInt(m[3], 10); const base: Record<string, number> = {C:0, D:2, E:4, F:5, G:7, A:9, B:11}; let semis = base[L] ?? 0; if (acc === '#') semis += 1; if (acc === 'b') semis -= 1; const midi = semis + (oct + 1) * 12; return { midi, pc: ((semis % 12) + 12) % 12 }; }
  function euclid(k: number, n: number): boolean[] { k = Math.max(0, Math.min(n, Math.round(k))); if (k === 0) return Array(n).fill(false); if (k === n) return Array(n).fill(true); const pattern: boolean[] = []; let bucket = 0; for (let i = 0; i < n; i++) { bucket += k; if (bucket >= n) { bucket -= n; pattern.push(true); } else pattern.push(false); } const rot = Math.floor(Math.random() * n); return pattern.map((_, i) => pattern[(i + rot) % n]); }
  function pickNextIndex(allowed: number[], prevIdx: number | null, jumpProb = 0.15): number { if (allowed.length === 0) return 0; if (prevIdx == null) { const center = Math.floor(allowed.length / 2); const weights = allowed.map((_, i) => { const d = Math.abs(i - center); return Math.exp(-0.5 * d * d); }); const sum = weights.reduce((a, b) => a + b, 0); let r = Math.random() * sum; for (let i = 0; i < allowed.length; i++) { r -= weights[i]; if (r <= 0) return allowed[i]; } return allowed[center]; } const iPrev = allowed.indexOf(prevIdx); if (iPrev < 0 || Math.random() < jumpProb) { const hop = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.floor(Math.random() * 3)); const target = allowed.reduce((best, idx) => Math.abs(idx - prevIdx) < Math.abs(best - prevIdx) ? idx : best, allowed[0]); const alt = prevIdx + hop; const clamped = allowed.reduce((best, idx) => Math.abs(idx - alt) < Math.abs(best - alt) ? idx : best, target); return clamped; } else { const candidates: number[] = []; for (let off of [-2,-1,1,2]) { const pos = iPrev + off; if (pos >= 0 && pos < allowed.length) candidates.push(allowed[pos]); } if (candidates.length === 0) return allowed[iPrev]; return candidates[Math.floor(Math.random() * candidates.length)]; } }

  function randomizeSynth(arg?: number | { scale?: 'major'|'minor'|'pentatonic'|'blues'; density?: number; hits?: number; root?: 'C'|'C#'|'Db'|'D'|'D#'|'Eb'|'E'|'F'|'F#'|'Gb'|'G'|'G#'|'Ab'|'A'|'A#'|'Bb'|'B'; jumpProb?: number; }){
    const opts = (typeof arg === 'number') ? (arg > 1 ? { hits: Math.round(arg) } : { density: arg }) : (arg || {});
    const scaleName = opts.scale ?? 'minor';
    const rootName  = (opts.root || 'C').replace('♯','#').replace('♭','b') as any;
    const jumpProb  = Math.max(0, Math.min(1, opts.jumpProb ?? 0.15));
    const density   = Math.max(0, Math.min(1, opts.density ?? 0.42));
    const hits      = Math.max(0, Math.min(STEPS, opts.hits != null ? Math.round(opts.hits) : Math.round(density * STEPS)));

    const SCALES: Record<string, number[]> = { major:[0,2,4,5,7,9,11], minor:[0,2,3,5,7,8,10], pentatonic:[0,3,5,7,10], blues:[0,3,5,6,7,10] };
    const rootPcMap: Record<string, number> = { C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11 };
    const rootPc = rootPcMap[rootName] ?? 0;
    const pcs = SCALES[scaleName] || SCALES.minor;
    const allowedPc = new Set(pcs.map(v => (v + rootPc) % 12));

    const rowPc: number[] = [];
    const allowedRows: number[] = [];
    function noteToMidi(n: string){ const m=n.match(/^([A-Ga-g])([#b]?)(-?\d+)$/); if(!m) return {pc:0}; const L=m[1].toUpperCase(), acc=m[2]; const base: Record<string,number>={C:0,D:2,E:4,F:5,G:7,A:9,B:11}; let s=base[L]??0; if(acc==='#') s++; if(acc==='b') s--; return { pc: ((s%12)+12)%12 }; }
    for (let r=0;r<ROLL_NOTES.length;r++){ const { pc } = noteToMidi(ROLL_NOTES[r]); rowPc[r]=pc; if (allowedPc.has(pc)) allowedRows.push(r); }

    const mask:boolean[] = (()=>{ const n=STEPS,k=Math.max(0,Math.min(n,hits)); const out:boolean[]=[]; let bucket=0; for(let i=0;i<n;i++){ bucket+=k; if(bucket>=n){bucket-=n; out.push(true);} else out.push(false); } const rot = Math.floor(Math.random()*n); return out.map((_,i)=>out[(i+rot)%n]); })();

    const line:(number|null)[] = Array(STEPS).fill(null);
    let prev:number|null = null;

    for(let i=0;i<STEPS;i++){
      if(!mask[i]) continue;
      const idx = pickNextIndex(allowedRows, prev, jumpProb);
      if(prev!==null && idx===prev && Math.random()<0.6){ const pos=allowedRows.indexOf(idx); const alt=pos+(Math.random()<0.5?-1:1); line[i]=(alt>=0 && alt<allowedRows.length)? allowedRows[alt] : idx; } else { line[i]=idx; }
      prev=line[i]!;
    }

    const rootRows = ROLL_NOTES.map((_,r)=>r).filter(r=>rowPc[r]===rootPc);
    if(rootRows.length){ for(let i=STEPS-2;i<STEPS;i++){ if(mask[i] && Math.random()<0.4){ const cur = line[i] ?? allowedRows[Math.floor(allowedRows.length/2)]; let best=rootRows[0]; for(const rr of rootRows) if(Math.abs(rr-(cur??rr))<Math.abs(best-(cur??rr))) best=rr; line[i]=best; } } }

    setState(prev => ({ ...prev, synthRoll: line }));
  }

  async function onSampleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (sampleUrlRef.current) URL.revokeObjectURL(sampleUrlRef.current);
    const url = URL.createObjectURL(file); sampleUrlRef.current = url;
    if (!audioRef.current) { audioRef.current = new Audio(); }
    audioRef.current.src = url; audioRef.current.crossOrigin = 'anonymous';
    if (playerRef.current) { playerRef.current.dispose(); playerRef.current = null; }
    setPlayerReady(false);
    const p = new Tone.Player({ volume: -4, fadeIn: 0.002, fadeOut: 0.008, autostart: false, loop: false, }).connect((synthsRef.current as any)?.bus ?? Tone.getDestination());
    playerRef.current = p;
    let cancelled = false; p.load(url).then(()=>{ if(!cancelled) setPlayerReady(true); }).catch(()=>{});
    setMarkers([]);
  }
  function addMarkerHere() { const a = audioRef.current; if (!a) return; const t = a.currentTime || 0; setMarkers(prev => { if (prev.length >= MAX_MARKERS) return prev; const next = [...prev, t].sort((x, y) => x - y); return next; }); }
  function clearMarkers() { setMarkers([]); }
  function toggleSamplerCell(markerRow: number, stepCol: number) { setState(prev => { const next = { ...prev, samplerRoll: [...prev.samplerRoll] }; next.samplerRoll[stepCol] = (next.samplerRoll[stepCol] === markerRow ? null : markerRow); return next; }); }

  // ---- Synth tone controls (UI state) ----
  const [wave, setWave] = useState<'sine'|'triangle'|'square'|'sawtooth'>('sawtooth')
  const [cutoff, setCutoff] = useState(1200)
  const [resonance, setResonance] = useState(1.2)
  const [attack, setAttack] = useState(0.005)
  const [decay, setDecay] = useState(0.12)
  const [sustain, setSustain] = useState(0.1)
  const [release, setRelease] = useState(0.2)
  const [detune, setDetune] = useState(0)
  const [porta, setPorta] = useState(0.0)

  // load/save pattern state
  const [state, setState] = useState<PatternState>(() => {
    const saved = localStorage.getItem('patterns_v2');
    if (saved) { const parsed = JSON.parse(saved); if (!parsed.samplerRoll) parsed.samplerRoll = Array(STEPS).fill(null); return parsed; }
    const legacy = localStorage.getItem('patterns');
    if (legacy) return { drums: JSON.parse(legacy), synthRoll: Array(STEPS).fill(null), samplerRoll: Array(STEPS).fill(null) };
    return makeEmpty();
  });
  const { drums, synthRoll, samplerRoll } = state;

  const [step, setStep] = useState(0)

  const synthsRef = useRef<{
    [k in TrackId]: any
  } & { synth: Tone.Synth, filter: Tone.Filter, bus: Tone.Gain } | null>(null)

  const seqRef = useRef<Tone.Sequence | null>(null)
  const startedRef = useRef(false)

  // persist patterns
  useEffect(() => { localStorage.setItem('patterns_v2', JSON.stringify(state)) }, [state])

  // setup transport
  useEffect(() => { Tone.Transport.bpm.value = bpm; Tone.Transport.swing = swing; Tone.Transport.swingSubdivision = '8n' }, [bpm, swing])

  // init instruments once
  useEffect(() => {
    if (synthsRef.current) return
    const bus = new Tone.Gain(0.9).toDestination()

    const kick = new Tone.MembraneSynth({ volume: -4, pitchDecay: 0.05, octaves: 8, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.2 }, }).connect(bus)
    const snareFilter = new Tone.Filter(1800, 'bandpass').connect(bus)
    const snare = new Tone.NoiseSynth({ volume: -6, noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.22, sustain: 0 }, }).connect(snareFilter)
    const hihat = new Tone.MetalSynth({ volume: -8, envelope: { attack: 0.001, decay: 0.08, release: 0.01 }, frequency: 250, harmonicity: 5.1, modulationIndex: 32, octaves: 1.5, } as any).connect(bus)
    ;(hihat as any).resonance = 4000
    const perc = new Tone.Synth({ volume: -8, oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.05 }, }).connect(bus)

    const filter = new Tone.Filter({ type: 'lowpass', frequency: cutoff, Q: resonance } as any)
    const preGain  = new Tone.Gain(drive)
    const distortion = new Tone.Distortion({ distortion: distAmount, oversample: distOversample, wet: distOn ? distWet : 0, })
    const postGain = new Tone.Gain(makeup)

    const synth = new Tone.Synth({ oscillator: { type: wave }, envelope: { attack, decay, sustain, release }, detune, portamento: porta, volume: -4, })
      .connect(filter).connect(preGain).connect(distortion).connect(postGain).connect(bus)

    synthsRef.current = { kick, snare, hihat, perc, synth, filter, preGain, distortion, postGain, bus } as any
  }, [])

  // apply synth parameter changes whenever UI state changes
  useEffect(() => {
    const s = synthsRef.current; if (!s) return
    s.synth.oscillator.type = wave
    ;(s.synth as any).set({ envelope: { attack, decay, sustain, release } })
    ;(s.synth as any).set({ detune, portamento: porta })
    s.filter.frequency.rampTo(cutoff, 0.01)
    s.filter.Q.rampTo(resonance, 0.01)
    if ((s as any).distortion) {
      (s as any).distortion.set({ distortion: distAmount, oversample: distOversample })
      ;(s as any).distortion.wet.rampTo(distOn ? distWet : 0, 0.01)
    }
    if ((s as any).preGain)  (s as any).preGain.gain.rampTo(drive, 0.01)
    if ((s as any).postGain) (s as any).postGain.gain.rampTo(makeup, 0.01)
  }, [wave, attack, decay, sustain, release, detune, porta, cutoff, resonance, distOn, distAmount, distWet, distOversample, drive, makeup])

  // create/update sequence when patterns or accent change
  useEffect(() => {
    if (!synthsRef.current) return
    if (seqRef.current) { seqRef.current.dispose(); seqRef.current = null }
    const seq = new Tone.Sequence((time, col) => {
      const i = (col as number) % STEPS
      setStep(i)
      if (drums.kick[i]) { const vel = accentEvery && (i % accentEvery === 0) ? 1 : 0.85; (synthsRef.current as any).kick.triggerAttackRelease('C2', '8n', time, vel) }
      if (drums.snare[i]) { const vel = accentEvery && (i % accentEvery === 2) ? 0.95 : 0.8; (synthsRef.current as any).snare.triggerAttackRelease('8n', time, vel) }
      if (drums.hihat[i]) { (synthsRef.current as any).hihat.triggerAttackRelease('C6', '16n', time, 0.5) }
      if (drums.perc[i])   { const notes = ['C4','D#4','G4','A#4']; const n = notes[i % notes.length]; (synthsRef.current as any).perc.triggerAttackRelease(n, '16n', time, 0.6) }
      const r = synthRoll[i]; if (r !== null) { const note = ROLL_NOTES[r]; (synthsRef.current as any).synth.triggerAttackRelease(note, '16n', time, 0.85) }
      if (playerRef.current) {
        const mark = samplerRoll[i]; const duration = playerRef.current.buffer?.duration ?? 0;
        if (mark !== null && duration > 0 && markers.length) {
          const start = Math.max(0, Math.min(duration, markers[mark] ?? 0));
          const next  = (mark + 1 < markers.length) ? markers[mark + 1]! : duration;
          const dur   = Math.max(0.005, Math.min(duration - start, next - start));
          if (dur > 0) { playerRef.current.start(time, start, dur); }
        }
      }
    }, [...Array(STEPS).keys()], '16n')

    seq.start(0)
    seqRef.current = seq
    return () => { seq.dispose(); seqRef.current = null }
  }, [drums, synthRoll, accentEvery, samplerRoll, markers, playerReady])

  // Auto-follow page
  useEffect(() => { if (!followRoll) return; const page = Math.floor(step / 8); if (page !== pianoPage) setPianoPage(page); }, [step, followRoll, pianoPage]);

  async function startStop() { if (!startedRef.current) { await Tone.start(); startedRef.current = true } if (isPlaying) { Tone.Transport.stop(); setIsPlaying(false); setStep(0) } else { Tone.Transport.start('+0.05'); setIsPlaying(true) } }

  useEffect(() => {
    const url = sampleUrlRef.current; if (!url) return;
    if (playerRef.current) { playerRef.current.dispose(); playerRef.current = null; }
    setPlayerReady(false);
    const p = new Tone.Player({ volume: -4, fadeIn: 0.002, fadeOut: 0.008, autostart: false, loop: false, }).connect((synthsRef.current as any)?.bus ?? Tone.getDestination());
    playerRef.current = p; let cancelled = false; p.load(url).then(() => { if (!cancelled) setPlayerReady(true); }).catch(() => {}); return () => { cancelled = true; };
  }, []);

  function toggleDrum(track: TrackId, i: number) { setState(prev => { const next = { ...prev, drums: { ...prev.drums, [track]: [...prev.drums[track]] } }; next.drums[track][i] = !next.drums[track][i]; return next; }) }
  function clearDrum(track: TrackId) { setState(prev => ({ ...prev, drums: { ...prev.drums, [track]: Array(STEPS).fill(false) } })) }
  function randomizeDrum(track: TrackId, density = 0.3) { setState(prev => ({ ...prev, drums: { ...prev.drums, [track]: [...Array(STEPS)].map(() => Math.random() < density) } })) }
  function clearAll() { setState(makeEmpty()) }
  function randomizeAll() { const densities: Record<TrackId, number> = { kick: 0.35, snare: 0.25, hihat: 0.5, perc: 0.2 }; setState(() => { const next = makeEmpty(); for (const t of TRACKS) { next.drums[t.id] = Array.from({ length: STEPS }, () => Math.random() < densities[t.id]); } return next; }); randomizeSynth(0.75); }
  function toggleRoll(row: number, col: number) { setState(prev => { const next = { ...prev, synthRoll: [...prev.synthRoll] }; next.synthRoll[col] = (next.synthRoll[col] === row) ? null : row; return next; }) }

  // ------------------------ RENDER ------------------------
  return (
    <div className="app">
      <h1>🎛️ Step Sequencer (Web)</h1>

      {/* Global controls */}
      <div className="controls row panel" style={{justifyContent:'space-between'}}>
        <div className="row">
          <button className={'button ' + (isPlaying ? 'danger' : 'primary')} onClick={startStop}>
            {isPlaying ? 'Stop' : 'Play'}
          </button>
          <button className="button secondary" onClick={randomizeAll}>Randomize</button>
          <button className="button" onClick={clearAll}>Clear</button>
        </div>

        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="label small">Tempo</span>
          <input type="range" min={60} max={180} value={bpm} onChange={(e)=>setBpm(parseInt(e.target.value))}/>
          <span className="small">{bpm} BPM</span>

          <span className="label small" style={{marginLeft:12}}>Swing</span>
          <input type="range" min={0} max={1} step={0.01} value={swing} onChange={(e)=>setSwing(parseFloat(e.target.value))}/>
          <span className="small">{Math.round(swing*100)}%</span>

          <span className="label small" style={{marginLeft:12}}>Accent every</span>
          <select value={accentEvery} onChange={(e)=>setAccentEvery(parseInt(e.target.value))}>
            {[0,2,3,4,8].map(n => <option key={n} value={n}>{n===0?'Off':`${n} steps`}</option>)}
          </select>

          {/* Collapse/Expand all */}
          <div className="row" style={{ marginLeft: 12, gap: 6 }}>
            <button className="button secondary xs" onClick={expandAll}>Expand All</button>
            <button className="button secondary xs" onClick={collapseAll}>Collapse All</button>
          </div>
        </div>
      </div>

      {/* ---------------- DRUMS DRAWER ---------------- */}
      <CollapsiblePanel
        id={`drums-${allOpenVersion}`}
        title={<span>Drums — <em style={{opacity:0.8}}>{TRACKS[currentTrackIndex].name}</em></span>}
        accent={TRACKS[currentTrackIndex].color}
        right={<span className="small" style={{color:'var(--sub)'}}>{currentTrackIndex+1}/{TRACKS.length}</span>}
      >
        {/* Track flip */}
        <div className="row" style={{justifyContent:'space-between', marginBottom:8}}>
          <button className="button secondary xs" onClick={prevTrack}>◀ Prev Track</button>
          <button className="button secondary xs" onClick={nextTrack}>Next Track ▶</button>
        </div>

        {/* Actions */}
        <div className="row" style={{gap:8, margin:'6px 0 10px'}}>
          <button className="button secondary xs" onClick={()=>randomizeDrum(TRACKS[currentTrackIndex].id,0.3)}>Randomize</button>
          <button className="button xs" onClick={()=>clearDrum(TRACKS[currentTrackIndex].id)}>Clear</button>
        </div>

        {/* 2 × 8 grid */}
        <div style={{padding:'12px 0'}}>
          {[0,1].map(bank => (
            <div key={'bank-'+bank} style={{marginBottom:8}}>
              <div className="grid" style={{gridTemplateColumns: 'repeat(8, var(--cell, 44px))', gap: 'var(--gap, 8px)', marginBottom: 6}}>
                {Array.from({length: 8}).map((_, col) => (
                  <div key={'lbl-'+bank+'-'+col} className="label small" style={{ textAlign:'center' }}>{bank*8 + col + 1}</div>
                ))}
              </div>
              <div className="grid" style={{gridTemplateColumns: 'repeat(8, var(--cell, 44px))', gap: 'var(--gap, 8px)'}}>
                {Array.from({length: 8}).map((_, col) => {
                  const idx = bank*8 + col; const on = drums[TRACKS[currentTrackIndex].id][idx]; const playing = isPlaying && idx === step; const quarter = idx % 4 === 0;
                  return (
                    <button
                      key={'btn-'+bank+'-'+col}
                      className={'step' + (on ? ' on' : '') + (quarter ? ' quarter' : '') + (playing ? ' playing' : '')}
                      onClick={() => toggleDrum(TRACKS[currentTrackIndex].id, idx)}
                      title={`Step ${idx + 1}`}
                      style={{ width: 'var(--cell, 44px)', height: 'var(--cell, 44px)', ...(on ? { background: TRACKS[currentTrackIndex].color, color: '#0b1012' } : null) }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CollapsiblePanel>

      {/* ---------------- SYNTH DRAWER ---------------- */}
      <CollapsiblePanel
        id={`synth-${allOpenVersion}`}
        title={<>Synth — Piano Roll</>}
        accent={'#a78bfa'}
        right={<span className="small" style={{color:'var(--sub)'}}>Steps {pianoPage*8+1}–{pianoPage*8+8}</span>}
      >
        {/* actions */}
        <div className="row" style={{gap:8, margin:'6px 0 10px'}}>
          <button className="button secondary xs" onClick={()=>randomizeSynth(0.75)}>Randomize</button>
          <button className="button xs" onClick={()=>setState(prev => ({ ...prev, synthRoll: Array(STEPS).fill(null)}))}>Clear</button>
          <label className="small" style={{display:'inline-flex',alignItems:'center',gap:6, marginLeft:8}}>
            <input type="checkbox" checked={followRoll} onChange={(e)=>setFollowRoll(e.target.checked)} /> Follow
          </label>
          <button className="button secondary xs" onClick={prevPianoPage} disabled={followRoll}>◀ Prev 8</button>
          <button className="button secondary xs" onClick={nextPianoPage} disabled={followRoll}>Next 8 ▶</button>
        </div>

        {/* paged grid */}
        <div style={{padding:'12px 0'}}>
          <div style={{ display:'grid', gridTemplateColumns:`28px repeat(8, var(--cell, 44px))`, gap:'var(--gap, 8px)' }}>
            <div />
            {Array.from({length:8}).map((_,i)=>(<div key={'colLabel'+i} className="label small" style={{textAlign:'center'}}>{pianoPage*8 + i + 1}</div>))}
            {ROLL_NOTES.map((note, rowIdx) => (
              <React.Fragment key={note}>
                <div className="label small" style={{textAlign:'right', paddingRight:2}}>{note}</div>
                {Array.from({length:8}).map((_, colIdx) => {
                  const stepIndex = pianoPage*8 + colIdx; const on = synthRoll[stepIndex] === rowIdx; const playing = isPlaying && stepIndex === step; const quarter = stepIndex % 4 === 0;
                  return (
                    <button
                      key={note+colIdx}
                      className={'step' + (on?' on':'') + (quarter?' quarter':'') + (playing?' playing':'')}
                      onClick={()=>toggleRoll(rowIdx, stepIndex)}
                      title={`${note} @ step ${stepIndex+1}`}
                      style={{ width:'var(--cell, 44px)', height:'var(--cell, 44px)', ...(on?{background:'#a78bfa',color:'#0b1012'}:null) }}
                    />
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* --- Synth Controls Sub-Panel (now inside the Synth drawer) --- */}
        <div className="subpanel" style={{marginTop:8, padding:'10px 12px', borderRadius:8, background:'var(--panelSub, #0f1518)'}}>
          <div className="row" style={{gap:8, marginBottom:10, flexWrap:'wrap'}}>
            <label className="small" style={{display:'inline-flex', alignItems:'center', gap:6}}>
              <span className="label small">Wave</span>
              <select value={wave} onChange={(e)=>setWave(e.target.value as any)}>
                <option value="sine">Sine</option>
                <option value="triangle">Triangle</option>
                <option value="square">Square</option>
                <option value="sawtooth">Saw</option>
              </select>
            </label>
            <button className="button secondary xs" onClick={randomizeSynthParams}>Randomize Tone</button>
            <button className="button xs" onClick={resetSynthParams}>Reset</button>
            <div className="row" style={{gap:6, alignItems:'center', marginLeft:6}}>
              <button className="button xs" title="Apply the current preset" onClick={()=>applyPreset(presetIndex)}>Preset: {SYNTH_PRESETS[presetIndex].name}</button>
              <button className="button secondary xs" onClick={prevPreset} title="Previous Preset">◀</button>
              <button className="button secondary xs" onClick={nextPreset} title="Next Preset">▶</button>
            </div>
          </div>

          {/* Filter */}
          <div className="panel" style={{padding:10, marginBottom:10}}>
            <div className="row" style={{gap:12, alignItems:'center', flexWrap:'wrap'}}>
              <strong className="small" style={{minWidth:60}}>Filter</strong>
              <label className="small" style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <span className="label small" style={{width:70}}>Cutoff</span>
                <input type="range" min={120} max={8000} step={1} value={cutoff} onChange={(e)=>setCutoff(parseInt(e.target.value))}/>
                <span className="small" style={{width:56, textAlign:'right'}}>{cutoff} Hz</span>
              </label>
              <label className="small" style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <span className="label small" style={{width:70}}>Resonance</span>
                <input type="range" min={0.2} max={10} step={0.01} value={resonance} onChange={(e)=>setResonance(parseFloat(e.target.value))}/>
                <span className="small" style={{width:56, textAlign:'right'}}>{resonance.toFixed(2)} Q</span>
              </label>
            </div>
          </div>

          {/* Distortion */}
          <div className="panel" style={{padding:10, marginBottom:10}}>
            <div className="row" style={{gap:12, alignItems:'center', flexWrap:'wrap'}}>
              <strong className="small" style={{minWidth:60}}>Distortion</strong>
              <label className="small" style={{display:'inline-flex',alignItems:'center',gap:6}}>
                <input type="checkbox" checked={distOn} onChange={(e)=>setDistOn(e.target.checked)} /> Enabled
              </label>
              <label className="small" style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <span className="label small" style={{width:70}}>Amount</span>
                <input type="range" min={0} max={1} step={0.001} value={distAmount} onChange={(e)=>setDistAmount(parseFloat(e.target.value))}/>
                <span className="small" style={{width:56, textAlign:'right'}}>{distAmount.toFixed(3)}</span>
              </label>
              <label className="small" style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <span className="label small" style={{width:70}}>Mix</span>
                <input type="range" min={0} max={1} step={0.001} value={distWet} onChange={(e)=>setDistWet(parseFloat(e.target.value))}/>
                <span className="small" style={{width:56, textAlign:'right'}}>{Math.round(distWet*100)}%</span>
              </label>
              <label className="small" style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <span className="label small" style={{width:70}}>Oversample</span>
                <select value={distOversample} onChange={(e)=>setDistOversample(e.target.value as any)}>
                  <option value="none">none</option>
                  <option value="2x">2x</option>
                  <option value="4x">4x</option>
                </select>
              </label>
            </div>
          </div>

          {/* Envelope */}
          <div className="panel" style={{padding:10, marginBottom:10}}>
            <div className="row" style={{gap:12, alignItems:'center', flexWrap:'wrap'}}>
              <strong className="small" style={{minWidth:60}}>Envelope</strong>
              <label className="small" style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <span className="label small" style={{width:60}}>Attack</span>
                <input type="range" min={0} max={0.5} step={0.001} value={attack} onChange={(e)=>setAttack(parseFloat(e.target.value))}/>
                <span className="small" style={{width:56, textAlign:'right'}}>{attack.toFixed(3)}s</span>
              </label>
              <label className="small" style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <span className="label small" style={{width:60}}>Decay</span>
                <input type="range" min={0.01} max={1} step={0.001} value={decay} onChange={(e)=>setDecay(parseFloat(e.target.value))}/>
                <span className="small" style={{width:56, textAlign:'right'}}>{decay.toFixed(3)}s</span>
              </label>
              <label className="small" style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <span className="label small" style={{width:60}}>Sustain</span>
                <input type="range" min={0} max={1} step={0.01} value={sustain} onChange={(e)=>setSustain(parseFloat(e.target.value))}/>
                <span className="small" style={{width:56, textAlign:'right'}}>{(sustain*100).toFixed(0)}%</span>
              </label>
              <label className="small" style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <span className="label small" style={{width:60}}>Release</span>
                <input type="range" min={0.01} max={2} step={0.001} value={release} onChange={(e)=>setRelease(parseFloat(e.target.value))}/>
                <span className="small" style={{width:56, textAlign:'right'}}>{release.toFixed(3)}s</span>
              </label>
            </div>
          </div>

          {/* Pitch / Glide */}
          <div className="panel" style={{padding:10}}>
            <div className="row" style={{gap:12, alignItems:'center', flexWrap:'wrap'}}>
              <strong className="small" style={{minWidth:60}}>Pitch</strong>
              <label className="small" style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <span className="label small" style={{width:60}}>Detune</span>
                <input type="range" min={-1200} max={1200} step={1} value={detune} onChange={(e)=>setDetune(parseInt(e.target.value))}/>
                <span className="small" style={{width:56, textAlign:'right'}}>{detune}¢</span>
              </label>
              <label className="small" style={{display:'inline-flex', alignItems:'center', gap:8}}>
                <span className="label small" style={{width:60}}>Porta</span>
                <input type="range" min={0} max={1} step={0.001} value={porta} onChange={(e)=>setPorta(parseFloat(e.target.value))}/>
                <span className="small" style={{width:56, textAlign:'right'}}>{porta.toFixed(3)}s</span>
              </label>
            </div>
          </div>
        </div>
      </CollapsiblePanel>

      {/* ---------------- SAMPLER DRAWER ---------------- */}
      <CollapsiblePanel
        id={`sampler-${allOpenVersion}`}
        title={<>Sampler</>}
        accent={'#22d3ee'}
        right={<span className="small" style={{color:'var(--sub)'}}>{markers.length}/{MAX_MARKERS} markers</span>}
      >
        <div className="row" style={{ gap: 8, margin: '6px 0 10px', flexWrap: 'wrap' }}>
          <input type="file" accept="audio/*" onChange={onSampleFile} />
          <button className="button secondary xs" onClick={() => audioRef.current?.play()} disabled={!playerReady}>Preview ▶</button>
          <button className="button secondary xs" onClick={() => audioRef.current?.pause()} disabled={!playerReady}>Pause ⏸</button>
          <button className="button xs" onClick={addMarkerHere} disabled={!sampleUrlRef.current || markers.length>=MAX_MARKERS}>Add Marker @ Playhead</button>
          <button className="button xs" onClick={clearMarkers} disabled={!markers.length}>Clear Markers</button>
          <button className="button xs" onClick={clearSamplerPattern} disabled={!samplerRoll.some(v => v !== null)}>Clear Pattern</button>
          <label className="small" style={{display:'inline-flex',alignItems:'center',gap:6, marginLeft:8}}>
            <input type="checkbox" checked={followRoll} onChange={(e)=>setFollowRoll(e.target.checked)} /> Follow
          </label>
          <button className="button secondary xs" onClick={prevPianoPage} disabled={followRoll}>◀ Prev 8</button>
          <button className="button secondary xs" onClick={nextPianoPage} disabled={followRoll}>Next 8 ▶</button>
        </div>

        {sampleUrlRef.current && (
          <div className="small" style={{marginBottom:8, color:'var(--sub)'}}>Markers (s): {markers.map((t,i)=>`${i+1}:${t.toFixed(2)}`).join('  ·  ') || '—'}</div>
        )}

        <div style={{ padding: '12px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `28px repeat(8, var(--cell, 44px))`, gap: 'var(--gap, 8px)' }}>
            <div />
            {Array.from({ length: 8 }).map((_, i) => (<div key={'samp-col-lbl-'+i} className="label small" style={{ textAlign: 'center' }}>{pianoPage * 8 + i + 1}</div>))}
            {Array.from({ length: MAX_MARKERS }).map((_, rowIdx) => (
              <React.Fragment key={'samp-row-'+rowIdx}>
                <div className="label small" style={{ textAlign: 'right', paddingRight: 2 }}>#{rowIdx+1}</div>
                {Array.from({ length: 8 }).map((_, colIdx) => {
                  const stepIndex = pianoPage * 8 + colIdx; const on = samplerRoll[stepIndex] === rowIdx; const playing = isPlaying && stepIndex === step; const quarter = stepIndex % 4 === 0;
                  return (
                    <button
                      key={'samp-cell-'+rowIdx+'-'+colIdx}
                      className={'step' + (on?' on':'') + (quarter?' quarter':'') + (playing?' playing':'')}
                      onClick={() => toggleSamplerCell(rowIdx, stepIndex)}
                      title={`Marker #${rowIdx+1} @ step ${stepIndex+1}`}
                      style={{ width:'var(--cell, 44px)', height:'var(--cell, 44px)', ...(on ? { background: '#22d3ee', color: '#0b1012' } : null) }}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </CollapsiblePanel>

      <div className="footer">Built with React + Tone.js. Tip: headphones help. Patterns & drawer state auto-save.</div>
    </div>
  )
}
