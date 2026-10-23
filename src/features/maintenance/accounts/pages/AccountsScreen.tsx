import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { accountsApi } from '../api/accountsApi'
import { formatMoney } from '../../../../lib/format'
import { Button } from '../../../../components/Button'

interface ScheduleRow {
  code: string
  mmaDescription: string | null
  scheduleDescription: string | null
  mmaBodyPart: string | null
  scheduleBodyPart: string | null
  mmaPage: string | null
  schedulePage: string | null
  mmaSurgeonFee: number | null
  mmaAnaesthetistFee: number | null
  scheduleSurgeonFeeMin: number | null
  scheduleSurgeonFeeMax: number | null
  scheduleAnaesthetistFee: number | null
}

type Direction = 'next' | 'prev' | 'find'

/** Maintenance > Accounts (legacy frmMMA13thSchDesc): read-only MMA and 13th Schedule description, one OPCS code at a time. */
export function AccountsScreen() {
  const [row, setRow] = useState<ScheduleRow | null>(null)
  const [find, setFind] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const move = useMutation({
    mutationFn: async ({ code, direction }: { code: string | null; direction: Direction }) => accountsApi.moveSchedule<ScheduleRow>(code, direction),
    onSuccess: (data) => {
      setNotice(data.message)
      if (data.row) setRow(data.row)
    },
  })
  const go = (direction: Direction, code = row?.code ?? null) => {
    setNotice(null)
    move.mutate({ code, direction })
  }
  const onFind = (e: FormEvent) => {
    e.preventDefault()
    if (find.trim()) go('find', find.trim().toUpperCase())
  }

  const line = (label: string, mma: string | null | undefined, schedule: string | null | undefined, wide = false) => (
    <tr>
      <th>{label}</th>
      <td className={wide ? 'wrap' : undefined}>{mma}</td>
      <td className={wide ? 'wrap' : undefined}>{schedule}</td>
    </tr>
  )

  return (
    <section>
      <h2>MMA and 13th Schedule Description</h2>
      <div className="registration">
        <fieldset>
          <div className="form-field">
            <span>MMA Code</span>
            <strong>{row?.code ?? 'No Code Available !'}</strong>
          </div>
          <div className="actions">
            <Button variant="ghost" disabled={move.isPending} onClick={() => go('prev')}>
              Prev
            </Button>
            <Button variant="ghost" disabled={move.isPending} onClick={() => go('next')}>
              Next
            </Button>
          </div>
          <form className="actions" onSubmit={onFind}>
            <input
              aria-label="Go to MMA code"
              placeholder="Go to code"
              value={find}
              maxLength={10}
              disabled={move.isPending}
              onChange={(e) => setFind(e.target.value.toUpperCase())}
            />
            <Button variant="primary" type="submit" disabled={move.isPending || !find.trim()}>
              Go
            </Button>
          </form>
        </fieldset>
        {move.isError && <p className="error">{errorMessage(move.error)}</p>}
        {notice && <p className="warning">{notice}</p>}
        {row && (
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th />
                  <th>MMA</th>
                  <th>13th Sch</th>
                </tr>
              </thead>
              <tbody>
                {line('Description', row.mmaDescription, row.scheduleDescription, true)}
                {line('Body Part', row.mmaBodyPart, row.scheduleBodyPart)}
                {line('Page', row.mmaPage, row.schedulePage)}
                {line('Surg Fee (Min)', '', formatMoney(row.scheduleSurgeonFeeMin))}
                {line('Surg Fee (Max)', formatMoney(row.mmaSurgeonFee), formatMoney(row.scheduleSurgeonFeeMax))}
                {line('Anae Fee', formatMoney(row.mmaAnaesthetistFee), formatMoney(row.scheduleAnaesthetistFee))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
