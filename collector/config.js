// =============================================
// 설정 - 계정 정보 받으면 여기 채우기
// =============================================

export const CONFIG = {
  // Air365 (케이웨더) - 실측 테스트로 확인된 실제 게이트웨이 주소 (규격서 문서와 다름)
  AIR365_API_URL: 'https://gateway3.kweather.co.kr:8443/iot/groups/v2/last-all',
  AIR365_API_KEY: process.env.AIR365_API_KEY || 'YOUR_AIR365_API_KEY',
  AIR365_ID_TYPE: process.env.AIR365_ID_TYPE || 'USER', // 개인 계정 = USER, 그룹 계정 = GROUP
  AIR365_ID: process.env.AIR365_ID || 'YOUR_AIR365_ID', // 예: jiyoung.park@johnsonelectric.com

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || 'YOUR_SUPABASE_SERVICE_KEY',
};

// 센서 설치 후 실제 serialNo로 교체 (실측 응답의 "serialNo" 필드 기준)
// board/js/board.js의 PROCESS_NAMES와 이름을 맞춰야 화면에 그대로 매칭됨
// TODO: 아래 6개는 2026-07-07 테스트 시점에 데이터가 갱신되고 있던 센서를 순서 없이 임시 배정한 것.
//       실제 어느 시리얼이 어느 공정에 설치됐는지 확인되면 순서를 맞춰야 함.
export const SERIAL_TO_PROCESS = {
  'IST4W2600557': '1P 성형-소결',
  'IST4W2600559': '1P 소결-정형',
  'IST4W2600561': '1P 후처리',
  'IST4W2600562': '2P 성형-소결',
  'IST4W2600563': '2P 소결-정형',
  'IST4W2600564': '2P 선별포장',
};
