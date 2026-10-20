import { Messages } from '../constants'
import type { UploadResult, VerifyResult } from '../types'

/** Verify result: totals and the error list (desktop lstError). */
export function VerifyResultView({ result }: { result: VerifyResult }) {
  const errorCount = result.errors.length
  return (
    <>
      <p className={errorCount ? 'warning' : 'success'} role="status">
        {errorCount ? `${errorCount} error(s) found.` : Messages.verified} Submission date {result.submissionDate || '-'}; principals {result.totalPrincipal};
        supplementaries {result.totalSupplementary}.
      </p>
      {errorCount > 0 && (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Line</th>
                <th>Policy No</th>
                <th>Name</th>
                <th>Error</th>
                <th>File</th>
              </tr>
            </thead>
            <tbody>
              {result.errors.map((e) => (
                <tr key={`${e.line}-${e.message}`}>
                  <td>{e.line}</td>
                  <td>{e.policyNo}</td>
                  <td>{e.name}</td>
                  <td>{e.message}</td>
                  <td>{e.fileName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/** Upload result: batch, counts, membership numbers and warnings. */
export function UploadResultView({ result }: { result: UploadResult }) {
  return (
    <div className="success" role="status">
      <p>
        {result.message} {result.batchNo != null && <>Batch {result.batchNo}. </>}
        New members {result.newMembers}, supplementaries {result.supplementaries}, cancelled {result.cancelled}, reinstated {result.reinstated}.
      </p>
      {result.membershipNumbers.length > 0 && <p className="muted">Memberships: {result.membershipNumbers.join(', ')}</p>}
      {result.warnings.map((w) => (
        <p key={w} className="warning">
          {w}
        </p>
      ))}
    </div>
  )
}
