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

-- 판정 시각별 최종 결과 기록 (엑셀 다운로드용 히스토리)
create table decisions (
  id bigserial primary key,
  log_date date not null,
  judgment_hour int not null,
  avg_temp numeric(4,1) not null,
  granted boolean not null,
  created_at timestamptz not null default now(),
  unique (log_date, judgment_hour)
);

create index idx_decisions_date on decisions(log_date desc, judgment_hour);

-- 전광판(브라우저)에서 직접 기록 확정/조회 (anon key)
alter table decisions enable row level security;
create policy "public_read_decisions" on decisions for select using (true);
create policy "public_upsert_decisions" on decisions for insert with check (true);
create policy "public_update_decisions" on decisions for update using (true);
