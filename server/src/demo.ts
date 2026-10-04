// example.ts  — run this to see it work
import { extractYouTubeVideoId } from "./utils/youtube";

const validUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s";

const videoId = extractYouTubeVideoId(validUrl);
console.log(videoId); // "dQw4w9WgXcQ"