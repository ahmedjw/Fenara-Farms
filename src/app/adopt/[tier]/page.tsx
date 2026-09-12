import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AdoptFlow } from "@/components/adopt-flow";
import { getTier } from "@/lib/site";
import { takenTreeIds } from "@/lib/store";
import { stripeConfigured } from "@/lib/stripe";

/* The picker must never offer a tree that has already been adopted. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tier: string }>;
}): Promise<Metadata> {
  const { tier } = await params;
  const found = getTier(tier);
  return { title: found ? `Adopt ${found.name}` : "Adopt an olive tree" };
}

export default async function AdoptTierPage({
  params,
}: {
  params: Promise<{ tier: string }>;
}) {
  const { tier: tierId } = await params;
  const tier = getTier(tierId);
  if (!tier) notFound();

  const taken = await takenTreeIds();

  return (
    <AdoptFlow tier={tier} taken={taken} paymentsReady={stripeConfigured()} />
  );
}
