-- Kishore Studios gallery policies
-- Run once in Supabase SQL Editor if uploads report an RLS/permission error.

alter table public.gallery enable row level security;

drop policy if exists "Public can view gallery" on public.gallery;
create policy "Public can view gallery"
on public.gallery for select
to anon, authenticated
using (true);

drop policy if exists "Kishore admin can insert gallery" on public.gallery;
create policy "Kishore admin can insert gallery"
on public.gallery for insert
to authenticated
with check ((auth.jwt() ->> 'email') = 'kishorestudios25@gmail.com');

drop policy if exists "Kishore admin can delete gallery" on public.gallery;
create policy "Kishore admin can delete gallery"
on public.gallery for delete
to authenticated
using ((auth.jwt() ->> 'email') = 'kishorestudios25@gmail.com');
