alter table public.profiles
  add column if not exists avatar_path text;

alter table public.seller_profiles
  add column if not exists verification_status text not null default 'Not Started',
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_submitted_at timestamptz,
  add column if not exists payout_phone text,
  add column if not exists id_document_type text,
  add column if not exists id_document_number text,
  add column if not exists id_document_path text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'seller_profiles_verification_status_check'
  ) then
    alter table public.seller_profiles
      add constraint seller_profiles_verification_status_check
      check (verification_status in ('Not Started', 'Pending', 'Approved', 'Needs Action'));
  end if;
end $$;

update public.seller_profiles sp
set
  verification_status = case
    when p.verified then 'Approved'
    when sp.verification_status = 'Not Started' then 'Pending'
    else sp.verification_status
  end,
  onboarding_completed = true,
  onboarding_submitted_at = coalesce(sp.onboarding_submitted_at, sp.created_at),
  payout_phone = coalesce(sp.payout_phone, p.phone)
from public.profiles p
where p.id = sp.id;

create index if not exists idx_seller_profiles_verification_status
  on public.seller_profiles(verification_status);

insert into storage.buckets (id, name, public)
values
  ('profile-images', 'profile-images', true),
  ('seller-kyc', 'seller-kyc', false)
on conflict (id) do nothing;

drop policy if exists "profile_images_insert" on storage.objects;
create policy "profile_images_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'profile-images');

drop policy if exists "profile_images_update" on storage.objects;
create policy "profile_images_update" on storage.objects for update to authenticated
using (
  bucket_id = 'profile-images'
  and (owner_id = (select auth.uid()::text) or (select public.is_admin()))
)
with check (
  bucket_id = 'profile-images'
  and (owner_id = (select auth.uid()::text) or (select public.is_admin()))
);

drop policy if exists "profile_images_delete" on storage.objects;
create policy "profile_images_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-images'
  and (owner_id = (select auth.uid()::text) or (select public.is_admin()))
);

drop policy if exists "seller_kyc_select" on storage.objects;
create policy "seller_kyc_select" on storage.objects for select to authenticated
using (
  bucket_id = 'seller-kyc'
  and (owner_id = (select auth.uid()::text) or (select public.is_admin()))
);

drop policy if exists "seller_kyc_insert" on storage.objects;
create policy "seller_kyc_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'seller-kyc');

drop policy if exists "seller_kyc_update" on storage.objects;
create policy "seller_kyc_update" on storage.objects for update to authenticated
using (
  bucket_id = 'seller-kyc'
  and (owner_id = (select auth.uid()::text) or (select public.is_admin()))
)
with check (
  bucket_id = 'seller-kyc'
  and (owner_id = (select auth.uid()::text) or (select public.is_admin()))
);

drop policy if exists "seller_kyc_delete" on storage.objects;
create policy "seller_kyc_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'seller-kyc'
  and (owner_id = (select auth.uid()::text) or (select public.is_admin()))
);
