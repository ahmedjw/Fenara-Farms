/**
 * Adoption store.
 *
 * Backed by a JSON file on disk so the full flow works end to end without
 * standing up a database. Every read and write goes through the functions
 * below, so moving to Postgres, Supabase or Mongo later means rewriting this
 * one file and nothing else.
 *
 * Note: file storage does not survive a redeploy on serverless hosts such as
 * Vercel. Swap in a real database before taking live payments.
 */

import { promises as fs } from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "adoptions.json");

export type AdoptionStatus = "pending" | "active" | "cancelled";

export type Adoption = {
  /** Human readable adoption number, e.g. FEN-2026-0043. */
  number: string;
  tierId: string;
  /**
   * Spot ids from the land map, e.g. ["A-R41-C55"]. Adoptions made before the
   * land map hold tree ids from the grove plan instead, e.g. ["SOL-014"].
   */
  trees: string[];
  /** Tree id mapped to the name the customer gave it. */
  names: Record<string, string>;
  customerName: string;
  email: string;
  status: AdoptionStatus;
  season: number;
  stripeSessionId?: string;
  createdAt: string;
  giftFrom?: string;
  giftMessage?: string;
};

type Db = { adoptions: Adoption[] };

async function read(): Promise<Db> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    return JSON.parse(raw) as Db;
  } catch {
    return { adoptions: [] };
  }
}

async function write(db: Db): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

/**
 * Runs read-modify-write steps one at a time, so two requests cannot both read
 * the file, both see a tree as free, and both write. This only holds within
 * one server process, which is another reason to move to a database.
 */
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/** Thrown when an adoption asks for a tree that another adoption already holds. */
export class TreesTakenError extends Error {
  constructor(readonly ids: string[]) {
    super(`Already adopted: ${ids.join(", ")}`);
  }
}

function heldIds(db: Db): Set<string> {
  return new Set(
    db.adoptions.filter((a) => a.status !== "cancelled").flatMap((a) => a.trees),
  );
}

export const SEASON = 2026;

export async function nextAdoptionNumber(): Promise<string> {
  const db = await read();
  const seq = db.adoptions.length + 1;
  return `FEN-${SEASON}-${String(seq).padStart(4, "0")}`;
}

/**
 * Records an adoption, re-checking inside the lock that none of its trees has
 * been taken since the caller validated them. Throws TreesTakenError if so.
 */
export async function createAdoption(
  input: Omit<Adoption, "number" | "createdAt" | "season" | "status"> & {
    status?: AdoptionStatus;
  },
): Promise<Adoption> {
  return exclusive(async () => {
    const db = await read();
    const held = heldIds(db);
    const clash = input.trees.filter((id) => held.has(id));
    if (clash.length) throw new TreesTakenError(clash);

    const adoption: Adoption = {
      ...input,
      number: `FEN-${SEASON}-${String(db.adoptions.length + 1).padStart(4, "0")}`,
      status: input.status ?? "pending",
      season: SEASON,
      createdAt: new Date().toISOString(),
    };
    db.adoptions.push(adoption);
    await write(db);
    return adoption;
  });
}

export async function getAdoption(number: string): Promise<Adoption | null> {
  const db = await read();
  return (
    db.adoptions.find(
      (a) => a.number.toUpperCase() === number.trim().toUpperCase(),
    ) ?? null
  );
}

export async function getAdoptionBySession(
  sessionId: string,
): Promise<Adoption | null> {
  const db = await read();
  return db.adoptions.find((a) => a.stripeSessionId === sessionId) ?? null;
}

export async function activateAdoption(
  sessionId: string,
): Promise<Adoption | null> {
  return exclusive(async () => {
    const db = await read();
    const adoption = db.adoptions.find((a) => a.stripeSessionId === sessionId);
    if (!adoption) return null;
    adoption.status = "active";
    await write(db);
    return adoption;
  });
}

/** Tree and spot ids already spoken for, so the maps can grey them out. */
export async function takenTreeIds(): Promise<string[]> {
  return [...heldIds(await read())];
}

/** Lookup for the account page: adoption number plus matching email. */
export async function findForCustomer(
  number: string,
  email: string,
): Promise<Adoption | null> {
  const adoption = await getAdoption(number);
  if (!adoption) return null;
  if (adoption.email.toLowerCase() !== email.trim().toLowerCase()) return null;
  return adoption;
}
