import type { ActivityItem } from "@/lib/types";

type FeedHealthResult = {
  total: number;
  byAuthor: Record<string, number>;
  byType: Record<string, number>;
  missingRequired: number;
  missingProfile: number;
};

export function shouldRunFeedHealthCheck(searchParams: URLSearchParams) {
  if (process.env.NODE_ENV === "production") return false;
  if (searchParams.get("health") === "1") return true;
  return process.env.NEXT_PUBLIC_FEED_HEALTH === "1";
}

export function runFeedHealthCheck(input: { items: ActivityItem[] }) {
  try {
    const byAuthor: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let missingRequired = 0;
    let missingProfile = 0;

    input.items.forEach((item) => {
      if (!item.id || !item.user_id || !item.event_type || !item.created_at) {
        missingRequired += 1;
      }
      if (!item.profile) missingProfile += 1;
      byAuthor[item.user_id] = (byAuthor[item.user_id] ?? 0) + 1;
      byType[item.event_type] = (byType[item.event_type] ?? 0) + 1;
    });

    const result: FeedHealthResult = {
      total: input.items.length,
      byAuthor,
      byType,
      missingRequired,
      missingProfile,
    };

    console.groupCollapsed("FeedHealth");
    console.log("Total items:", result.total);
    console.log("By author:", Object.entries(result.byAuthor).slice(0, 5));
    console.log("By type:", result.byType);
    if (result.missingRequired > 0) {
      console.warn("Missing required fields:", result.missingRequired);
    }
    if (result.missingProfile > 0) {
      console.warn("Missing profiles:", result.missingProfile);
    }
    console.groupEnd();

    return result;
  } catch (error) {
    console.warn("FeedHealth error", error);
    return {
      total: 0,
      byAuthor: {},
      byType: {},
      missingRequired: 0,
      missingProfile: 0,
    } as FeedHealthResult;
  }
}

export function summarizeFeedHealth(result: FeedHealthResult) {
  const status =
    result.missingRequired > 0 || result.missingProfile > 0 ? "WARN" : "OK";
  const authors = Object.keys(result.byAuthor).length;
  return `FeedHealth: ${status} (${result.total} items / ${authors} authors)`;
}
