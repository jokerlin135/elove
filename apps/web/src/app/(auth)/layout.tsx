export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-3xl font-bold bg-gradient-to-r from-rose-400 to-pink-600 bg-clip-text text-transparent">
            ELove
          </span>
          <p className="text-white/40 text-sm mt-1">Thiệp cưới online</p>
        </div>
        {children}
      </div>
    </div>
  );
}
