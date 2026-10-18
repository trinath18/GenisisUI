import { Modal } from '../../components/Modal'
import { formatMoney } from '../../lib/format'
import { isoToDmy, S } from '../case/caseShared'
import { excessHeading, noteAddress, noteAddressee, noteTitle, showsTotalExcess } from './documentRules'
import type { ExcessLetter, WorksheetNote } from './documentRules'

const money = (v: number) => formatMoney(v)

function Actions({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-actions letter-actions">
      <button type="button" className="ghost" onClick={() => window.print()}>
        Print
      </button>
      <button type="button" className="primary" onClick={onClose}>
        Close
      </button>
    </div>
  )
}

/** The credit / debit note: what CreditNote.xlt / DebitNote.xlt were filled with. */
export function NoteModal({ note, onClose }: { note: WorksheetNote; onClose: () => void }) {
  const credit = note.kind === 'Credit'
  return (
    <Modal title={noteTitle(note)} onClose={onClose} wide>
      <div className="letter-sheet">
        <div className="letter-head">
          <strong>GENISIS SDN BHD</strong>
          <span>{noteTitle(note)}</span>
        </div>
        <table className="letter-meta">
          <tbody>
            <tr>
              <th>{credit ? 'Credit Note No' : 'Debit Note No'}</th>
              <td>{note.number || '(not numbered)'}</td>
            </tr>
            <tr>
              <th>Date</th>
              <td>{isoToDmy(note.date)}</td>
            </tr>
          </tbody>
        </table>
        <div className="letter-to">
          <strong>{noteAddressee(note)}</strong>
          {noteAddress(note).map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
        <table className="letter-meta">
          <tbody>
            <tr>
              <th>Patient Name</th>
              <td>{note.patientName}</td>
            </tr>
            <tr>
              <th>Member No</th>
              <td>{note.memberNo}</td>
            </tr>
            <tr>
              <th>Case No - Version</th>
              <td>
                {note.caseNo} - {note.version}
              </td>
            </tr>
            <tr>
              <th>Hospital</th>
              <td>{note.hospital}</td>
            </tr>
            <tr>
              <th>Admission Date</th>
              <td>{isoToDmy(note.admitted)}</td>
            </tr>
            <tr>
              <th>Disability</th>
              <td style={{ whiteSpace: 'pre-line' }}>{note.disability}</td>
            </tr>
          </tbody>
        </table>
        <h4>{credit ? 'AMOUNT DUE TO YOU' : 'AMOUNT DUE FROM YOU'}</h4>
        <p>
          <strong>RM {money(note.amount)}</strong>
        </p>
        {note.remarks && <p style={{ whiteSpace: 'pre-line' }}>{note.remarks}</p>}
      </div>
      <Actions onClose={onClose} />
    </Modal>
  )
}

/** The Excess letter: what the EXCLetter templates were filled with. */
export function ExcessLetterModal({ letter, onClose }: { letter: ExcessLetter; onClose: () => void }) {
  const extras: [string, number][] = [
    ['Limit Exceeded', letter.limitExceeded],
    ['Co-Payment (R&B)', letter.coPayment],
    ['Underwriting Excess', letter.undertakenExcess],
  ]
  return (
    <Modal title="Excess Letter" onClose={onClose} wide>
      <div className="letter-sheet">
        <div className="letter-head">
          <strong>GENISIS SDN BHD</strong>
          <span>{excessHeading(letter.template)}</span>
        </div>
        <table className="letter-meta">
          <tbody>
            <tr>
              <th>Excess No</th>
              <td>{letter.excessNo}</td>
            </tr>
            <tr>
              <th>Issue Date</th>
              <td>{isoToDmy(letter.issuedOn)}</td>
            </tr>
          </tbody>
        </table>
        <div className="letter-to">
          <strong>To: {letter.hospital}</strong>
          {letter.hospitalContact && <div>Attention: {letter.hospitalContact}</div>}
          {letter.hospitalFax && <div>Fax: {letter.hospitalFax}</div>}
        </div>
        <table className="letter-meta">
          <tbody>
            {letter.template === 'MAS' && (
              <>
                <tr>
                  <th>Principal</th>
                  <td>{letter.principalName}</td>
                </tr>
                <tr>
                  <th>Staff No</th>
                  <td>{letter.staffNo}</td>
                </tr>
                <tr>
                  <th>Cost Center</th>
                  <td>{letter.costCenter}</td>
                </tr>
                <tr>
                  <th>Department</th>
                  <td>{letter.department}</td>
                </tr>
              </>
            )}
            <tr>
              <th>Patient</th>
              <td>{letter.patientName}</td>
            </tr>
            <tr>
              <th>Patient I/C</th>
              <td>{letter.patientIc}</td>
            </tr>
            <tr>
              <th>Plan</th>
              <td>{letter.planCode}</td>
            </tr>
            <tr>
              <th>Case No</th>
              <td>{letter.caseNo}</td>
            </tr>
            <tr>
              <th>Admitted / Discharged</th>
              <td>
                {isoToDmy(letter.admitted)} / {isoToDmy(letter.discharged)}
              </td>
            </tr>
            <tr>
              <th>Invoice</th>
              <td>
                {S(letter.invoiceNo)} (RM {money(letter.invoiceAmount)})
              </td>
            </tr>
            {letter.bordxNo && (
              <tr>
                <th>Bordereaux No</th>
                <td>{letter.bordxNo}</td>
              </tr>
            )}
          </tbody>
        </table>
        <h4>AMOUNTS TO BE COLLECTED FROM THE PATIENT</h4>
        <table className="letter-meta" aria-label="Excess amounts">
          <tbody>
            {letter.items.map((i) => (
              <tr key={i.label}>
                <th>{i.label}</th>
                <td style={{ textAlign: 'right' }}>{money(i.amount)}</td>
              </tr>
            ))}
            {extras
              .filter(([, v]) => v !== 0)
              .map(([label, v]) => (
                <tr key={label}>
                  <th>{label}</th>
                  <td style={{ textAlign: 'right' }}>{money(v)}</td>
                </tr>
              ))}
            {showsTotalExcess(letter) && (
              <tr>
                <th>
                  <strong>Total Excess</strong>
                </th>
                <td style={{ textAlign: 'right' }}>
                  <strong>{money(letter.totalExcess)}</strong>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Actions onClose={onClose} />
    </Modal>
  )
}
