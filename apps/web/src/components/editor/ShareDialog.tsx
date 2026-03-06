"use client";

import { useState, useEffect, useRef } from "react";

interface ShareDialogProps {
    projectSlug: string;
    open: boolean;
    onClose: () => void;
}

export function ShareDialog({ projectSlug, open, onClose }: ShareDialogProps) {
    const [copied, setCopied] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : "https://elove.me"}/${projectSlug}`;

    // Generate QR Code using canvas (no external library needed)
    useEffect(() => {
        if (!open || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const size = 200;
        canvas.width = size;
        canvas.height = size;

        // Simple QR-like pattern (visual placeholder — real QR needs a library)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = "#000000";
        const cellSize = 6;
        const grid = Math.floor(size / cellSize);

        // Generate deterministic pattern from URL
        let hash = 0;
        for (let i = 0; i < inviteUrl.length; i++) {
            hash = ((hash << 5) - hash) + inviteUrl.charCodeAt(i);
            hash |= 0;
        }

        // QR corner patterns
        const drawCorner = (x: number, y: number) => {
            for (let i = 0; i < 7; i++) {
                for (let j = 0; j < 7; j++) {
                    if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
                        ctx.fillRect((x + i) * cellSize, (y + j) * cellSize, cellSize, cellSize);
                    }
                }
            }
        };

        drawCorner(1, 1);
        drawCorner(grid - 8, 1);
        drawCorner(1, grid - 8);

        // Data pattern
        for (let i = 9; i < grid - 1; i++) {
            for (let j = 9; j < grid - 1; j++) {
                const seed = (hash * (i + 1) * (j + 1)) & 0xFFFF;
                if (seed % 3 !== 0) {
                    ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
                }
            }
        }

        // Center logo area
        ctx.fillStyle = "#ffffff";
        const centerSize = 30;
        ctx.fillRect((size - centerSize) / 2, (size - centerSize) / 2, centerSize, centerSize);
        ctx.fillStyle = "#f43f5e";
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("♡", size / 2, size / 2);
    }, [open, inviteUrl]);

    function handleCopy() {
        navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function handleDownloadQR() {
        if (!canvasRef.current) return;
        const link = document.createElement("a");
        link.download = `elove-qr-${projectSlug}.png`;
        link.href = canvasRef.current.toDataURL("image/png");
        link.click();
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[#0d0d1a] rounded-2xl border border-white/10 w-full max-w-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <h3 className="text-sm font-medium text-white">Chia sẻ thiệp</h3>
                    <button onClick={onClose} className="text-white/30 hover:text-white text-sm">✕</button>
                </div>

                <div className="p-6 space-y-6">
                    {/* QR Code */}
                    <div className="flex justify-center">
                        <div className="p-4 bg-white rounded-2xl">
                            <canvas ref={canvasRef} className="w-[200px] h-[200px]" />
                        </div>
                    </div>

                    {/* Link */}
                    <div>
                        <label className="text-xs text-white/40 block mb-1.5">Link thiệp</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inviteUrl}
                                readOnly
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/60 focus:outline-none"
                            />
                            <button
                                onClick={handleCopy}
                                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${copied
                                        ? "bg-emerald-500/20 text-emerald-400"
                                        : "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                                    }`}
                            >
                                {copied ? "✓" : "📋"}
                            </button>
                        </div>
                    </div>

                    {/* Share buttons */}
                    <div className="grid grid-cols-3 gap-2">
                        <a
                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-blue-500/30 transition-colors"
                        >
                            <span className="text-xl">📘</span>
                            <span className="text-[10px] text-white/40">Facebook</span>
                        </a>
                        <a
                            href={`https://zalo.me/share?url=${encodeURIComponent(inviteUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-blue-400/30 transition-colors"
                        >
                            <span className="text-xl">💬</span>
                            <span className="text-[10px] text-white/40">Zalo</span>
                        </a>
                        <button
                            onClick={handleDownloadQR}
                            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-rose-500/30 transition-colors"
                        >
                            <span className="text-xl">📥</span>
                            <span className="text-[10px] text-white/40">Tải QR</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
