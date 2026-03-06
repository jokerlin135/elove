"use client";

import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export function Analytics() {
    if (!GA_ID) return null;

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
                strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
                {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            page_path: window.location.pathname,
          });
        `}
            </Script>
        </>
    );
}

// Track custom events
export function trackEvent(action: string, category: string, label?: string, value?: number) {
    if (typeof window !== "undefined" && "gtag" in window) {
        (window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", action, {
            event_category: category,
            event_label: label,
            value,
        });
    }
}

// Pre-defined conversion events
export const events = {
    signUp: () => trackEvent("sign_up", "conversion"),
    createProject: () => trackEvent("create_project", "engagement"),
    publishProject: () => trackEvent("publish", "conversion"),
    selectTemplate: (name: string) => trackEvent("select_template", "engagement", name),
    upgradeClick: (plan: string) => trackEvent("upgrade_click", "revenue", plan),
    shareInvite: (method: string) => trackEvent("share_invite", "engagement", method),
    rsvpSubmit: () => trackEvent("rsvp_submit", "engagement"),
    wishSubmit: () => trackEvent("wish_submit", "engagement"),
};
