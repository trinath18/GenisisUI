import { useState } from 'react'
import { api, errorMessage } from '../../api/client'
import { downloadCsv } from '../../lib/exportCsv'
import type { CsvColumn } from '../../lib/exportCsv'
import { ask, notify } from '../../lib/notifyStore'
import { useTickList } from '../worksheet/useTickList'
import type { SearchResult } from '../worksheet/worksheetRules'
import { afterPrint, nothingListed, printQuestion, withKeys } from './invoiceAccountingRules'
import type { AccountingAmounts, PrintResult } from './invoiceAccountingRules'

/**
 * The list of an accounting screen (HOS or MBM): Search fills it, Preview downloads it, and Print to File takes the batch of the day on the server, marks the listed
 * invoices as printed and downloads the list as the batch. The desktop exported the list to Excel; the file here is a CSV that opens in Excel.
 * <c>marks</c> says which listed rows the server marks as printed (the member print marks only the member-paid invoices).
 */
export function useAccountingList<T extends AccountingAmounts>(
  endpoint: string,
  fileName: string,
  columns: CsvColumn<T>[],
  marks: (row: T) => boolean = () => true,
) {
  const list = useTickList<T>((r) => r.key)
  const [busy, setBusy] = useState(false)
  const [batch, setBatch] = useState('')
  const { replace } = list

  /** CmdSearch_Click: replaces the list; "No record found!" when nothing matches. */
  async function search(params: object) {
    setBusy(true)
    try {
      const { data } = await api.get<SearchResult<Omit<T, 'key'>>>(`${endpoint}/search`, { params })
      replace(withKeys(data.rows) as unknown as T[])
      setBatch('')
      if (data.rows.length === 0) notify('No record found!', 'error')
      else if (data.truncated) notify('Only the first 5,000 invoices are shown. Narrow the search to see the rest.', 'info')
      return data.rows.length
    } catch (e) {
      notify(errorMessage(e), 'error')
      return 0
    } finally {
      setBusy(false)
    }
  }

  /** cmdPreview_Click: downloads the list as it is; nothing is marked. */
  function preview() {
    if (list.rows.length === 0) return notify(nothingListed, 'error')
    downloadCsv(`${fileName}-preview.csv`, columns, list.rows)
  }

  /** CmdPrintFile_Click: asks, lets the server mark the listed invoices (a reprint marks none) and downloads the list. */
  async function print(body: object) {
    if (list.rows.length === 0) return notify(nothingListed, 'error')
    if (!(await ask(printQuestion))) return
    setBusy(true)
    try {
      const { data } = await api.post<PrintResult>(`${endpoint}/print`, body)
      const rows = data.batch ? afterPrint(list.rows, data.batch, marks) : list.rows
      if (data.batch) {
        list.replace(rows)
        setBatch(data.batch)
      }
      downloadCsv(`${fileName}-${data.batch ?? 'reprint'}.csv`, columns, rows)
      notify(data.batch ? `Batch ${data.batch}: ${data.updated} invoice(s) marked as printed.` : 'Record Printed...', 'success')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    list.clear()
    setBatch('')
  }

  return { list, busy, batch, search, preview, print, clear }
}
