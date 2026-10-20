import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adjustmentApi, adjustmentKeys } from '../api/adjustmentApi'
import {
  EndorsementType,
  FAMILY_INSURED_TYPES,
  MemberStatus,
  Messages,
  NOTES_MAXIMUM_LENGTH,
  TABS,
  editsPrincipal,
  endsMembership,
  worksOnSupplementaries,
} from '../constants'
import type { AdjustmentTab } from '../constants'
import { newSupplementary, supplementaryError, text, toForm, toRequest } from '../memberForm'
import type { AdjustmentLookups, FormRow, FormValue, LoadedMembership, MemberForm, Recalculation } from '../types'
import { EndorsementPanel } from './EndorsementPanel'
import { MemberTextArea } from './MemberControls'
import { OthersDetailsTab } from './OthersDetailsTab'
import { PrincipalDetailsTab } from './PrincipalDetailsTab'
import { feeColumns, historyColumns, memberHistoryColumns } from '../tabColumns'
import { QueryTable } from './ReadOnlyTabs'
import { SupplementaryTab } from './SupplementaryTab'

interface AdjustmentEditorProps {
  membershipNo: string
  original: LoadedMembership
  lookups: AdjustmentLookups
  onReload: () => void
  /** Kept by the page: the save reloads the membership, which starts a new editor. */
  savedMessage: string | null
  onSavedMessageChange: (message: string | null) => void
}

/**
 * Endorsement editing of one loaded membership. The page renders it with a key per load, so every load starts from the
 * stored values without syncing state in effects.
 */
export function AdjustmentEditor({ membershipNo, original, lookups, onReload, savedMessage, onSavedMessageChange: setSavedMessage }: AdjustmentEditorProps) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<AdjustmentTab>('Principal Details')
  const [editing, setEditing] = useState(false)
  const [type, setType] = useState('')
  const [bordxDate, setBordxDate] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [member, setMember] = useState<FormRow>(() => toForm(original.member))
  const [covered, setCovered] = useState<FormRow[]>(() => original.covered.map(toForm))
  const [person, setPerson] = useState<FormRow | null>(null)
  const [personIndex, setPersonIndex] = useState<number | null>(null)
  const [recalculation, setRecalculation] = useState<Recalculation | null>(null)
  const [applyAnnualLimit, setApplyAnnualLimit] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const familyPlan = FAMILY_INSURED_TYPES.includes(text(original.member.insuredType)) || FAMILY_INSURED_TYPES.includes(text(original.clinic?.insuredType))
  const editPrincipal = editing && editsPrincipal(type)

  const plans = useQuery({
    queryKey: adjustmentKeys.plans(member.healthCode, member.payorCode),
    enabled: editPrincipal && !!member.healthCode,
    queryFn: () => adjustmentApi.getPlans(text(member.healthCode), text(member.payorCode)),
  })
  const lastBatch = useQuery({
    queryKey: adjustmentKeys.lastBatch(bordxDate, member.payorCode),
    enabled: bordxDate !== '',
    queryFn: () => adjustmentApi.getLastBatch(bordxDate, text(member.payorCode) || undefined),
  })
  const fees = useQuery({ queryKey: adjustmentKeys.fees(membershipNo), enabled: tab === 'Fees', queryFn: () => adjustmentApi.getFees(membershipNo) })
  const history = useQuery({
    queryKey: adjustmentKeys.history(membershipNo),
    enabled: tab === 'Adjustment History',
    queryFn: () => adjustmentApi.getHistory(membershipNo),
  })
  const memberHistory = useQuery({
    queryKey: adjustmentKeys.memberHistory(membershipNo),
    enabled: tab === 'MBM History',
    queryFn: () => adjustmentApi.getMemberHistory(membershipNo),
  })

  const recalculate = useMutation({
    mutationFn: () =>
      adjustmentApi.recalculate(membershipNo, {
        planCode: text(member.planCode) || null,
        payorEffectiveDate: text(member.payorEffectiveDate) || null,
        payorExpiryDate: text(member.payorExpiryDate) || null,
        dateOfBirth: text(member.dateOfBirth) || null,
        sex: text(member.sex) || null,
      }),
    onSuccess: setRecalculation,
  })
  const policyCheck = useMutation({
    mutationFn: () => adjustmentApi.checkPolicy(text(member.policyNo), membershipNo),
    onSuccess: (result) => setNotice(result.duplicateOf ? `Duplicate Policy No In The Membership. Membership No: ${result.duplicateOf}` : null),
  })
  const save = useMutation({
    mutationFn: () =>
      adjustmentApi.save(membershipNo, {
        endorsementType: type,
        endtBordxDate: bordxDate || null,
        endtEffectiveDate: effectiveDate || null,
        member: toRequest(member),
        covered: covered.map(toRequest),
        applyAnnualLimit: applyAnnualLimit && recalculation?.annualLimit != null,
        annualLimit: recalculation?.annualLimit ?? null,
      }),
    onSuccess: async (result) => {
      setSavedMessage([result.message, ...result.warnings].join(' — '))
      setBordxDate('')
      setEffectiveDate('')
      await queryClient.invalidateQueries({ queryKey: adjustmentKeys.afterSave })
    },
  })
  const busy = save.isPending

  const form: MemberForm = {
    member,
    set: (key: string, value: FormValue) => setMember((current) => ({ ...current, [key]: value })),
    editable: editPrincipal,
    busy,
  }

  function startEdit() {
    setEditing(true)
    setSavedMessage(null)
    save.reset()
  }

  /** The desktop's cboEndorseStatus checks, then a fresh copy of the stored member for the chosen type. */
  function chooseType(next: string) {
    const stored = original.member
    setNotice(null)
    const noPlan = !stored.insuredType && !stored.planCode
    if ((next === EndorsementType.AddSupplementary || next === EndorsementType.DeleteSupplementary) && !familyPlan) return setNotice(Messages.noSupplementary)
    if (next === EndorsementType.PlanChange && noPlan) return setNotice(Messages.noPlanToChange)
    if (endsMembership(next) && noPlan && stored.status === MemberStatus.Active) return setNotice(Messages.clinicalMember)
    setType(next)
    setMember(toForm(stored))
    setCovered(original.covered.map(toForm))
    setPerson(next === EndorsementType.AddSupplementary ? newSupplementary(stored) : null)
    setPersonIndex(null)
    setRecalculation(null)
    if (worksOnSupplementaries(next)) setTab('Supplementary')
  }

  function addPerson() {
    if (!person) return
    const error = supplementaryError(person, true, bordxDate)
    if (error) return setNotice(error)
    setNotice(null)
    setCovered((list) => [...list, { ...person, name: text(person.name).toUpperCase() }])
    setPerson(newSupplementary(member))
  }

  function updatePerson() {
    if (personIndex === null || !person) return
    const error = supplementaryError(person, false, bordxDate)
    if (error) return setNotice(error)
    setNotice(null)
    setCovered((list) => list.map((p, i) => (i === personIndex ? { ...person } : p)))
    setPerson(null)
    setPersonIndex(null)
  }

  async function refreshSupplementaryExpiry(row: FormRow) {
    if (!row.dateOfBirth || !row.planCode || !row.effectiveDate || !row.expiryDate) return
    const result = await adjustmentApi.getSupplementaryExpiry({
      dateOfBirth: text(row.dateOfBirth),
      planCode: text(row.planCode),
      effectiveDate: text(row.effectiveDate),
      expiryDate: text(row.expiryDate),
    })
    setPerson((current) => (current ? { ...current, expiryDate: result.expiryDate?.slice(0, 10) ?? current.expiryDate } : current))
    setNotice(result.overAge ? `Supplementary age is above ${result.ageLimit}` : null)
  }

  function confirmSave() {
    if (busy) return
    setSavedMessage(null)
    if (window.confirm(Messages.confirm)) save.mutate()
  }

  return (
    <>
      <EndorsementPanel
        original={original}
        endorsementTypes={lookups.endorsementTypes}
        editing={editing}
        busy={busy}
        endorsementType={type}
        endorsementBordxDate={bordxDate}
        endorsementEffectiveDate={effectiveDate}
        lastBatch={lastBatch.data?.lastBatch}
        notice={notice}
        saveError={save.isError ? save.error : null}
        savedMessage={savedMessage}
        onStartEdit={startEdit}
        onTypeChange={chooseType}
        onBordxDateChange={setBordxDate}
        onEffectiveDateChange={setEffectiveDate}
        onSave={confirmSave}
        onClear={onReload}
      />

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === tab}
            className={t === tab ? 'active' : undefined}
            disabled={t === 'Supplementary' && !familyPlan}
            title={t === 'Supplementary' && !familyPlan ? Messages.noSupplementary : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="tab-body" role="tabpanel">
        {tab === 'Principal Details' && (
          <PrincipalDetailsTab
            form={form}
            original={original}
            lookups={lookups}
            plans={plans.data ?? []}
            onPlanChange={(planCode) => {
              form.set('planCode', planCode)
              setRecalculation(null)
            }}
            onPolicyBlur={() => editPrincipal && member.policyNo && policyCheck.mutate()}
            recalculation={recalculation}
            recalculating={recalculate.isPending}
            recalculateError={recalculate.isError ? recalculate.error : null}
            onRecalculate={() => recalculate.mutate()}
            onUsePremium={() =>
              recalculation &&
              setMember((m) => ({ ...m, premium: recalculation.premium, basicPremium: recalculation.basicPremium, ageCode: recalculation.ageCode }))
            }
            onUseMco={() => recalculation && setMember((m) => ({ ...m, mcoFee: recalculation.mco }))}
            applyAnnualLimit={applyAnnualLimit}
            onApplyAnnualLimitChange={setApplyAnnualLimit}
          />
        )}
        {tab === 'Others Details' && <OthersDetailsTab form={form} original={original} />}
        {tab === 'Supplementary' && (
          <SupplementaryTab
            covered={covered}
            endorsementType={type}
            editing={editing}
            busy={busy}
            relationships={lookups.relationships}
            person={person}
            personIndex={personIndex}
            onPersonChange={setPerson}
            onPersonBlur={refreshSupplementaryExpiry}
            onEdit={(index) => {
              setPerson({ ...covered[index] })
              setPersonIndex(index)
            }}
            onMark={(index, action) => setCovered((list) => list.map((p, i) => (i === index ? { ...p, action } : p)))}
            onRemoveNew={(index) => setCovered((list) => list.filter((_, i) => i !== index))}
            onAdd={addPerson}
            onUpdate={updatePerson}
            onClear={() => {
              setPerson(type === EndorsementType.AddSupplementary ? newSupplementary(member) : null)
              setPersonIndex(null)
            }}
          />
        )}
        {tab === 'Adjustment History' && <QueryTable query={history} columns={historyColumns} />}
        {tab === 'Fees' && <QueryTable query={fees} columns={feeColumns} />}
        {tab === 'MBM History' && <QueryTable query={memberHistory} columns={memberHistoryColumns} />}
        {tab === 'Mgmt Note' && (
          <div className="registration">
            <label className="form-field wide">
              <span>Management Notes</span>
              <MemberTextArea form={form} field="mgmtNotes" rows={8} maxLength={NOTES_MAXIMUM_LENGTH} />
            </label>
            {!editPrincipal && <p className="muted">Choose Amendment or Plan Change to edit the note.</p>}
          </div>
        )}
      </div>
    </>
  )
}
