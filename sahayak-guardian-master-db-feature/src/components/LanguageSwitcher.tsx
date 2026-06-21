import { useTranslation } from "react-i18next";
import { LANGS } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  async function change(code: string) {
    await i18n.changeLanguage(code);
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from("profiles").update({ language: code }).eq("id", data.user.id);
      }
    } catch {}
  }
  return (
    <div className="flex items-center gap-1">
      <Languages className="h-3.5 w-3.5 text-muted-foreground" />
      <Select value={i18n.resolvedLanguage ?? "en"} onValueChange={change}>
        <SelectTrigger className={compact ? "h-8 w-[110px] text-xs" : "h-9 w-[140px] text-sm"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGS.map((l) => (
            <SelectItem key={l.code} value={l.code}>
              {l.native}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}