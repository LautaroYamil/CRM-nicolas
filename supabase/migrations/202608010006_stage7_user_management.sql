-- Etapa 7: gestion de usuarios por admin (invitar, cambiar rol, activar/desactivar)
--
-- Bug de seguridad corregido de paso: "profiles_self_update" solo validaba
-- auth.uid() = id, sin restringir que columnas se podian tocar. Cualquier
-- vendedor autenticado podia hacer:
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', auth.uid())
-- y auto-promoverse, porque RLS es a nivel de fila, no de columna.
-- El trigger de abajo bloquea cambios de role/active salvo que los haga un admin,
-- sin importar que policy dejo pasar la fila.

create or replace function public.prevent_unauthorized_profile_changes()
returns trigger
language plpgsql
as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and public.get_my_role() != 'admin' then
    raise exception 'Solo un administrador puede cambiar el rol o el estado activo de un perfil';
  end if;

  return new;
end;
$$;

create trigger trg_profiles_guard_privileged_fields
before update on public.profiles
for each row
execute function public.prevent_unauthorized_profile_changes();

-- Reemplaza profiles_self_update por el mismo patron owner-or-admin que usa el resto
-- del esquema, para que un admin pueda editar la fila de otro usuario (rol, activo).
drop policy "profiles_self_update" on public.profiles;

create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (auth.uid() = id or public.get_my_role() = 'admin')
with check (auth.uid() = id or public.get_my_role() = 'admin');
