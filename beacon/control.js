import { createClient } from '@supabase/supabase-js';
import { loginDeviceByIp } from 'tp-link-tapo-connect';
import { CONFIG } from './config.js';

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// 판정 시각(T) -> 화면 전환 시각(T-30분) 매핑, 오름차순 정렬 (board/js/board.js와 동일 로직)
const REVEAL_TABLE = CONFIG.FIXED_TIMES
  .map(T => ({ T, revealMinutes: T * 60 - 30 }))
  .sort((a, b) => a.revealMinutes - b.revealMinutes);

function getSeoulParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  let hour = +parts.hour;
  if (hour === 24) hour = 0;
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour, minute: +parts.minute };
}

function getActiveT(nowMinutes) {
  for (let i = REVEAL_TABLE.length - 1; i >= 0; i--) {
    if (nowMinutes >= REVEAL_TABLE[i].revealMinutes) return REVEAL_TABLE[i].T;
  }
  return REVEAL_TABLE[REVEAL_TABLE.length - 1].T;
}

// KST 특정 시:분을 UTC ISO로 변환 (KST = UTC+9, DST 없음)
function seoulHMToUTCISO(parts, h, m) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, h - 9, m, 0)).toISOString();
}

// 지금이 "쉬는시간 부여" 구간(T~T+10)이고, 그 판정이 실제로 부여였는지 확인
async function shouldLightBeOn() {
  const parts = getSeoulParts();
  const nowMinutes = parts.hour * 60 + parts.minute;
  const T = getActiveT(nowMinutes);

  const inBreakWindow = nowMinutes >= T * 60 && nowMinutes < T * 60 + 10;
  if (!inBreakWindow) return false;

  const windowStart = seoulHMToUTCISO(parts, T - 1, 0);
  const windowEnd = seoulHMToUTCISO(parts, T - 1, 30);

  const { data, error } = await supabase
    .from('readings')
    .select('sense_temp')
    .gte('recorded_at', windowStart)
    .lt('recorded_at', windowEnd);

  if (error || !data || !data.length) return false;

  const avg = data.reduce((sum, r) => sum + r.sense_temp, 0) / data.length;
  return avg >= CONFIG.THRESHOLD;
}

async function main() {
  console.log('경광등 제어 시작... Tapo 플러그 연결 중');
  const device = await loginDeviceByIp(CONFIG.TAPO_EMAIL, CONFIG.TAPO_PASSWORD, CONFIG.TAPO_IP);
  console.log('연결 완료');

  let lastState = null;

  async function tick() {
    try {
      const on = await shouldLightBeOn();
      if (on !== lastState) {
        if (on) await device.turnOn();
        else await device.turnOff();
        lastState = on;
        console.log(`[${new Date().toLocaleString('ko-KR')}] 경광등 ${on ? 'ON (쉬는시간 부여)' : 'OFF'}`);
      }
    } catch (e) {
      console.error('제어 실패:', e.message);
    }
  }

  await tick();
  setInterval(tick, CONFIG.CHECK_INTERVAL_MS);
}

main().catch(err => {
  console.error('시작 실패:', err.message);
  process.exit(1);
});
