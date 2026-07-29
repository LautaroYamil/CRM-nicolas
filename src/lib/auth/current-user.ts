import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export async function getCurrentUserContext() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, created_at, updated_at")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  return {
    user,
    profile,
    supabase,
  };
}
