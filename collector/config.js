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

// 센서 설치 위치 확인 완료 (2026-07-07)
// board/js/board.js의 PROCESS_NAMES와 이름을 맞춰야 화면에 그대로 매칭됨
export const SERIAL_TO_PROCESS = {
  'IST4W2600563': '1P 성형',
  'IST4W2600564': '1P 소결',
  'IST4W2600557': '1P 후처리',
  'IST4W2600562': '2P 성형',
  'IST4W2600561': '2P 소결',
  'IST4W2600559': '2P 후처리',
};
