// =============================================
// 설정 - 값 채우기
// =============================================
export const CONFIG = {
  // Supabase (board와 동일한 값, anon key라 안전함)
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://bdbhgcivycrmqtybszdv.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'sb_publishable_Sf-AS6Z0dXWTMC-STRFcSg_M6VU7TOa',

  // Tapo 스마트 플러그 - Tapo 앱에 가입한 계정 정보 + 플러그의 공유기 내부 IP
  // (공유기 관리 화면에서 이 플러그에 고정 IP를 할당해두는 것을 권장 - IP가 바뀌면 제어 안 됨)
  TAPO_EMAIL: process.env.TAPO_EMAIL || 'YOUR_TAPO_ACCOUNT_EMAIL',
  TAPO_PASSWORD: process.env.TAPO_PASSWORD || 'YOUR_TAPO_ACCOUNT_PASSWORD',
  TAPO_IP: process.env.TAPO_IP || 'YOUR_SMART_PLUG_LOCAL_IP', // 예: 192.168.0.50

  // 판정 로직 (board/js/board.js와 동일하게 유지)
  FIXED_TIMES: [1, 3, 7, 9, 11, 15, 17, 19, 23],
  THRESHOLD: 33,

  CHECK_INTERVAL_MS: 15000, // 15초마다 판정 재확인
};
