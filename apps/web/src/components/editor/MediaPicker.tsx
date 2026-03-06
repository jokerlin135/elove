"use client";

import { useState, useRef, useCallback } from "react";
import { trpc } from "../../lib/trpc";

interface MediaPickerProps {
    projectId: string;
    onSelect: (url: string) => void;
    accept?: string;
}

export function MediaPicker({ projectId, onSelect, accept = "image/*" }: MediaPickerProps) {
    const [open, setOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const mediaList = trpc.media?.list?.useQuery?.({ projectId }) ?? { data: [] as Array<{ id: string; r2_key: string; mime_type: string; size_bytes: number; created_at: string }> };
    const getUploadUrl = trpc.media?.getUploadUrl?.useMutation?.() ?? null;
    const confirmUpload = trpc.media?.confirmUpload?.useMutation?.() ?? null;

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadProgress(0);
        setError(null);

        try {
            // 1. Get presigned upload URL
            if (!getUploadUrl) throw new Error("Media API not available");
            const { uploadUrl, mediaId } = await getUploadUrl.mutateAsync({
                projectId,
                filename: file.name,
                mimeType: file.type,
                sizeBytes: file.size,
            });

            // 2. Upload file directly to R2
            setUploadProgress(30);
            await fetch(uploadUrl, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": file.type },
            });

            setUploadProgress(80);

            // 3. Confirm upload
            if (confirmUpload) {
                await confirmUpload.mutateAsync({ mediaId });
            }

            setUploadProgress(100);

            // 4. Use the CDN URL
            const cdnUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ""}/media/${mediaId}`;
            onSelect(cdnUrl);
            setOpen(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }, [projectId, getUploadUrl, confirmUpload, onSelect]);

    const mediaItems = (mediaList.data ?? []) as Array<{ id: string; r2_key: string; mime_type: string; created_at: string }>;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full py-2 text-xs text-white/40 border border-dashed border-white/10 rounded-lg hover:border-rose-500/30 hover:text-rose-300 transition-colors"
            >
                📷 Chọn ảnh
            </button>

            {open && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-[#0d0d1a] rounded-2xl border border-white/10 w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                            <h3 className="text-sm font-medium text-white">Thư viện ảnh</h3>
                            <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white text-sm">✕</button>
                        </div>

                        {/* Upload */}
                        <div className="p-4 border-b border-white/5">
                            <input
                                ref={fileRef}
                                type="file"
                                accept={accept}
                                onChange={handleFileSelect}
                                className="hidden"
                                id="media-upload"
                            />
                            <label
                                htmlFor="media-upload"
                                className={`block w-full py-4 text-center border-2 border-dashed rounded-xl cursor-pointer transition-all ${uploading
                                        ? "border-rose-500/30 bg-rose-500/5"
                                        : "border-white/10 hover:border-rose-500/30 hover:bg-white/[0.02]"
                                    }`}
                            >
                                {uploading ? (
                                    <div className="space-y-2">
                                        <p className="text-sm text-rose-300">Đang tải lên... {uploadProgress}%</p>
                                        <div className="w-32 mx-auto h-1 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-rose-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-white/40">📤 Tải ảnh lên</p>
                                )}
                            </label>
                            {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
                        </div>

                        {/* Gallery */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {mediaItems.length > 0 ? (
                                <div className="grid grid-cols-3 gap-2">
                                    {mediaItems.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                const cdnUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ""}/media/${item.id}`;
                                                onSelect(cdnUrl);
                                                setOpen(false);
                                            }}
                                            className="aspect-square rounded-lg bg-white/5 border border-white/8 hover:border-rose-500/30 transition-colors overflow-hidden"
                                        >
                                            {item.mime_type.startsWith("image/") ? (
                                                <img src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ""}/${item.r2_key}`} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-2xl text-white/20">🎬</div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-white/20 text-sm">
                                    Chưa có ảnh nào. Tải ảnh lên để bắt đầu.
                                </div>
                            )}
                        </div>

                        {/* URL input fallback */}
                        <div className="p-4 border-t border-white/5">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Hoặc dán URL ảnh..."
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            const val = (e.target as HTMLInputElement).value;
                                            if (val) { onSelect(val); setOpen(false); }
                                        }
                                    }}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500/50"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
