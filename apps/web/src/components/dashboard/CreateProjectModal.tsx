"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "../../lib/trpc";

const TEMPLATES = [
  { id: "classic-01", name: "Cổ Điển", color: "from-amber-900/40 to-rose-900/40" },
  { id: "minimal-01", name: "Tối Giản", color: "from-slate-800/60 to-gray-900/60" },
  { id: "vintage-01", name: "Vintage", color: "from-yellow-900/40 to-amber-800/40" },
  { id: "floral-01", name: "Hoa", color: "from-pink-900/40 to-rose-800/40" },
  { id: "modern-01", name: "Hiện Đại", color: "from-blue-900/40 to-indigo-900/40" },
  { id: "gold-01", name: "Gold", color: "from-yellow-700/40 to-orange-900/40" },
];

interface CreateProjectModalProps {
  onClose: () => void;
}

export function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<"template" | "info">("template");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: ({ projectId }) => {
      router.push(`/editor/${projectId}`);
    },
    onError: (e) => setError(e.message),
  });

  function handleTitleChange(v: string) {
    setTitle(v);
    setSlug(
      v
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  }

  function handleSubmit() {
    setError("");
    if (!title.trim() || !slug.trim() || !selectedTemplate) return;
    createMutation.mutate({
      templateId: selectedTemplate,
      title: title.trim(),
      slug,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f0f1e] border border-white/10 rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
          <h2 className="font-semibold">
            {step === "template" ? "Chọn mẫu thiệp" : "Thông tin thiệp"}
          </h2>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          {step === "template" ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`rounded-xl overflow-hidden border-2 transition-all ${
                      selectedTemplate === t.id
                        ? "border-rose-500"
                        : "border-transparent"
                    }`}
                  >
                    <div
                      className={`aspect-[3/4] bg-gradient-to-br ${t.color} flex items-center justify-center`}
                    >
                      <span className="text-2xl opacity-40">&#9825;</span>
                    </div>
                    <div className="py-1.5 text-center text-xs text-white/60">
                      {t.name}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep("info")}
                disabled={!selectedTemplate}
                className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full text-sm font-medium disabled:opacity-40"
              >
                Tiếp tục →
              </button>
            </>
          ) : (
            <>
              <div className="space-y-4 mb-5">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">
                    Tên thiệp *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Ví dụ: Đám cưới Anh & Em"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-rose-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">
                    Đường dẫn (slug)
                  </label>
                  <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                    <span className="text-white/30 text-xs mr-1">
                      elove.vn/w/
                    </span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) =>
                        setSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))
                      }
                      className="flex-1 bg-transparent text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("template")}
                  className="flex-1 py-2.5 bg-white/5 rounded-full text-sm text-white/50 hover:bg-white/10"
                >
                  ← Quay lại
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!title || !slug || createMutation.isLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full text-sm font-medium disabled:opacity-40"
                >
                  {createMutation.isLoading ? "Đang tạo..." : "Tạo thiệp →"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
