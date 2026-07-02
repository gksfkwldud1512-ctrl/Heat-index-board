import { createClient } from '@supabase/supabase-js';
import { CONFIG, SERIAL_TO_PROCESS } from './config.js';

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_KEY);

// Air365 "최신값" 조회 - 그룹에 등록된 센서 전체를 한 번에 반환
// (규격서: KW_Air365 IoT데이터 API 규격서_v1.6.pdf, 2.2 상세기능 내역)
async function fetchLatest() {
  const url = `${CONFIG.AIR365_API_URL}?stationType=ALL&idType=GROUP` +
    `&id=${encodeURIComponent(CONFIG.AIR365_GROUP_ID)}&api_key=${CONFIG.AIR365_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Air365 API 오류: ${res.status}`);

  const data = await res.json();
  if (String(data.error) !== '0') throw new Error(`Air365 응답 오류: ${data.message}`);

  return data.result?.iaq_list ?? [];
}

// serialNo -> 공정명 매핑되는 것만, sense_temp(체감온도) 있는 것만 사용
function toRows(iaqList) {
  return iaqList
    .filter(d => SERIAL_TO_PROCESS[d.serialNo] && d.sense_temp != null)
    .map(d => ({
      process_name: SERIAL_TO_PROCESS[d.serialNo],
      sense_temp: d.sense_temp,
    }));
}

async function main() {
  console.log('체감온도 수집 시작...');

  const iaqList = await fetchLatest();
  const rows = toRows(iaqList);

  if (!rows.length) {
    console.warn(
      `매핑된 센서 데이터 없음 (수신 ${iaqList.length}건) - config.js의 SERIAL_TO_PROCESS 확인 필요`
    );
    return;
  }

  const { error } = await supabase.from('readings').insert(rows);
  if (error) throw error;

  console.log(`저장 완료 (${rows.length}건):`, rows.map(r => `${r.process_name}=${r.sense_temp}`).join(', '));
}

main().catch(err => {
  console.error('수집 실패:', err.message);
  process.exit(1);
});
