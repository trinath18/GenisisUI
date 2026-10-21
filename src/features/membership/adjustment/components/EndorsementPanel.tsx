import { errorMessage } from '../../../../api/client'
import { FormField } from '../../../../components/common/FormField'
import { text } from '../memberForm'
import type { LoadedMembership, Option } from '../types'
import { Button } from '../../../../components/Button'

interface EndorsementPanelProps {
  original: LoadedMembership
  endorsementTypes: Option[]
  editing: boolean
  busy: boolean
  endorsementType: string
  endorsementBordxDate: string
  endorsementEffectiveDate: string
  lastBatch: number | undefined
  notice: string | null
  saveError: unknown
  savedMessage: string | null
  onStartEdit: () => void
  onTypeChange: (type: string) => void
  onBordxDateChange: (date: string) => void
  onEffectiveDateChange: (date: string) => void
  onSave: () => void
  onClear: () => void
}

/** Edit Status, endorsement type and dates, Save / Clear (top of frmNewMBMAdjustment). */
export function EndorsementPanel(props: EndorsementPanelProps) {
  const { original, editing, busy } = props
  return (
    <div className="registration">
      {original.blocked && <p className="warning">{original.blocked}</p>}
      {original.member.topupInd === 'Y' && <p className="muted">Top-up membership ({text(original.member.topupNumber)})</p>}
      <fieldset>
        <legend>Endorsement</legend>
        <div className="actions">
          <Button variant="ghost" disabled={editing || !!original.blocked} onClick={props.onStartEdit}>
            Edit Status
          </Button>
        </div>
        <FormField label="Endorsement Type *">
          <select value={props.endorsementType} disabled={!editing || busy} onChange={(e) => props.onTypeChange(e.target.value)}>
            <option value="" />
            {props.endorsementTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.code} - {t.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Endt. Bordx Date *">
          <input type="date" value={props.endorsementBordxDate} disabled={!editing || busy} onChange={(e) => props.onBordxDateChange(e.target.value)} />
        </FormField>
        <FormField label="Last Batch">
          <input value={props.lastBatch != null ? String(props.lastBatch) : ''} disabled />
        </FormField>
        <FormField label="Endt. Effective Date *">
          <input type="date" value={props.endorsementEffectiveDate} disabled={!editing || busy} onChange={(e) => props.onEffectiveDateChange(e.target.value)} />
        </FormField>
        <FormField label="Status">
          <input value={text(original.member.status)} disabled />
        </FormField>
        <FormField label="Batch No">
          <input value={text(original.member.batchNo)} disabled />
        </FormField>
      </fieldset>
      {props.notice && (
        <p className="warning" role="status">
          {props.notice}
        </p>
      )}
      {props.saveError != null && (
        <p className="error" role="alert">
          {errorMessage(props.saveError)}
        </p>
      )}
      {props.savedMessage && (
        <p className="success" role="status">
          {props.savedMessage}
        </p>
      )}
      <div className="actions">
        <Button variant="primary" busy={busy} busyLabel="Saving…" disabled={!editing || !props.endorsementType || busy} onClick={props.onSave}>
          {' '}
          Save{' '}
        </Button>
        <Button variant="link" disabled={busy} onClick={props.onClear}>
          Clear
        </Button>
      </div>
    </div>
  )
}
