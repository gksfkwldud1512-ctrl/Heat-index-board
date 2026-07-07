// =============================================
// 설정값 - 나중에 실제 값으로 교체
// =============================================
const FIXED_TIMES = [1, 3, 7, 9, 11, 15, 17, 19, 23]; // 판정 시각 (시)
const THRESHOLD = 33;                       // 쉬는시간 부여 기준 (평균 체감온도)
const PROCESS_NAMES = [
  '1P 성형',
  '1P 소결',
  '1P 후처리',
  '2P 성형',
  '2P 소결',
  '2P 후처리',
];

const TICK_MS = 15000; // 판정 재계산 주기
const CLOCK_MS = 1000; // 시계만 갱신하는 주기

// =============================================
// Supabase 설정 - collector 연동 시 여기 두 값만 채우면 자동으로 실데이터 사용
// (anon public key만 쓰므로 브라우저에 노출돼도 안전함, 쓰기는 RLS로 막혀있음)
// =============================================
const SUPABASE_URL = 'https://bdbhgcivycrmqtybszdv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Sf-AS6Z0dXWTMC-STRFcSg_M6VU7TOa';

const supabaseClient = (SUPABASE_URL.startsWith('http') && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// 판정 시각(T) -> 화면 전환 시각(T-30분, 분 단위) 매핑, 오름차순 정렬
const REVEAL_TABLE = FIXED_TIMES
  .map(T => ({ T, revealMinutes: T * 60 - 30 }))
  .sort((a, b) => a.revealMinutes - b.revealMinutes);

const pad2 = n => String(n).padStart(2, '0');
const fmtHM = (h, m) => `${pad2(h)}:${pad2(m)}`;

// -------------------------------------------
// 시간 계산 (Asia/Seoul 고정, 전광판 PC의 OS 시간대 설정에 의존하지 않음)
// -------------------------------------------
function getSeoulParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  let hour = +parts.hour;
  if (hour === 24) hour = 0; // 일부 브라우저에서 자정을 24시로 반환하는 것 보정

  return {
    year: +parts.year, month: +parts.month, day: +parts.day,
    hour, minute: +parts.minute, second: +parts.second,
  };
}

const weekdayFmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' });
function getSeoulWeekday(date = new Date()) {
  return weekdayFmt.format(date); // 예: '월', '화' ...
}

// parts(오늘 날짜, Seoul 기준)의 특정 시:분을 UTC ISO 문자열로 변환 (KST = UTC+9, DST 없음)
function seoulHMToUTCISO(parts, h, m) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, h - 9, m, 0)).toISOString();
}

// 현재 시각이 어느 판정 세그먼트에 속하는지 계산 (자정 넘어가는 구간 포함, 순환 처리)
function getActiveT(nowMinutes) {
  for (let i = REVEAL_TABLE.length - 1; i >= 0; i--) {
    if (nowMinutes >= REVEAL_TABLE[i].revealMinutes) return REVEAL_TABLE[i].T;
  }
  // 첫 세그먼트의 reveal 시각보다 이른 새벽 시간대 -> 전날 마지막 세그먼트 결과 유지
  return REVEAL_TABLE[REVEAL_TABLE.length - 1].T;
}

// -------------------------------------------
// 데이터 연결 지점
// -------------------------------------------

// 판정 시각 T의 측정창(T-1시 00분~30분) 원시 데이터 조회 (parts는 조회할 날짜, Seoul 기준)
async function queryWindowReadings(parts, T) {
  if (!supabaseClient) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 응답 지연 시 5초 후 포기
  try {
    const startISO = seoulHMToUTCISO(parts, T - 1, 0);
    const endISO = seoulHMToUTCISO(parts, T - 1, 30);

    const { data, error } = await supabaseClient
      .from('readings')
      .select('process_name, sense_temp')
      .gte('recorded_at', startISO)
      .lt('recorded_at', endISO)
      .abortSignal(controller.signal);

    if (error) throw error;
    if (data && data.length) {
      return data.map(r => ({ name: r.process_name, value: r.sense_temp }));
    }
    return null;
  } catch (e) {
    console.error(`Supabase 조회 실패 (T=${T}시):`, e.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 우선순위: 테스트 패널 값 > Supabase 실데이터 > 임시(mock)값
async function fetchWindowData(parts, T) {
  if (testState.enabled) {
    return buildMockReadings(testState.avg);
  }

  const readings = await queryWindowReadings(parts, T);
  if (readings) return readings;

  return buildMockReadings(28 + Math.random() * 3);
}

function buildMockReadings(avg) {
  return PROCESS_NAMES.map(name => ({
    name,
    value: +(avg + (Math.random() - 0.5) * 2).toFixed(1),
  }));
}

function computeDecision(readings) {
  const avg = readings.reduce((sum, r) => sum + r.value, 0) / readings.length;
  return { avg: +avg.toFixed(1), granted: avg >= THRESHOLD };
}

// -------------------------------------------
// 오늘 하루 9개 판정 시각의 현황 (상단 스트립 + 엑셀용 기록)
// -------------------------------------------
const dailyCache = { dateKey: null, results: {} };

function dateKeyOf(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

async function upsertDecision(parts, T, avg, granted) {
  if (!supabaseClient) return;
  try {
    const { error } = await supabaseClient.from('decisions').upsert(
      { log_date: dateKeyOf(parts), judgment_hour: T, avg_temp: avg, granted },
      { onConflict: 'log_date,judgment_hour' }
    );
    if (error) throw error;
  } catch (e) {
    console.error(`decisions 기록 실패 (T=${T}시):`, e.message);
  }
}

async function computeDailyStatus(parts, nowMinutes) {
  const key = dateKeyOf(parts);
  if (dailyCache.dateKey !== key) {
    dailyCache.dateKey = key;
    dailyCache.results = {};
  }

  const sortedTimes = [...FIXED_TIMES].sort((a, b) => a - b);
  const statuses = [];

  for (const T of sortedTimes) {
    const revealMinutes = T * 60 - 30;

    if (nowMinutes < revealMinutes) {
      statuses.push({ T, status: 'pending' });
      continue;
    }

    if (dailyCache.results[T]) {
      statuses.push({ T, status: dailyCache.results[T].granted ? 'granted' : 'not-granted' });
      continue;
    }

    // 테스트 모드: 실 데이터를 건드리지 않고 미리보기만 (DB에 기록하지 않음)
    if (testState.enabled) {
      statuses.push({ T, status: testState.avg >= THRESHOLD ? 'granted' : 'not-granted' });
      continue;
    }

    const readings = await queryWindowReadings(parts, T);
    if (!readings) {
      statuses.push({ T, status: 'no-data' });
      continue;
    }

    const avg = +(readings.reduce((sum, r) => sum + r.value, 0) / readings.length).toFixed(1);
    const granted = avg >= THRESHOLD;
    dailyCache.results[T] = { avg, granted };
    statuses.push({ T, status: granted ? 'granted' : 'not-granted' });

    await upsertDecision(parts, T, avg, granted);
  }

  return statuses;
}

function renderDailyStatus(statuses) {
  const strip = document.getElementById('daily-status-strip');
  const labelOf = {
    granted: '부여',
    'not-granted': '미부여',
    pending: '미측정',
    'no-data': '데이터없음',
  };

  strip.innerHTML = '';
  statuses.forEach(({ T, status }) => {
    const box = document.createElement('div');
    box.className = 'status-box' + (status === 'granted' || status === 'not-granted' ? ` ${status}` : '');
    box.innerHTML = `<div class="hour">${pad2(T)}시</div><div class="label">${labelOf[status]}</div>`;
    strip.appendChild(box);
  });
}

// -------------------------------------------
// 렌더링
// -------------------------------------------
function render(state) {
  document.getElementById('clock').textContent =
    `${pad2(state.parts.hour)}:${pad2(state.parts.minute)}:${pad2(state.parts.second)}`;
  document.getElementById('date').textContent =
    `${state.parts.year}년 ${pad2(state.parts.month)}월 ${pad2(state.parts.day)}일 (${getSeoulWeekday()})`;

  const screen = document.getElementById('screen');
  screen.className = 'screen ' + (state.decision.granted ? 'state-granted' : 'state-not-granted');

  document.getElementById('banner-time').textContent = state.breakLabel;
  document.getElementById('banner-text').textContent =
    state.decision.granted ? '쉬는시간 부여' : '쉬는시간 없음';

  document.getElementById('avg-temp').textContent = `${state.decision.avg}°C`;

  renderDailyStatus(state.dailyStatus);

  const grid = document.getElementById('process-grid');
  grid.innerHTML = '';
  state.readings.forEach(r => {
    const cell = document.createElement('div');
    cell.className = 'process-cell' + (r.value >= THRESHOLD ? ' over' : '');
    cell.innerHTML = `<div class="name">${r.name}</div><div class="value">${r.value}°C</div>`;
    grid.appendChild(cell);
  });

  drawConnectors();
}

// 평균온도 카드에서 각 공정 셀로 이어지는 연결선을 그림 (공정별 값이 평균에 반영됨을 시각적으로 표시)
function drawConnectors() {
  const wrap = document.getElementById('diagram-wrap');
  const svg = document.getElementById('connector-svg');
  const avgCard = document.getElementById('info-card');
  const cells = document.querySelectorAll('#process-grid .process-cell');
  if (!wrap || !svg || !avgCard || !cells.length) return;

  const svgNS = 'http://www.w3.org/2000/svg';
  const wrapRect = wrap.getBoundingClientRect();
  const avgRect = avgCard.getBoundingClientRect();
  const fromX = avgRect.left + avgRect.width / 2 - wrapRect.left;
  const fromY = avgRect.bottom - wrapRect.top;

  svg.innerHTML = '';
  cells.forEach(cell => {
    const r = cell.getBoundingClientRect();
    const toX = r.left + r.width / 2 - wrapRect.left;
    const toY = r.top - wrapRect.top;
    const midY = fromY + (toY - fromY) / 2;

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`);
    path.setAttribute('stroke', '#a7b2c9');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    svg.appendChild(path);

    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', toX);
    dot.setAttribute('cy', toY);
    dot.setAttribute('r', 3.5);
    dot.setAttribute('fill', '#a7b2c9');
    svg.appendChild(dot);
  });
}

function updateClockOnly() {
  const parts = getCurrentParts();
  document.getElementById('clock').textContent =
    `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
  document.getElementById('date').textContent =
    `${parts.year}년 ${pad2(parts.month)}월 ${pad2(parts.day)}일 (${getSeoulWeekday()})`;
}

// -------------------------------------------
// 측정기준 안내 패널
// -------------------------------------------
function setupCriteriaModal() {
  const overlay = document.getElementById('criteria-overlay');
  const openBtn = document.getElementById('criteria-btn');
  const closeBtn = document.getElementById('criteria-close');

  openBtn.addEventListener('click', () => overlay.classList.add('open'));
  closeBtn.addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
}

// -------------------------------------------
// 엑셀 다운로드 (10분 단위 원시 기록 + 판정 시각에만 부여여부 표시)
// -------------------------------------------

// Supabase 기본 조회 한도(1000행)를 넘어서도 전체를 가져오기 위한 페이지네이션
async function fetchAllRows(table, select, orderCol) {
  const pageSize = 1000;
  let all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabaseClient
      .from(table)
      .select(select)
      .order(orderCol, { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function exportToExcel() {
  if (!supabaseClient) {
    alert('Supabase가 연결되어 있지 않습니다.');
    return;
  }

  let readings, decisions;
  try {
    [readings, decisions] = await Promise.all([
      fetchAllRows('readings', 'recorded_at, process_name, sense_temp', 'recorded_at'),
      fetchAllRows('decisions', 'log_date, judgment_hour, granted', 'log_date'),
    ]);
  } catch (e) {
    alert('기록을 불러오지 못했습니다: ' + e.message);
    return;
  }

  if (!readings.length) {
    alert('아직 내보낼 기록이 없습니다.');
    return;
  }

  const decisionMap = new Map();
  decisions.forEach(d => decisionMap.set(`${d.log_date}_${d.judgment_hour}`, d.granted));

  // 정확히 같은 수집 시각(recorded_at)끼리 한 행으로 묶기
  const groups = new Map();
  readings.forEach(r => {
    if (!groups.has(r.recorded_at)) groups.set(r.recorded_at, {});
    groups.get(r.recorded_at)[r.process_name] = r.sense_temp;
  });

  const rows = [...groups.entries()].map(([recordedAt, values]) => {
    const parts = getSeoulParts(new Date(recordedAt));
    const dateStr = dateKeyOf(parts);

    const temps = Object.values(values);
    const avg = temps.length ? +(temps.reduce((s, v) => s + v, 0) / temps.length).toFixed(1) : '';

    // 휴식시간 부여여부는 실제 판정 시각(정각, FIXED_TIMES)에만 표시 - 그 외 10분 단위 행은 비움
    let breakStatus = '';
    if (parts.minute === 0 && FIXED_TIMES.includes(parts.hour)) {
      const key = `${dateStr}_${parts.hour}`;
      if (decisionMap.has(key)) {
        breakStatus = decisionMap.get(key) ? '쉬는시간 부여' : '쉬는시간 없음';
      }
    }

    const row = { '날짜': dateStr, '시간': fmtHM(parts.hour, parts.minute) };
    PROCESS_NAMES.forEach(name => {
      row[`${name}(℃)`] = values[name] != null ? values[name] : '';
    });
    row['평균 체감온도(℃)'] = avg;
    row['쉬는시간 부여여부'] = breakStatus;
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '체감온도 기록');
  XLSX.writeFile(wb, `체감온도_기록_${dateKeyOf(getSeoulParts())}.xlsx`);
}

function setupExcelButton() {
  document.getElementById('excel-btn').addEventListener('click', exportToExcel);
}

// -------------------------------------------
// 테스트 패널 상태 (하드웨어 연결 전 화면 확인용 - 배포 시 board/index.html의
// test-panel 섹션과 이 블록을 함께 제거하면 됩니다)
// -------------------------------------------
const testState = { enabled: false, avg: 34.0, timeOverride: null };

function getCurrentParts() {
  if (testState.timeOverride) {
    const [h, m] = testState.timeOverride.split(':').map(Number);
    return { ...getSeoulParts(), hour: h, minute: m, second: 0 };
  }
  return getSeoulParts();
}

function setupTestPanel() {
  const enabledEl = document.getElementById('test-enabled');
  const avgEl = document.getElementById('test-avg');
  const timeEl = document.getElementById('test-time');
  const applyBtn = document.getElementById('test-apply');

  applyBtn.addEventListener('click', () => {
    testState.enabled = enabledEl.checked;
    testState.avg = parseFloat(avgEl.value) || 0;
    const t = timeEl.value.trim();
    testState.timeOverride = /^\d{1,2}:\d{2}$/.test(t) ? t : null;
    tick();
  });
}

// -------------------------------------------
// 메인 루프
// -------------------------------------------
async function tick() {
  const parts = getCurrentParts();
  const nowMinutes = parts.hour * 60 + parts.minute;
  const T = getActiveT(nowMinutes);

  const windowStart = { h: T - 1, m: 0 };
  const windowEnd = { h: T - 1, m: 30 };
  const breakStart = { h: T, m: 0 };
  const breakEnd = { h: T, m: 10 };

  const readings = await fetchWindowData(parts, T);
  const decision = computeDecision(readings);
  const dailyStatus = await computeDailyStatus(parts, nowMinutes);

  render({
    parts, T, readings, decision, dailyStatus,
    windowLabel: `${fmtHM(windowStart.h, windowStart.m)} ~ ${fmtHM(windowEnd.h, windowEnd.m)}`,
    breakLabel: `${fmtHM(breakStart.h, breakStart.m)} ~ ${fmtHM(breakEnd.h, breakEnd.m)}`,
  });
}

function start() {
  setupTestPanel();
  setupCriteriaModal();
  setupExcelButton();
  tick();
  setInterval(tick, TICK_MS);
  setInterval(updateClockOnly, CLOCK_MS);
  window.addEventListener('resize', drawConnectors);
}

start();
