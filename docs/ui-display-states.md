# UI display states for billing & usage figures

Every money or usage number in the Client Portal and the Super Admin console
is rendered from what the backend returns. The browser never computes a
total, an overage, a percentage or a rate. When the backend has not given us
a figure, we render one of the states below instead of inventing a value.

The same seven states exist in both portals so the two always look identical:

| Portal        | File                                       | Exports                                                                 |
| ------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| Client portal | `components/DataState.tsx`                 | `DataState`, `DataStatePill`, `ValueUnavailable`, `KpiUnavailable`, `UnavailableControl` |
| Super admin   | `public/admin/asset_display_states.js`     | `DataState`, `DataStatePill`, `NotAvailable`, `KpiUnavailable`, `UnavailableControl`, `Money`, `fmtMoneyOrNull` |

## The states

| `kind`                   | When to use it                                                                 | Tone  |
| ------------------------ | ------------------------------------------------------------------------------ | ----- |
| `loading`                | Request in flight, nothing to show yet.                                        | grey  |
| `empty`                  | Request succeeded and there are genuinely no rows for this period.             | grey  |
| `disconnected`           | The upstream source (DB, voice provider, billing API) isn't connected.         | amber |
| `stale`                  | We have a value but the last successful refresh is older than expected.        | amber |
| `pending`                | The figure exists upstream but isn't published to this UI yet. Default state for "Not available yet". | grey |
| `reconciliation-warning` | The API says two sources disagree for this figure. Show it as provisional.     | rose  |
| `unauthorized`           | The viewer's role may not see this figure.                                     | grey  |

Every rendered state carries a `data-state="<kind>"` attribute so UI tests
can assert on it without depending on copy.

## Components

### Block state (replaces a chart, table or card body)

```tsx
// client portal
<DataState kind="pending" />                       // default title/description
<DataState kind="disconnected" detail={error} />   // raw API detail, monospace
<DataState kind="empty" compact />                 // one-line variant for headers
```

```jsx
// super admin (Babel bundle, globals)
<DataState kind="pending" />
<DataState kind="stale" title="Last refresh 3h ago" />
```

### Pill (table cells, headers)

```tsx
<DataStatePill kind="stale" />
<DataStatePill kind="reconciliation-warning" label="Check" />
```

### Single value placeholder

Use wherever a number would normally be printed:

```tsx
// client portal
<ValueUnavailable />                 // "— NOT AVAILABLE YET"
<ValueUnavailable kind="unauthorized" />
```

```jsx
// super admin
<NotAvailable />
<Money value={client.mrr} />         // prints fmtMoney(value) or <NotAvailable /> when null
```

### KPI card placeholder

Keeps the card in the grid so the layout doesn't shift when the real figure
lands:

```tsx
<KpiUnavailable label="Monthly Recurring Revenue" />
<KpiUnavailable label="Platform uptime" kind="disconnected" hint="Monitoring not wired up." />
```

### Controls without a backend yet

Render the button greyed-out with an explicit label so nobody mistakes it for
a working action:

```tsx
<UnavailableControl>Download PDF</UnavailableControl>
<UnavailableControl reason="Coming with the billing API">Mark paid</UnavailableControl>
```

## Rules

1. Never derive a number in the browser. If the API doesn't send it, render a
   state. If two API fields could be combined into a third, ask the API for
   the third.
2. Never hardcode a plan figure or wording in copy ("40h", "monthly",
   "calendar month", "Rs. 3 / minute"). Use `periodLabel`, `includedMinutes`,
   `rate` and friends from the API payload.
3. Keep the card. Replace the value, not the layout.
4. When the API contract lands, each `pending` state should turn into either
   the real figure or one of the other states; none should remain as
   permanent copy.
