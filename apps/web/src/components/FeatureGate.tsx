"use client";

interface FeatureGateProps {
  allowed: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function FeatureGate({
  allowed,
  fallback = null,
  children,
}: FeatureGateProps) {
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
