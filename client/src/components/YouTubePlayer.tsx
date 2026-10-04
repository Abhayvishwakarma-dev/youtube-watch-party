// // ============================================================
// //  client/src/components/YouTubePlayer.tsx
// //
// //  Wrapper around the YouTube IFrame Player API.
// //  Uses INLINE STYLES so it works even without CSS rules.
// // ============================================================

// import { useEffect, useRef } from "react";
// import type { PlayState } from "../types";

// declare global {
//     interface Window {
//         YT?: any;
//         onYouTubeIframeAPIReady?: () => void;
//     }
// }

// let apiLoadPromise: Promise<void> | null = null;

// function loadYouTubeApi(): Promise<void> {
//     if (typeof window === "undefined") return Promise.resolve();
//     if (window.YT && window.YT.Player) return Promise.resolve();
//     if (apiLoadPromise) return apiLoadPromise;

//     apiLoadPromise = new Promise((resolve) => {
//         const previous = window.onYouTubeIframeAPIReady;
//         window.onYouTubeIframeAPIReady = () => {
//             previous?.();
//             resolve();
//         };
//         const tag = document.createElement("script");
//         tag.src = "https://www.youtube.com/iframe_api";
//         document.head.appendChild(tag);
//     });

//     return apiLoadPromise;
// }

// const VALID_ID = /^[A-Za-z0-9_-]{11}$/;

// interface Props {
//     videoId: string | null;
//     currentTime: number;
//     playState: PlayState;
//     canControl: boolean;
//     onLocalPlay: (time: number) => void;
//     onLocalPause: (time: number) => void;
//     onLocalSeek: (time: number) => void;
//     onReady?: (player: any) => void;
//     onStateChange?: (state: number) => void;
//     onTimeUpdate?: (time: number) => void;
// }

// const STATE_PLAYING = 1;
// const STATE_PAUSED = 2;

// export default function YouTubePlayer({
//     videoId,
//     currentTime,
//     playState,
//     canControl,
//     onLocalPlay,
//     onLocalPause,
//     onLocalSeek,
//     onReady,
//     onStateChange,
//     onTimeUpdate,
// }: Props) {
//     const containerRef = useRef<HTMLDivElement | null>(null);
//     const playerRef = useRef<any>(null);
//     const isRemoteUpdateRef = useRef(false);
//     const readyRef = useRef(false);

//     const pendingVideoIdRef = useRef<string | null>(videoId);
//     const pendingTimeRef = useRef<number>(currentTime);
//     const pendingPlayStateRef = useRef<PlayState>(playState);

//     const onLocalPlayRef = useRef(onLocalPlay);
//     const onLocalPauseRef = useRef(onLocalPause);
//     const onLocalSeekRef = useRef(onLocalSeek);
//     const onReadyRef = useRef(onReady);
//     const onStateChangeRef = useRef(onStateChange);
//     const onTimeUpdateRef = useRef(onTimeUpdate);
//     const canControlRef = useRef(canControl);

//     useEffect(() => {
//         onLocalPlayRef.current = onLocalPlay;
//         onLocalPauseRef.current = onLocalPause;
//         onLocalSeekRef.current = onLocalSeek;
//         onReadyRef.current = onReady;
//         onStateChangeRef.current = onStateChange;
//         onTimeUpdateRef.current = onTimeUpdate;
//         canControlRef.current = canControl;
//     });

//     // ---------- Create the player exactly once ----------
//     useEffect(() => {
//         let destroyed = false;
//         let ticker: number | null = null;

//         (async () => {
//             try {
//                 await loadYouTubeApi();
//             } catch (err) {
//                 console.error("[YT] Failed to load IFrame API:", err);
//                 return;
//             }
//             if (destroyed) return;

//             const el = containerRef.current;
//             if (!el) {
//                 console.warn("[YT] Container missing — aborting init");
//                 return;
//             }

//             const rect = el.getBoundingClientRect();
//             console.log(
//                 `[YT] Init. Container size: ${rect.width}x${rect.height}`
//             );

//             // Build config — only include videoId if we have a VALID one.
//             // Passing `videoId: undefined` makes YT try to load a video
//             // literally named "undefined" and throws "Invalid video id".
//             const config: any = {
//                 width: "100%",
//                 height: "100%",
//                 playerVars: {
//                     controls: 0,
//                     disablekb: 1,
//                     modestbranding: 1,
//                     rel: 0,
//                     playsinline: 1,
//                     origin: window.location.origin,
//                 },
//                 events: {
//                     onReady: () => {
//                         readyRef.current = true;
//                         console.log("[YT] onReady");
//                         onReadyRef.current?.(playerRef.current);

//                         try {
//                             playerRef.current.setSize?.("100%", "100%");
//                         } catch {
//                             /* ignore */
//                         }

//                         applyRemoteState(
//                             pendingVideoIdRef.current,
//                             pendingTimeRef.current,
//                             pendingPlayStateRef.current
//                         );
//                     },
//                     onError: (e: any) => {
//                         console.error(
//                             "[YT] Player error code:",
//                             e?.data,
//                             "(2=bad id, 5=html5, 100=not found, 101/150=embed denied)"
//                         );
//                     },
//                     onStateChange: (e: any) => {
//                         onStateChangeRef.current?.(e.data);
//                         if (isRemoteUpdateRef.current) return;
//                         const t = playerRef.current?.getCurrentTime?.() ?? 0;
//                         if (e.data === STATE_PLAYING) onLocalPlayRef.current(t);
//                         else if (e.data === STATE_PAUSED)
//                             onLocalPauseRef.current(t);
//                     },
//                 },
//             };

//             if (
//                 pendingVideoIdRef.current &&
//                 VALID_ID.test(pendingVideoIdRef.current)
//             ) {
//                 config.videoId = pendingVideoIdRef.current;
//                 console.log(
//                     "[YT] Constructor will load initial video:",
//                     pendingVideoIdRef.current
//                 );
//             } else {
//                 console.log(
//                     "[YT] No initial video — creating empty player"
//                 );
//             }

//             playerRef.current = new window.YT.Player(el, config);

//             ticker = window.setInterval(() => {
//                 const t = playerRef.current?.getCurrentTime?.();
//                 if (typeof t === "number" && isFinite(t)) {
//                     onTimeUpdateRef.current?.(t);
//                 }
//             }, 500);
//         })();

//         return () => {
//             destroyed = true;
//             readyRef.current = false;
//             if (ticker !== null) window.clearInterval(ticker);
//             try {
//                 playerRef.current?.destroy?.();
//             } catch {
//                 /* ignore */
//             }
//             playerRef.current = null;
//         };
//         // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, []);

//     // ---------- Apply remote state on prop change ----------
//     useEffect(() => {
//         pendingVideoIdRef.current = videoId;
//         pendingTimeRef.current = currentTime;
//         pendingPlayStateRef.current = playState;

//         if (readyRef.current) {
//             applyRemoteState(videoId, currentTime, playState);
//         }
//         // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, [videoId, currentTime, playState]);

//     // ---------- Core logic ----------
//     function applyRemoteState(
//         vId: string | null,
//         time: number,
//         state: PlayState
//     ) {
//         console.log("[YT] applyRemoteState:", {
//             vId,
//             time,
//             state,
//             hasPlayer: !!playerRef.current,
//             ready: readyRef.current,
//         });

//         const player = playerRef.current;
//         if (!player || typeof player.loadVideoById !== "function") {
//             console.warn("[YT] Player not ready yet");
//             return;
//         }
//         if (!vId) {
//             console.log("[YT] No videoId yet — nothing to load");
//             return;
//         }

//         // Reject any non-11-char string before it reaches YT.
//         if (!VALID_ID.test(vId)) {
//             console.error(
//                 "[YT] Refusing to load invalid video id:",
//                 JSON.stringify(vId)
//             );
//             return;
//         }

//         let currentVideoId: string | null = null;
//         try {
//             currentVideoId = player.getVideoData?.()?.video_id ?? null;
//         } catch {
//             currentVideoId = null;
//         }

//         if (vId !== currentVideoId) {
//             console.log("[YT] Loading new video:", vId);
//             isRemoteUpdateRef.current = true;

//             try {
//                 if (state === "playing") {
//                     player.loadVideoById({ videoId: vId, startSeconds: time });
//                 } else {
//                     player.cueVideoById({ videoId: vId, startSeconds: time });
//                 }
//             } catch (err) {
//                 console.error("[YT] loadVideoById/cueVideoById threw:", err);
//             }

//             window.setTimeout(() => {
//                 isRemoteUpdateRef.current = false;
//                 try {
//                     if (state === "paused") player.pauseVideo?.();
//                 } catch {
//                     /* ignore */
//                 }
//             }, 500);
//             return;
//         }

//         // Same video — just sync
//         isRemoteUpdateRef.current = true;
//         const now = player.getCurrentTime?.() ?? 0;
//         if (Math.abs(now - time) > 1.5) {
//             try {
//                 player.seekTo(time, true);
//             } catch {
//                 /* ignore */
//             }
//         }
//         try {
//             if (state === "playing") player.playVideo?.();
//             else player.pauseVideo?.();
//         } catch {
//             /* ignore */
//         }
//         window.setTimeout(() => {
//             isRemoteUpdateRef.current = false;
//         }, 250);
//     }

//     // ---------- Render ----------
//     return (
//         <div
//             style={{
//                 position: "relative",
//                 width: "100%",
//                 aspectRatio: "16 / 9",
//                 background: "#000",
//                 borderRadius: 10,
//                 overflow: "hidden",
//                 border: "1px solid #333",
//                 minHeight: 360,
//             }}
//         >
//             <div
//                 ref={containerRef}
//                 style={{
//                     position: "absolute",
//                     top: 0,
//                     left: 0,
//                     width: "100%",
//                     height: "100%",
//                 }}
//             />
//             {!videoId && (
//                 <div
//                     style={{
//                         position: "absolute",
//                         top: 0,
//                         left: 0,
//                         right: 0,
//                         bottom: 0,
//                         display: "flex",
//                         alignItems: "center",
//                         justifyContent: "center",
//                         background: "#000",
//                         color: "#aaa",
//                         fontSize: 14,
//                         zIndex: 1,
//                         pointerEvents: "none",
//                     }}
//                 >
//                     Waiting for the host to pick a video…
//                 </div>
//             )}
//         </div>
//     );
// }




// ============================================================
//  client/src/components/YouTubePlayer.tsx
//
//  Wrapper around the YouTube IFrame Player API.
//
//  - Hides ALL YouTube native controls (play/pause/seek/etc.)
//    so the app's own PlaybackControls are the only UI.
//  - Adds a transparent overlay on top of the iframe to block
//    clicks from reaching YouTube's chrome.
//  - Applies remote state from the socket without creating loops.
// ============================================================

import { useEffect, useRef } from "react";
import type { PlayState } from "../types";

declare global {
    interface Window {
        YT?: any;
        onYouTubeIframeAPIReady?: () => void;
    }
}

let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (apiLoadPromise) return apiLoadPromise;

    apiLoadPromise = new Promise((resolve) => {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previous?.();
            resolve();
        };
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
    });

    return apiLoadPromise;
}

const VALID_ID = /^[A-Za-z0-9_-]{11}$/;

interface Props {
    videoId: string | null;
    currentTime: number;
    playState: PlayState;
    canControl: boolean;
    onLocalPlay: (time: number) => void;
    onLocalPause: (time: number) => void;
    onLocalSeek: (time: number) => void;
    onReady?: (player: any) => void;
    onStateChange?: (state: number) => void;
    onTimeUpdate?: (time: number) => void;
}

const STATE_PLAYING = 1;
const STATE_PAUSED = 2;

export default function YouTubePlayer({
    videoId,
    currentTime,
    playState,
    canControl,
    onLocalPlay,
    onLocalPause,
    onLocalSeek,
    onReady,
    onStateChange,
    onTimeUpdate,
}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<any>(null);
    const isRemoteUpdateRef = useRef(false);
    const readyRef = useRef(false);

    const pendingVideoIdRef = useRef<string | null>(videoId);
    const pendingTimeRef = useRef<number>(currentTime);
    const pendingPlayStateRef = useRef<PlayState>(playState);

    const onLocalPlayRef = useRef(onLocalPlay);
    const onLocalPauseRef = useRef(onLocalPause);
    const onLocalSeekRef = useRef(onLocalSeek);
    const onReadyRef = useRef(onReady);
    const onStateChangeRef = useRef(onStateChange);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    const canControlRef = useRef(canControl);

    useEffect(() => {
        onLocalPlayRef.current = onLocalPlay;
        onLocalPauseRef.current = onLocalPause;
        onLocalSeekRef.current = onLocalSeek;
        onReadyRef.current = onReady;
        onStateChangeRef.current = onStateChange;
        onTimeUpdateRef.current = onTimeUpdate;
        canControlRef.current = canControl;
    });

    // ---------- Create the player exactly once ----------
    useEffect(() => {
        let destroyed = false;
        let ticker: number | null = null;

        (async () => {
            try {
                await loadYouTubeApi();
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[YT] Failed to load IFrame API:", err);
                return;
            }
            if (destroyed) return;

            const el = containerRef.current;
            if (!el) {
                // eslint-disable-next-line no-console
                console.warn("[YT] Container missing — aborting init");
                return;
            }

            const rect = el.getBoundingClientRect();
            // eslint-disable-next-line no-console
            console.log(
                `[YT] Init. Container size: ${rect.width}x${rect.height}`
            );

            // Build config — only include videoId if we have a VALID one.
            // Passing `videoId: undefined` makes YT throw "Invalid video id".
            const config: any = {
                width: "100%",
                height: "100%",
                playerVars: {
                    // ★ Hide ALL YouTube chrome
                    controls: 0,        // no play/pause/seek bar
                    disablekb: 1,       // disable keyboard shortcuts
                    fs: 0,              // no fullscreen button
                    iv_load_policy: 3,  // hide annotations
                    modestbranding: 1,  // minimal YouTube branding
                    rel: 0,             // no related videos
                    showinfo: 0,        // hide video title overlay (legacy)
                    cc_load_policy: 0,  // don't force captions
                    playsinline: 1,     // inline playback on mobile
                    origin: window.location.origin,
                },
                events: {
                    onReady: () => {
                        readyRef.current = true;
                        // eslint-disable-next-line no-console
                        console.log("[YT] onReady");
                        onReadyRef.current?.(playerRef.current);

                        try {
                            playerRef.current.setSize?.("100%", "100%");
                        } catch {
                            /* ignore */
                        }

                        applyRemoteState(
                            pendingVideoIdRef.current,
                            pendingTimeRef.current,
                            pendingPlayStateRef.current
                        );
                    },
                    onError: (e: any) => {
                        // eslint-disable-next-line no-console
                        console.error(
                            "[YT] Player error code:",
                            e?.data,
                            "(2=bad id, 5=html5, 100=not found, 101/150=embed denied)"
                        );
                    },
                    onStateChange: (e: any) => {
                        onStateChangeRef.current?.(e.data);
                        if (isRemoteUpdateRef.current) return;
                        const t = playerRef.current?.getCurrentTime?.() ?? 0;
                        if (e.data === STATE_PLAYING) onLocalPlayRef.current(t);
                        else if (e.data === STATE_PAUSED)
                            onLocalPauseRef.current(t);
                    },
                },
            };

            if (
                pendingVideoIdRef.current &&
                VALID_ID.test(pendingVideoIdRef.current)
            ) {
                config.videoId = pendingVideoIdRef.current;
            }

            playerRef.current = new window.YT.Player(el, config);

            ticker = window.setInterval(() => {
                const t = playerRef.current?.getCurrentTime?.();
                if (typeof t === "number" && isFinite(t)) {
                    onTimeUpdateRef.current?.(t);
                }
            }, 500);
        })();

        return () => {
            destroyed = true;
            readyRef.current = false;
            if (ticker !== null) window.clearInterval(ticker);
            try {
                playerRef.current?.destroy?.();
            } catch {
                /* ignore */
            }
            playerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---------- Apply remote state on prop change ----------
    useEffect(() => {
        pendingVideoIdRef.current = videoId;
        pendingTimeRef.current = currentTime;
        pendingPlayStateRef.current = playState;

        if (readyRef.current) {
            applyRemoteState(videoId, currentTime, playState);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId, currentTime, playState]);

    // ---------- Core logic ----------
    function applyRemoteState(
        vId: string | null,
        time: number,
        state: PlayState
    ) {
        const player = playerRef.current;
        if (!player || typeof player.loadVideoById !== "function") return;
        if (!vId) return;
        if (!VALID_ID.test(vId)) return;

        let currentVideoId: string | null = null;
        try {
            currentVideoId = player.getVideoData?.()?.video_id ?? null;
        } catch {
            currentVideoId = null;
        }

        if (vId !== currentVideoId) {
            isRemoteUpdateRef.current = true;

            try {
                if (state === "playing") {
                    player.loadVideoById({ videoId: vId, startSeconds: time });
                } else {
                    player.cueVideoById({ videoId: vId, startSeconds: time });
                }
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[YT] loadVideoById threw:", err);
            }

            window.setTimeout(() => {
                isRemoteUpdateRef.current = false;
                try {
                    if (state === "paused") player.pauseVideo?.();
                } catch {
                    /* ignore */
                }
            }, 500);
            return;
        }

        // Same video — sync position + state.
        isRemoteUpdateRef.current = true;
        const now = player.getCurrentTime?.() ?? 0;
        if (Math.abs(now - time) > 1.5) {
            try {
                player.seekTo(time, true);
            } catch {
                /* ignore */
            }
        }
        try {
            if (state === "playing") player.playVideo?.();
            else player.pauseVideo?.();
        } catch {
            /* ignore */
        }
        window.setTimeout(() => {
            isRemoteUpdateRef.current = false;
        }, 250);
    }

    // ---------- Render ----------
    // The overlay is a transparent layer on top of the iframe that
    // swallows all pointer events. This ensures clicks never reach
    // YouTube's native controls (some of which are shown on hover
    // or pause even with controls: 0).
    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                background: "#000",
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid #333",
                minHeight: 360,
            }}
        >
            {/* iframe container — YouTube replaces this div with an iframe */}
            <div
                ref={containerRef}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                }}
            />

            {/* Transparent overlay — catches ALL clicks on the video area
                so they never reach YouTube's native UI. Users interact via
                our own PlaybackControls (Play / Pause / Seek) instead. */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "transparent",
                    cursor: "default",
                    zIndex: 2,
                }}
                onClick={(e) => e.preventDefault()}
                onDoubleClick={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
            />

            {/* "Waiting for host" placeholder — hidden once a video is set */}
            {!videoId && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#000",
                        color: "#aaa",
                        fontSize: 14,
                        zIndex: 3,
                        pointerEvents: "none",
                    }}
                >
                    Waiting for the host to pick a video…
                </div>
            )}
        </div>
    );
}