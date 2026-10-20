// Case > Panel Hospitals (legacy frmPanelHospital): pick a hospital panel code, list its hospitals, print the list.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { ComboField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { requiredText } from '../../lib/validation'
import { useScreenLookups } from './useScreenLookups'

interface PanelHospital {
  code: string
  name: string
  tel: string
  fax: string
  add1: string
  add2: string
  add3: string
  state: string
  town: string
}

interface Values {
  panelCode: string
}

const columns: GridColumn<PanelHospital>[] = [
  { key: 'code', label: 'Hospital Code' },
  { key: 'name', label: 'Hospital Name' },
  { key: 'tel', label: 'Tel No' },
  { key: 'fax', label: 'Fax No' },
  { key: 'add1', label: 'Address 1' },
  { key: 'add2', label: 'Address 2' },
  { key: 'add3', label: 'Address 3' },
  { key: 'state', label: 'State' },
  { key: 'town', label: 'Town' },
]

const schema: yup.ObjectSchema<Values> = yup.object({ panelCode: requiredText('Please Select Hospital Panel Code!') })

export function PanelHospitalsPage() {
  const navigate = useNavigate()
  const { panelCodes } = useScreenLookups({ panelCodes: true })
  const [rows, setRows] = useState<PanelHospital[]>([])
  const [busy, setBusy] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<Values>({ resolver: yupResolver(schema), defaultValues: { panelCode: '' } })
  const panelCode = useWatch({ control, name: 'panelCode' })

  const search = handleSubmit(async ({ panelCode: code }) => {
    setBusy(true)
    try {
      const { data } = await api.get<PanelHospital[]>('/api/case/panel-hospitals', { params: { code } })
      setRows(data)
      if (data.length === 0) notify('No Record Found!', 'error')
    } catch (e) {
      setRows([])
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  function clear() {
    reset()
    setRows([])
  }

  function print() {
    if (rows.length === 0) {
      notify('Report cannot be printed without any record.', 'info')
      return
    }
    window.print()
  }

  return (
    <PageShell title="Panel Hospitals" subtitle="Hospitals that belong to a hospital panel.">
      <form onSubmit={search} noValidate className="screen-form">
        <fieldset>
          <legend>Selection Criteria</legend>
          <ComboField
            label="Hospital Panel Code"
            required
            options={panelCodes}
            error={errors.panelCode}
            autoFocus
            {...register('panelCode', { onChange: () => setRows([]) })}
          />
        </fieldset>

        <ActionBar label="Panel hospital actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Searching…">
            Search
          </Button>
          <Button variant="ghost" onClick={print}>
            Print
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Record(s)" value={rows.length} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>

        <fieldset className="print-area">
          <legend>Hospitals</legend>
          <h3 className="print-only">Panel Hospitals — {panelCode}</h3>
          <DataGrid
            caption="Panel hospitals"
            columns={columns}
            rows={rows}
            rowKey={(r) => r.code}
            tall
            empty="No records. Choose a panel code and press Search."
          />
        </fieldset>
      </form>
    </PageShell>
  )
}
