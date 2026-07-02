-- Supabase SQL Editor에서 실행

create table readings (
  id bigserial primary key,
  recorded_at timestamptz not null default now(),
  process_name text not null,
  sense_temp numeric(4,1) not null
);

create index idx_readings_recorded_at on readings(recorded_at desc);

-- 전광판(브라우저)은 읽기만, 수집 스크립트(service key)만 쓰기 가능
alter table readings enable row level security;
create policy "public_read" on readings for select using (true);
create policy "service_insert" on readings for insert with check (true);
