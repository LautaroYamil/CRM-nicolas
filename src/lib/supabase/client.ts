import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const env = getPublicEnv();
    browserClient = createBrowserClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      // Cookie de sesion (sin maxAge): se borra al cerrar el navegador en vez de
      // persistir ~1 anio, para que cada apertura nueva del navegador pida login.
      { cookieOptions: { maxAge: undefined } },
    );
  }

  return browserClient;
}
