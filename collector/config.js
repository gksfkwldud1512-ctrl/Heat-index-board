// =============================================
// 설정 - 계정 정보 받으면 여기 채우기
// =============================================

export const CONFIG = {
  // Air365 (케이웨더) - 업체에서 발급받는 값
  AIR365_API_URL: 'https://gateway.kweather.co.kr:8443/iot/groups/v2/last-all',
  AIR365_API_KEY: process.env.AIR365_API_KEY || 'YOUR_AIR365_API_KEY',
  AIR365_GROUP_ID: process.env.AIR365_GROUP_ID || 'YOUR_AIR365_GROUP_ID', // 예: xxx@company.kr

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || 'YOUR_SUPABASE_SERVICE_KEY',
};

// 센서 설치 후 실제 serialNo로 교체 (규격서 응답의 "serialNo" 필드 기준)
// board/js/board.js의 PROCESS_NAMES와 이름을 맞춰야 화면에 그대로 매칭됨
export const SERIAL_TO_PROCESS = {
  'SERIAL_1P_SEONGHYEONG_SOGYEOL': '1P 성형-소결',
  'SERIAL_1P_SOGYEOL_JEONGHYEONG': '1P 소결-정형',
  'SERIAL_1P_HUCHEORI': '1P 후처리',
  'SERIAL_2P_SEONGHYEONG_SOGYEOL': '2P 성형-소결',
  'SERIAL_2P_SOGYEOL_JEONGHYEONG': '2P 소결-정형',
  'SERIAL_2P_SEONBYEOL_POJANG': '2P 선별포장',
};
