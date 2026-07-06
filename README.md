# 쉬는시간 안내 전광판

폭염 대응 쉬는시간 판정 결과를 현장 화면에 크게 표시하는 프로젝트. 6개 공정에 설치될 IoT 체감온도계(Air365/케이웨더) 데이터를 기반으로 자동 판정한다.

## 지금 상태
- 화면(`board/`)과 데이터 파이프라인 코드(`collector/`, `database/`, `.github/workflows/`)는 전부 완성됨.
- 센서 하드웨어는 배송 중, 업체 API 키/계정은 아직 미수령.
- 업체가 IP 화이트리스트 제한을 없애주기로 해서, 고정 IP용 서버(Oracle/GCP VM) 없이 **GitHub Actions**로 수집한다.
- Supabase 프로젝트도 아직 미생성.
- **즉, 값(계정 정보)만 채우면 바로 실데이터로 전환되는 상태.** 그 전까지 화면은 테스트 패널/임의값(mock)으로 동작.
- 경광등 연동(`beacon/`) 코드도 준비됨 — 실제 스마트플러그 기기로는 아직 미검증.

**배포 주소: https://board-seven-rho.vercel.app** (Vercel, 아무 컴퓨터 브라우저에서 접속 가능)

## 판정 규칙
- 고정 판정 시각 9개: **01:00, 03:00, 07:00, 09:00, 11:00, 15:00, 17:00, 19:00, 23:00**
- 판정 시각 T의 측정창: **[T-60분, T-30분)** (10분 간격 3회 데이터)
- 측정창의 6개 공정 전체 평균 체감온도가 **33도 이상**이면 T~T+10분 "쉬는시간 부여"
- 화면은 각 측정창이 끝나는 시점(T-30분)부터 다음 측정창이 끝날 때까지 그 판정 결과를 계속 표시
- 화면 상단에 오늘 9개 판정 시각의 현황을 각각 박스로 표시 (부여/미부여/미측정)
- 시계 옆 **측정기준** 버튼으로 전체 로직 설명, **엑셀 다운로드** 버튼으로 누적 판정 기록 내보내기 가능

## 전체 구조
```
[Air365 last-all API] <--10분마다 GET 1회-- [GitHub Actions (collector/)]
                                                      |  10분마다 쓰기
                                                      v
                                              [Supabase DB (무료)]
                                                      ^  판정 시 읽기 (HTTPS)
                                                      |
                                        [board 화면 (Vercel, 브라우저)]
```

## 파일 구조
```
board/
  index.html      # 전광판 화면 (로고/시계/판정배너/평균온도/공정별 값/테스트패널)
  css/style.css   # 대형 화면용 스타일
  js/board.js     # 판정 로직 + Supabase 조회 + 자동 갱신 + 테스트 패널
  assets/logo.png # 존슨일렉트릭 로고 (Vercel에는 board 폴더만 배포되므로 반드시 이 안에 있어야 함)
collector/
  poll.js         # Air365 API 수집 스크립트 (GitHub Actions에서 10분마다 실행)
  config.js       # Air365/Supabase 계정 정보 + 센서 serialNo→공정명 매핑
  .env.example    # 로컬에서 poll.js 수동 테스트할 때 참고용 (GitHub Actions는 Secrets 사용)
database/
  schema.sql      # Supabase에서 실행할 테이블 정의 (readings: 원시 측정값, decisions: 판정 시각별 확정 기록)
.github/workflows/
  collect.yml     # 10분마다 collector/poll.js 실행하는 GitHub Actions 워크플로우
beacon/
  control.js      # 경광등(스마트플러그) 제어 스크립트, 전광판 PC에서 상시 실행
  config.js       # Tapo 계정/IP + 판정 기준값
  run.bat         # Windows에서 상시 실행 + 자동 재시작용 배치 파일
```

## 로컬 확인 방법 (지금 바로 가능)
`board/index.html`을 브라우저로 바로 열면 됩니다. 화면 하단 "테스트 컨트롤"에서:
- **테스트 값 사용** 체크 + 평균온도 33 이상 입력 → 빨간 "쉬는시간 부여" 확인
- 평균온도 33 미만 입력 → 초록 "쉬는시간 없음" 확인
- **시간 오버라이드**에 `23:40`, `01:00`, `08:15` 등을 넣어 자정 넘어가는 구간이나 경계 시각에서 판정 시각(T)이 올바르게 바뀌는지 확인

## 배포 (다른 컴퓨터/스크린에 띄우기)
이미 Vercel에 배포되어 있습니다: **https://board-seven-rho.vercel.app**
현장 컴퓨터 브라우저에서 이 URL을 열고 전체화면(F11) 또는 kiosk 모드로 띄우면 됩니다.
화면은 15초마다 자동으로 판정을 다시 계산해서 갱신되므로 새로고침 불필요.

코드 수정 후 재배포하려면 `board` 폴더에서:
```
npx vercel --prod
```

## 실제 데이터 연결까지 남은 절차

### 1) Supabase 프로젝트 생성 (무료, 카드 불필요)
1. https://supabase.com → GitHub 계정으로 가입 → New Project
2. Settings → API에서 `Project URL`, `anon public key`, `service_role key` 확보
3. SQL Editor에 `database/schema.sql` 내용 실행

**이미 `readings` 테이블을 만들어둔 프로젝트라면** (엑셀 다운로드 기능 추가로 `decisions` 테이블이 새로 생김), 아래 부분만 SQL Editor에서 추가로 실행하면 됩니다:
```sql
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

alter table decisions enable row level security;
create policy "public_read_decisions" on decisions for select using (true);
create policy "public_upsert_decisions" on decisions for insert with check (true);
create policy "public_update_decisions" on decisions for update using (true);
```

### 2) 업체(케이웨더)에서 연동 정보 받기
- `api_key`와 Air365 그룹 계정명(id) 발급받기 (IP 제한은 업체 쪽에서 해제해주기로 함)

### 3) 값 채워넣기
- `board/js/board.js` 상단 `SUPABASE_URL`, `SUPABASE_ANON_KEY` → Supabase 값으로 교체 → 재배포(`npx vercel --prod`)
- `collector/config.js`의 `SERIAL_TO_PROCESS` → 센서 설치 후 실제 serialNo로 교체
- GitHub 저장소 **Settings → Secrets and variables → Actions**에 아래 4개 등록:
  | 이름 | 값 |
  |---|---|
  | `AIR365_API_KEY` | 업체에서 받은 API 키 |
  | `AIR365_GROUP_ID` | 업체에서 받은 Air365 그룹 계정명 |
  | `SUPABASE_URL` | Supabase Project URL |
  | `SUPABASE_SERVICE_KEY` | Supabase service_role key |

이 Secrets 4개만 등록하면 `.github/workflows/collect.yml`이 10분마다 자동으로 돌기 시작합니다. GitHub Actions 탭에서 "Run workflow" 버튼으로 수동 테스트도 가능합니다.

## 호출량 참고
Air365 API는 1일 1500회 한도. 10분 주기 1콜(그룹 전체 조회) = **하루 144회, 한도의 약 10%**만 사용 — 여유 충분.

## 경광등 연동 (선택 사항)

쉬는시간 부여 시 실제 경광등이 켜지도록 하는 기능. 전광판을 띄우는 PC와 같은 공장 와이파이에 있는 것을 전제로 함.

### 준비물
1. **회전경광등** (AC220V, 콘센트 플러그 타입) — 국내 쇼핑몰에서 "회전경광등 220V" 검색. 전원만 넣으면 자동으로 돌아가는 제품이면 됨. 단자대(배선) 타입 말고 **플러그 타입**으로 구매 (배선 작업/감전 위험 없음).
2. **TP-Link Tapo P100** 스마트 플러그 — 경광등을 이 플러그에 꽂고, 플러그를 벽 콘센트에 꽂음.
3. Tapo 앱으로 스마트 플러그를 공유기 와이파이에 연결 (최초 1회, 스마트폰 앱으로 진행)
4. 공유기 관리 페이지에서 이 플러그에 **고정 IP(DHCP 예약)** 할당 — 나중에 IP가 바뀌면 제어가 안 되므로 꼭 필요

### 설정
`beacon` 폴더에서 `.env.example`을 `.env`로 복사 후 채우기:
```
TAPO_EMAIL=Tapo 앱 가입 이메일
TAPO_PASSWORD=Tapo 앱 비밀번호
TAPO_IP=스마트플러그 고정 IP (예: 192.168.0.50)
```

### 실행 (전광판을 띄우는 그 PC에서)
```
cd beacon
npm install
run.bat
```
`run.bat`을 **Windows 시작프로그램**(`Win+R` → `shell:startup` → 이 배치파일 바로가기 추가)에 등록해두면 PC가 켜질 때마다 자동으로 실행되고, 중간에 오류로 꺼져도 5초 후 자동 재시작합니다.

### 동작 방식
`beacon/control.js`가 `board/js/board.js`와 동일한 판정 로직으로 15초마다 지금이 "쉬는시간 부여" 구간인지 Supabase에서 직접 확인해서, 그 결과에 따라 스마트 플러그를 켜고/끕니다 (전광판 화면과 별개로 독립 동작 — 화면이 꺼져 있어도 경광등은 정상 작동).

⚠️ 실제 Tapo 기기로 아직 테스트해보지 않은 코드입니다. 기기 구매/연결 후 `node control.js`로 직접 실행해서 콘솔 로그를 같이 확인하며 점검하는 걸 권장합니다.

## 안전장치
- `board/js/board.js`의 Supabase 조회는 5초 타임아웃 — 응답이 없으면 자동으로 mock값으로 전환되어 화면이 멈추지 않음
- 테스트 패널은 실사용 전 `board/index.html`의 `test-panel` 섹션과 `board/js/board.js`의 관련 코드를 삭제하면 됨 (지금은 검증용으로 유지)
