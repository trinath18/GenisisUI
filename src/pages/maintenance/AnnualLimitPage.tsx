import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../../api/client";

interface Option {
  code: string;
  name: string;
}
interface AnnualLimitRow {
  index: number;
  planCode: string | null;
  insuredCode: string | null;
  healthCode: string | null;
  payorCode: string | null;
  groupCompany: string | null;
  annualLimit: number | null;
  suppLimit: number | null;
  effectiveDate: string | null;
  suppLimitStatus: string | null;
  version: number | null;
  lifetimeLimit: number | null;
  suppLifetimeLimit: number | null;
  disabilityLimit: number;
}
interface SearchResult {
  rows: AnnualLimitRow[];
  truncated: boolean;
  limit: number;
}
type Form = Record<string, string>;

const statuses: [string, string][] = [
  ["A", "Share Limit For Family"],
  ["B", "Share Limit For Supplementary"],
  ["C", "Separate Limit For Supplementary"],
];
const amounts: [string, string][] = [
  ["annualLimit", "Annual Limit *"],
  ["lifetimeLimit", "Life Time Limit"],
  ["disabilityLimit", "Disability Limit"],
];
const money = (v: number | null) =>
  v == null ? "" : v.toLocaleString(undefined, { minimumFractionDigits: 2 });

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function AnnualLimitPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>({ suppLimitStatus: "A" });
  const [editing, setEditing] = useState<number | null>(null);
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
    queryKey: ["annual-limits", filter],
    enabled: filter !== null,
    queryFn: async () =>
      (
        await api.get<SearchResult>("/api/maintenance/annual-limits", {
          params: filter,
        })
      ).data,
  });

  const supp = form.suppLimitStatus === "B" || form.suppLimitStatus === "C";
  const set = (key: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const select = (key: string, options?: Option[]) => (
    <select value={form[key] ?? ""} onChange={set(key)}>
      <option value="" />
      {options?.map((o) => (
        <option key={o.code} value={o.code}>
          {o.code} - {o.name}
        </option>
      ))}
    </select>
  );

  const save = useMutation({
    mutationFn: async () => {
      const num = (v?: string) => (v ? Number(v) : null);
      const body = {
        ...form,
        annualLimit: num(form.annualLimit),
        lifetimeLimit: num(form.lifetimeLimit),
        suppLimit: supp ? num(form.suppLimit) : null,
        suppLifetimeLimit: supp ? num(form.suppLifetimeLimit) : null,
        disabilityLimit: num(form.disabilityLimit),
        version: num(form.version),
        effectiveDate: form.effectiveDate || null,
      };
      return editing === null
        ? api.post("/api/maintenance/annual-limits", body)
        : api.put(`/api/maintenance/annual-limits/${editing}`, body);
    },
    onSuccess: () => {
      setSaved(editing === null ? "Record Saved..." : "Record Updated...");
      setForm({ suppLimitStatus: "A" });
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["annual-limits"] });
    },
  });
  const remove = useMutation({
    mutationFn: async (index: number) =>
      api.delete(`/api/maintenance/annual-limits/${index}`),
    onSuccess: () => {
      setSaved("Record Deleted...");
      queryClient.invalidateQueries({ queryKey: ["annual-limits"] });
    },
  });

  const resetFeedback = () => {
    setSaved(null);
    save.reset();
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
      "planCode",
      "healthCode",
      "insuredCode",
      "payorCode",
      "groupCompany",
    ];
    const f: Form = Object.fromEntries(
      keys.filter((k) => form[k]?.trim()).map((k) => [k, form[k].trim()]),
    );
    if (JSON.stringify(f) === JSON.stringify(filter)) search.refetch();
    else setFilter(f);
  };
  const onEdit = (r: AnnualLimitRow) => {
    resetFeedback();
    setEditing(r.index);
    const s = (v: unknown) => (v == null ? "" : String(v));
    setForm({
      planCode: s(r.planCode),
      healthCode: s(r.healthCode),
      insuredCode: s(r.insuredCode),
      payorCode: s(r.payorCode),
      groupCompany: s(r.groupCompany),
      annualLimit: s(r.annualLimit),
      lifetimeLimit: s(r.lifetimeLimit),
      disabilityLimit: s(r.disabilityLimit),
      suppLimitStatus: s(r.suppLimitStatus) || "A",
      suppLimit: s(r.suppLimit),
      suppLifetimeLimit: s(r.suppLifetimeLimit),
      effectiveDate: r.effectiveDate?.slice(0, 10) ?? "",
      version: s(r.version),
    });
  };

  return (
    <section>
      <h2>Plan Maintenance: Annual Limit</h2>
      {(lookups.isError || insuredTypes.isError) && (
        <p className="error">
          {errorMessage(lookups.error ?? insuredTypes.error)}
        </p>
      )}
      <form onSubmit={onSave}>
        <fieldset>
          <legend>
            {editing === null
              ? "New annual limit"
              : `Editing record ${editing}`}
          </legend>
          <Field label="Plan Code *">
            <input
              value={form.planCode ?? ""}
              maxLength={4}
              onChange={set("planCode")}
            />
          </Field>
          <Field label="Health Type *">
            {select("healthCode", lookups.data?.healthCodes)}
          </Field>
          <Field label="Insured Type *">
            {select("insuredCode", insuredTypes.data)}
          </Field>
          <Field label="Payor">
            {select("payorCode", lookups.data?.payors)}
          </Field>
          <Field label="Group Company">
            <input
              value={form.groupCompany ?? ""}
              maxLength={200}
              onChange={set("groupCompany")}
            />
          </Field>
          {amounts.map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form[key] ?? ""}
                onChange={set(key)}
              />
            </Field>
          ))}
          <Field label="Supp Limit Status">
            <select
              value={form.suppLimitStatus ?? "A"}
              onChange={set("suppLimitStatus")}
            >
              {statuses.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} - {name}
                </option>
              ))}
            </select>
          </Field>
          {supp && (
            <>
              <Field label="Supp Premium Limit *">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.suppLimit ?? ""}
                  onChange={set("suppLimit")}
                />
              </Field>
              <Field label="Supp Life Time Limit *">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.suppLifetimeLimit ?? ""}
                  onChange={set("suppLifetimeLimit")}
                />
              </Field>
            </>
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
        <p className="muted">
          Life Time Limit is required when the plan has a life-time limit.
        </p>
        {save.isError && <p className="error">{errorMessage(save.error)}</p>}
        {saved && <p className="success">{saved}</p>}
        <div className="actions">
          <button type="submit" disabled={save.isPending}>
            {editing === null ? "Save" : "Update"}
          </button>
          <button type="button" onClick={onSearch}>
            Search
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => {
              setForm({ suppLimitStatus: "A" });
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
          <table>
            <thead>
              <tr>
                <th>Health</th>
                <th>Plan</th>
                <th>Insured</th>
                <th>Payor</th>
                <th>Group Company</th>
                <th>Annual</th>
                <th>Life Time</th>
                <th>Status</th>
                <th>Supp</th>
                <th>Supp Life Time</th>
                <th>Effective</th>
                <th>Ver.</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {search.data.rows.map((r) => (
                <tr key={r.index}>
                  <td>{r.healthCode}</td>
                  <td>{r.planCode}</td>
                  <td>{r.insuredCode}</td>
                  <td>{r.payorCode}</td>
                  <td>{r.groupCompany}</td>
                  <td>{money(r.annualLimit)}</td>
                  <td>{money(r.lifetimeLimit)}</td>
                  <td>{r.suppLimitStatus}</td>
                  <td>{money(r.suppLimit)}</td>
                  <td>{money(r.suppLifetimeLimit)}</td>
                  <td>{r.effectiveDate?.slice(0, 10)}</td>
                  <td>{r.version}</td>
                  <td>
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
                            `Do you want to delete the annual limit for plan ${r.planCode}?`,
                          )
                        )
                          remove.mutate(r.index);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
