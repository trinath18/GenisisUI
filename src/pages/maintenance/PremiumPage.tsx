import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../../api/client";

interface Option {
  code: string;
  name: string;
}
interface PremiumRow {
  code: number;
  insuredCode: string | null;
  payorCode: string | null;
  healthCode: string | null;
  ageCode: string | null;
  planCode: string | null;
  amount: number | null;
  suppAmount: number | null;
  effectiveDate: string | null;
  version: number | null;
  suppStatus: string | null;
}
interface SearchResult {
  rows: PremiumRow[];
  truncated: boolean;
  limit: number;
}
type Form = Record<string, string>;

const ageCodes = ["01", "02", "03", "04", "05", "06", "07"];
const statuses: [string, string][] = [
  ["A", "No Supplementary Premium"],
  ["B", "Supplementary Premium"],
  ["C", "Separate Supplementary Premium"],
];
const blank: Form = { suppStatus: "A" };
const money = (v: number | null) =>
  v == null ? "" : v.toLocaleString(undefined, { minimumFractionDigits: 2 });
const num = (v?: string) => (v ? Number(v) : null);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function PremiumPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<PremiumRow | null>(null);
  const [filter, setFilter] = useState<Form | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const lookups = useQuery({
    queryKey: ["plan-lookups"],
    queryFn: async () =>
      (
        await api.get<{ healthCodes: Option[]; payors: Option[] }>(
          "/api/maintenance/plans/lookups",
        )
      ).data,
  });
  const insuredTypes = useQuery({
    queryKey: ["insured-types"],
    queryFn: async () =>
      (await api.get<Option[]>("/api/maintenance/annual-limits/insured-types"))
        .data,
  });
  const search = useQuery({
    queryKey: ["premiums", filter],
    enabled: filter !== null,
    queryFn: async () =>
      (
        await api.get<SearchResult>("/api/maintenance/premiums", {
          params: filter,
        })
      ).data,
  });

  const status = editing ? (editing.suppStatus ?? "A") : form.suppStatus;
  const supp = status === "B" || status === "C";
  const set = (key: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const select = (key: string, options?: Option[]) => (
    <select value={form[key] ?? ""} onChange={set(key)} disabled={!!editing}>
      <option value="" />
      {options?.map((o) => (
        <option key={o.code} value={o.code}>
          {o.code} - {o.name}
        </option>
      ))}
    </select>
  );
  const amountInput = (key: string) => (
    <input
      type="number"
      min={0}
      step="0.01"
      value={form[key] ?? ""}
      onChange={set(key)}
    />
  );
  const copyFirstBand = (prefix: string) =>
    setForm((f) => ({
      ...f,
      ...Object.fromEntries(
        ageCodes.map((a) => [prefix + a, f[prefix + "01"] ?? ""]),
      ),
    }));

  const save = useMutation({
    mutationFn: async () => {
      const common = {
        effectiveDate: form.effectiveDate || null,
        version: num(form.version),
      };
      if (editing)
        return api.put(`/api/maintenance/premiums/${editing.code}`, {
          ...common,
          amount: num(form.amount),
          suppAmount: supp ? num(form.suppAmount) : null,
        });
      return api.post("/api/maintenance/premiums", {
        ...common,
        insuredCode: form.insuredCode,
        healthCode: form.healthCode,
        payorCode: form.payorCode,
        planCode: form.planCode,
        suppStatus: form.suppStatus,
        bands: ageCodes.map((a) => ({
          ageCode: a,
          amount: num(form["amt" + a]),
          suppAmount: supp ? num(form["supp" + a]) : null,
        })),
      });
    },
    onSuccess: () => {
      setSaved(editing ? "Record Updated..." : "Record Saved...");
      setForm(blank);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["premiums"] });
    },
  });
  const remove = useMutation({
    mutationFn: async (code: number) =>
      api.delete(`/api/maintenance/premiums/${code}`),
    onSuccess: () => {
      setSaved("Record Deleted...");
      queryClient.invalidateQueries({ queryKey: ["premiums"] });
    },
  });

  const resetFeedback = () => {
    setSaved(null);
    if (!save.isPending) save.reset();
    remove.reset();
  };
  const onSave = (e: FormEvent) => {
    e.preventDefault();
    resetFeedback();
    save.mutate();
  };
  const onSearch = () => {
    resetFeedback();
    const keys = [
      "insuredCode",
      "payorCode",
      "healthCode",
      "ageCode",
      "planCode",
    ];
    const f: Form = Object.fromEntries(
      keys.filter((k) => form[k]?.trim()).map((k) => [k, form[k].trim()]),
    );
    if (JSON.stringify(f) === JSON.stringify(filter)) search.refetch();
    else setFilter(f);
  };
  const onEdit = (r: PremiumRow) => {
    resetFeedback();
    setEditing(r);
    const s = (v: unknown) => (v == null ? "" : String(v));
    setForm({
      insuredCode: s(r.insuredCode),
      healthCode: s(r.healthCode),
      payorCode: s(r.payorCode),
      planCode: s(r.planCode),
      ageCode: s(r.ageCode),
      suppStatus: s(r.suppStatus) || "A",
      amount: s(r.amount),
      suppAmount: s(r.suppAmount),
      effectiveDate: r.effectiveDate?.slice(0, 10) ?? "",
      version: s(r.version),
    });
  };

  return (
    <section>
      <h2>Plan Maintenance: Premium</h2>
      {(lookups.isError || insuredTypes.isError) && (
        <p className="error">
          {errorMessage(lookups.error ?? insuredTypes.error)}
        </p>
      )}
      <form onSubmit={onSave}>
        <fieldset disabled={save.isPending}>
          <legend>
            {editing
              ? `Editing record ${editing.code} (age band ${editing.ageCode ?? "-"})`
              : "New premium"}
          </legend>
          <Field label="Insured Type *">
            {select("insuredCode", insuredTypes.data)}
          </Field>
          <Field label="Health Type *">
            {select("healthCode", lookups.data?.healthCodes)}
          </Field>
          <Field label="Payor">
            {select("payorCode", lookups.data?.payors)}
          </Field>
          <Field label="Plan Code *">
            <input
              value={form.planCode ?? ""}
              maxLength={4}
              disabled={!!editing}
              onChange={set("planCode")}
            />
          </Field>
          <Field label="Age Band (search)">
            <select
              value={form.ageCode ?? ""}
              disabled={!!editing}
              onChange={set("ageCode")}
            >
              <option value="" />
              {ageCodes.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Supp Premium Status">
            <select
              value={status ?? "A"}
              disabled={!!editing}
              onChange={set("suppStatus")}
            >
              {statuses.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} - {name}
                </option>
              ))}
            </select>
          </Field>
          {editing ? (
            <>
              <Field label="Premium *">{amountInput("amount")}</Field>
              {supp && (
                <Field label="Supp Premium">{amountInput("suppAmount")}</Field>
              )}
            </>
          ) : (
            <table className="age-bands">
              <thead>
                <tr>
                  <th>Age Band</th>
                  <th>Premium</th>
                  {supp && <th>Supp Premium</th>}
                </tr>
              </thead>
              <tbody>
                {ageCodes.map((a) => (
                  <tr key={a}>
                    <td>{a}</td>
                    <td>{amountInput("amt" + a)}</td>
                    {supp && <td>{amountInput("supp" + a)}</td>}
                  </tr>
                ))}
                <tr>
                  <td />
                  <td>
                    <button
                      type="button"
                      className="link"
                      onClick={() => copyFirstBand("amt")}
                    >
                      Copy 01 to all
                    </button>
                  </td>
                  {supp && (
                    <td>
                      <button
                        type="button"
                        className="link"
                        onClick={() => copyFirstBand("supp")}
                      >
                        Copy 01 to all
                      </button>
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          )}
          <Field label="Effective Date *">
            <input
              type="date"
              value={form.effectiveDate ?? ""}
              onChange={set("effectiveDate")}
            />
          </Field>
          <Field label="Version *">
            <input
              type="number"
              min={0}
              step={1}
              value={form.version ?? ""}
              onChange={set("version")}
            />
          </Field>
        </fieldset>
        {!editing && (
          <p className="muted">Age bands left blank are not saved.</p>
        )}
        {save.isError && <p className="error">{errorMessage(save.error)}</p>}
        {saved && <p className="success">{saved}</p>}
        <div className="actions">
          <button type="submit" disabled={save.isPending}>
            {editing ? "Update" : "Save"}
          </button>
          <button type="button" onClick={onSearch} disabled={!!editing}>
            Search
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => {
              setForm(blank);
              setEditing(null);
              resetFeedback();
            }}
          >
            Clear
          </button>
        </div>
      </form>
      {search.isError && <p className="error">{errorMessage(search.error)}</p>}
      {remove.isError && <p className="error">{errorMessage(remove.error)}</p>}
      {search.data && (
        <>
          <p className="muted">
            {search.data.rows.length === 0
              ? "Record not found"
              : `${search.data.rows.length} record(s)`}
            {search.data.truncated &&
              ` (showing the latest ${search.data.limit}; narrow the search to see more)`}
          </p>
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Insured</th>
                  <th>Payor</th>
                  <th>Health</th>
                  <th>Age</th>
                  <th>Plan</th>
                  <th className="num">Premium</th>
                  <th className="num">Supp</th>
                  <th>Effective</th>
                  <th>Ver.</th>
                  <th>Status</th>
                  <th className="action-cell" />
                </tr>
              </thead>
              <tbody>
                {search.data.rows.map((r) => (
                  <tr key={r.code}>
                    <td>{r.code}</td>
                    <td>{r.insuredCode}</td>
                    <td>{r.payorCode}</td>
                    <td>{r.healthCode}</td>
                    <td>{r.ageCode}</td>
                    <td>{r.planCode}</td>
                    <td className="num">{money(r.amount)}</td>
                    <td className="num">{money(r.suppAmount)}</td>
                    <td>{r.effectiveDate?.slice(0, 10)}</td>
                    <td>{r.version}</td>
                    <td>{r.suppStatus}</td>
                    <td className="action-cell">
                      <button
                        type="button"
                        className="link"
                        disabled={save.isPending}
                        onClick={() => onEdit(r)}
                      >
                        Edit
                      </button>{" "}
                      <button
                        type="button"
                        className="link"
                        disabled={remove.isPending}
                        onClick={() => {
                          resetFeedback();
                          if (
                            window.confirm(
                              `Do you want to delete premium record ${r.code}?`,
                            )
                          )
                            remove.mutate(r.code);
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
