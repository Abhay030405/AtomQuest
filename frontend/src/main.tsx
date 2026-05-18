import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { toast } from "sonner";
import "./index.css";
import App from "./App";

// Errors the api-client surfaces that are already handled with side effects
// (auto-redirect to /login) and shouldn't double up as a generic toast.
const SILENCED_MESSAGES = new Set<string>([
  "Your session has expired. Please log in again.",
]);

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const message = error instanceof Error ? error.message : String(error);
      if (SILENCED_MESSAGES.has(message)) return;
      // Don't toast for background refetches — only when the query has no
      // data yet (i.e. the user-facing initial load failed). Background
      // refetch failures should be silent; the consumer still sees the
      // last-good data.
      if (query.state.data !== undefined) return;
      toast.error(`Something went wrong: ${message}`);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      const message = error instanceof Error ? error.message : String(error);
      if (SILENCED_MESSAGES.has(message)) return;
      // Skip if the mutation already defined its own onError — caller owns the UX.
      if (mutation.options.onError) return;
      toast.error(message);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);

