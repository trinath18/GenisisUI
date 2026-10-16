import { api } from '../../../../api/client'

const BASE_URL = '/api/maintenance/benefits'
const CATEGORIES_URL = `${BASE_URL}/categories`
const SUB_CATEGORIES_URL = `${BASE_URL}/sub-categories`
const ENTRY_URL = `${BASE_URL}/entry`
const ROWS_URL = `${BASE_URL}/rows`

type Params = Record<string, string | undefined>

/** Maintenance > Benefits endpoints. Row types belong to the tabs that show them. */
export const benefitsApi = {
  getLookups: async <T>() => (await api.get<T>(`${BASE_URL}/lookups`)).data,

  searchCategories: async <T>(params: Params) => (await api.get<T[]>(CATEGORIES_URL, { params })).data,
  /** Adds the category when <c>editingCode</c> is null, else updates it. */
  saveCategory: (editingCode: string | null, body: object) =>
    editingCode === null ? api.post(CATEGORIES_URL, body) : api.put(`${CATEGORIES_URL}/${encodeURIComponent(editingCode)}`, body),
  deleteCategory: (code: string) => api.delete(`${CATEGORIES_URL}/${encodeURIComponent(code)}`),

  searchSubCategories: async <T>(params: Params) => (await api.get<T[]>(SUB_CATEGORIES_URL, { params })).data,
  saveSubCategory: (editingCode: string | null, body: object) =>
    editingCode === null ? api.post(SUB_CATEGORIES_URL, body) : api.put(`${SUB_CATEGORIES_URL}/${encodeURIComponent(editingCode)}`, body),
  deleteSubCategory: (code: string) => api.delete(`${SUB_CATEGORIES_URL}/${encodeURIComponent(code)}`),

  loadEntry: async <T>(params: Params) => (await api.get<T>(ENTRY_URL, { params })).data,
  saveEntry: async (body: object) => (await api.post<{ saved: number }>(ENTRY_URL, body)).data,

  searchRows: async <T>(params: Params) => (await api.get<T>(ROWS_URL, { params })).data,
  /** The row key (sub category, insured, plan, effective date) is in the body for both add and update. */
  saveRow: (isNew: boolean, body: object) => (isNew ? api.post(ROWS_URL, body) : api.put(ROWS_URL, body)),
  deleteRow: (key: { subCategoryCode: string; insuredCode: string; planCode: string; effectiveDate: string }) => api.delete(ROWS_URL, { params: key }),
}
