import type { UseQueryResult } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { DataTable } from '../../../../components/DataTable'
import type { Column } from '../../../../components/DataTable'
import type { FormRow } from '../types'

/** A read-only tab: loading, error, empty and data states of one query. */
export function QueryTable({ query, columns }: { query: UseQueryResult<FormRow[]>; columns: Column[] }) {
  if (query.isLoading) return <p className="muted">Loading…</p>
  if (query.isError)
    return (
      <p className="error" role="alert">
        {errorMessage(query.error)}
      </p>
    )
  return <DataTable columns={columns} rows={query.data ?? []} />
}
