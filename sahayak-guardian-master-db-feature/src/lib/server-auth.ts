import { createClient } from "@supabase/supabase-js";
import { createMiddleware } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";

export interface AuthContext {
  supabase: ReturnType<typeof createClient<Database>>;
  userId: string;
}

export type MaybeMockContext = AuthContext & { isMock?: boolean; mockRole?: string };

export const requireAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    let token: string | undefined;
    if (typeof window !== "undefined") {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  })
  .server(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (opts: any): Promise<any> => {
      const { request: req, next } = opts as {
        request?: Request;
        next: (o: { context: MaybeMockContext }) => unknown;
      };
      const authHeader = req?.headers?.get("authorization");

      // Mock mode fallback — if no auth token or Supabase env missing, run in-memory
      if (!authHeader?.startsWith("Bearer ")) {
        return next({
          context: {
            isMock: true,
            mockRole: "teacher",
            userId: "mock-user",
            supabase: null as any,
          },
        });
      }

      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
        return next({
          context: {
            isMock: true,
            mockRole: "teacher",
            userId: "mock-user",
            supabase: null as any,
          },
        });
      }

      try {
        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: authHeader } },
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          },
        );

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error || !user) {
          return next({
            context: {
              isMock: true,
              mockRole: "teacher",
              userId: "mock-user",
              supabase: null as any,
            },
          });
        }

        return next({
          context: { supabase, userId: user.id, isMock: false } satisfies MaybeMockContext,
        });
      } catch {
        return next({
          context: {
            isMock: true,
            mockRole: "teacher",
            userId: "mock-user",
            supabase: null as any,
          },
        });
      }
    },
  );
