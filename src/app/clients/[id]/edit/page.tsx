import { notFound } from "next/navigation";
import { ClientForm } from "@/components/clients/client-form";
import { updateClientAction } from "@/app/clients/actions";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";

type EditClientPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_raw: string;
  dni: string | null;
  birth_date: string | null;
  locality: string | null;
  address: string | null;
  status: "nuevo" | "interesado" | "en_seguimiento" | "compro" | "no_interesado" | "inactivo";
  assigned_user_id: string;
  notes: string | null;
};

export default async function EditClientPage({ params, searchParams }: EditClientPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, user, profile } = await getCurrentUserContext();

  const [{ data: client }, { data: sellers }, { data: interests }, { data: selectedInterests }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, first_name, last_name, phone_raw, dni, birth_date, locality, address, status, assigned_user_id, notes",
      )
      .eq("id", id)
      .single<ClientRow>(),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("active", true)
      .in("role", ["seller", "admin"])
      .order("full_name"),
    supabase.from("interests").select("id, name, active").order("name"),
    supabase.from("client_interests").select("interest_id").eq("client_id", id),
  ]);

  if (!client) {
    notFound();
  }

  if (profile.role !== "admin" && client.assigned_user_id !== user.id) {
    notFound();
  }

  const availableSellers = (sellers ?? []).length > 0 ? sellers ?? [] : [{ id: user.id, full_name: profile.full_name }];

  const boundUpdateAction = updateClientAction.bind(null, id);

  return (
    <AppShell profile={profile} title="Editar cliente">
      <ClientForm
        title={`Editar a ${client.first_name}`}
        subtitle="Actualiza los datos y la situacion comercial del cliente."
        submitLabel="Guardar cambios"
        cancelHref={`/clients/${id}`}
        action={boundUpdateAction}
        sellers={availableSellers}
        interests={interests ?? []}
        isAdmin={profile.role === "admin"}
        errorMessage={query.error}
        values={{
          firstName: client.first_name,
          lastName: client.last_name ?? "",
          phone: client.phone_raw,
          dni: client.dni ?? "",
          birthDate: client.birth_date ?? "",
          locality: client.locality ?? "",
          address: client.address ?? "",
          status: client.status,
          assignedUserId: client.assigned_user_id,
          notes: client.notes ?? "",
          interestIds: (selectedInterests ?? []).map((item) => item.interest_id),
        }}
      />
    </AppShell>
  );
}
