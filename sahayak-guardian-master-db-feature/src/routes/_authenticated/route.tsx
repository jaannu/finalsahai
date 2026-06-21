import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sprout, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        throw redirect({ to: "/auth" });
      }
    }
  },
  component: AuthShell,
});

type Role = "teacher" | "principal" | "counsellor" | "education_officer" | "district_admin";

function AuthShell() {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState<string>("");
  const [roles, setRoles] = useState<Role[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getUser();
      if (!s.user) return;
      const { data: p } = await supabase.from("profiles").select("display_name,language").eq("id", s.user.id).maybeSingle();
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", s.user.id);
      setName(p?.display_name ?? s.user.email ?? "");
      const userRoles = ((r ?? []).map((x) => x.role)) as Role[];
      setRoles(userRoles);
      if (p?.language && p.language !== i18n.resolvedLanguage) {
        i18n.changeLanguage(p.language);
      }

      // Auto-redirect principals and other administrative staff to principal dashboard if they land on teacher view
      const path = typeof window !== "undefined" ? window.location.pathname : "";
      const isPrincipalOrStaff =
        userRoles.includes("principal") ||
        userRoles.includes("counsellor") ||
        userRoles.includes("education_officer") ||
        userRoles.includes("district_admin");

      if (path.startsWith("/teacher") && isPrincipalOrStaff && !userRoles.includes("teacher")) {
        router.navigate({ to: "/principal", replace: true });
      }
    })();
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md grid place-items-center [background:var(--gradient-hero)] text-white">
              <Sprout className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg">Sahayak</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground -mt-0.5">
                {t("brand_sub")}
              </div>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <NavLinks roles={roles} />
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><LanguageSwitcher compact /></div>
            <div className="hidden sm:block text-right text-xs">
              <div className="font-medium leading-tight">{name}</div>
              <div className="text-muted-foreground leading-tight">{roles[0] ?? "—"}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title={t("sign_out")}>
              <LogOut className="h-4 w-4" />
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="font-display">Sahayak</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-1 mt-4">
                  <NavLinks roles={roles} />
                  <div className="mt-3"><LanguageSwitcher /></div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Sahayak — {t("tagline")}
      </footer>
    </div>
  );
}

function NavLinks({ roles }: { roles: Role[] }) {
  const { t } = useTranslation();
  const isPrincipalOrStaff =
    roles.includes("principal") ||
    roles.includes("counsellor") ||
    roles.includes("education_officer") ||
    roles.includes("district_admin");

  const items: { to: string; label: string; show: boolean }[] = [
    { to: "/teacher", label: t("teacher"), show: roles.includes("teacher") || roles.length === 0 },
    { to: "/principal", label: t("principal"), show: isPrincipalOrStaff || roles.includes("teacher") },
  ];
  return (
    <>
      {items.filter((i) => i.show).map((i) => (
        <Link
          key={i.to}
          to={i.to}
          className="px-3 py-1.5 rounded-md text-sm hover:bg-accent/40 [&.active]:bg-accent/60 [&.active]:text-accent-foreground"
          activeProps={{ className: "active" }}
        >
          {i.label}
        </Link>
      ))}
    </>
  );
}