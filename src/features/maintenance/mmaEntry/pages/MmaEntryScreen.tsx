import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, errorMessage } from '../../../../api/client'
import { formatMoney } from '../../../../lib/format'

type Mode = 'S' | 'N'

interface Line {
  code: string
  actualFee: string
  actualAnaesthetistFee: string
}

interface Rate {
  code: string
  mmaDescription: string | null
  scheduleDescription: string | null
  mmaSurgeonFee: number | null
  mmaAnaesthetistFee: number | null
  scheduleSurgeonMax: number | null
  scheduleSurgeonMin: number | null
  scheduleAnaesthetist: number | null
}

interface ResultLine {
  code: string
  found: boolean
  rate: Rate | null
  actualFee: number
  actualAnaesthetistFee: number
  feeAboveSchedule: boolean
  anaesthetistFeeAboveSchedule: boolean
}

interface Result {
  lines: ResultLine[]
  totalActualFee: number
  totalActualAnaesthetistFee: number
  totalMmaFee: number
  totalMmaAnaesthetistFee: number
  totalScheduleMax: number
  totalScheduleMin: number
  totalScheduleAnaesthetist: number
}

const LINES = 6
const CODE_MAX = 10
const emptyLines = (): Line[] => Array.from({ length: LINES }, () => ({ code: '', actualFee: '', actualAnaesthetistFee: '' }))
const toNumber = (v: string) => (v.trim() === '' ? null : Number(v))
const money = (v: number | null | undefined) => (v === null || v === undefined ? '' : formatMoney(v))

const calculate = async (mode: Mode, lines: Line[]) =>
  (
    await api.post<Result>('/api/maintenance/mma-entry/calculate', {
      mode,
      lines: lines
        .filter((l) => l.code.trim() !== '')
        .map((l) => ({
          code: l.code.trim(),
          actualFee: toNumber(l.actualFee),
          actualAnaesthetistFee: mode === 'S' ? toNumber(l.actualAnaesthetistFee) : null,
        })),
    })
  ).data

/**
 * Maintenance > MMA (legacy frmMMAEntry, "Procedures/OPCS"): up to six surgical or non-surgical procedures checked against the
 * MMA and 13th Schedule. Fees above the 13th Schedule are shown in red, as in the desktop. Nothing is saved.
 */
export function MmaEntryScreen() {
  const [mode, setMode] = useState<Mode>('S')
  const [lines, setLines] = useState<Line[]>(emptyLines)
  const run = useMutation({ mutationFn: () => calculate(mode, lines) })
  const surgical = mode === 'S'

  const setLine = (i: number, key: keyof Line, value: string) => {
    setLines((all) => all.map((l, n) => (n === i ? { ...l, [key]: value } : l)))
    run.reset()
  }
  const switchMode = (m: Mode) => {
    setMode(m)
    run.reset()
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    run.mutate()
  }
  const r = run.data

  return (
    <section>
      <h2>Procedures/OPCS</h2>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={surgical} className={surgical ? 'active' : undefined} onClick={() => switchMode('S')}>
          Surgical Procedures Entry
        </button>
        <button type="button" role="tab" aria-selected={!surgical} className={!surgical ? 'active' : undefined} onClick={() => switchMode('N')}>
          Non-Surgical Procedures Entry
        </button>
      </div>
      <form className="tab-body" onSubmit={submit}>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>#</th>
                <th>OPCS</th>
                <th>{surgical ? "Actual Surgeon's Fee" : 'Actual Fee'}</th>
                {surgical && <th>Actual Anaesthetist&apos;s Fee</th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                // The six lines are fixed slots, like the desktop's text boxes.
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <input
                      aria-label={`OPCS ${i + 1}`}
                      value={l.code}
                      maxLength={CODE_MAX}
                      onChange={(e) => setLine(i, 'code', e.target.value.toUpperCase())}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Fee ${i + 1}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.actualFee}
                      onChange={(e) => setLine(i, 'actualFee', e.target.value)}
                    />
                  </td>
                  {surgical && (
                    <td>
                      <input
                        aria-label={`Anaesthetist fee ${i + 1}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.actualAnaesthetistFee}
                        onChange={(e) => setLine(i, 'actualAnaesthetistFee', e.target.value)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <button type="submit" disabled={run.isPending}>
            Calculate
          </button>
          <button
            type="button"
            onClick={() => {
              setLines(emptyLines())
              run.reset()
            }}
          >
            Clear
          </button>
        </div>
      </form>
      {run.isError && (
        <p className="error" role="alert">
          {errorMessage(run.error)}
        </p>
      )}
      {r && r.lines.length === 0 && <p className="muted">Enter at least one OPCS code.</p>}
      {r && r.lines.length > 0 && (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>OPCS</th>
                <th>MMA Description</th>
                <th>{surgical ? "MMA Surgeon's Fee" : 'MMA Rate'}</th>
                {surgical && <th>MMA Anaesthetist&apos;s Fee</th>}
                <th>13th Sch. (Min)</th>
                <th>13th Sch. (Max)</th>
                {surgical && <th>13th Sch. Anaesthetist</th>}
                <th>{surgical ? "Actual Surgeon's Fee" : 'Actual Fee'}</th>
                {surgical && <th>Actual Anaesthetist&apos;s Fee</th>}
              </tr>
            </thead>
            <tbody>
              {r.lines.map((l, i) => (
                <tr key={`${l.code}-${i}`}>
                  <td>{l.code}</td>
                  <td className="wrap">{l.found ? l.rate?.mmaDescription : <span className="muted">Not in the MMA schedule</span>}</td>
                  <td>{money(l.rate?.mmaSurgeonFee)}</td>
                  {surgical && <td>{money(l.rate?.mmaAnaesthetistFee)}</td>}
                  <td>{money(l.rate?.scheduleSurgeonMin)}</td>
                  <td>{money(l.rate?.scheduleSurgeonMax)}</td>
                  {surgical && <td>{money(l.rate?.scheduleAnaesthetist)}</td>}
                  <td className={l.feeAboveSchedule ? 'error' : undefined}>{money(l.actualFee)}</td>
                  {surgical && <td className={l.anaesthetistFeeAboveSchedule ? 'error' : undefined}>{money(l.actualAnaesthetistFee)}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>Total</th>
                <th>{money(r.totalMmaFee)}</th>
                {surgical && <th>{money(r.totalMmaAnaesthetistFee)}</th>}
                <th>{money(r.totalScheduleMin)}</th>
                <th>{money(r.totalScheduleMax)}</th>
                {surgical && <th>{money(r.totalScheduleAnaesthetist)}</th>}
                <th>{money(r.totalActualFee)}</th>
                {surgical && <th>{money(r.totalActualAnaesthetistFee)}</th>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
