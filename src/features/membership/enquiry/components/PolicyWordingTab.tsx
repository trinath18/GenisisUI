import { useMutation, useQuery } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { openBlob } from '../../../../lib/download'
import { enquiryApi, enquiryKeys } from '../api/enquiryApi'

/** Policy Wording tab: the plan's policy wording documents (desktop addTheFiles); a click opens the file in a new tab. */
export function PolicyWordingTab({ membershipNo }: { membershipNo: string }) {
  const list = useQuery({ queryKey: enquiryKeys.policyWording(membershipNo), queryFn: () => enquiryApi.getPolicyWording(membershipNo) })
  const open = useMutation({
    mutationFn: (fileName: string) => enquiryApi.getPolicyWordingFile(membershipNo, fileName),
    onSuccess: openBlob,
  })

  if (list.isLoading) return <p className="muted">Loading…</p>
  if (list.isError)
    return (
      <p className="error" role="alert">
        {errorMessage(list.error)}
      </p>
    )
  const data = list.data!
  if (!data.wording) return <p className="muted">This plan has no policy wording.</p>
  if (data.files.length === 0)
    return (
      <p className="muted">
        No policy wording files found for "{data.wording}"{data.folderFound ? '' : ' (folder not found on the server)'}.
      </p>
    )
  return (
    <>
      {open.isError && (
        <p className="error" role="alert">
          {errorMessage(open.error)}
        </p>
      )}
      <ul>
        {data.files.map((fileName) => (
          <li key={fileName}>
            <button type="button" className="link" disabled={open.isPending} onClick={() => open.mutate(fileName)}>
              {fileName}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
