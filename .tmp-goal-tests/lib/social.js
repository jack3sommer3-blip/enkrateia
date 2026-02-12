"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchUsers = searchUsers;
exports.getProfileByUsername = getProfileByUsername;
exports.followUser = followUser;
exports.unfollowUser = unfollowUser;
exports.listFollowers = listFollowers;
exports.listFollowing = listFollowing;
exports.getFeed = getFeed;
exports.getUserFeed = getUserFeed;
exports.upsertFeedItem = upsertFeedItem;
exports.ensureFeedItemIdForActivity = ensureFeedItemIdForActivity;
exports.backfillFeedItemsForUser = backfillFeedItemsForUser;
exports.updateFeedItemByEvent = updateFeedItemByEvent;
exports.deleteFeedItemByEvent = deleteFeedItemByEvent;
exports.toggleLike = toggleLike;
exports.addComment = addComment;
exports.deleteComment = deleteComment;
exports.listComments = listComments;
exports.getCommentsForPost = getCommentsForPost;
exports.getCommentCounts = getCommentCounts;
exports.getLikesForFeed = getLikesForFeed;
exports.getSelfActivityStream = getSelfActivityStream;
exports.getFeedActivityStream = getFeedActivityStream;
exports.getActivityDebug = getActivityDebug;
exports.deleteActivity = deleteActivity;
const supabase_1 = require("@/lib/supabase");
const utils_1 = require("@/lib/utils");
const scoring_1 = require("@/lib/scoring");
async function searchUsers(query) {
    if (!query.trim())
        return [];
    const { data, error } = await supabase_1.supabase
        .from("profiles")
        .select("id, username, display_name, bio, profile_photo_url, is_public, show_workouts, show_reading, show_drinking")
        .ilike("username", `${query.toLowerCase()}%`)
        .order("username", { ascending: true })
        .limit(20);
    if (error)
        return [];
    return (data ?? []);
}
async function getProfileByUsername(username) {
    const { data, error } = await supabase_1.supabase
        .from("profiles")
        .select("id, username, display_name, bio, profile_photo_url, is_public, show_workouts, show_reading, show_drinking, created_at, first_name, last_name")
        .eq("username", username)
        .single();
    if (error)
        return undefined;
    return data;
}
async function followUser(followerId, followingId) {
    const { data, error } = await supabase_1.supabase
        .from("follows")
        .insert({ follower_id: followerId, following_id: followingId })
        .select("follower_id, following_id, created_at")
        .single();
    if (error)
        return undefined;
    return data;
}
async function unfollowUser(followerId, followingId) {
    const { error } = await supabase_1.supabase
        .from("follows")
        .delete()
        .eq("following_id", followingId)
        .eq("follower_id", followerId);
    return !error;
}
async function listFollowers(userId) {
    const { data, error } = await supabase_1.supabase
        .from("follows")
        .select("follower_id, following_id, created_at, profiles:follower_id(id, username, display_name, profile_photo_url)")
        .eq("following_id", userId);
    if (error)
        return [];
    return data ?? [];
}
async function listFollowing(userId) {
    const { data, error } = await supabase_1.supabase
        .from("follows")
        .select("follower_id, following_id, created_at, profiles:following_id(id, username, display_name, profile_photo_url)")
        .eq("follower_id", userId);
    if (error)
        return [];
    return data ?? [];
}
async function getFeed(userIds) {
    if (userIds.length === 0)
        return [];
    const { data, error } = await supabase_1.supabase
        .from("feed_items")
        .select("id, user_id, created_at, event_date, event_type, event_id, summary, metadata, profiles:user_id(username, display_name, profile_photo_url)")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(50);
    if (error)
        return [];
    return data ?? [];
}
async function getUserFeed(userId) {
    const { data, error } = await supabase_1.supabase
        .from("feed_items")
        .select("id, user_id, created_at, event_date, event_type, event_id, summary, metadata")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
    if (error)
        return [];
    return data;
}
async function upsertFeedItem(input) {
    const { data, error } = await supabase_1.supabase
        .from("feed_items")
        .upsert(input, { onConflict: "user_id,event_type,event_id" })
        .select("id, user_id, created_at, event_date, event_type, event_id, summary, metadata")
        .single();
    if (error)
        return undefined;
    return data;
}
async function ensureFeedItemIdForActivity(item) {
    if (item.feed_item_id)
        return item.feed_item_id;
    const created = await upsertFeedItem({
        user_id: item.user_id,
        event_date: item.event_date,
        event_type: item.event_type,
        event_id: item.event_id,
        summary: item.summary,
        metadata: item.metadata ?? {},
    });
    return created?.id;
}
function stableUuid(seed) {
    const hash = (input, seedNum) => {
        let h = seedNum >>> 0;
        for (let i = 0; i < input.length; i += 1) {
            h = Math.imul(h ^ input.charCodeAt(i), 0x5bd1e995);
            h = (h >>> 0) ^ (h >>> 13);
        }
        return h >>> 0;
    };
    const h1 = hash(seed, 0x1234abcd).toString(16).padStart(8, "0");
    const h2 = hash(seed, 0x9e3779b1).toString(16).padStart(8, "0");
    const h3 = hash(seed, 0x7f4a7c15).toString(16).padStart(8, "0");
    const h4 = hash(seed, 0xcafef00d).toString(16).padStart(8, "0");
    const hex = `${h1}${h2}${h3}${h4}`;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function ensureUuid(value, seed) {
    if (value && UUID_RE.test(value))
        return value;
    return stableUuid(seed);
}
function workoutSummary(activity) {
    const minutes = (0, utils_1.intFromText)(activity.minutesText) ?? 0;
    const seconds = (0, utils_1.intFromText)(activity.secondsText) ?? 0;
    const intensity = (0, utils_1.intFromText)(activity.intensityText);
    const timeLabel = minutes > 0
        ? `${minutes} min`
        : seconds > 0
            ? `${seconds} sec`
            : undefined;
    const parts = [
        activity.type,
        activity.environment,
        timeLabel,
        intensity ? `Intensity ${intensity}` : undefined,
    ].filter(Boolean);
    return parts.join(" • ");
}
function readingSummary(event) {
    const totalPages = event.pages ?? (event.fictionPages ?? 0) + (event.nonfictionPages ?? 0);
    const base = totalPages ? `Read ${totalPages} pages` : "Read";
    return event.title ? `${base} • ${event.title}` : base;
}
function isValidWorkout(activity) {
    const minutes = (0, utils_1.intFromText)(activity.minutesText) ?? 0;
    const seconds = (0, utils_1.intFromText)(activity.secondsText) ?? 0;
    const calories = (0, utils_1.intFromText)(activity.caloriesText) ?? 0;
    const intensity = (0, utils_1.intFromText)(activity.intensityText) ?? 0;
    return minutes > 0 || seconds > 0 || calories > 0 || intensity > 0;
}
function isValidReading(event) {
    const totalPages = event.pages ?? (event.fictionPages ?? 0) + (event.nonfictionPages ?? 0);
    return (totalPages ?? 0) > 0 || !!event.title;
}
function isValidActivityItem(item) {
    if (item.event_type === "workout") {
        const minutes = Number(item.metadata?.minutes ?? 0);
        const seconds = Number(item.metadata?.seconds ?? 0);
        const calories = Number(item.metadata?.calories ?? 0);
        const intensity = Number(item.metadata?.intensity ?? 0);
        return minutes > 0 || seconds > 0 || calories > 0 || intensity > 0;
    }
    if (item.event_type === "reading") {
        const pages = Number(item.metadata?.pages ?? 0);
        const fiction = Number(item.metadata?.fiction_pages ?? 0);
        const nonfiction = Number(item.metadata?.nonfiction_pages ?? 0);
        const title = String(item.metadata?.title ?? "").trim();
        return pages > 0 || fiction > 0 || nonfiction > 0 || !!title;
    }
    if (item.event_type === "drinking") {
        const drinks = Number(item.metadata?.drinks ?? 0);
        return drinks > 0;
    }
    return true;
}
async function backfillFeedItemsForUser(userId, days = 30) {
    const start = (0, utils_1.addDays)(new Date(), -(Math.max(days, 1) - 1));
    const startKey = (0, utils_1.toDateKey)(start);
    const { data: logs, error: logsError } = await supabase_1.supabase
        .from("daily_logs")
        .select("date,data")
        .eq("user_id", userId)
        .gte("date", startKey);
    if (logsError)
        return { ok: false, error: logsError.message };
    const items = [];
    (logs ?? []).forEach((row) => {
        const data = row.data;
        const dateKey = row.date;
        const activities = data?.workouts?.activities ?? [];
        activities.forEach((activity, index) => {
            if (!isValidWorkout(activity))
                return;
            const eventId = ensureUuid(activity.id, `${dateKey}-workout-${index}`);
            items.push({
                user_id: userId,
                event_date: dateKey,
                event_type: "workout",
                event_id: eventId,
                summary: workoutSummary(activity),
                metadata: {
                    activityType: activity.type,
                    minutes: activity.minutesText,
                    seconds: activity.secondsText,
                    calories: activity.caloriesText,
                    intensity: activity.intensityText,
                },
            });
        });
        const readingEvents = data?.reading?.events ?? [];
        if (readingEvents.length > 0) {
            readingEvents.forEach((event, index) => {
                if (!isValidReading(event))
                    return;
                const eventId = ensureUuid(event.id, `${dateKey}-reading-${index}`);
                items.push({
                    user_id: userId,
                    event_date: dateKey,
                    event_type: "reading",
                    event_id: eventId,
                    summary: readingSummary(event),
                    metadata: {
                        title: event.title,
                        pages: event.pages,
                        fiction_pages: event.fictionPages,
                        nonfiction_pages: event.nonfictionPages,
                        quote: event.quote,
                    },
                });
            });
        }
        else if (data?.reading?.title || data?.reading?.pagesText) {
            const pages = (0, utils_1.intFromText)(data.reading.pagesText) ?? 0;
            if (pages <= 0 && !data.reading.title)
                return;
            const eventId = stableUuid(`${dateKey}-reading-legacy`);
            items.push({
                user_id: userId,
                event_date: dateKey,
                event_type: "reading",
                event_id: eventId,
                summary: readingSummary({
                    id: eventId,
                    title: data.reading.title,
                    pages,
                }),
                metadata: {
                    title: data.reading.title,
                    pages,
                },
            });
        }
    });
    const { data: drinkingEvents, error: drinkingError } = await supabase_1.supabase
        .from("drinking_events")
        .select("id, date, tier, drinks, note")
        .eq("user_id", userId)
        .gte("date", startKey);
    if (!drinkingError && drinkingEvents) {
        drinkingEvents.forEach((event) => {
            if (Number(event.drinks ?? 0) <= 0)
                return;
            items.push({
                user_id: userId,
                event_date: event.date,
                event_type: "drinking",
                event_id: event.id,
                summary: `Tier ${event.tier} • ${event.drinks} drinks`,
                metadata: {
                    tier: event.tier,
                    drinks: event.drinks,
                    note: event.note,
                },
            });
        });
    }
    if (items.length === 0)
        return { ok: true };
    const { error: upsertError } = await supabase_1.supabase
        .from("feed_items")
        .upsert(items, { onConflict: "user_id,event_type,event_id" });
    if (upsertError)
        return { ok: false, error: upsertError.message };
    return { ok: true };
}
async function updateFeedItemByEvent(eventType, eventId, patch) {
    const { data, error } = await supabase_1.supabase
        .from("feed_items")
        .update(patch)
        .eq("event_type", eventType)
        .eq("event_id", eventId)
        .select("id, user_id, created_at, event_date, event_type, event_id, summary, metadata")
        .single();
    if (error)
        return undefined;
    return data;
}
async function deleteFeedItemByEvent(eventType, eventId) {
    const { error } = await supabase_1.supabase
        .from("feed_items")
        .delete()
        .eq("event_type", eventType)
        .eq("event_id", eventId);
    return !error;
}
async function toggleLike(feedItemId, liked, userId) {
    if (liked) {
        const { error } = await supabase_1.supabase
            .from("likes")
            .delete()
            .eq("feed_item_id", feedItemId)
            .eq("user_id", userId);
        return !error;
    }
    const { data, error } = await supabase_1.supabase
        .from("likes")
        .insert({ feed_item_id: feedItemId, user_id: userId })
        .select("user_id, feed_item_id, created_at")
        .single();
    if (error)
        return undefined;
    return data;
}
async function addComment(feedItemId, body, userId) {
    const { data, error } = await supabase_1.supabase
        .from("comments")
        .insert({ feed_item_id: feedItemId, body, author_id: userId })
        .select("id, author_id, feed_item_id, body, created_at")
        .single();
    if (error)
        return { comment: undefined, error };
    return { comment: data, error: null };
}
async function deleteComment(commentId) {
    const { error } = await supabase_1.supabase.from("comments").delete().eq("id", commentId);
    return !error;
}
async function listComments(feedItemId) {
    const debugEnabled = typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("debug") === "1";
    const { data: comments, error } = await supabase_1.supabase
        .from("comments")
        .select("id, author_id, feed_item_id, body, created_at")
        .eq("feed_item_id", feedItemId)
        .order("created_at", { ascending: true });
    if (error && process.env.NODE_ENV !== "production") {
        console.debug("[listComments] error", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });
    }
    if (!comments || comments.length === 0) {
        if (debugEnabled)
            console.debug("[listComments] empty", { feedItemId });
        return { comments: [], error };
    }
    const authorIds = Array.from(new Set(comments.map((c) => c.author_id)));
    const { data: profiles, error: profileError } = await supabase_1.supabase
        .from("profiles")
        .select("id, username, display_name, profile_photo_url")
        .in("id", authorIds);
    if (profileError && process.env.NODE_ENV !== "production") {
        console.debug("[listComments] profile error", {
            message: profileError.message,
            code: profileError.code,
            details: profileError.details,
            hint: profileError.hint,
        });
    }
    const profileMap = new Map();
    (profiles ?? []).forEach((p) => profileMap.set(p.id, p));
    const merged = comments.map((row) => ({
        ...row,
        profiles: profileMap.get(row.author_id) ?? undefined,
    }));
    if (debugEnabled) {
        console.debug("[listComments] sample row", merged[0]);
    }
    return { comments: merged, error: error ?? profileError ?? null };
}
async function getCommentsForPost(feedItemId) {
    return listComments(feedItemId);
}
async function getCommentCounts(feedItemIds) {
    if (feedItemIds.length === 0)
        return {};
    const { data, error } = await supabase_1.supabase.rpc("get_comment_counts", {
        feed_ids: feedItemIds,
    });
    if (error)
        return {};
    const counts = {};
    (data ?? []).forEach((row) => {
        counts[row.feed_item_id] = Number(row.count ?? 0);
    });
    return counts;
}
async function getLikesForFeed(feedItemIds) {
    if (feedItemIds.length === 0)
        return [];
    const { data, error } = await supabase_1.supabase
        .from("likes")
        .select("user_id, feed_item_id")
        .in("feed_item_id", feedItemIds);
    if (error)
        return [];
    return (data ?? []);
}
function makeCreatedAt(dateKey) {
    return `${dateKey}T12:00:00.000Z`;
}
function activityFromWorkout(userId, dateKey, activity, index, createdAt) {
    const eventId = ensureUuid(activity.id, `${dateKey}-workout-${index}`);
    return {
        id: eventId,
        user_id: userId,
        event_type: "workout",
        event_id: eventId,
        event_date: dateKey,
        created_at: createdAt ?? makeCreatedAt(dateKey),
        summary: workoutSummary(activity) || "Workout",
        metadata: {
            activityType: activity.type,
            minutes: activity.minutesText,
            seconds: activity.secondsText,
            calories: activity.caloriesText,
            intensity: activity.intensityText,
            environment: activity.environment,
        },
    };
}
function activityFromReading(userId, dateKey, event, index, createdAt) {
    const eventId = ensureUuid(event.id, `${dateKey}-reading-${index}`);
    return {
        id: eventId,
        user_id: userId,
        event_type: "reading",
        event_id: eventId,
        event_date: dateKey,
        created_at: createdAt ?? makeCreatedAt(dateKey),
        summary: readingSummary(event) || "Reading",
        metadata: {
            title: event.title,
            pages: event.pages,
            fiction_pages: event.fictionPages,
            nonfiction_pages: event.nonfictionPages,
            quote: event.quote,
        },
    };
}
async function recomputeAndSaveDailyLog(userId, dateKey, dataValue) {
    const { data: goalsRow, error: goalsError } = await supabase_1.supabase
        .from("user_goals")
        .select("goals, enabled_categories")
        .eq("user_id", userId)
        .maybeSingle();
    if (goalsError)
        return { ok: false, error: goalsError.message };
    const { data: drinkingRows, error: drinkingError } = await supabase_1.supabase
        .from("drinking_events")
        .select("id, user_id, date, tier, drinks, note")
        .eq("user_id", userId)
        .eq("date", dateKey);
    if (drinkingError)
        return { ok: false, error: drinkingError.message };
    const drinkingEvents = (drinkingRows ?? []);
    const { startKey, endKey } = (0, utils_1.getWeekWindowFromKey)(dateKey);
    const { data: weekRows, error: weekError } = await supabase_1.supabase
        .from("daily_logs")
        .select("date,data")
        .eq("user_id", userId)
        .gte("date", startKey)
        .lte("date", endKey);
    if (weekError)
        return { ok: false, error: weekError.message };
    let workoutsWeekly = 0;
    let callsFriendsWeekly = 0;
    let callsFamilyWeekly = 0;
    let socialWeekly = 0;
    let pagesWeekly = 0;
    (weekRows ?? []).forEach((row) => {
        if (row.date === dateKey)
            return;
        const parsed = row.data;
        workoutsWeekly += parsed?.workouts?.activities?.length ?? 0;
        callsFriendsWeekly +=
            (0, utils_1.intFromText)(parsed?.community?.callsFriendsText) ??
                (0, utils_1.intFromText)(parsed?.community?.callsText) ??
                0;
        callsFamilyWeekly += (0, utils_1.intFromText)(parsed?.community?.callsFamilyText) ?? 0;
        socialWeekly += (0, utils_1.intFromText)(parsed?.community?.socialEventsText) ?? 0;
        const events = parsed?.reading?.events ?? [];
        const eventPages = events.reduce((sum, event) => sum + (event.pages ?? 0), 0);
        const eventFiction = events.reduce((sum, event) => sum + (event.fictionPages ?? 0), 0);
        const eventNonfiction = events.reduce((sum, event) => sum + (event.nonfictionPages ?? 0), 0);
        const pagesRaw = (0, utils_1.intFromText)(parsed?.reading?.pagesText) ?? 0;
        const fictionRaw = (0, utils_1.intFromText)(parsed?.reading?.fictionPagesText) ?? 0;
        const nonfictionRaw = (0, utils_1.intFromText)(parsed?.reading?.nonfictionPagesText) ?? 0;
        const fiction = fictionRaw || eventFiction;
        const nonfiction = nonfictionRaw || eventNonfiction;
        pagesWeekly += pagesRaw || eventPages || fiction + nonfiction;
    });
    const weeklyActuals = {
        workouts_logged_weekly: workoutsWeekly + (dataValue.workouts?.activities?.length ?? 0),
        calls_friends_weekly: callsFriendsWeekly +
            ((0, utils_1.intFromText)(dataValue.community?.callsFriendsText) ??
                (0, utils_1.intFromText)(dataValue.community?.callsText) ??
                0),
        calls_family_weekly: callsFamilyWeekly + ((0, utils_1.intFromText)(dataValue.community?.callsFamilyText) ?? 0),
        social_events_weekly: socialWeekly + ((0, utils_1.intFromText)(dataValue.community?.socialEventsText) ?? 0),
        pages_weekly: pagesWeekly + (() => {
            const events = dataValue.reading?.events ?? [];
            const eventPages = events.reduce((sum, event) => sum + (event.pages ?? 0), 0);
            const eventFiction = events.reduce((sum, event) => sum + (event.fictionPages ?? 0), 0);
            const eventNonfiction = events.reduce((sum, event) => sum + (event.nonfictionPages ?? 0), 0);
            const pagesRaw = (0, utils_1.intFromText)(dataValue.reading?.pagesText) ?? 0;
            const fictionRaw = (0, utils_1.intFromText)(dataValue.reading?.fictionPagesText) ?? 0;
            const nonfictionRaw = (0, utils_1.intFromText)(dataValue.reading?.nonfictionPagesText) ?? 0;
            const fiction = fictionRaw || eventFiction;
            const nonfiction = nonfictionRaw || eventNonfiction;
            return pagesRaw || eventPages || fiction + nonfiction;
        })(),
    };
    const scores = (0, scoring_1.computeScores)(dataValue, goalsRow
        ? {
            categories: goalsRow.goals,
            enabledCategories: goalsRow.enabled_categories,
        }
        : null, drinkingEvents, weeklyActuals);
    const steps = (0, utils_1.intFromText)(dataValue.workouts?.stepsText);
    const { error: saveError } = await supabase_1.supabase.from("daily_logs").upsert({
        user_id: userId,
        date: dateKey,
        data: dataValue,
        steps: steps ?? null,
        total_score: scores.totalScore,
        workout_score: scores.workoutScore,
        sleep_score: scores.sleepScore,
        diet_score: scores.dietScore,
        reading_score: scores.readingScore,
        community_score: scores.communityScore,
    }, { onConflict: "user_id,date" });
    if (saveError)
        return { ok: false, error: saveError.message };
    return { ok: true };
}
async function getSelfActivityStream(userId, days = 30) {
    const start = (0, utils_1.addDays)(new Date(), -(Math.max(days, 1) - 1));
    const startKey = (0, utils_1.toDateKey)(start);
    const errors = [];
    const { data: logs, error: logsError } = await supabase_1.supabase
        .from("daily_logs")
        .select("date,data,updated_at")
        .eq("user_id", userId)
        .gte("date", startKey);
    if (logsError)
        errors.push(logsError.message);
    const items = [];
    (logs ?? []).forEach((row) => {
        const data = row.data;
        const dateKey = row.date;
        const fallbackCreatedAt = row.updated_at ?? undefined;
        const activities = data?.workouts?.activities ?? [];
        activities.forEach((activity, index) => {
            // Root cause (Bug 1): daily_logs.updated_at is shared; prefer per-event loggedAt when present.
            const activityCreatedAt = activity.loggedAt ?? fallbackCreatedAt;
            items.push(activityFromWorkout(userId, dateKey, activity, index, activityCreatedAt));
        });
        const readingEvents = data?.reading?.events ?? [];
        if (readingEvents.length > 0) {
            readingEvents.forEach((event, index) => {
                const eventCreatedAt = event.loggedAt ?? fallbackCreatedAt;
                items.push(activityFromReading(userId, dateKey, event, index, eventCreatedAt));
            });
        }
        else if (data?.reading?.title || data?.reading?.pagesText) {
            const pages = (0, utils_1.intFromText)(data.reading.pagesText) ?? 0;
            const eventId = stableUuid(`${dateKey}-reading-legacy`);
            items.push({
                id: eventId,
                user_id: userId,
                event_type: "reading",
                event_id: eventId,
                event_date: dateKey,
                created_at: fallbackCreatedAt ?? makeCreatedAt(dateKey),
                summary: readingSummary({
                    id: eventId,
                    title: data.reading.title,
                    pages,
                }),
                metadata: { title: data.reading.title, pages },
            });
        }
    });
    const { data: drinkingEvents, error: drinkingError } = await supabase_1.supabase
        .from("drinking_events")
        .select("id, date, tier, drinks, note, created_at")
        .eq("user_id", userId)
        .gte("date", startKey);
    if (drinkingError) {
        errors.push(drinkingError.message);
    }
    else if (drinkingEvents) {
        drinkingEvents.forEach((event) => {
            items.push({
                id: event.id,
                user_id: userId,
                event_type: "drinking",
                event_id: event.id,
                event_date: event.date,
                created_at: event.created_at ?? makeCreatedAt(event.date),
                summary: `Tier ${event.tier} • ${event.drinks} drinks`,
                metadata: { tier: event.tier, drinks: event.drinks, note: event.note },
            });
        });
    }
    items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { items, errors };
}
async function getFeedActivityStream(userId, followedIds, days = 30) {
    const errors = [];
    const start = (0, utils_1.addDays)(new Date(), -(Math.max(days, 1) - 1));
    const startIso = start.toISOString();
    const { items: selfItemsRaw, errors: selfErrors } = await getSelfActivityStream(userId, days);
    errors.push(...selfErrors);
    const selfItems = selfItemsRaw.filter(isValidActivityItem);
    const allIds = Array.from(new Set([userId, ...followedIds]));
    const { data: feedItems, error: feedError } = await supabase_1.supabase
        .from("feed_items")
        .select("id, user_id, created_at, event_date, event_type, event_id, summary, metadata, profiles:user_id(username, display_name, profile_photo_url)")
        .in("user_id", allIds)
        .gte("created_at", startIso)
        .order("created_at", { ascending: false })
        .limit(100);
    if (feedError)
        errors.push(feedError.message);
    const feedActivity = (feedItems ?? [])
        .filter((item) => item.user_id !== userId)
        .map((item) => ({
        id: item.id,
        user_id: item.user_id,
        event_type: item.event_type,
        event_id: item.event_id,
        event_date: item.event_date,
        created_at: item.created_at,
        summary: item.summary,
        metadata: item.metadata ?? {},
        feed_item_id: item.id,
        profile: item.profiles ?? undefined,
    }))
        .filter(isValidActivityItem);
    const feedMap = new Map();
    const feedSignature = new Map();
    (feedItems ?? []).forEach((item) => {
        const key = `${item.user_id}:${item.event_type}:${item.event_id}`;
        feedMap.set(key, { id: item.id, created_at: item.created_at });
        const signature = `${item.user_id}:${item.event_type}:${item.event_date}:${item.summary}`;
        feedSignature.set(signature, { id: item.id, created_at: item.created_at });
    });
    const selfWithFeed = selfItems.map((item) => {
        const key = `${item.user_id}:${item.event_type}:${item.event_id}`;
        const feedInfo = feedMap.get(key);
        if (feedInfo) {
            return { ...item, feed_item_id: feedInfo.id, created_at: feedInfo.created_at };
        }
        const signature = `${item.user_id}:${item.event_type}:${item.event_date}:${item.summary}`;
        const fallback = feedSignature.get(signature);
        return fallback
            ? { ...item, feed_item_id: fallback.id, created_at: fallback.created_at }
            : item;
    });
    const selfFromFeed = selfItems.length === 0
        ? (feedItems ?? [])
            .filter((item) => item.user_id === userId)
            .map((item) => ({
            id: item.id,
            user_id: item.user_id,
            event_type: item.event_type,
            event_id: item.event_id,
            event_date: item.event_date,
            created_at: item.created_at,
            summary: item.summary,
            metadata: item.metadata ?? {},
            feed_item_id: item.id,
        }))
            .filter(isValidActivityItem)
        : [];
    const items = [...selfWithFeed, ...selfFromFeed, ...feedActivity];
    items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { items, errors };
}
async function getActivityDebug(userId) {
    const errors = [];
    const { items: last7Items, errors: itemErrors } = await getSelfActivityStream(userId, 7);
    errors.push(...itemErrors);
    const workoutCount7d = last7Items.filter((i) => i.event_type === "workout").length;
    const readingCount7d = last7Items.filter((i) => i.event_type === "reading").length;
    const drinkingCount7d = last7Items.filter((i) => i.event_type === "drinking").length;
    const start30 = (0, utils_1.addDays)(new Date(), -29);
    const start30Key = (0, utils_1.toDateKey)(start30);
    const { count: feedCount, error: feedError } = await supabase_1.supabase
        .from("feed_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("event_date", start30Key);
    if (feedError)
        errors.push(feedError.message);
    return {
        userId,
        workoutCount7d,
        readingCount7d,
        drinkingCount7d,
        feedItemsCount30d: feedCount ?? 0,
        errors,
    };
}
async function deleteActivity(viewerId, item) {
    // Root cause (Bug 2): deleting feed items without updating the daily log let posts reappear.
    // Keep a single path here and ensure the same mutation is used across surfaces.
    if (process.env.NODE_ENV !== "production") {
        // Temporary debug trace.
        console.debug("[deleteActivity]", {
            viewerId,
            eventType: item.event_type,
            eventId: item.event_id,
            eventDate: item.event_date,
            feedItemId: item.feed_item_id,
        });
    }
    if (item.user_id !== viewerId)
        return { ok: false, error: "Not authorized" };
    if (item.event_type === "drinking") {
        const { error } = await supabase_1.supabase.from("drinking_events").delete().eq("id", item.event_id);
        if (error)
            return { ok: false, error: error.message };
    }
    else {
        const { data, error } = await supabase_1.supabase
            .from("daily_logs")
            .select("data")
            .eq("user_id", viewerId)
            .eq("date", item.event_date)
            .maybeSingle();
        if (error)
            return { ok: false, error: error.message };
        if (!data?.data) {
            return { ok: false, error: "Daily log not found for date" };
        }
        const dataValue = (data?.data ?? {});
        let changed = false;
        if (item.event_type === "workout") {
            const activities = dataValue?.workouts?.activities ?? [];
            const next = activities.filter((activity) => activity.id !== item.event_id);
            changed = next.length !== activities.length;
            if (!changed) {
                return { ok: false, error: "Workout event not found in daily log" };
            }
            dataValue.workouts = {
                ...dataValue.workouts,
                activities: next,
            };
        }
        if (item.event_type === "reading") {
            const events = dataValue?.reading?.events ?? [];
            const next = events.filter((event) => event.id !== item.event_id);
            changed = next.length !== events.length;
            const legacyId = stableUuid(`${item.event_date}-reading-legacy`);
            if (!changed && item.event_id !== legacyId) {
                return { ok: false, error: "Reading event not found in daily log" };
            }
            dataValue.reading = {
                ...dataValue.reading,
                events: next,
            };
            if (item.event_id === legacyId) {
                dataValue.reading = {
                    ...dataValue.reading,
                    title: undefined,
                    pagesText: undefined,
                    fictionPagesText: undefined,
                    nonfictionPagesText: undefined,
                    note: undefined,
                    quote: undefined,
                };
            }
        }
        const save = await recomputeAndSaveDailyLog(viewerId, item.event_date, dataValue);
        if (!save.ok)
            return save;
    }
    if (item.event_type === "drinking") {
        const { data: row, error: rowError } = await supabase_1.supabase
            .from("daily_logs")
            .select("data")
            .eq("user_id", viewerId)
            .eq("date", item.event_date)
            .maybeSingle();
        if (rowError)
            return { ok: false, error: rowError.message };
        if (row?.data) {
            const save = await recomputeAndSaveDailyLog(viewerId, item.event_date, row.data);
            if (!save.ok)
                return save;
        }
    }
    if (item.feed_item_id) {
        await supabase_1.supabase.from("feed_items").delete().eq("id", item.feed_item_id);
    }
    else {
        await supabase_1.supabase
            .from("feed_items")
            .delete()
            .eq("user_id", viewerId)
            .eq("event_type", item.event_type)
            .eq("event_id", item.event_id);
    }
    return { ok: true };
}
