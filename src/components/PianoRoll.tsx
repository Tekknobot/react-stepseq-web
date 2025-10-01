import React from 'react'

type Props = {
  notes: string[]
  steps: number
  grid: boolean[][]
  onToggle: (row: number, col: number) => void
  isPlaying: boolean
  playhead: number
}

export default function PianoRoll({
  notes, steps, grid, onToggle, isPlaying, playhead
}: Props) {
  return (
    <div className="panel">
      <div className="pianoHead">
        <strong>Poly Synth</strong>
        <span className="label small">Piano Roll</span>
      </div>

      <div className="pianogrid" style={{gridTemplateColumns: `120px repeat(${steps}, 36px)`}}>
        {/* header spacer */}
        <div className="noteLabel header">Note</div>
        {Array.from({length: steps}).map((_, c) => (
          <div key={'h'+c} className="stepHeader">{c+1}</div>
        ))}

        {notes.map((n, r) => (
          <React.Fragment key={n}>
            <div className="noteLabel">{n}</div>
            {Array.from({length: steps}).map((_, c) => {
              const on = grid[r][c]
              const playing = isPlaying && c === playhead
              const quarter = c % 4 === 0
              return (
                <button
                  key={`${r}:${c}`}
                  className={
                    'noteCell' + (on?' on':'') + (playing?' playing':'') + (quarter?' quarter':'')
                  }
                  onClick={() => onToggle(r, c)}
                  title={`${n} @ step ${c+1}`}
                />
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
