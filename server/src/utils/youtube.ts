// ============================================================
//  server/src/utils/youtube.ts
//  Pure utility — no imports from other project files.
//  Also duplicated verbatim at client/src/utils/youtube.ts
// ============================================================

const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeVideoId(input: string): string | null {
    if (!input || typeof input !== "string") return null;

    const trimmed = input.trim();
    if (trimmed.length === 0) return null;

    // 1) Raw 11-char ID
    if (VIDEO_ID_REGEX.test(trimmed)) return trimmed;

    // 2) Parse as URL
    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        return null;
    }

    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

    // 3) youtu.be/<id>
    if (host === "youtu.be") {
        const id = parsed.pathname.slice(1).split("/")[0];
        return VIDEO_ID_REGEX.test(id) ? id : null;
    }

    // 4) youtube.com and subdomains
    if (
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com" ||
        host === "youtube-nocookie.com"
    ) {
        const v = parsed.searchParams.get("v");
        if (v && VIDEO_ID_REGEX.test(v)) return v;

        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
            const [kind, id] = parts;
            if (
                (kind === "embed" || kind === "v" || kind === "shorts") &&
                VIDEO_ID_REGEX.test(id)
            ) {
                return id;
            }
        }
    }

    return null;
}

export function isValidVideoId(id: string): boolean {
    return typeof id === "string" && VIDEO_ID_REGEX.test(id);
}