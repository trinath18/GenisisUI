import { Modal } from '../../components/Modal'

export interface RepReasonDetail {
  code: string
  reason: string
  categoryName?: string
  categoryDescription?: string
}

export interface LetterResult {
  letter: string
  title: string
  fields: Record<string, string | undefined>
  repReasons?: RepReasonDetail[]
}

type F = Record<string, string | undefined>

function Head({ f }: { f: F }) {
  return (
    <div className="letter-head">
      <strong>MEDIEXPRESS (M) SDN. BHD.</strong>
      <span>{f.systemDate}</span>
    </div>
  )
}

function PatientBlock({ f }: { f: F }) {
  return (
    <table className="letter-meta">
      <tbody>
        {f.caseNo && <tr><th>Case No</th><td>{f.caseNo}</td></tr>}
        {f.patient && <tr><th>Patient</th><td>{f.patient}</td></tr>}
        {f.mbmNo && <tr><th>Membership No</th><td>{f.mbmNo}</td></tr>}
        {f.patientIC && <tr><th>IC / BC / PP</th><td>{f.patientIC}</td></tr>}
        {f.policyNo && <tr><th>Policy No</th><td>{f.policyNo}</td></tr>}
        {f.hospital && <tr><th>Hospital</th><td>{f.hospital}</td></tr>}
        {f.doa && <tr><th>Admission Date</th><td>{f.doa}</td></tr>}
        {f.dod && <tr><th>Discharge Date</th><td>{f.dod}</td></tr>}
      </tbody>
    </table>
  )
}

function Signoff({ f }: { f: F }) {
  return (
    <div className="letter-sign">
      <p>Thank you.</p>
      <p>
        Yours faithfully,
        <br />
        <br />
        <strong>{f.staffName}</strong>
        <br />
        <span className="muted">MediExpress (M) Sdn. Bhd.</span>
      </p>
    </div>
  )
}

function DocRequest({ f, when }: { f: F; when: 'admission' | 'discharge' }) {
  return (
    <>
      <Head f={f} />
      <p className="letter-to">
        To: {f.hospital}
        {f.hosContact && <><br />Attention: {f.hosContact}</>}
        {f.hosFax && <><br />Fax: {f.hosFax}</>}
      </p>
      <h4>DOCUMENTS REQUIRED {when === 'admission' ? 'ON ADMISSION' : 'ON DISCHARGE'}</h4>
      <PatientBlock f={f} />
      <p>
        Please provide the documents required for the above case{when === 'admission' ? ' upon admission' : ' upon discharge'}.
        Kindly fax the completed documentation to us at your earliest convenience.
      </p>
      <Signoff f={f} />
    </>
  )
}

function TakeHomeDrugs({ f }: { f: F }) {
  return (
    <>
      <Head f={f} />
      <p className="letter-to">To: {f.hospital}</p>
      <h4>TAKE HOME DRUGS</h4>
      <PatientBlock f={f} />
      <p>
        Please arrange the take-home drugs for the above patient and forward the itemised list together with
        the discharge summary to MediExpress for review.
      </p>
      <p className="muted">Prepared by: {f.staffCode}</p>
      <Signoff f={f} />
    </>
  )
}

function PriorLetter({ f, expired }: { f: F; expired: boolean }) {
  return (
    <>
      <Head f={f} />
      <p className="letter-to">
        To: {f.payor}
        {f.payorAdd1 && <><br />{f.payorAdd1}</>}
        {f.payorAdd2 && <><br />{f.payorAdd2}</>}
        {f.payorAdd3 && <><br />{f.payorAdd3}</>}
      </p>
      <h4>{expired ? `MEMBERSHIP EXPIRED — ${f.month ?? f.expiryDate}` : `MEMBERSHIP EXPIRING — ${f.month ?? f.expiryDate}`}</h4>
      <PatientBlock f={f} />
      {f.diag && <p>Diagnosis: {f.diag}</p>}
      <p>
        {expired
          ? `Please note that the above membership expired on ${f.expiryDate}. The case above was registered before the expiry date shown.`
          : `Please note that the above membership is due to expire on ${f.expiryDate}. The case above was registered while the membership was still in force.`}
      </p>
      <Signoff f={f} />
    </>
  )
}

function GuaranteeLetter({ f, letter }: { f: F; letter: string }) {
  const btb = letter === 'B'
  return (
    <>
      <Head f={f} />
      <p className="letter-to">
        To: {f.hospital}
        {f.hosContact && <><br />Attention: {f.hosContact}</>}
        {f.hosFax && <><br />Fax: {f.hosFax}</>}
      </p>
      <h4>{btb ? 'BACK TO BACK GUARANTEE' : 'LETTER OF GUARANTEE'}{f.perVisit === 'Y' ? ' (PER VISIT)' : ''}</h4>
      <table className="letter-meta">
        <tbody>
          <tr><th>{btb ? 'BTB No' : 'LG No'}</th><td>{f.lgNo}</td></tr>
          <PatientBlockRows f={f} />
          {f.lgAmount && <tr><th>Guarantee Amount</th><td>RM {f.lgAmount}</td></tr>}
          {f.rb && <tr><th>Room &amp; Board</th><td>{f.rb}</td></tr>}
        </tbody>
      </table>
      <p>
        We confirm a {btb ? 'back to back ' : ''}guarantee of payment for the hospitalisation of the above patient
        {f.grpCompany ? ` ${f.grpCompany}` : ''} up to the amount stated, subject to the following terms:
      </p>
      <ol className="letter-terms">
        <li>This guarantee covers hospitalisation charges{f.including ? `, including ${f.including}` : ''}.</li>
        {f.terms?.split('\n').filter(Boolean).map((line, i) => <li key={i}>{line.trim()}</li>)}
      </ol>
      {f.remark && <p>Remark: {f.remark}</p>}
      <p className="muted">Issued by {f.staffCode}{f.lgTime ? ` at ${f.lgTime}` : ''}</p>
      <Signoff f={f} />
    </>
  )
}

function PatientBlockRows({ f }: { f: F }) {
  return (
    <>
      {f.patient && <tr><th>Patient</th><td>{f.patient}</td></tr>}
      {f.mbmNo && <tr><th>Membership No</th><td>{f.mbmNo}</td></tr>}
      {f.policyNo && <tr><th>Policy No</th><td>{f.policyNo}</td></tr>}
      {f.doa && <tr><th>Admission Date</th><td>{f.doa}</td></tr>}
    </>
  )
}

function RepudiationLetter({ f, reasons }: { f: F; reasons?: RepReasonDetail[] }) {
  return (
    <>
      <Head f={f} />
      <p className="letter-to">
        {f.principal}
        {f.add1 && <><br />{f.add1}</>}
        {f.add2 && <><br />{f.add2}</>}
        {(f.postCode || f.city) && <><br />{f.postCode}{f.city ? ` ${f.city}` : ''}</>}
        {f.state && <><br />{f.state}</>}
      </p>
      <h4>REPUDIATION OF CLAIM{reasons?.length ? ` — ${reasons.map((r) => r.categoryName).filter(Boolean).join(', ')}` : ''}</h4>
      <table className="letter-meta">
        <tbody>
          {f.caseNo && <tr><th>Case No</th><td>{f.caseNo}</td></tr>}
          {f.patient && <tr><th>Patient</th><td>{f.patient}</td></tr>}
          {f.mbmNo && <tr><th>Membership No</th><td>{f.mbmNo}</td></tr>}
          {f.policyNo && <tr><th>Policy No</th><td>{f.policyNo}</td></tr>}
          {f.expiryDate && <tr><th>Expiry Date</th><td>{f.expiryDate}</td></tr>}
          {f.doa && <tr><th>Admission Date</th><td>{f.doa}</td></tr>}
          {f.hospital && <tr><th>Hospital</th><td>{f.hospital}</td></tr>}
        </tbody>
      </table>
      <p>
        Dear {f.principal}, we regret to inform you that the above hospitalisation claim
        {f.hospital ? ` at ${f.hospital}` : ''} has been repudiated
        {f.reasons ? ` for the following reason(s): ${f.reasons}` : ''}
        {f.underlying ? f.underlying : '.'}
      </p>
      {reasons?.map((r) => (
        <p key={r.code}>
          <strong>{r.code}</strong> — {r.reason}
          {r.categoryDescription && <><br /><span className="muted">{r.categoryDescription}</span></>}
        </p>
      ))}
      {(f.repDocument || f.repPersonnel || f.repAttention) && (
        <table className="letter-meta">
          <tbody>
            {f.repDocument && <tr><th>Document</th><td>{f.repDocument}</td></tr>}
            {f.repPersonnel && <tr><th>Personnel</th><td>{f.repPersonnel}</td></tr>}
            {f.repAttention && <tr><th>Attention</th><td>{f.repAttention}</td></tr>}
          </tbody>
        </table>
      )}
      {f.ldDesc && <p>{f.ldDesc}</p>}
      {f.payor && <p>Payor: {f.payor}{f.payorContact ? ` (Contact: ${f.payorContact})` : ''}</p>}
      <Signoff f={f} />
    </>
  )
}

function InvestigationRequest({ f }: { f: F }) {
  return (
    <>
      <Head f={f} />
      <p className="letter-to">
        To: {f.hospital}
        {f.hosContact && <><br />Attention: {f.hosContact}</>}
        {f.hosFax && <><br />Fax: {f.hosFax}</>}
      </p>
      <h4>REQUEST FOR INVESTIGATION / MEDICAL REPORT (GP / QA)</h4>
      <PatientBlock f={f} />
      {f.diag && <p>Diagnosis: {f.diag}</p>}
      <p>
        We would be grateful if you could forward the investigation findings and medical report for the
        above patient to assist in the processing of this case. Kindly fax the documents to us at your
        earliest convenience.
      </p>
      <Signoff f={f} />
    </>
  )
}

function ReimbursementRequest({ f }: { f: F }) {
  return (
    <>
      <Head f={f} />
      <p className="letter-to">
        {f.principal}
        {f.add1 && <><br />{f.add1}</>}
        {f.add2 && <><br />{f.add2}</>}
        {(f.postCode || f.city) && <><br />{f.postCode}{f.city ? ` ${f.city}` : ''}</>}
        {f.state && <><br />{f.state}</>}
      </p>
      <h4>DOCUMENTS REQUIRED FOR REIMBURSEMENT CLAIM</h4>
      <PatientBlock f={f} />
      <p>
        To process the reimbursement for the above hospitalisation, please forward the original
        itemised bills, receipts and the completed claim documentation to MediExpress for review.
      </p>
      <Signoff f={f} />
    </>
  )
}

function ManagementNote({ f }: { f: F }) {
  return (
    <>
      <Head f={f} />
      <h4>CASE MANAGEMENT NOTE</h4>
      <PatientBlock f={f} />
      <div className="letter-note">
        {(f.note ?? '').split('\n').filter((x) => x.trim()).map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      <p className="muted">Prepared by: {f.staffCode}</p>
      <Signoff f={f} />
    </>
  )
}

export function LetterModal({ letter, onClose }: { letter: LetterResult; onClose: () => void }) {
  const f = letter.fields
  return (
    <Modal title={letter.title} onClose={onClose} wide>
      <div className="letter-sheet">
        {(letter.letter === 'A' || letter.letter === 'D') && <DocRequest f={f} when={letter.letter === 'A' ? 'admission' : 'discharge'} />}
        {letter.letter === 'T' && <TakeHomeDrugs f={f} />}
        {(letter.letter === 'P' || letter.letter === 'E') && <PriorLetter f={f} expired={letter.letter === 'E'} />}
        {(letter.letter === 'L' || letter.letter === 'C' || letter.letter === 'B') && <GuaranteeLetter f={f} letter={letter.letter} />}
        {letter.letter === 'R' && <RepudiationLetter f={f} reasons={letter.repReasons} />}
        {letter.letter === 'I' && <InvestigationRequest f={f} />}
        {letter.letter === 'S' && <ReimbursementRequest f={f} />}
        {letter.letter === 'M' && <ManagementNote f={f} />}
      </div>
      <div className="modal-actions letter-actions">
        <button type="button" className="ghost" onClick={() => window.print()}>
          Print
        </button>
        <button type="button" className="primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  )
}
