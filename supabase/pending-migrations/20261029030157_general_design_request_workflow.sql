begin;

alter table public.general_design_requests
  add column started_at timestamptz,
  add column delivered_at timestamptz,
  add column priority text not null default 'NORMAL' check (priority in ('HIGH', 'NORMAL', 'LOW')),
  add column client_submission_key uuid not null default gen_random_uuid();
create unique index general_design_requests_submission_key_idx on public.general_design_requests(requester_id, client_submission_key);

-- Narrow the initial table-level grant so requesters cannot forge workflow fields through the Data API.
revoke insert on public.general_design_requests from authenticated;
grant insert (title, design_type, design_type_other, instructions, categories, scopes, department, required_date,
  additional_specifications, requester_id, requester_role, client_submission_key) on public.general_design_requests to authenticated;
alter table public.general_design_requests
  add constraint general_design_requests_department_allowed_check
    check (department in ('Mercadeo', 'Operaciones', 'Capital Humano', 'Selección', 'Compras', 'Farmacia', 'Ventas Online')),
  add constraint general_design_requests_categories_allowed_check
    check (categories <@ array['Carnicería', 'Charcutería', 'Pescadería', 'Víveres', 'Panadería', 'Farmacia', 'Eventos', 'Otros']::text[]),
  add constraint general_design_requests_scopes_allowed_check
    check (scopes <@ array['Prebo', 'Mañongo', 'Trigal Sur', 'Trigal Norte', 'Guataparo', 'Castillito', 'San Felipe', 'Online']::text[]);

create table public.general_design_request_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.general_design_requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('CREATED', 'STARTED', 'DELIVERED', 'PRIORITY_UPDATED', 'CANCELLATION_REQUESTED', 'CANCELLATION_APPROVED', 'CANCELLATION_REJECTED', 'DRIVE_UPDATED')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index general_design_request_history_request_idx on public.general_design_request_history(request_id, created_at desc);
alter table public.general_design_request_history enable row level security;
create policy general_design_request_history_read on public.general_design_request_history for select to authenticated
  using (exists (select 1 from public.general_design_requests r where r.id = request_id and (r.requester_id = (select auth.uid()) or (select public.has_permission('design.requests.read')))));
grant select on public.general_design_request_history to authenticated;

create table public.general_design_cancellations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.general_design_requests(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  reviewer_id uuid references auth.users(id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index general_design_cancellations_one_pending_idx on public.general_design_cancellations(request_id) where status = 'PENDING';
alter table public.general_design_cancellations enable row level security;
create policy general_design_cancellations_read on public.general_design_cancellations for select to authenticated
  using (requester_id = (select auth.uid()) or (select public.has_permission('design.requests.read')));
create policy general_design_cancellations_request on public.general_design_cancellations for insert to authenticated
  with check (requester_id = (select auth.uid()) and exists (
    select 1 from public.general_design_requests r where r.id = request_id and r.requester_id = (select auth.uid())
      and r.status in ('SOLICITADA', 'EN_DISENO', 'EN_CORRECCION')
  ));
grant select on public.general_design_cancellations to authenticated;
grant insert (request_id, requester_id, reason) on public.general_design_cancellations to authenticated;

create table public.general_design_request_uploads (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.general_design_requests(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  category text not null check (category in ('REFERENCIAS', 'ENTREGABLES')),
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 104857600),
  session_uri text,
  drive_file_id text,
  drive_web_url text,
  status text not null default 'UPLOADING' check (status in ('UPLOADING', 'COMPLETE', 'FAILED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index general_design_request_uploads_request_idx on public.general_design_request_uploads(request_id, category, created_at desc);
alter table public.general_design_request_uploads enable row level security;
create policy general_design_request_uploads_read on public.general_design_request_uploads for select to authenticated
  using (exists (select 1 from public.general_design_requests r where r.id = request_id and (r.requester_id = (select auth.uid()) or (select public.has_permission('design.requests.read')))));
grant select (id, request_id, actor_id, category, file_name, mime_type, file_size, drive_file_id, drive_web_url, status, created_at, completed_at)
  on public.general_design_request_uploads to authenticated;

insert into public.general_design_request_history(request_id, actor_id, action)
select id, requester_id, 'CREATED' from public.general_design_requests;

commit;
