# MCM Passport — Style Journey

Manyfast의 `MCM Passport 스타일 여정` PRD·Feature 슬롯·User Flow v2, 최신 Figma 모바일 와이어프레임, 2026-08-18 API/ERD 문서를 기준으로 만든 Next.js 모바일 웹입니다.

## 실행

```bash
npm install
npm run dev
```

기본 상태에서는 별도 서버 없이 API 계약과 동일한 ID/응답 구조의 데모 데이터로 실행됩니다.

## Backend 연결

`.env.example`을 `.env.local`로 복사하고 Backend origin을 입력합니다.

```bash
NEXT_PUBLIC_API_BASE_URL=/backend
BACKEND_ORIGIN=https://hackathonback.devdlfjstizlzl.xyz
NEXT_PUBLIC_PASSPORT_CARD_UID=MCM-GUIDE-TEST-001
NEXT_PUBLIC_DEMO_PRODUCT_ID=1
NEXT_PUBLIC_NFC_BAG_1_PRODUCT_ID=1
NEXT_PUBLIC_NFC_BAG_1_NAME=Stark Backpack
NEXT_PUBLIC_NFC_BAG_2_PRODUCT_ID=2
NEXT_PUBLIC_NFC_BAG_2_NAME=Aren Shopper
```

브라우저는 `/backend` 동일 출처 경로를 사용하고 Next.js가 `BACKEND_ORIGIN`의 배포 서버로 프록시합니다. `NEXT_PUBLIC_API_BASE_URL`이 설정되면 데모 fallback을 사용하지 않고 실제 API 오류를 화면에 표시합니다.
기본 카드 UID는 Backend의 reference data가 생성하는 `MCM-GUIDE-TEST-001`과 일치해야 합니다.

## NFC 스티커 설정

배포된 HTTPS 사이트의 `/nfc-setup`을 Web NFC를 지원하는 Android Chrome에서 엽니다. 화면 순서대로 `사이트 입장`, `가방 01`, `가방 02` 스티커를 기록할 수 있습니다. 가방별 Backend Product ID를 입력하고 상품 정보가 정상 조회되는지 확인한 뒤 기록합니다.

- 사이트 입장 스티커는 새 Passport 여정을 열고 이전 방문 기록을 초기화합니다.
- 가방 스티커는 해당 Product ID만 전달합니다. 태그 시 `GET /api/products/{productId}`로 이름, 카테고리, 색상, 소재, 실루엣과 이미지를 조회한 뒤 진행 중 세션에 연결합니다.
- Web NFC 읽기·쓰기는 Android Chrome과 HTTPS(로컬 개발은 localhost)에서 동작합니다. iPhone은 기록 페이지 대신 NFC URL 태그를 여는 방식으로 이용합니다.
- 스티커는 기록과 동작 테스트를 마친 뒤 부착하고, 금속 장식 바로 위는 피합니다.

## 반영한 API 계약

- `POST /api/passport-sessions`으로 Passport Session 생성
- Journey Spot 상세 응답의 `journeySpotId`, `questionId`, `optionId`, `required`를 동적으로 사용
- Guide 답변은 동일한 PUT API로 생성 및 수정
- 필수 질문 완료 후 Journey Stamp 생성
- Product Tag는 선택 기능이며 Boarding 조건에 포함하지 않음
- `styleSpotId`는 숫자가 아닌 `GATE-S1` 문자열 사용
- Style Spot Connect의 200 응답에 포함된 Style Result를 바로 렌더링
- `usedFallback=true`도 정상 결과로 처리
- Style Portrait는 `portraitImageUrl` 쿼리 값이 전달된 경우에만 `consent: true`로 선택 저장
- Souvenir 생성의 200/201을 모두 성공으로 처리
- API 오류는 공통 `ErrorResponse`의 `message`를 사용자에게 표시

## 화면 흐름

1. NFC Passport 활성화 또는 NFC 실패 시 QR 대체 진입
2. 여정 데이터 필수 동의와 Style Portrait 선택 동의
3. AI Guide의 Journey Map에서 첫 Spot 선택
4. 오늘의 Mood Signal과 Origin Gate의 MCM 여행 DNA 질문
5. Origin Stamp 획득
6. Material Lounge의 소재 및 Color & Pattern 질문과 Material Stamp
7. Movement Deck의 착용 장면 질문과 Movement Stamp
8. City Mood Room의 도시 감각 질문과 City Mood Stamp
9. 선택적 Product Tagging과 제품별 선호 이유 수집
10. Journey Signal 요약과 Private Boarding Pass
11. Style Spot `GATE-S1`의 NFC 태깅, QR 재연결 및 Journey Host 도움 경로
12. 연결 후 Journey Signal 분석 중 화면
13. City Code, 추천 제품, Style Mood와 사전 제작 개인화 배경 공개
14. 명시적 동의 기반 Style Portrait 선택 저장
15. Journey Souvenir 생성 후 My Passport에 명시적으로 저장
16. City Code 커스터마이징 Benefit, 추천 제품 링크와 MCM 온라인 계정 취향 저장

Journey Host 태블릿 운영 화면은 Manyfast 문서에는 정의되어 있지만 고객 모바일 웹 MVP 범위에서는 제외했습니다. MCM 온라인 계정 저장은 백엔드 계약이 추가되기 전까지 UI 데모 상태로 동작합니다.

진행 상태는 `localStorage`에서 라이브·데모 모드별 키로 분리해 저장됩니다.
