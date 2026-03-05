# Auth + Dashboard + Editor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Auth (Supabase + Google OAuth), Dashboard (project list + create), và Editor (drag-drop + property panel + autosave + publish) để ELove có thể dùng end-to-end.

**Architecture:** Next.js 15 App Router với route groups: `(auth)` cho login/signup, `(app)` cho dashboard+editor. Supabase SSR cookies cho session. tRPC client dùng Supabase access_token làm Bearer. Editor Zustand store đã có — chỉ cần connect tới tRPC + dnd-kit.

**Tech Stack:** `@supabase/ssr`, `@supabase/auth-ui-react`, `@dnd-kit/core` + `@dnd-kit/sortable`, tRPC v10 + React Query v4, Zustand + Immer, Tailwind CSS v4, Next.js 15 App Router.

---

## Task 1: Install dependencies + tRPC client browser setup

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/trpc.ts`
- Create: `apps/web/src/lib/query-client.ts`

**Step 1: Install dependencies**

```bash
cd /Users/mini4/bydone/elove
npm install --workspace=@elove/web @supabase/ssr @supabase/auth-ui-react @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: packages added to `apps/web/node_modules`.

**Step 2: Tạo tRPC browser client**

```typescript
// apps/web/src/lib/trpc.ts
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../server/app.router";
import { createBrowserClient } from "@supabase/ssr";

export const trpc = createTRPCReact<AppRouter>();

export function makeTRPCClient() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        async headers() {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
```

**Step 3: Tạo QueryClient factory**

```typescript
// apps/web/src/lib/query-client.ts
import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000, retry: 1 },
    },
  });
}
```

**Step 4: Verify TypeScript compiles**

```bash
cd /Users/mini4/bydone/elove
npm run typecheck 2>&1 | tail -5
```

Expected: `Tasks: X successful`

**Step 5: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/
git commit -m "feat: install supabase/ssr, auth-ui, dnd-kit; add tRPC browser client"
```

---

## Task 2: Supabase client helpers + Middleware

**Files:**
- Create: `apps/web/src/lib/supabase/client.ts`
- Create: `apps/web/src/lib/supabase/server.ts`
- Create: `apps/web/middleware.ts`

**Step 1: Tạo browser Supabase client**

```typescript
// apps/web/src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Tạo server Supabase client**

```typescript
// apps/web/src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — cookies cannot be set in server component render
          }
        },
      },
    }
  );
}
```

**Step 3: Tạo middleware bảo vệ routes**

```typescript
// apps/web/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users to /login
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/editor");
  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from auth pages
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Step 4: Thêm env vars vào `.env.local`**

Mở `apps/web/.env.local`, thêm:
```
NEXT_PUBLIC_SUPABASE_URL=https://urcwmghrpmjnbusraoxz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key từ Supabase dashboard>
```

Lấy anon key: Supabase Dashboard → Settings → API → `anon public`.

**Step 5: Verify build**

```bash
npm run build 2>&1 | tail -8
```

Expected: `Tasks: 2 successful`

**Step 6: Commit**

```bash
git add apps/web/src/lib/supabase/ apps/web/middleware.ts
git commit -m "feat: supabase SSR client helpers + middleware auth guard"
```

---

## Task 3: Auth callback route + DB user provisioning

**Files:**
- Create: `apps/web/src/app/auth/callback/route.ts`

Khi Supabase OAuth hoàn thành, nó redirect về `/auth/callback?code=...`. Route này exchange code lấy session, tạo DB record nếu user mới, rồi redirect `/dashboard`.

**Step 1: Tạo callback route**

```typescript
// apps/web/src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createDb } from "@elove/shared";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Ensure user + tenant exist in DB
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const db = createDb(process.env.DATABASE_URL!);
        const existing = await db.query.users.findFirst({
          where: (u, { eq }) => eq(u.id, user.id),
        });
        if (!existing) {
          // Provision tenant + user
          const { randomUUID } = await import("crypto");
          const tenantId = randomUUID();
          const { tenants, users } = await import("@elove/shared");
          const email = user.email ?? "";
          const slug = email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase();

          await db.insert(tenants).values({
            id: tenantId,
            slug: `${slug}-${tenantId.slice(0, 6)}`,
            plan_id: "free",
          });
          await db.insert(users).values({
            id: user.id,
            tenant_id: tenantId,
            email,
            role: "owner",
          });
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

**Step 2: Verify TypeScript**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/web/src/app/auth/
git commit -m "feat: auth callback — exchange code, provision user+tenant in DB"
```

---

## Task 4: Auth Pages — Login + Signup

**Files:**
- Create: `apps/web/app/(auth)/layout.tsx`
- Create: `apps/web/app/(auth)/login/page.tsx`
- Create: `apps/web/app/(auth)/signup/page.tsx`

**Step 1: Route group layout cho auth**

```typescript
// apps/web/app/(auth)/layout.tsx
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
```

**Step 2: Login page**

```typescript
// apps/web/app/(auth)/login/page.tsx
"use client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { createClient } from "../../../src/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <Auth
        supabaseClient={supabase}
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: "#f43f5e",
                brandAccent: "#e11d48",
                inputBackground: "rgba(255,255,255,0.05)",
                inputBorder: "rgba(255,255,255,0.1)",
                inputText: "white",
                inputLabelText: "rgba(255,255,255,0.6)",
                messageText: "rgba(255,255,255,0.5)",
                anchorTextColor: "#fb7185",
              },
              radii: { borderRadiusButton: "9999px", inputBorderRadius: "12px" },
            },
          },
          className: { container: "text-white" },
        }}
        providers={["google"]}
        redirectTo={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`}
        view="sign_in"
        localization={{
          variables: {
            sign_in: {
              email_label: "Email",
              password_label: "Mật khẩu",
              button_label: "Đăng nhập",
              social_provider_text: "Đăng nhập với {{provider}}",
              link_text: "Chưa có tài khoản? Đăng ký",
            },
          },
        }}
      />
    </div>
  );
}
```

**Step 3: Signup page**

```typescript
// apps/web/app/(auth)/signup/page.tsx
"use client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { createClient } from "../../../src/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <Auth
        supabaseClient={supabase}
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: "#f43f5e",
                brandAccent: "#e11d48",
                inputBackground: "rgba(255,255,255,0.05)",
                inputBorder: "rgba(255,255,255,0.1)",
                inputText: "white",
                inputLabelText: "rgba(255,255,255,0.6)",
                messageText: "rgba(255,255,255,0.5)",
                anchorTextColor: "#fb7185",
              },
              radii: { borderRadiusButton: "9999px", inputBorderRadius: "12px" },
            },
          },
        }}
        providers={["google"]}
        redirectTo={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`}
        view="sign_up"
        localization={{
          variables: {
            sign_up: {
              email_label: "Email",
              password_label: "Mật khẩu",
              button_label: "Đăng ký miễn phí",
              social_provider_text: "Đăng ký với {{provider}}",
              link_text: "Đã có tài khoản? Đăng nhập",
            },
          },
        }}
      />
    </div>
  );
}
```

**Step 4: Thêm NEXT_PUBLIC_SITE_URL vào .env.local**

```
NEXT_PUBLIC_SITE_URL=https://elove-xi.vercel.app
```

**Step 5: Build check**

```bash
npm run build 2>&1 | tail -8
```

Expected: `Tasks: 2 successful`

**Step 6: Commit**

```bash
git add apps/web/app/\(auth\)/
git commit -m "feat: auth pages — login + signup with Supabase Auth UI + Google OAuth"
```

---

## Task 5: Dashboard layout (App route group + Sidebar)

**Files:**
- Create: `apps/web/app/(app)/layout.tsx`
- Create: `apps/web/src/components/dashboard/Sidebar.tsx`

**Step 1: TRPCProvider component**

```typescript
// apps/web/src/components/TRPCProvider.tsx
"use client";
import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { trpc, makeTRPCClient } from "../lib/trpc";
import { makeQueryClient } from "../lib/query-client";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [trpcClient] = useState(makeTRPCClient);
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

**Step 2: Sidebar component**

```typescript
// apps/web/src/components/dashboard/Sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Thiệp của tôi", icon: "♡" },
  { href: "/dashboard/billing", label: "Billing", icon: "💳" },
  { href: "/dashboard/settings", label: "Cài đặt", icon: "⚙" },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-56 min-h-screen bg-[#0d0d1a] border-r border-white/5 flex flex-col">
      <div className="p-5">
        <span className="text-xl font-bold bg-gradient-to-r from-rose-400 to-pink-600 bg-clip-text text-transparent">
          ELove
        </span>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
              pathname === item.href
                ? "bg-rose-500/15 text-rose-300"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-white/5">
        <div className="text-xs text-white/40 truncate mb-2">{email}</div>
        <button
          onClick={handleSignOut}
          className="text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
```

**Step 3: App group layout với Sidebar**

```typescript
// apps/web/app/(app)/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "../../src/lib/supabase/server";
import { Sidebar } from "../../src/components/dashboard/Sidebar";
import { TRPCProvider } from "../../src/components/TRPCProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <TRPCProvider>
      <div className="flex min-h-screen bg-[#080810] text-white">
        <Sidebar email={user.email ?? ""} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </TRPCProvider>
  );
}
```

**Step 4: Build check**

```bash
npm run build 2>&1 | tail -8
```

**Step 5: Commit**

```bash
git add apps/web/app/\(app\)/ apps/web/src/components/
git commit -m "feat: app layout — sidebar + TRPC provider + auth guard"
```

---

## Task 6: Dashboard page — project list + empty state

**Files:**
- Create: `apps/web/app/(app)/dashboard/page.tsx`
- Create: `apps/web/src/components/dashboard/ProjectGrid.tsx`
- Create: `apps/web/src/components/dashboard/ProjectCard.tsx`

**Step 1: ProjectCard component**

```typescript
// apps/web/src/components/dashboard/ProjectCard.tsx
"use client";
import Link from "next/link";

interface ProjectCardProps {
  id: string;
  title: string;
  slug: string;
  status: string;
  updatedAt: Date;
  onArchive: (id: string) => void;
}

export function ProjectCard({ id, title, slug, status, updatedAt, onArchive }: ProjectCardProps) {
  return (
    <div className="group rounded-2xl bg-white/5 border border-white/8 hover:border-rose-500/30 transition-all overflow-hidden">
      {/* Thumbnail */}
      <div className="aspect-[4/3] bg-gradient-to-br from-rose-900/30 via-pink-900/20 to-purple-900/30 flex items-center justify-center">
        <span className="text-5xl opacity-20">♡</span>
      </div>
      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-medium text-sm truncate">{title}</h3>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ml-2 shrink-0 ${
              status === "published"
                ? "bg-green-500/15 text-green-400"
                : "bg-white/10 text-white/40"
            }`}
          >
            {status === "published" ? "Live" : "Draft"}
          </span>
        </div>
        <p className="text-xs text-white/30 mb-3">/{slug}</p>
        <div className="flex items-center gap-2">
          <Link
            href={`/editor/${id}`}
            className="flex-1 text-center py-1.5 text-xs bg-rose-500/15 text-rose-300 rounded-lg hover:bg-rose-500/25 transition-colors"
          >
            Chỉnh sửa
          </Link>
          <button
            onClick={() => {
              if (confirm("Chia sẻ link thiệp?")) {
                navigator.clipboard.writeText(
                  `${window.location.origin}/w/${slug}`
                );
              }
            }}
            className="flex-1 py-1.5 text-xs bg-white/5 text-white/50 rounded-lg hover:bg-white/10 transition-colors"
          >
            Chia sẻ
          </button>
          <button
            onClick={() => onArchive(id)}
            className="py-1.5 px-2 text-xs text-white/20 hover:text-red-400 transition-colors"
            title="Xóa"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: ProjectGrid (client component với tRPC)**

```typescript
// apps/web/src/components/dashboard/ProjectGrid.tsx
"use client";
import { trpc } from "../../lib/trpc";
import { ProjectCard } from "./ProjectCard";
import { useState } from "react";
import { CreateProjectModal } from "./CreateProjectModal";

export function ProjectGrid() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: projects, isLoading, refetch } = trpc.projects.list.useQuery();
  const archiveMutation = trpc.projects.archive.useMutation({
    onSuccess: () => refetch(),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-white/5 animate-pulse aspect-[4/5]" />
        ))}
      </div>
    );
  }

  const active = projects?.filter((p) => p.status !== "archived") ?? [];

  return (
    <>
      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-6xl mb-4 opacity-30">♡</div>
          <h3 className="text-lg font-medium mb-2">Chưa có thiệp nào</h3>
          <p className="text-white/30 text-sm mb-6">
            Tạo thiệp cưới đầu tiên của bạn ngay bây giờ
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full text-sm font-medium"
          >
            Tạo thiệp ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {active.map((p) => (
            <ProjectCard
              key={p.id}
              id={p.id}
              title={p.title}
              slug={p.slug}
              status={p.status ?? "draft"}
              updatedAt={new Date(p.updated_at)}
              onArchive={(id) => archiveMutation.mutate({ projectId: id })}
            />
          ))}
          {/* Create new card */}
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-2xl border-2 border-dashed border-white/10 hover:border-rose-500/30 transition-colors flex flex-col items-center justify-center aspect-[4/5] text-white/30 hover:text-rose-400"
          >
            <span className="text-3xl mb-2">+</span>
            <span className="text-sm">Tạo thiệp mới</span>
          </button>
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
```

**Step 3: Dashboard page**

```typescript
// apps/web/app/(app)/dashboard/page.tsx
import { ProjectGrid } from "../../../src/components/dashboard/ProjectGrid";

export const metadata = { title: "Dashboard — ELove" };

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Thiệp của tôi</h1>
      </div>
      <ProjectGrid />
    </div>
  );
}
```

**Step 4: Build check**

```bash
npm run build 2>&1 | tail -8
```

**Step 5: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/ apps/web/src/components/dashboard/
git commit -m "feat: dashboard page — project grid, empty state, archive"
```

---

## Task 7: Create Project Modal

**Files:**
- Create: `apps/web/src/components/dashboard/CreateProjectModal.tsx`

```typescript
// apps/web/src/components/dashboard/CreateProjectModal.tsx
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
      v.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  }

  function handleSubmit() {
    setError("");
    if (!title.trim() || !slug.trim() || !selectedTemplate) return;
    createMutation.mutate({ templateId: selectedTemplate, title: title.trim(), slug });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f0f1e] border border-white/10 rounded-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="font-semibold">
            {step === "template" ? "Chọn mẫu thiệp" : "Thông tin thiệp"}
          </h2>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl">×</button>
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
                    <div className={`aspect-[3/4] bg-gradient-to-br ${t.color} flex items-center justify-center`}>
                      <span className="text-2xl opacity-40">♡</span>
                    </div>
                    <div className="py-1.5 text-center text-xs text-white/60">{t.name}</div>
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
                  <label className="text-xs text-white/50 mb-1 block">Tên thiệp *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Ví dụ: Đám cưới Anh & Em"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-rose-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Đường dẫn (slug)</label>
                  <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                    <span className="text-white/30 text-xs mr-1">elove.vn/w/</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))}
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
```

**Step 2: Build check**

```bash
npm run build 2>&1 | tail -8
```

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/CreateProjectModal.tsx
git commit -m "feat: create project modal — template picker + title/slug form"
```

---

## Task 8: tRPC projects.update procedure

**Files:**
- Modify: `apps/web/src/server/projects/projects.router.ts`
- Modify: `apps/web/src/server/projects/projects.service.ts`

**Step 1: Thêm update vào ProjectsService**

Mở `apps/web/src/server/projects/projects.service.ts`, thêm method sau `archive`:

```typescript
async update(
  projectId: string,
  tenantId: string,
  payload: {
    documentJson: string;
    themeJson: string;
    editRevision: number;
  }
) {
  const project = await this.db.query.projects.findFirst({
    where: (p, { eq, and }) =>
      and(eq(p.id, projectId), eq(p.tenant_id, tenantId)),
  });
  if (!project) throw new Error("Project không tìm thấy");

  const docPath = project.r2_document_key;
  const themePath = `projects/${tenantId}/${projectId}/theme.json`;

  await Promise.all([
    this.r2.put(docPath, payload.documentJson, { contentType: "application/json" }),
    this.r2.put(themePath, payload.themeJson, { contentType: "application/json" }),
  ]);

  const { eq, and } = await import("drizzle-orm");
  await this.db
    .update(projects)
    .set({ edit_revision: payload.editRevision, updated_at: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.tenant_id, tenantId)));

  return { ok: true };
}
```

**Step 2: Thêm update vào router**

Mở `apps/web/src/server/projects/projects.router.ts`, thêm sau `archive`:

```typescript
update: protectedProcedure
  .input(
    z.object({
      projectId: z.string().uuid(),
      documentJson: z.string(),
      themeJson: z.string(),
      editRevision: z.number().int().min(0),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const service = new ProjectsService(ctx.db, ctx.r2);
    return service.update(input.projectId, ctx.tenantId, input);
  }),
```

**Step 3: Verify**

```bash
npm run typecheck 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add apps/web/src/server/projects/
git commit -m "feat: projects.update tRPC procedure — save document+theme to R2"
```

---

## Task 9: Editor — connect tRPC + EditorProvider + autosave

**Files:**
- Create: `apps/web/src/components/editor/EditorProvider.tsx`
- Modify: `apps/web/src/app/editor/[projectId]/page.tsx`
- Modify: `apps/web/src/components/editor/EditorLayout.tsx`

**Step 1: EditorProvider (loads project, provides store)**

```typescript
// apps/web/src/components/editor/EditorProvider.tsx
"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { trpc } from "../../lib/trpc";
import { createEditorStore, type EditorStore } from "../../store/editor.store";
import { sha256 } from "../../utils/hash";

const EditorContext = createContext<EditorStore | null>(null);

export function useEditorStore() {
  const store = useContext(EditorContext);
  if (!store) throw new Error("useEditorStore must be inside EditorProvider");
  return store;
}

export function EditorProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const [store, setStore] = useState<EditorStore | null>(null);
  const storeRef = useRef<EditorStore | null>(null);

  const { data, isLoading } = trpc.projects.get.useQuery({ projectId });
  const updateMutation = trpc.projects.update.useMutation();

  // Init store when data loads
  useEffect(() => {
    if (!data) return;
    const s = createEditorStore({
      document: data.document,
      theme: data.theme,
      editRevision: data.project.edit_revision ?? 0,
    });
    storeRef.current = s;
    setStore(s);
  }, [data]);

  // Autosave every 3s when dirty
  useEffect(() => {
    const interval = setInterval(() => {
      const s = storeRef.current;
      if (!s) return;
      const state = s.getState();
      if (!state.dirty) return;

      const documentJson = JSON.stringify(state.document);
      const themeJson = JSON.stringify(state.theme);
      const hash = sha256(documentJson);
      if (hash === state.lastSavedHash) return;

      const nextRevision = state.editRevision + 1;
      updateMutation.mutate(
        { projectId, documentJson, themeJson, editRevision: nextRevision },
        { onSuccess: () => s.getState().markSaved(hash, nextRevision) }
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [projectId]);

  if (isLoading || !store) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#080810] text-white">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">♡</div>
          <p className="text-white/40 text-sm">Đang tải thiệp...</p>
        </div>
      </div>
    );
  }

  return <EditorContext.Provider value={store}>{children}</EditorContext.Provider>;
}
```

**Step 2: Wrap EditorLayout trong TRPCProvider + EditorProvider**

```typescript
// apps/web/src/app/editor/[projectId]/page.tsx
import { TRPCProvider } from "../../../components/TRPCProvider";
import { EditorProvider } from "../../../components/editor/EditorProvider";
import { EditorLayout } from "../../../components/editor/EditorLayout";

interface EditorPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { projectId } = await params;
  return (
    <TRPCProvider>
      <EditorProvider projectId={projectId}>
        <EditorLayout projectId={projectId} />
      </EditorProvider>
    </TRPCProvider>
  );
}

export const metadata = { title: "Editor — ELove" };
```

**Step 3: Build check**

```bash
npm run build 2>&1 | tail -8
```

**Step 4: Commit**

```bash
git add apps/web/src/components/editor/EditorProvider.tsx apps/web/src/app/editor/
git commit -m "feat: EditorProvider — loads project from tRPC, autosave every 3s"
```

---

## Task 10: Editor Toolbar — connected + save indicator

**Files:**
- Modify: `apps/web/src/components/editor/Toolbar.tsx`

```typescript
// apps/web/src/components/editor/Toolbar.tsx
"use client";
import Link from "next/link";
import { useEditorStore } from "./EditorProvider";

interface ToolbarProps {
  projectId: string;
}

export function Toolbar({ projectId }: ToolbarProps) {
  const store = useEditorStore();
  const { dirty, document: doc, undoStack, redoStack, undo, redo } = store.getState();
  // Subscribe to changes
  const state = store((s) => ({
    dirty: s.dirty,
    title: s.document.content?.data?.couple?.partner1 ?? "Thiệp cưới",
    canUndo: s.undoStack.length > 0,
    canRedo: s.redoStack.length > 0,
  }));

  return (
    <header className="h-12 bg-[#0d0d1a] border-b border-white/8 flex items-center justify-between px-4 shrink-0 text-white">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-white/40 hover:text-white transition-colors text-sm"
        >
          ← Dashboard
        </Link>
        <span className="text-white/20">|</span>
        <span className="text-sm font-medium truncate max-w-40">{state.title}</span>
        {state.dirty && (
          <span className="text-xs text-amber-400/60">● Chưa lưu</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => store.getState().undo()}
          disabled={!state.canUndo}
          className="p-1.5 text-white/40 hover:text-white disabled:opacity-20 transition-colors"
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          onClick={() => store.getState().redo()}
          disabled={!state.canRedo}
          className="p-1.5 text-white/40 hover:text-white disabled:opacity-20 transition-colors"
          title="Redo (Ctrl+Y)"
        >
          ↪
        </button>
        <button className="px-3 py-1.5 text-xs text-white/50 hover:text-white border border-white/10 rounded-lg transition-colors">
          Xem trước
        </button>
        <button className="px-4 py-1.5 text-xs bg-gradient-to-r from-rose-500 to-pink-600 rounded-lg font-medium hover:opacity-90">
          Xuất bản
        </button>
      </div>
    </header>
  );
}
```

**Step 2: Build + commit**

```bash
npm run build 2>&1 | tail -5
git add apps/web/src/components/editor/Toolbar.tsx
git commit -m "feat: editor toolbar — connected to store, undo/redo, dirty indicator"
```

---

## Task 11: Canvas với drag-drop sections

**Files:**
- Modify: `apps/web/src/components/editor/Canvas.tsx`

```typescript
// apps/web/src/components/editor/Canvas.tsx
"use client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEditorStore } from "./EditorProvider";

function SectionBlock({ sectionId, isSelected, onClick }: {
  sectionId: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sectionId });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`relative mb-2 rounded-lg border-2 transition-all cursor-pointer ${
        isSelected ? "border-rose-500" : "border-transparent hover:border-white/20"
      }`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center opacity-0 hover:opacity-100 cursor-grab text-white/30 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        ⋮⋮
      </div>
      {/* Section content placeholder */}
      <div className="bg-white/5 border border-white/8 rounded-lg p-8 text-center text-white/20 text-sm ml-6">
        Section: {sectionId.slice(0, 8)}
      </div>
    </div>
  );
}

export function Canvas() {
  const store = useEditorStore();
  const { document: doc, selection, setSelection, setDocument, pushToUndo } = store.getState();

  // Subscribe to re-render
  const { pages, selection: sel } = store((s) => ({
    pages: s.document.structure.pages,
    selection: s.selection,
  }));

  const currentPage = pages.find((p) => p.id === (sel.pageId ?? pages[0]?.id));
  const sections = currentPage?.sections ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !currentPage) return;

    pushToUndo();
    const oldIndex = sections.indexOf(active.id as string);
    const newIndex = sections.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newSections = [...sections];
    newSections.splice(oldIndex, 1);
    newSections.splice(newIndex, 0, active.id as string);

    const newDoc = JSON.parse(JSON.stringify(doc));
    const pageIndex = newDoc.structure.pages.findIndex((p: { id: string }) => p.id === currentPage.id);
    newDoc.structure.pages[pageIndex].sections = newSections;
    setDocument(newDoc);
  }

  return (
    <div className="min-h-full bg-[#080810] flex justify-center p-6">
      <div className="w-full max-w-2xl">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections} strategy={verticalListSortingStrategy}>
            {sections.map((sectionId) => (
              <SectionBlock
                key={sectionId}
                sectionId={sectionId}
                isSelected={sel.sectionId === sectionId}
                onClick={() => setSelection({ sectionId, slotId: null })}
              />
            ))}
          </SortableContext>
        </DndContext>
        {sections.length === 0 && (
          <div className="flex items-center justify-center h-64 border-2 border-dashed border-white/10 rounded-2xl text-white/20 text-sm">
            Kéo components vào đây để thiết kế thiệp cưới
          </div>
        )}
        <button className="mt-4 w-full py-3 border border-dashed border-white/10 rounded-xl text-white/30 hover:text-white/60 hover:border-white/20 text-sm transition-colors">
          + Thêm section
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Build**

```bash
npm run build 2>&1 | tail -8
```

**Step 3: Commit**

```bash
git add apps/web/src/components/editor/Canvas.tsx
git commit -m "feat: canvas with dnd-kit drag-drop section reordering"
```

---

## Task 12: PropertyPanel contextual + PageTree connected

**Files:**
- Modify: `apps/web/src/components/editor/PropertyPanel.tsx`
- Modify: `apps/web/src/components/editor/PageTree.tsx`

**Step 1: PropertyPanel (contextual)**

```typescript
// apps/web/src/components/editor/PropertyPanel.tsx
"use client";
import { useEditorStore } from "./EditorProvider";

export function PropertyPanel() {
  const store = useEditorStore();
  const { selection: sel, document: doc } = store((s) => ({
    selection: s.selection,
    document: s.document,
  }));

  const couple = doc.content?.data?.couple;

  return (
    <div className="h-full bg-[#0d0d1a] border-l border-white/5 overflow-y-auto text-white">
      <div className="p-4 border-b border-white/5">
        <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">
          {sel.sectionId ? "Section" : "Thuộc tính"}
        </h3>
      </div>

      {!sel.sectionId ? (
        // Global properties — couple info
        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs text-white/30 mb-3">Thông tin cặp đôi</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 block mb-1">Cô dâu</label>
                <input
                  type="text"
                  value={couple?.partner1 ?? ""}
                  onChange={(e) => {
                    store.getState().pushToUndo();
                    const newDoc = JSON.parse(JSON.stringify(doc));
                    newDoc.content.data.couple.partner1 = e.target.value;
                    store.getState().setDocument(newDoc);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Chú rể</label>
                <input
                  type="text"
                  value={couple?.partner2 ?? ""}
                  onChange={(e) => {
                    store.getState().pushToUndo();
                    const newDoc = JSON.parse(JSON.stringify(doc));
                    newDoc.content.data.couple.partner2 = e.target.value;
                    store.getState().setDocument(newDoc);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Ngày cưới</label>
                <input
                  type="date"
                  value={couple?.weddingDate ?? ""}
                  onChange={(e) => {
                    store.getState().pushToUndo();
                    const newDoc = JSON.parse(JSON.stringify(doc));
                    newDoc.content.data.couple.weddingDate = e.target.value;
                    store.getState().setDocument(newDoc);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Section properties
        <div className="p-4 space-y-4">
          <p className="text-xs text-white/30">Section ID: {sel.sectionId.slice(0, 8)}</p>
          <div>
            <label className="text-xs text-white/40 block mb-1">Background</label>
            <input
              type="color"
              defaultValue="#ffffff"
              className="w-full h-10 rounded-lg border border-white/10 bg-white/5 cursor-pointer"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-2">Animation</label>
            <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              <option value="none">Không</option>
              <option value="fade">Fade in</option>
              <option value="slide-up">Slide up</option>
              <option value="zoom">Zoom in</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: PageTree connected**

```typescript
// apps/web/src/components/editor/PageTree.tsx
"use client";
import { useEditorStore } from "./EditorProvider";

export function PageTree() {
  const store = useEditorStore();
  const { pages, currentPageId } = store((s) => ({
    pages: s.document.structure.pages,
    currentPageId: s.selection.pageId ?? s.document.structure.pages[0]?.id,
  }));

  return (
    <div className="h-full bg-[#0d0d1a] border-r border-white/5 text-white">
      <div className="p-4 border-b border-white/5">
        <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Trang</h3>
      </div>
      <div className="p-2">
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => store.getState().setSelection({ pageId: page.id, sectionId: null })}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              page.id === currentPageId
                ? "bg-rose-500/15 text-rose-300"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
          >
            {page.title}
          </button>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-white/5">
        <p className="text-xs text-white/20 text-center">Components</p>
      </div>
      <div className="p-2 space-y-1">
        {[
          { icon: "📝", label: "Text" },
          { icon: "🖼", label: "Ảnh" },
          { icon: "👫", label: "Cặp đôi" },
          { icon: "📅", label: "Sự kiện" },
          { icon: "🎵", label: "Nhạc" },
          { icon: "💌", label: "RSVP" },
        ].map((c) => (
          <div
            key={c.label}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white hover:bg-white/5 cursor-grab transition-colors"
          >
            <span>{c.icon}</span>
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Build + commit**

```bash
npm run build 2>&1 | tail -5
git add apps/web/src/components/editor/
git commit -m "feat: PropertyPanel contextual + PageTree connected to store"
```

---

## Task 13: Push + verify live

**Step 1: Push tất cả**

```bash
git push origin main
```

**Step 2: Wait for Vercel deploy (~2 min), then verify**

```bash
sleep 120 && curl -s -o /dev/null -w "%{http_code}" https://elove-xi.vercel.app/login
```

Expected: `200`

**Step 3: Thêm Vercel env vars còn thiếu**

Vào Vercel Dashboard → elove-xi → Settings → Environment Variables, thêm:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://urcwmghrpmjnbusraoxz.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<từ Supabase dashboard>`
- `NEXT_PUBLIC_SITE_URL` = `https://elove-xi.vercel.app`

Rồi redeploy: Vercel → Deployments → Redeploy.

**Step 4: Cấu hình Supabase OAuth callback URL**

Vào Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://elove-xi.vercel.app`
- Redirect URLs: `https://elove-xi.vercel.app/auth/callback`

Vào Google Cloud Console → OAuth 2.0:
- Authorized redirect URIs: `https://[supabase-project].supabase.co/auth/v1/callback`

**Step 5: Manual smoke test**

1. Mở `https://elove-xi.vercel.app/login` → thấy form login
2. Đăng ký tài khoản mới → redirect `/dashboard`
3. Click "+ Tạo thiệp mới" → chọn template → nhập tên → redirect `/editor/[id]`
4. Kéo section → drop ở vị trí mới → xác nhận thứ tự thay đổi
5. Sửa tên cô dâu trong PropertyPanel → sau 3s check autosave indicator

---

## Tóm tắt files tạo/sửa

| File | Action |
|------|--------|
| `apps/web/src/lib/trpc.ts` | Create |
| `apps/web/src/lib/query-client.ts` | Create |
| `apps/web/src/lib/supabase/client.ts` | Create |
| `apps/web/src/lib/supabase/server.ts` | Create |
| `apps/web/middleware.ts` | Create |
| `apps/web/src/app/auth/callback/route.ts` | Create |
| `apps/web/app/(auth)/layout.tsx` | Create |
| `apps/web/app/(auth)/login/page.tsx` | Create |
| `apps/web/app/(auth)/signup/page.tsx` | Create |
| `apps/web/src/components/TRPCProvider.tsx` | Create |
| `apps/web/src/components/dashboard/Sidebar.tsx` | Create |
| `apps/web/app/(app)/layout.tsx` | Create |
| `apps/web/app/(app)/dashboard/page.tsx` | Create |
| `apps/web/src/components/dashboard/ProjectCard.tsx` | Create |
| `apps/web/src/components/dashboard/ProjectGrid.tsx` | Create |
| `apps/web/src/components/dashboard/CreateProjectModal.tsx` | Create |
| `apps/web/src/server/projects/projects.service.ts` | Modify (add update) |
| `apps/web/src/server/projects/projects.router.ts` | Modify (add update) |
| `apps/web/src/components/editor/EditorProvider.tsx` | Create |
| `apps/web/src/app/editor/[projectId]/page.tsx` | Modify |
| `apps/web/src/components/editor/Toolbar.tsx` | Modify |
| `apps/web/src/components/editor/Canvas.tsx` | Modify |
| `apps/web/src/components/editor/PropertyPanel.tsx` | Modify |
| `apps/web/src/components/editor/PageTree.tsx` | Modify |
