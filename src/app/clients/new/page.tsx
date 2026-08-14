import { ClientForm } from "@/components/clients/client-form";
import { createClientAction } from "@/app/clients/actions";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";

type NewClientPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewClientPage({ searchParams }: NewClientPageProps) {
  const params = await searchParams;
  const { supabase, user, profile } = await getCurrentUserContext();

  const [{ data: sellers }, { data: interests }, { data: lossReasons }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("active", true)
      .in("role", ["seller", "admin"])
      .order("full_name"),
    supabase.from("interests").select("id, name, active").order("name"),
    supabase.from("loss_reasons").select("id, name, active").order("name"),
  ]);

  const availableSellers = (sellers ?? []).length > 0 ? sellers ?? [] : [{ id: user.id, full_name: profile.full_name }];
  const defaultSellerId = profile.role === "admin" ? availableSellers[0]?.id ?? user.id : user.id;

  return (
    <AppShell profile={profile} title="Nuevo cliente">
      <ClientForm
        title="Nuevo cliente"
        subtitle="Cargalo apenas se va del local, antes de que se enfrie el contacto."
        submitLabel="Guardar cliente"
        cancelHref="/clients"
        action={createClientAction}
        sellers={availableSellers}
        interests={interests ?? []}
        lossReasons={lossReasons ?? []}
        isAdmin={profile.role === "admin"}
        errorMessage={params.error}
        withFirstFollowUp
        values={{
          firstName: "",
          lastName: "",
          phone: "",
          dni: "",
          birthDate: "",
          locality: "",
          address: "",
          status: "nuevo",
          assignedUserId: defaultSellerId,
          lossReasonId: "",
          notes: "",
          interestIds: [],
        }}
      />
    </AppShell>
  );
}
