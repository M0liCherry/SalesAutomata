import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useApi } from "../hooks/useApi";
import type { ListResponse } from "../types";
import { DataTable, type Column } from "./DataTable";
import { FilterBar, type FilterField } from "./FilterBar";
import { Pagination } from "./Pagination";
import { ErrorMessage, Loading } from "./Status";

interface ResourceListPageProps<T> {
  title: string;
  description?: string;
  endpoint: string;
  fields: FilterField[];
  columns: Column<T>[];
  getKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  defaultParams?: Record<string, string | number | boolean>;
  pageSize?: number;
  headerAction?: ReactNode;
  refreshKey?: number | string;
}

export function ResourceListPage<T>({
  title,
  description,
  endpoint,
  fields,
  columns,
  getKey,
  actions,
  defaultParams,
  pageSize = 25,
  headerAction,
  refreshKey,
}: ResourceListPageProps<T>) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [offset, setOffset] = useState(0);

  const params = useMemo(
    () => ({ ...defaultParams, ...applied, limit: pageSize, offset }),
    [defaultParams, applied, pageSize, offset],
  );

  const { data, loading, error, reload } = useApi<ListResponse<T>>(
    endpoint,
    params,
  );

  useEffect(() => {
    void reload();
    // Reload on demand after create/edit actions; initial load is handled by useApi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const apply = () => {
    setApplied({ ...draft });
    setOffset(0);
  };

  const reset = () => {
    setDraft({});
    setApplied({});
    setOffset(0);
  };

  return (
    <section>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}

      <FilterBar
        fields={fields}
        values={draft}
        onChange={(name, value) =>
          setDraft((current) => ({ ...current, [name]: value }))
        }
        onSubmit={apply}
        onReset={reset}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {headerAction}
        <button type="button" onClick={() => void reload()} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? <Loading /> : null}
      {error ? (
        <ErrorMessage message={error} onRetry={() => void reload()} />
      ) : null}
      {!loading && !error && data ? (
        <>
          <DataTable
            columns={columns}
            rows={data.data}
            getKey={getKey}
            actions={actions}
          />
          <Pagination
            limit={data.limit}
            offset={data.offset}
            count={data.count}
            onPage={setOffset}
          />
        </>
      ) : null}
    </section>
  );
}
