-- Etapa 6: alta automatica de perfiles al crear usuarios en Supabase Auth
-- Antes habia que insertar la fila en public.profiles a mano por SQL.
-- Ahora, al crear el usuario desde Authentication > Users, el perfil nace solo
-- con rol 'seller'. Para promover a admin: update public.profiles set role='admin' where id='...';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    ),
    'seller'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
