import { api } from '../../../../api/client'

const BASE_URL = '/api/maintenance/entity'
const PROCEDURES_URL = `${BASE_URL}/procedures`
const FEES_URL = `${BASE_URL}/fees`

type Params = Record<string, string | undefined>

/** Maintenance > Entity endpoints (Procedures and Look Up Table tabs). */
export const entityApi = {
  searchProcedures: async <T>(params: Params) => (await api.get<T>(PROCEDURES_URL, { params })).data,
  /** Adds the procedure when <c>editingIndex</c> is null, else updates it. */
  saveProcedure: (editingIndex: number | null, body: object) =>
    editingIndex === null ? api.post(PROCEDURES_URL, body) : api.put(`${PROCEDURES_URL}/${editingIndex}`, body),
  deleteProcedure: (index: number) => api.delete(`${PROCEDURES_URL}/${index}`),

  searchFees: async <T>(params: Params) => (await api.get<T[]>(FEES_URL, { params })).data,
  saveFee: (editingIndex: number | null, body: object) => (editingIndex === null ? api.post(FEES_URL, body) : api.put(`${FEES_URL}/${editingIndex}`, body)),
  deleteFee: (index: number) => api.delete(`${FEES_URL}/${index}`),
}
