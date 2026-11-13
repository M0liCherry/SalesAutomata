export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className={`tab ${value === item.value ? "tab--active" : ""}`}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {typeof item.count === "number" ? (
            <span className="tab__count">{item.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
