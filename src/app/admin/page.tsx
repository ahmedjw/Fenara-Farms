import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  addressLines,
  buildReport,
  type AdoptionRow,
  type Report,
  type TreeRow,
} from "@/lib/admin";
import { isAdmin } from "@/lib/admin-auth";
import { StorageNotConfiguredError } from "@/lib/db";
import { formatDate, formatPrice, site } from "@/lib/site";
import { listAdoptions, listHolds, SEASON } from "@/lib/store";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

type View = "overview" | "adoptions" | "trees" | "shipping";
const VIEWS: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "adoptions", label: "Adoptions" },
  { id: "trees", label: "Trees" },
  { id: "shipping", label: "Shipping" },
];

type Search = { view?: string; q?: string; status?: string };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const params = await searchParams;
  const view: View = VIEWS.some((v) => v.id === params.view)
    ? (params.view as View)
    : "overview";

  let report: Report;
  try {
    // One after the other: the local dev database serves a single connection.
    const adoptions = await listAdoptions();
    report = buildReport(adoptions, await listHolds());
  } catch (e) {
    console.error("Admin dashboard could not read the store:", e);
    return (
      <Shell view={view} counts={null}>
        <p className="rounded-[2px] border-l-2 border-brick bg-paper-sunk p-5 text-[15px] leading-relaxed text-ink">
          {e instanceof StorageNotConfiguredError
            ? "DATABASE_URL is not set, so there are no adoptions to show. Add the database connection to this server's environment."
            : "The database could not be reached just now. Refresh in a moment; if it keeps happening, check the database is up."}
        </p>
      </Shell>
    );
  }

  return (
    <Shell
      view={view}
      counts={{ adoptions: report.adoptions.length, generatedAt: report.generatedAt }}
    >
      {view === "overview" && <Overview report={report} />}
      {view === "adoptions" && (
        <Adoptions report={report} q={params.q ?? ""} status={params.status ?? ""} />
      )}
      {view === "trees" && (
        <Trees report={report} q={params.q ?? ""} status={params.status ?? ""} />
      )}
      {view === "shipping" && <Shipping report={report} />}
    </Shell>
  );
}

/* ------------------------------------------------------------------ shell */

function Shell({
  view,
  counts,
  children,
}: {
  view: View;
  counts: { adoptions: number; generatedAt: string } | null;
  children: ReactNode;
}) {
  return (
    <div className="px-4 pb-20 md:px-8">
      <div className="mx-auto w-full max-w-[1320px]">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5 pt-8">
          <div>
            <p className="mono-label">{site.name}</p>
            <h1 className="display mt-1 text-[36px] text-olive">Admin</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-stone">
            {counts && (
              <span>
                As of{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Europe/Madrid",
                }).format(new Date(counts.generatedAt))}{" "}
                Madrid
              </span>
            )}
            <Link
              href={`/admin?view=${view}`}
              className="rounded-[2px] border border-line-strong px-3 py-1.5 text-ink hover:border-ink"
            >
              Refresh
            </Link>
            <Link
              href="/"
              className="rounded-[2px] border border-line-strong px-3 py-1.5 text-ink hover:border-ink"
            >
              View site
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-[2px] border border-line-strong px-3 py-1.5 text-ink hover:border-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <nav aria-label="Dashboard sections" className="-mx-4 overflow-x-auto px-4">
          <ul className="flex min-w-max gap-1 border-b border-line">
            {VIEWS.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/admin?view=${v.id}`}
                  aria-current={view === v.id ? "page" : undefined}
                  className={`-mb-px block border-b-2 px-4 py-3 text-[14px] transition-colors ${
                    view === v.id
                      ? "border-olive font-medium text-olive"
                      : "border-transparent text-stone hover:text-ink"
                  }`}
                >
                  {v.label}
                  {v.id === "adoptions" && counts ? (
                    <span className="ml-1.5 font-mono text-[11px] text-stone">
                      {counts.adoptions}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="pt-8">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- overview */

function Overview({ report }: { report: Report }) {
  const { totals, treeTotals } = report;
  const adoptedShare = treeTotals.offered
    ? Math.round((treeTotals.adopted / treeTotals.offered) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Collected to date"
          value={formatPrice(totals.collected)}
          detail={`${formatPrice(totals.firstYear)} new · ${formatPrice(totals.renewals)} renewals`}
        />
        <Stat
          label="Renewing yearly"
          value={formatPrice(totals.yearly)}
          detail={`incl. ${formatPrice(totals.yearlyShipping)} shipping${
            totals.ending ? ` · ${totals.ending} ending` : ""
          }`}
        />
        <Stat
          label="Active adoptions"
          value={String(totals.active)}
          detail={`${totals.customers} ${totals.customers === 1 ? "customer" : "customers"} · ${totals.gifts} ${totals.gifts === 1 ? "gift" : "gifts"}`}
        />
        <Stat
          label="Trees adopted"
          value={`${treeTotals.adopted} / ${treeTotals.offered}`}
          detail={`${adoptedShare}% · ${treeTotals.available} free · ${treeTotals.reserved} on hold · ${treeTotals.unavailable} not available`}
        />
      </div>

      <p className="-mt-6 text-[12px] leading-relaxed text-stone">
        Money is counted at today&rsquo;s tier prices, one charge for the
        purchase and one per renewal. Stripe fees, refunds and tax are not
        included; Stripe is the record for those.
        {totals.pending > 0 &&
          ` ${totals.pending} ${totals.pending === 1 ? "checkout is" : "checkouts are"} in progress and not counted.`}
      </p>

      <Panel
        title="Needs attention"
        empty="Nothing needs looking at. Every active adoption has an address, a confirmation email and a tree that is still there."
        count={report.attention.length}
      >
        <AdoptionTable rows={report.attention} />
      </Panel>

      <Panel
        title="Renewing in the next 60 days"
        empty="No renewals due in the next 60 days."
        count={report.renewingSoon.length}
      >
        <Table
          head={["Adoption", "Customer", "Tier", "Renews", "Will charge"]}
          rows={report.renewingSoon.map((r) => [
            <AdoptionLink key="n" number={r.number} />,
            <Person key="p" row={r} />,
            r.tier?.name ?? r.tierId,
            r.renewsAt ? formatDate(r.renewsAt) : "—",
            r.cancelAtPeriodEnd ? (
              <span key="c" className="text-brick">
                Cancelled, ends
              </span>
            ) : (
              formatPrice(r.nextCharge)
            ),
          ])}
        />
      </Panel>

      <div className="grid gap-10 lg:grid-cols-2">
        <Panel title="By tier">
          <Table
            head={["Tier", "Active", "Trees", "Collected", "Yearly"]}
            numeric={[1, 2, 3, 4]}
            rows={report.byTier.map((t) => [
              <span key="t">
                {t.tier.name}{" "}
                <span className="text-stone">· {t.tier.englishName.toLowerCase()}</span>
              </span>,
              t.active,
              t.trees,
              formatPrice(t.collected),
              formatPrice(t.yearly),
            ])}
          />
        </Panel>

        <Panel title="New adoptions by month" empty="No paid adoptions yet.">
          {report.byMonth.length > 0 && (
            <Table
              head={["Month", "Adoptions", "First-year sales"]}
              numeric={[1, 2]}
              rows={report.byMonth.map((m) => [
                new Intl.DateTimeFormat("en-GB", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(new Date(`${m.month}-01T00:00:00Z`)),
                m.adoptions,
                formatPrice(m.collected),
              ])}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- adoptions */

const STATUS_FILTERS = [
  ["", "All"],
  ["active", "Active"],
  ["ending", "Cancelling"],
  ["pending", "In checkout"],
  ["cancelled", "Ended"],
  ["attention", "Needs attention"],
] as const;

function matchesQuery(r: AdoptionRow, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  const haystack = [
    r.number,
    r.customerName,
    r.email,
    r.delivery?.name,
    r.delivery?.phone,
    r.delivery?.city,
    r.giftFrom,
    ...r.treeLabels.flatMap((t) => [t.label, t.id, t.name]),
  ];
  return haystack.some((s) => s?.toLowerCase().includes(needle));
}

function Adoptions({
  report,
  q,
  status,
}: {
  report: Report;
  q: string;
  status: string;
}) {
  const rows = report.adoptions.filter((r) => {
    if (!matchesQuery(r, q)) return false;
    switch (status) {
      case "active":
        return r.status === "active";
      case "ending":
        return r.status === "active" && r.cancelAtPeriodEnd;
      case "pending":
        return r.status === "pending";
      case "cancelled":
        return r.status === "cancelled";
      case "attention":
        return r.flags.some((f) => f.tone === "alert");
      default:
        return true;
    }
  });

  return (
    <div className="flex flex-col gap-5">
      <Filters
        view="adoptions"
        q={q}
        status={status}
        options={STATUS_FILTERS}
        placeholder="Name, email, adoption number, tree, phone…"
        exportHref="/admin/export?type=adoptions"
        exportLabel="Download all as CSV"
      />
      <p className="text-[13px] text-stone">
        {rows.length} of {report.adoptions.length}{" "}
        {report.adoptions.length === 1 ? "adoption" : "adoptions"}. Click one for
        the delivery address, gift note and Stripe details.
      </p>
      {rows.length ? (
        <AdoptionTable rows={rows} />
      ) : (
        <Empty>No adoptions match.</Empty>
      )}
    </div>
  );
}

function AdoptionTable({ rows }: { rows: AdoptionRow[] }) {
  return (
    <div className="overflow-hidden rounded-[2px] border border-line bg-paper-raised">
      <div className="hidden grid-cols-[1.1fr_1.6fr_0.9fr_1.3fr_0.9fr_1fr] gap-4 border-b border-line bg-paper-sunk px-4 py-2.5 lg:grid">
        {["Adoption", "Customer", "Tier", "Trees", "Paid", "Status"].map((h) => (
          <span key={h} className="mono-label !text-[10px]">
            {h}
          </span>
        ))}
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.number} className="border-b border-line last:border-b-0">
            <details id={r.number}>
              <summary className="grid cursor-pointer list-none items-start gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-paper lg:grid-cols-[1.1fr_1.6fr_0.9fr_1.3fr_0.9fr_1fr] [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="font-mono text-[13px] text-ink">{r.number}</span>
                  <span className="block text-[12px] text-stone">
                    {formatDate(r.createdAt)}
                  </span>
                </span>
                <Person row={r} />
                <span className="text-[14px] text-ink">
                  {r.tier?.name ?? r.tierId}
                  <span className="block text-[12px] text-stone">
                    Season {r.season}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {r.treeLabels.map((t) => (
                    <span
                      key={t.id}
                      title={t.name ? `${t.label} "${t.name}"` : t.label}
                      className={`rounded-[2px] px-1.5 py-0.5 font-mono text-[12px] ${
                        t.unavailable
                          ? "bg-brick/10 text-brick line-through"
                          : "bg-olive-soft text-olive"
                      }`}
                    >
                      {t.label}
                    </span>
                  ))}
                </span>
                <span className="text-[14px] text-ink">
                  {r.payments ? formatPrice(r.collected) : "—"}
                  <span className="block text-[12px] text-stone">
                    {r.payments === 0
                      ? "not paid"
                      : r.payments === 1
                        ? "1 payment"
                        : `${r.payments} payments`}
                  </span>
                </span>
                <span className="flex flex-wrap items-start gap-1.5">
                  <StatusBadge row={r} />
                  {r.flags.map((f) => (
                    <Badge key={f.text} tone={f.tone}>
                      {f.text}
                    </Badge>
                  ))}
                </span>
              </summary>
              <AdoptionDetail row={r} />
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdoptionDetail({ row: r }: { row: AdoptionRow }) {
  const address = addressLines(r);
  // Missing details only matter once someone has paid. Before that, Stripe
  // has not handed them over yet, and nothing is wrong.
  const missing = r.status === "active" ? "text-brick" : "text-stone";
  return (
    <div className="grid gap-6 border-t border-line bg-paper px-4 py-5 text-[14px] sm:grid-cols-2 lg:grid-cols-4">
      <Facts title="Deliver to">
        {address.length ? (
          <>
            {r.delivery?.name && <p className="text-ink">{r.delivery.name}</p>}
            {address.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {r.delivery?.phone && (
              <p className="mt-1">
                <a className="text-olive underline" href={`tel:${r.delivery.phone}`}>
                  {r.delivery.phone}
                </a>
              </p>
            )}
            {r.tier && <p className="mt-1 text-stone">{r.tier.bottles}</p>}
          </>
        ) : (
          <p className={missing}>No address on record.</p>
        )}
      </Facts>

      <Facts title="Trees">
        {r.treeLabels.map((t) => (
          <p key={t.id}>
            <span className="font-mono text-ink">{t.label}</span>
            {t.name && <span> &ldquo;{t.name}&rdquo;</span>}
            {t.label !== t.id && (
              <span className="text-stone"> · spot {t.id}</span>
            )}
            {t.unavailable && <span className="text-brick"> · no longer available</span>}
          </p>
        ))}
      </Facts>

      <Facts title="Billing">
        <p>
          {r.payments
            ? `${formatPrice(r.collected)} over ${r.payments} ${r.payments === 1 ? "payment" : "payments"}`
            : "Nothing charged"}
        </p>
        {r.status === "active" && (
          <p>
            {r.cancelAtPeriodEnd
              ? `Cancelled. Ends ${r.renewsAt ? formatDate(r.renewsAt) : "at renewal"}.`
              : r.renewsAt
                ? `Renews ${formatDate(r.renewsAt)} for ${formatPrice(r.nextCharge)}`
                : "Renewal date not known yet"}
          </p>
        )}
        <p>
          Confirmation email:{" "}
          {r.confirmationSentAt ? formatDate(r.confirmationSentAt) : (
            <span className={missing}>not sent</span>
          )}
        </p>
        {r.stripeUrl && (
          <p className="mt-1">
            <a
              href={r.stripeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-olive underline"
            >
              Open customer in Stripe
            </a>
          </p>
        )}
      </Facts>

      <Facts title="Gift">
        {r.giftFrom || r.giftMessage ? (
          <>
            {r.giftFrom && <p>From {r.giftFrom}</p>}
            {r.giftMessage && <p className="italic">&ldquo;{r.giftMessage}&rdquo;</p>}
          </>
        ) : (
          <p className="text-stone">Not a gift.</p>
        )}
        <p className="mt-3 break-all font-mono text-[11px] text-stone">
          {[r.stripeSubscriptionId, r.stripeSessionId].filter(Boolean).join(" · ")}
        </p>
      </Facts>
    </div>
  );
}

/* ------------------------------------------------------------------ trees */

const TREE_FILTERS = [
  ["", "All"],
  ["available", "Available"],
  ["adopted", "Adopted"],
  ["reserved", "On hold"],
  ["unavailable", "Not available"],
] as const;

const TREE_WORDS: Record<TreeRow["status"], string> = {
  available: "Available",
  adopted: "Adopted",
  reserved: "On hold",
  unavailable: "Not available",
};

function Trees({ report, q, status }: { report: Report; q: string; status: string }) {
  const needle = q.trim().toLowerCase();
  const rows = report.trees.filter(
    (t) =>
      (!status || t.status === status) &&
      (!needle ||
        [t.id, t.spotId, t.adoptionNumber, t.customerName, t.name].some((s) =>
          s?.toLowerCase().includes(needle),
        )),
  );
  const { treeTotals } = report;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Adopted" value={String(treeTotals.adopted)} />
        <Stat label="Available" value={String(treeTotals.available)} />
        <Stat label="On hold in checkout" value={String(treeTotals.reserved)} />
        <Stat label="Not available" value={String(treeTotals.unavailable)} />
      </div>
      <Filters
        view="trees"
        q={q}
        status={status}
        options={TREE_FILTERS}
        placeholder="Tree, spot, adoption number, customer…"
        exportHref="/admin/export?type=trees"
        exportLabel="Download trees as CSV"
      />
      <p className="text-[13px] text-stone">
        {rows.length} of {report.trees.length} trees in the open plots.
      </p>
      {rows.length ? (
        <Table
          head={["Tree", "Row · Pos", "Status", "Adoption", "Adopted by", "Named"]}
          rows={rows.map((t) => [
            <span key="t" className="font-mono text-ink">
              {t.id}
              <span className="block text-[11px] text-stone">{t.spotId}</span>
            </span>,
            `${t.row} · ${t.pos}`,
            <Badge
              key="s"
              tone={
                t.status === "available"
                  ? "good"
                  : t.status === "unavailable"
                    ? "muted"
                    : t.status === "reserved"
                      ? "notice"
                      : "plain"
              }
            >
              {TREE_WORDS[t.status]}
            </Badge>,
            t.adoptionNumber ? (
              <AdoptionLink key="a" number={t.adoptionNumber} />
            ) : (
              "—"
            ),
            t.customerName ?? "—",
            t.name ? `“${t.name}”` : "—",
          ])}
        />
      ) : (
        <Empty>No trees match.</Empty>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- shipping */

function Shipping({ report }: { report: Report }) {
  const rows = report.adoptions.filter((r) => r.status === "active");
  const missing = rows.filter((r) => !r.delivery?.line1).length;
  // Every bottle is 500ml, so a tier's litres say how many go in its parcel.
  const bottles = rows.reduce(
    (n, r) => n + (r.tier ? Math.round(r.tier.litres * 2) : 0),
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Parcels this harvest" value={String(rows.length)} />
        <Stat label="Bottles of 500ml" value={String(bottles)} />
        <Stat
          label="Missing an address"
          value={String(missing)}
          tone={missing ? "alert" : undefined}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-stone">
          Every active adoption, season {SEASON} onwards. Gift parcels carry the
          note in the last column.
        </p>
        <a
          href="/admin/export?type=shipping"
          className="rounded-[2px] bg-olive px-4 py-2.5 text-[13px] font-medium text-paper hover:bg-olive-mid"
        >
          Download shipping list (CSV)
        </a>
      </div>
      {rows.length ? (
        <Table
          head={["Adoption", "Ship to", "Address", "Phone", "Bottles", "Gift note"]}
          rows={rows.map((r) => {
            const address = addressLines(r);
            return [
              <AdoptionLink key="n" number={r.number} />,
              r.delivery?.name ?? r.customerName,
              address.length ? (
                <span key="a" className="block min-w-[180px]">
                  {address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              ) : (
                <span key="a" className="text-brick">
                  No address
                </span>
              ),
              r.delivery?.phone ?? "—",
              r.tier?.bottles ?? "—",
              r.giftFrom || r.giftMessage ? (
                <span key="g" className="block min-w-[160px]">
                  {r.giftFrom && <span className="block">From {r.giftFrom}</span>}
                  {r.giftMessage && (
                    <span className="block italic text-stone">“{r.giftMessage}”</span>
                  )}
                </span>
              ) : (
                "—"
              ),
            ];
          })}
        />
      ) : (
        <Empty>No active adoptions to ship yet.</Empty>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

function Filters({
  view,
  q,
  status,
  options,
  placeholder,
  exportHref,
  exportLabel,
}: {
  view: View;
  q: string;
  status: string;
  options: readonly (readonly [string, string])[];
  placeholder: string;
  exportHref: string;
  exportLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <form method="get" action="/admin" className="flex flex-wrap gap-2">
        <input type="hidden" name="view" value={view} />
        {status && <input type="hidden" name="status" value={status} />}
        <label htmlFor="admin-search" className="sr-only">
          Search
        </label>
        <input
          id="admin-search"
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className="min-w-[220px] flex-1 rounded-[2px] border border-line-strong bg-paper-raised px-4 py-2.5 text-[14px] text-ink placeholder:text-stone-light focus:border-olive focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-[2px] bg-olive px-4 py-2.5 text-[13px] font-medium text-paper hover:bg-olive-mid"
        >
          Search
        </button>
        <a
          href={exportHref}
          className="rounded-[2px] border border-line-strong px-4 py-2.5 text-[13px] text-ink hover:border-ink"
        >
          {exportLabel}
        </a>
      </form>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
        {options.map(([id, label]) => {
          const href = `/admin?view=${view}${id ? `&status=${id}` : ""}${
            q ? `&q=${encodeURIComponent(q)}` : ""
          }`;
          return (
            <Link
              key={id}
              href={href}
              aria-current={status === id ? "true" : undefined}
              className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                status === id
                  ? "bg-olive text-paper"
                  : "border border-line-strong text-stone hover:text-ink"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "alert";
}) {
  return (
    <div className="min-w-0 rounded-[2px] border border-line bg-paper-raised p-4 sm:p-5">
      <p className="mono-label !text-[10px]">{label}</p>
      <p
        className={`display mt-2 text-[28px] leading-none sm:text-[34px] ${
          tone === "alert" ? "text-brick" : "text-olive"
        }`}
      >
        {value}
      </p>
      {detail && <p className="mt-2 text-[12px] leading-snug text-stone">{detail}</p>}
    </div>
  );
}

function Panel({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count?: number;
  empty?: string;
  children: ReactNode;
}) {
  const isEmpty = count === 0 || (count === undefined && !children);
  return (
    <section>
      <h2 className="display mb-3 flex items-baseline gap-2 text-[24px] text-ink">
        {title}
        {count !== undefined && count > 0 && (
          <span className="font-mono text-[13px] text-stone">{count}</span>
        )}
      </h2>
      {isEmpty && empty ? <Empty>{empty}</Empty> : children}
    </section>
  );
}

function Table({
  head,
  rows,
  numeric = [],
}: {
  head: string[];
  rows: ReactNode[][];
  numeric?: number[];
}) {
  return (
    <div className="overflow-x-auto rounded-[2px] border border-line bg-paper-raised">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead className="bg-paper-sunk">
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`mono-label whitespace-nowrap px-4 py-2.5 !text-[10px] font-normal ${
                  numeric.includes(i) ? "text-right" : ""
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r} className="border-t border-line align-top">
              {cells.map((cell, i) => (
                <td
                  key={i}
                  className={`px-4 py-3 text-ink ${
                    numeric.includes(i) ? "text-right tabular-nums" : ""
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Person({ row }: { row: AdoptionRow }) {
  return (
    <span className="min-w-0 text-[14px]">
      <span className="block truncate text-ink">{row.customerName}</span>
      <a
        href={`mailto:${row.email}`}
        className="block truncate text-[12px] text-stone hover:text-olive"
      >
        {row.email}
      </a>
    </span>
  );
}

function AdoptionLink({ number }: { number: string }) {
  return (
    <Link
      href={`/admin?view=adoptions&q=${encodeURIComponent(number)}`}
      className="font-mono text-[13px] text-olive underline decoration-line-strong underline-offset-2 hover:decoration-olive"
    >
      {number}
    </Link>
  );
}

function StatusBadge({ row }: { row: AdoptionRow }) {
  if (row.status === "active") {
    return <Badge tone="good">Active</Badge>;
  }
  if (row.status === "pending") return <Badge tone="notice">In checkout</Badge>;
  return <Badge tone="muted">{row.payments ? "Ended" : "Checkout lapsed"}</Badge>;
}

const BADGE = {
  good: "bg-olive text-paper",
  plain: "bg-olive-soft text-olive",
  notice: "border border-dashed border-brick text-brick",
  alert: "bg-brick text-white",
  muted: "bg-paper-sunk text-stone",
} as const;

function Badge({
  tone,
  children,
}: {
  tone: keyof typeof BADGE;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-[2px] px-2 py-0.5 text-[11px] font-medium ${BADGE[tone]}`}
    >
      {children}
    </span>
  );
}

function Facts({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="leading-relaxed text-ink">
      <p className="mono-label mb-1.5 !text-[10px]">{title}</p>
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[2px] border border-dashed border-line-strong px-5 py-6 text-[14px] text-stone">
      {children}
    </p>
  );
}
