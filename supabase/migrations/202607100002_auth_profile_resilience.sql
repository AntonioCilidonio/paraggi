create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
begin
  profile_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Utente'
  );
  if char_length(profile_name) < 2 then
    profile_name := 'Utente';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, left(profile_name, 40))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, display_name)
select
  users.id,
  left(case
    when char_length(coalesce(nullif(users.raw_user_meta_data ->> 'display_name', ''), nullif(split_part(users.email, '@', 1), ''), 'Utente')) < 2 then 'Utente'
    else coalesce(nullif(users.raw_user_meta_data ->> 'display_name', ''), nullif(split_part(users.email, '@', 1), ''), 'Utente')
  end, 40)
from auth.users
left join public.profiles on profiles.id = users.id
where profiles.id is null;
