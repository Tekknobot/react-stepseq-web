import React, { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'

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

type PatternState = {
  drums: Record<TrackId, boolean[]>
  synthRoll: RollIndex[] // length = STEPS, per-step note index or null
}

function makeEmpty(): PatternState {
  const drums = TRACKS.reduce(
    (acc, t) => ({ ...acc, [t.id]: Array(STEPS).fill(false) }),
    {} as Record<TrackId, boolean[]>
  )
  const synthRoll = Array<RollIndex>(STEPS).fill(null)
  return { drums, synthRoll }
}

// --- Polished SVG Knob ---
// Features:
// - clear marker (needle + end-cap dot + top notch)
// - tick marks
// - drag (vertical), wheel, keyboard nudge, double-click to reset
// - accessible (aria + focus ring)
// Usage: <Knob value={...} min={...} max={...} step={...} label="Cutoff" suffix="Hz" onChange={...} defaultValue={1200} />
function Knob({
  value, min, max, step = 1,
  onChange,
  label,
  size = 72,
  suffix = '',
  defaultValue,
}: {
  value: number; min: number; max: number; step?: number;
  onChange: (v:number)=>void; label: string; size?: number; suffix?: string;
  defaultValue?: number;
}) {
  const [drag, setDrag] = React.useState<{y:number; start:number}|null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  // geometry
  const rPad = 10;
  const radius = (size/2) - rPad;
  const cx = size/2, cy = size/2;
  const START = -135;           // deg
  const SWEEP = 270;            // deg

  const clamp = (v:number) => Math.min(max, Math.max(min, v));
  const norm = (v:number) => (clamp(v) - min) / (max - min); // 0..1
  const angle = START + SWEEP * norm(value);

  const toXY = (deg:number, rad=radius) => {
    const a = (deg * Math.PI) / 180;
    return [cx + rad*Math.cos(a), cy + rad*Math.sin(a)];
  };

  // arc endpoints
  const [sx, sy] = toXY(START);
  const [ex, ey] = toXY(angle);
  const largeArc = SWEEP * norm(value) > 180 ? 1 : 0;

  const commit = (next:number) => onChange(clamp(Math.round(next/step)*step));

  // drag
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ y: e.clientY, start: value });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dy = drag.y - e.clientY;    // up = increase
    const sens = (max-min) / 180;     // pixels-to-value feel
    commit(drag.start + dy * sens);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture(e.pointerId);
    setDrag(null);
  };

  // wheel + keyboard
  const onWheel: React.WheelEventHandler = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -step : step;
    commit(value + delta);
  };
  const onKeyDown: React.KeyboardEventHandler = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { commit(value + step); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { commit(value - step); }
    if ((e.key === 'Home')) { commit(min); }
    if ((e.key === 'End'))  { commit(max); }
    if ((e.key === 'r' || e.key === 'R') && defaultValue !== undefined) { commit(defaultValue); }
  };

  // double-click reset
  const onDoubleClick = () => {
    if (defaultValue !== undefined) commit(defaultValue);
  };

  // ticks (every 30° across sweep)
  const ticks: JSX.Element[] = [];
  for (let d = 0; d <= SWEEP; d += 30) {
    const deg = START + d;
    const [tx1, ty1] = toXY(deg, radius - 6);
    const [tx2, ty2] = toXY(deg, radius - 12);
    ticks.push(<line key={d} x1={tx1} y1={ty1} x2={tx2} y2={ty2} className="knobTick" />);
  }
  // top notch (at START+SWEEP/2 ≈ 0° visual top)
  const [nx, ny] = toXY(START + SWEEP/2, radius - 18);

  return (
    <div className="knobWrap" ref={ref}>
      <div
        className="knobFocus"
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamp(value)}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onDoubleClick={onDoubleClick}
      >
        <svg
          width={size} height={size}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          className="knobSvg"
        >
          {/* base circle */}
          <circle cx={cx} cy={cy} r={radius} className="knobBase" />

          {/* ticks */}
          {ticks}

          {/* grey track */}
          <path
            d={`M ${toXY(START)[0]} ${toXY(START)[1]} A ${radius} ${radius} 0 1 1 ${toXY(START+SWEEP-0.001)[0]} ${toXY(START+SWEEP-0.001)[1]}`}
            className="knobTrack"
          />
          {/* active arc */}
          <path
            d={`M ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} 1 ${ex} ${ey}`}
            className="knobArc"
          />

          {/* needle + end dot */}
          <line x1={cx} y1={cy} x2={ex} y2={ey} className="knobNeedle" />
          <circle cx={ex} cy={ey} r={3.2} className="knobDot" />

          {/* top notch */}
          <circle cx={nx} cy={ny} r={2} className="knobNotch" />
        </svg>
      </div>
      <div className="knobLabel">{label}</div>
      <div className="knobValue">
        {Number.isInteger(value) ? value : +value.toFixed(2)}{suffix}
      </div>
    </div>
  );
}

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [bpm, setBpm] = useState(120)
  const [swing, setSwing] = useState(0)
  const [accentEvery, setAccentEvery] = useState(4)

  // ---- Synth tone controls (UI state) ----
  const [wave, setWave] = useState<'sine'|'triangle'|'square'|'sawtooth'>('sawtooth')
  const [cutoff, setCutoff] = useState(1200)      // Hz
  const [resonance, setResonance] = useState(1.2) // Q
  const [attack, setAttack] = useState(0.005)
  const [decay, setDecay] = useState(0.12)
  const [sustain, setSustain] = useState(0.1)
  const [release, setRelease] = useState(0.2)
  const [detune, setDetune] = useState(0)         // cents (-1200..+1200)
  const [porta, setPorta] = useState(0.0)         // seconds

  // load/save state (keeps compatibility with the old drum-only save)
  const [state, setState] = useState<PatternState>(() => {
    const saved = localStorage.getItem('patterns_v2')
    if (saved) return JSON.parse(saved)
    const legacy = localStorage.getItem('patterns')
    if (legacy) return { drums: JSON.parse(legacy), synthRoll: Array(STEPS).fill(null) }
    return makeEmpty()
  })
  const { drums, synthRoll } = state

  const [step, setStep] = useState(0)

  const synthsRef = useRef<{
    [k in TrackId]: any
  } & { synth: Tone.Synth, filter: Tone.Filter, bus: Tone.Gain } | null>(null)

  const seqRef = useRef<Tone.Sequence | null>(null)
  const startedRef = useRef(false)

  // persist patterns
  useEffect(() => {
    localStorage.setItem('patterns_v2', JSON.stringify(state))
  }, [state])

  // setup transport
  useEffect(() => {
    Tone.Transport.bpm.value = bpm
    Tone.Transport.swing = swing
    Tone.Transport.swingSubdivision = '8n'
  }, [bpm, swing])

  // init instruments once
  useEffect(() => {
    if (synthsRef.current) return

    // Master bus to balance levels
    const bus = new Tone.Gain(0.9).toDestination()

    const kick = new Tone.MembraneSynth({
      volume: -4,
      pitchDecay: 0.05, octaves: 8,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.2 },
    }).connect(bus)

    const snareFilter = new Tone.Filter(1800, 'bandpass').connect(bus)
    const snare = new Tone.NoiseSynth({
      volume: -6,
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.22, sustain: 0 },
    }).connect(snareFilter)

    const hihat = new Tone.MetalSynth({
      volume: -8,
      envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
      frequency: 250,
      harmonicity: 5.1,
      modulationIndex: 32,
      octaves: 1.5,
    } as any).connect(bus)
    ;(hihat as any).resonance = 4000 // optional

    const perc = new Tone.Synth({
      volume: -8,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.05 },
    }).connect(bus)

    // ---- Tonal synth chain: Synth -> Filter -> Bus ----
    const filter = new Tone.Filter({ type: 'lowpass', frequency: cutoff, Q: resonance } as any)
    const synth = new Tone.Synth({
      oscillator: { type: wave },
      envelope: { attack, decay, sustain, release },
      detune,
      portamento: porta,
      volume: -4,
    }).connect(filter).connect(bus)

    synthsRef.current = { kick, snare, hihat, perc, synth, filter, bus } as any
  }, []) // eslint-disable-line

  // apply synth parameter changes whenever UI state changes
  useEffect(() => {
    const s = synthsRef.current;
    if (!s) return;

    // Oscillator & ADSR
    s.synth.oscillator.type = wave;
    (s.synth as any).set({ envelope: { attack, decay, sustain, release } });
    (s.synth as any).set({ detune, portamento: porta });

    // Filter — use Signals for live updates
    // rampTo avoids zipper noise and actually touches the Signal
    s.filter.frequency.rampTo(cutoff, 0.01);
    s.filter.Q.rampTo(resonance, 0.01);
  }, [wave, attack, decay, sustain, release, detune, porta, cutoff, resonance]);

  // create/update sequence when patterns or accent change
  useEffect(() => {
    if (!synthsRef.current) return
    if (seqRef.current) {
      seqRef.current.dispose()
      seqRef.current = null
    }
    const seq = new Tone.Sequence((time, col) => {
      const i = (col as number) % STEPS
      setStep(i)

      if (drums.kick[i]) {
        const vel = accentEvery && (i % accentEvery === 0) ? 1 : 0.85
        ;(synthsRef.current as any).kick.triggerAttackRelease('C2', '8n', time, vel)
      }
      if (drums.snare[i]) {
        const vel = accentEvery && (i % accentEvery === 2) ? 0.95 : 0.8
        ;(synthsRef.current as any).snare.triggerAttackRelease('8n', time, vel)
      }
      if (drums.hihat[i]) {
        ;(synthsRef.current as any).hihat.triggerAttackRelease('C6', '16n', time, 0.5)
      }
      if (drums.perc[i]) {
        const notes = ['C4','D#4','G4','A#4']
        const n = notes[i % notes.length]
        ;(synthsRef.current as any).perc.triggerAttackRelease(n, '16n', time, 0.6)
      }

      const r = synthRoll[i]
      if (r !== null) {
        const note = ROLL_NOTES[r]
        ;(synthsRef.current as any).synth.triggerAttackRelease(note, '16n', time, 0.85)
      }
    }, [...Array(STEPS).keys()], '16n')
    seq.start(0)
    seqRef.current = seq

    return () => { seq.dispose(); seqRef.current = null }
  }, [drums, synthRoll, accentEvery])

  async function startStop() {
    if (!startedRef.current) { await Tone.start(); startedRef.current = true }
    if (isPlaying) { Tone.Transport.stop(); setIsPlaying(false); setStep(0) }
    else { Tone.Transport.start('+0.05'); setIsPlaying(true) }
  }

  // Drum toggles
  function toggleDrum(track: TrackId, i: number) {
    setState(prev => {
      const next = { ...prev, drums: { ...prev.drums, [track]: [...prev.drums[track]] } }
      next.drums[track][i] = !next.drums[track][i]
      return next
    })
  }
  function clearDrum(track: TrackId) {
    setState(prev => ({ ...prev, drums: { ...prev.drums, [track]: Array(STEPS).fill(false) } }))
  }
  function randomizeDrum(track: TrackId, density = 0.3) {
    setState(prev => ({ ...prev, drums: { ...prev.drums, [track]: [...Array(STEPS)].map(() => Math.random() < density) } }))
  }

  // Global clear/random
  function clearAll() { setState(makeEmpty()) }
  function randomizeAll() {
    const densities: Record<TrackId, number> = { kick: 0.35, snare: 0.25, hihat: 0.5, perc: 0.2 }
    setState(prev => {
      const next = makeEmpty()
      for (const t of TRACKS) next.drums[t.id] = [...Array(STEPS)].map(() => Math.random() < densities[t.id])
      next.synthRoll = Array.from({length:STEPS}, () => (Math.random()<0.25 ? Math.floor(Math.random()*ROLL_NOTES.length) : null))
      return next
    })
  }

  // Piano roll toggle (monophonic per step)
  function toggleRoll(row: number, col: number) {
    setState(prev => {
      const next = { ...prev, synthRoll: [...prev.synthRoll] }
      next.synthRoll[col] = (next.synthRoll[col] === row) ? null : row
      return next
    })
  }

  return (
    <div className="app">
      <h1>🎛️ Step Sequencer (Web)</h1>

      <div className="controls row panel" style={{justifyContent:'space-between'}}>
        <div className="row">
          <button className={'button ' + (isPlaying ? 'danger' : 'primary')} onClick={startStop}>
            {isPlaying ? 'Stop' : 'Play'}
          </button>
          <button className="button secondary" onClick={randomizeAll}>Randomize</button>
          <button className="button" onClick={clearAll}>Clear</button>
        </div>

        <div className="row">
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
        </div>
      </div>

      {/* Drum tracks */}
      <div style={{display:'grid', gap:12, marginTop:12}}>
        {TRACKS.map(t => (
          <div key={t.id} className="track panel">
            <div className="trackHead">
              <div className="row">
                <div style={{width:12,height:12,borderRadius:6, background:t.color, marginRight:8}}/>
                <strong>{t.name}</strong>
              </div>
              <div className="row">
                <button className="button secondary small" onClick={()=>randomizeDrum(t.id, 0.3)}>Randomize</button>
                <button className="button small" onClick={()=>clearDrum(t.id)}>Clear</button>
              </div>
            </div>
            <div className="grid">
              {drums[t.id].map((on, i) => {
                const playing = isPlaying && i === step
                const quarter = i % 4 === 0
                return (
                  <button
                    key={i}
                    className={'step' + (on?' on':'') + (quarter?' quarter':'') + (playing?' playing':'')}
                    onClick={()=>toggleDrum(t.id, i)}
                    title={`Step ${i+1}`}
                    style={on?{background:t.color,color:'#0b1012'}:undefined}
                  >
                    {i+1}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Piano Roll */}
      <div className="panel" style={{marginTop:12}}>
        <div className="trackHead" style={{marginBottom:8}}>
          <div className="row">
            <div style={{width:12,height:12,borderRadius:6, background:'#a78bfa', marginRight:8}}/>
            <strong>Synth (Piano Roll)</strong>
          </div>
          <div className="row">
            <button
              className="button secondary small"
              onClick={()=>{
                setState(prev => ({ ...prev, synthRoll: Array(STEPS).fill(null)}))
              }}
            >
              Clear Synth
            </button>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:`40px repeat(${STEPS}, 44px)`, gap:8}}>
          {/* note labels */}
          <div />
          {Array.from({length:STEPS}).map((_,i)=>
            <div key={'colLabel'+i} className="label small" style={{textAlign:'center'}}>{i+1}</div>
          )}

          {ROLL_NOTES.map((note, rowIdx) => (
            <React.Fragment key={note}>
              <div className="label small" style={{textAlign:'right', paddingRight:6}}>{note}</div>
              {Array.from({length:STEPS}).map((_, colIdx) => {
                const on = synthRoll[colIdx] === rowIdx
                const playing = isPlaying && colIdx === step
                const quarter = colIdx % 4 === 0
                return (
                  <button
                    key={note+colIdx}
                    className={'step' + (on?' on':'') + (quarter?' quarter':'') + (playing?' playing':'')}
                    onClick={()=>toggleRoll(rowIdx,colIdx)}
                    title={`${note} @ step ${colIdx+1}`}
                    style={on?{background:'#a78bfa',color:'#0b1012'}:undefined}
                  />
                )
              })}
            </React.Fragment>
          ))}
        </div>

        {/* ---- Synth Parameter Controls (redesigned) ---- */}
        <div className="ctrlPanel" style={{marginTop:12}}>
          {/* Oscillator */}
          <div className="ctrlCard">
            <div className="ctrlTitle">Oscillator</div>
            <div className="row" style={{gap:10, flexWrap:'wrap'}}>
              <div className="row" style={{gap:8}}>
                <span className="small">Wave</span>
                <select value={wave} onChange={e=>setWave(e.target.value as any)}>
                  <option value="sine">sine</option>
                  <option value="triangle">triangle</option>
                  <option value="square">square</option>
                  <option value="sawtooth">sawtooth</option>
                </select>
              </div>

              <Knob label="Detune" value={detune} min={-1200} max={1200} step={1}
                onChange={setDetune} suffix="¢" />
              <Knob label="Porta" value={porta} min={0} max={0.5} step={0.005}
                onChange={setPorta} suffix="s" />
            </div>
          </div>

          {/* Filter */}
          <div className="ctrlCard">
            <div className="ctrlTitle">Filter</div>
            <div className="row" style={{gap:14, flexWrap:'wrap'}}>
              <Knob label="Cutoff" value={cutoff} min={80} max={8000} step={10}
                onChange={setCutoff} suffix="Hz" />
              <Knob label="Res(Q)" value={resonance} min={0.5} max={20} step={0.1}
                onChange={setResonance} />
              <div style={{minWidth:220}}>
                <div className="ctrlRow">
                  <span className="small">Cutoff</span>
                  <input type="range" min={80} max={8000} value={cutoff}
                    onChange={e=>setCutoff(parseInt(e.target.value))}
                    style={{width:180}}/>
                  <span className="small">{cutoff}Hz</span>
                </div>
                <div className="ctrlRow">
                  <span className="small">Res</span>
                  <input type="range" min={0.5} max={20} step={0.1} value={resonance}
                    onChange={e=>setResonance(parseFloat(e.target.value))}
                    style={{width:180}}/>
                  <span className="small">{resonance.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Envelope (ADSR) */}
          <div className="ctrlCard">
            <div className="ctrlTitle">Envelope</div>
            <div className="row" style={{gap:16, flexWrap:'wrap'}}>
              <Knob label="Attack"  value={attack}  min={0} max={0.5} step={0.005} onChange={setAttack}  suffix="s"/>
              <Knob label="Decay"   value={decay}   min={0} max={1}   step={0.01}  onChange={setDecay}   suffix="s"/>
              <Knob label="Sustain" value={sustain} min={0} max={1}   step={0.01}  onChange={setSustain}/>
              <Knob label="Release" value={release} min={0} max={1}   step={0.01}  onChange={setRelease} suffix="s"/>
            </div>
          </div>

          {/* Helpful long sliders (fine adjust) */}
          <div className="ctrlCard">
            <div className="ctrlTitle">Fine Adjust</div>
            <div className="ctrlRow">
              <span className="small">Detune</span>
              <input type="range" min={-1200} max={1200} step={1} value={detune}
                onChange={e=>setDetune(parseInt(e.target.value))}
                style={{width:220}}/>
              <span className="small">{detune}¢</span>
            </div>
            <div className="ctrlRow">
              <span className="small">Porta</span>
              <input type="range" min={0} max={0.5} step={0.005} value={porta}
                onChange={e=>setPorta(parseFloat(e.target.value))}
                style={{width:220}}/>
              <span className="small">{porta.toFixed(3)}s</span>
            </div>
          </div>
        </div>
        {/* ---- end synth controls ---- */}
      </div>

      <div className="footer">Built with React + Tone.js. Tip: headphones help. Patterns auto-save.</div>
    </div>
  )
}
