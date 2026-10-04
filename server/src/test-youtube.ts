// cat > src/test-youtube.ts << 'EOF'
import { extractYouTubeVideoId } from "./utils/youtube";

const validUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s";
const videoId = extractYouTubeVideoId(validUrl);

console.log("Input:   ", validUrl);
console.log("Output:  ", videoId);
console.log("Expected:", "dQw4w9WgXcQ");
console.log("Match:   ", videoId === "dQw4w9WgXcQ");
// EOF