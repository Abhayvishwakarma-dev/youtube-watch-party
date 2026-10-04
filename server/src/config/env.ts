import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
    const value = process.env[name] ?? fallback;
    if (value === undefined || value === "") {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export const env = {
    PORT: parseInt(process.env.PORT ?? "5000", 10),
    CLIENT_URL: required("CLIENT_URL", "http://localhost:5173"),
    NODE_ENV: process.env.NODE_ENV ?? "development",
    MONGODB_URI: process.env.MONGODB_URI ?? "",
} as const;