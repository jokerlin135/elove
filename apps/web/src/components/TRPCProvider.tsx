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
