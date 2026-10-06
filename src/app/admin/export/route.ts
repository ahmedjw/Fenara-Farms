import { NextResponse } from "next/server";
import { addressLines, buildReport, toCsv } from "@/lib/admin";
import { isAdmin } from "@/lib/admin-auth";
import { listAdoptions, listHolds } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The dashboard's tables as spreadsheets.
 *
 *   /admin/export?type=adoptions   every adoption, one row each
 *   /admin/export?type=shipping    active adoptions, ready for labels
 *   /admin/export?type=trees       every tree in the open plots
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const type = new URL(request.url).searchParams.get("type") ?? "adoptions";
  const adoptions = await listAdoptions();
  const report = buildReport(adoptions, await listHolds());
  const money = (cents: number) => (cents / 100).toFixed(2);

  let rows: (string | number | undefined)[][];
  switch (type) {
    case "shipping":
      rows = [
        [
          "Adoption", "Ship to", "Phone", "Address line 1", "Address line 2",
          "City", "Region", "Postal code", "Country", "Tier", "Bottles",
          "Trees", "Gift from", "Gift message", "Email",
        ],
        ...report.adoptions
          .filter((r) => r.status === "active")
          .map((r) => [
            r.number,
            r.delivery?.name ?? r.customerName,
            r.delivery?.phone,
            r.delivery?.line1,
            r.delivery?.line2,
            r.delivery?.city,
            r.delivery?.region,
            r.delivery?.postalCode,
            r.delivery?.country,
            r.tier?.name ?? r.tierId,
            r.tier?.bottles,
            r.treeLabels.map((t) => t.label).join(" "),
            r.giftFrom,
            r.giftMessage,
            r.email,
          ]),
      ];
      break;
    case "trees":
      rows = [
        ["Tree", "Spot", "Row", "Position", "Status", "Adoption", "Adopted by", "Named"],
        ...report.trees.map((t) => [
          t.id, t.spotId, t.row, t.pos, t.status,
          t.adoptionNumber, t.customerName, t.name,
        ]),
      ];
      break;
    default:
      rows = [
        [
          "Adoption", "Created", "Status", "Cancelling", "Customer", "Email",
          "Phone", "Tier", "Season", "Trees", "Tree names", "Payments",
          "Collected", "Next charge", "Renews", "Address", "Gift from",
          "Gift message", "Confirmation sent", "Needs attention",
          "Stripe customer", "Stripe subscription",
        ],
        ...report.adoptions.map((r) => [
          r.number,
          r.createdAt,
          r.status,
          r.cancelAtPeriodEnd ? "yes" : "",
          r.customerName,
          r.email,
          r.delivery?.phone,
          r.tier?.name ?? r.tierId,
          r.season,
          r.treeLabels.map((t) => t.label).join(" "),
          r.treeLabels
            .filter((t) => t.name)
            .map((t) => `${t.label}: ${t.name}`)
            .join("; "),
          r.payments,
          money(r.collected),
          money(r.nextCharge),
          r.renewsAt,
          addressLines(r).join(", "),
          r.giftFrom,
          r.giftMessage,
          r.confirmationSentAt,
          r.flags.map((f) => f.text).join("; "),
          r.stripeCustomerId,
          r.stripeSubscriptionId,
        ]),
      ];
  }

  const day = new Date().toISOString().slice(0, 10);
  const name = ["shipping", "trees"].includes(type) ? type : "adoptions";
  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="fenara-${name}-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}
