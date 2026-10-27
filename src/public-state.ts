import type { State } from "./model.ts";

export interface PublicSnapshot {
  schemaVersion: number;
  publishedAt: string;
  dataVersion: string;
  records: Omit<
    State,
    | "revision"
    | "lastCommitAt"
    | "uploads"
    | "receipts"
    | "reviews"
    | "publication"
  >;
}

export function publicState(snapshot: PublicSnapshot): State {
  const kinds = [
    "targets",
    "companies",
    "sources",
    "series",
    "molecules",
    "evidence",
    "relations",
    "deals",
    "gaps",
  ] as const;
  if (
    snapshot.schemaVersion !== 1 ||
    !snapshot.publishedAt ||
    !snapshot.dataVersion ||
    kinds.some((kind) => !Array.isArray(snapshot.records?.[kind]))
  ) {
    throw Error("公开数据快照格式无效");
  }
  return {
    ...snapshot.records,
    revision: 0,
    uploads: [],
    receipts: [],
    reviews: [],
    publication: {
      publishedAt: snapshot.publishedAt,
      dataVersion: snapshot.dataVersion,
    },
  };
}

export async function readPublicState(
  url: string,
  fallbackUrl: string,
  request: typeof fetch = fetch,
): Promise<State> {
  async function read(path: string) {
    const response = await request(path, { cache: "no-store" });
    if (!response.ok) throw Error("公开数据暂时无法读取，请稍后重试");
    return publicState(await response.json());
  }
  try {
    return await read(url);
  } catch (error) {
    if (url === fallbackUrl) throw error;
    const state = await read(fallbackUrl);
    if (state.publication) state.publication.fallback = true;
    return state;
  }
}
