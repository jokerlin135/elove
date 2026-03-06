"use client";

import { useStore } from "zustand";
import { useEditorStore } from "./EditorProvider";
import { executeCommand } from "../../editor/execute-command";

const SECTION_TYPES = [
    {
        group: "Cơ bản",
        items: [
            { type: "hero", label: "Hero Banner", icon: "🌅", desc: "Ảnh bìa + tên cặp đôi" },
            { type: "text", label: "Văn bản", icon: "📝", desc: "Đoạn văn bản tùy chỉnh" },
            { type: "image_gallery", label: "Album ảnh", icon: "🖼️", desc: "Bộ sưu tập ảnh" },
            { type: "spacer", label: "Khoảng trống", icon: "↕️", desc: "Ngăn cách giữa các section" },
        ],
    },
    {
        group: "Sự kiện",
        items: [
            { type: "event_info", label: "Thông tin sự kiện", icon: "📅", desc: "Ngày, giờ, địa điểm" },
            { type: "countdown", label: "Đếm ngược", icon: "⏳", desc: "Countdown tới ngày cưới" },
            { type: "map", label: "Bản đồ", icon: "📍", desc: "Google Maps embedded" },
            { type: "timeline", label: "Timeline", icon: "📋", desc: "Câu chuyện tình yêu" },
        ],
    },
    {
        group: "Tương tác",
        items: [
            { type: "rsvp", label: "RSVP", icon: "✉️", desc: "Form xác nhận tham dự" },
            { type: "guestbook", label: "Lời chúc", icon: "💌", desc: "Khách gửi lời chúc" },
            { type: "gift", label: "Quà tặng", icon: "🎁", desc: "Thông tin mừng cưới" },
            { type: "music", label: "Nhạc nền", icon: "🎵", desc: "Phát nhạc tự động" },
        ],
    },
];

export function ComponentLibrary() {
    const store = useEditorStore();
    const { pages, sel } = useStore(store, (s) => ({
        pages: s.document.structure.pages,
        sel: s.selection,
    }));

    const currentPageId = sel.pageId ?? pages[0]?.id;

    function handleAddSection(componentType: string) {
        if (!currentPageId) return;
        const state = store.getState();
        state.pushToUndo();

        const cmd = {
            type: "ADD_SECTION" as const,
            payload: {
                pageId: currentPageId,
                afterSectionId: null,
                sectionType: componentType,
            },
        };

        const next = executeCommand(
            {
                document: state.document,
                theme: state.theme,
                undoStack: [],
                redoStack: [],
                dirty: true,
            },
            cmd,
        );

        state.setDocument(next.document);
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="p-4 border-b border-white/5">
                <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">
                    Components
                </h3>
            </div>

            <div className="p-3 space-y-4">
                {SECTION_TYPES.map((group) => (
                    <div key={group.group}>
                        <div className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/20">
                            {group.group}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {group.items.map((comp) => (
                                <button
                                    key={comp.type}
                                    onClick={() => handleAddSection(comp.type)}
                                    className="group flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-rose-500/30 hover:bg-rose-500/5 transition-all text-center"
                                    title={comp.desc}
                                >
                                    <span className="text-xl group-hover:scale-110 transition-transform">
                                        {comp.icon}
                                    </span>
                                    <span className="text-[11px] text-white/50 group-hover:text-white/70 leading-tight">
                                        {comp.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
