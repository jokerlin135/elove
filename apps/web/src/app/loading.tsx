import Link from "next/link";

export default function GlobalLoading() {
    return (
        <div className="min-h-screen bg-[#080810] flex items-center justify-center">
            <div className="text-center">
                <Link href="/" className="inline-block mb-6">
                    <span className="text-2xl font-bold bg-gradient-to-r from-rose-400 to-pink-600 bg-clip-text text-transparent">
                        ELove
                    </span>
                </Link>
                <div className="flex items-center gap-1.5 justify-center">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-rose-500"
                            style={{
                                animation: "pulse 1.2s ease-in-out infinite",
                                animationDelay: `${i * 0.2}s`,
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
