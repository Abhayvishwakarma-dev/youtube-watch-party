import { useState } from "react";

interface Props {
    canControl: boolean;
    onChangeVideo: (raw: string) => void;
}

export default function VideoInput({ canControl, onChangeVideo }: Props) {
    const [value, setValue] = useState("");

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = value.trim();

        console.log("[VideoInput] submit clicked", {
            canControl,
            trimmed,
            isEmpty: !trimmed,
        });

        if (!trimmed) return;
        onChangeVideo(trimmed);
        setValue("");
    }

    return (
        <form
            className="controls-row"
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
        >
            <input
                type="text"
                placeholder="Paste YouTube URL or 11-char ID"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={!canControl}
                style={{ flex: 1, minWidth: 240 }}
            />
            <button
                type="submit"
                className="primary"
                disabled={!canControl || !value.trim()}
            >
                Change Video
            </button>
        </form>
    );
}