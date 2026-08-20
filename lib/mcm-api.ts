export type PassportStatus = "EXPLORING" | "READY_TO_BOARD" | "STYLE_SPOT" | "COMPLETED";

export type GuideOption = {
  id: number;
  code: string;
  label: string;
  sequence: number;
};

export type GuideQuestion = {
  id: number;
  code: string;
  questionText: string;
  required: boolean;
  sequence: number;
  options: GuideOption[];
};

export type JourneySpot = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  sequence: number;
  required: boolean;
  completed?: boolean;
  stampedAt?: string | null;
  questions: GuideQuestion[];
};

export type PassportSession = {
  passportSessionId: number;
  status: PassportStatus;
  startedAt: string;
  completedAt?: string | null;
};

export type JourneyStamp = {
  journeyStampId: number;
  journeySpotId: number;
  stampedAt: string;
};

export type Product = {
  id: number;
  code: string;
  name: string;
  category: string;
  description?: string | null;
  color?: string | null;
  material?: string | null;
  silhouette?: string | null;
  imageUrl?: string | null;
  recommendable?: boolean;
};

export type BoardingPass = {
  boardingPassId: number;
  passportSessionId: number;
  gate: string;
  issuedAt: string;
};

export type StyleResult = {
  id: number;
  passportSessionId: number;
  cityCode: string;
  cityCodeName: string;
  recommendedProductCode: string;
  recommendedProductName: string;
  styleMood: string;
  styleMoodName: string;
  backgroundCode: string;
  backgroundName: string;
  backgroundAssetKey: string;
  description: string;
  matchScore: number;
  usedFallback: boolean;
  createdAt: string;
};

export type StyleSpotConnectResponse = {
  styleSpotSessionId: number;
  styleSpotId: string;
  passportSessionId: number;
  status: "RESULT";
  styleResult: StyleResult;
};

export type JourneySouvenir = {
  id: number;
  passportSessionId: number;
  styleResultId: number;
  cityCode: string;
  cityCodeName: string;
  recommendedProductCode: string;
  recommendedProductName: string;
  styleMood: string;
  styleMoodName: string;
  backgroundCode: string;
  backgroundName: string;
  backgroundAssetKey: string;
  journeyStamps: string[];
  taggedProductCodes: string[];
  createdAt: string;
};

export type StylePortrait = {
  id: number;
  passportSessionId: number;
  imageUrl: string;
  consent: true;
  createdAt: string;
};

export type ErrorResponse = {
  timestamp: string;
  status: number;
  code: string;
  message: string;
  path: string;
  errors: Array<{ field?: string; message?: string }>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = "UNKNOWN_API_ERROR",
    public details: ErrorResponse | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
export const passportCardUid = process.env.NEXT_PUBLIC_PASSPORT_CARD_UID ?? "MCM-GUIDE-TEST-001";
export const isLiveApi = Boolean(API_BASE_URL);
const browserCardStorageKey = "mcm-passport-browser-card-uid-v3";

export function getPassportCardUid() {
  if (typeof window === "undefined" || passportCardUid !== "MCM-GUIDE-TEST-001") return passportCardUid;
  const existing = window.localStorage.getItem(browserCardStorageKey);
  if (existing) return existing;
  const issued = `MCM-WEB-${window.crypto.randomUUID()}`;
  window.localStorage.setItem(browserCardStorageKey, issued);
  return issued;
}

export function resetVirtualPassportCardUid() {
  if (typeof window !== "undefined" && passportCardUid === "MCM-GUIDE-TEST-001") {
    window.localStorage.removeItem(browserCardStorageKey);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  successStatuses: number[] = [200],
): Promise<T> {
  if (!API_BASE_URL) throw new ApiError("API base URL is not configured.", 0, "API_NOT_CONFIGURED");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!successStatuses.includes(response.status)) {
    let details: ErrorResponse | null = null;
    try {
      details = (await response.json()) as ErrorResponse;
    } catch {}
    throw new ApiError(
      details?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      details?.code,
      details,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const demoSpots: JourneySpot[] = [
  {
    id: 1,
    code: "ORIGIN_GATE",
    name: "Origin Gate",
    description: "MCM의 여행 DNA와 오늘의 무드",
    sequence: 1,
    required: true,
    questions: [{
      id: 11,
      code: "TODAY_MOOD",
      questionText: "오늘 어떤 무드로 여정을 시작하고 싶으신가요?",
      required: true,
      sequence: 1,
      options: [
        { id: 111, code: "ELEGANT", label: "세련되고 우아한", sequence: 1 },
        { id: 112, code: "TRENDY", label: "트렌디하고 감각적인", sequence: 2 },
        { id: 113, code: "NATURAL", label: "자유롭고 내추럴한", sequence: 3 },
        { id: 114, code: "MODERN", label: "모던하고 시크한", sequence: 4 },
      ],
    }, {
      id: 12,
      code: "ORIGIN_SIGNAL",
      questionText: "방금 들은 MCM의 이야기 중 가장 끌리는 감각은 무엇인가요?",
      required: true,
      sequence: 2,
      options: [
        { id: 121, code: "MOVEMENT", label: "자유롭게 이동하는 감각", sequence: 1 },
        { id: 122, code: "URBAN", label: "도시적인 자신감", sequence: 2 },
        { id: 123, code: "HERITAGE", label: "클래식한 헤리티지", sequence: 3 },
        { id: 124, code: "DISCOVERY", label: "새로운 장소를 발견하는 설렘", sequence: 4 },
      ],
    }],
  },
  {
    id: 2,
    code: "MATERIAL_LOUNGE",
    name: "Material Lounge",
    description: "소재, 컬러와 패턴의 감각",
    sequence: 2,
    required: true,
    questions: [{
      id: 21,
      code: "MATERIAL_SIGNAL",
      questionText: "가장 먼저 시선이 머무른 소재의 감각은 무엇인가요?",
      required: true,
      sequence: 1,
      options: [
        { id: 211, code: "LUXE", label: "은은하게 빛나는 광택", sequence: 1 },
        { id: 212, code: "SOFT", label: "부드럽고 차분한 촉감", sequence: 2 },
        { id: 213, code: "STRUCTURE", label: "단단하고 구조적인 형태", sequence: 3 },
        { id: 214, code: "GRAPHIC", label: "한눈에 보이는 아이코닉한 패턴", sequence: 4 },
      ],
    }, {
      id: 22,
      code: "COLOR_PATTERN_SIGNAL",
      questionText: "오늘 더 끌리는 컬러와 패턴 무드는 무엇인가요?",
      required: true,
      sequence: 2,
      options: [
        { id: 221, code: "AFTERDARK", label: "블랙과 다크톤", sequence: 1 },
        { id: 222, code: "HERITAGE", label: "브라운과 클래식 패턴", sequence: 2 },
        { id: 223, code: "NEUTRAL", label: "밝고 부드러운 뉴트럴 톤", sequence: 3 },
        { id: 224, code: "BOLD_GRAPHIC", label: "포인트가 되는 컬러나 그래픽", sequence: 4 },
      ],
    }],
  },
  {
    id: 3,
    code: "MOVEMENT_DECK",
    name: "Movement Deck",
    description: "가방을 들고 움직이는 나의 장면",
    sequence: 3,
    required: true,
    questions: [{
      id: 31,
      code: "MOVEMENT_SIGNAL",
      questionText: "이 가방을 들었을 때 가장 자연스럽게 떠오르는 장면은 무엇인가요?",
      required: true,
      sequence: 1,
      options: [
        { id: 311, code: "URBAN_DAILY", label: "출근길이나 학교 가는 도시 이동", sequence: 1 },
        { id: 312, code: "WEEKEND_TRAVEL", label: "주말의 짧은 여행", sequence: 2 },
        { id: 313, code: "CREATIVE_VISIT", label: "전시, 팝업, 카페 방문", sequence: 3 },
        { id: 314, code: "AFTERDARK", label: "밤의 약속이나 특별한 자리", sequence: 4 },
        { id: 315, code: "NOMAD", label: "공항과 호텔 사이를 오가는 이동", sequence: 5 },
      ],
    }],
  },
  {
    id: 4,
    code: "CITY_MOOD_ROOM",
    name: "City Mood Room",
    description: "도시의 빛, 사운드와 스타일 무드",
    sequence: 4,
    required: true,
    questions: [{
      id: 41,
      code: "CITY_SIGNAL",
      questionText: "방금 경험한 도시 무드 중 가장 강하게 남은 감각은 무엇인가요?",
      required: true,
      sequence: 1,
      options: [
        { id: 411, code: "AFTERDARK", label: "낮은 조명과 어두운 분위기", sequence: 1 },
        { id: 412, code: "ENERGY", label: "빠른 리듬과 에너지", sequence: 2 },
        { id: 413, code: "MINIMAL", label: "고요한 선과 정제된 분위기", sequence: 3 },
        { id: 414, code: "DISCOVERY", label: "낯선 공간에서 느껴지는 자유로움", sequence: 4 },
        { id: 415, code: "CLASSIC", label: "클래식하고 깊이 있는 질감", sequence: 5 },
        { id: 416, code: "GRAPHIC", label: "강한 그래픽과 선명한 이미지", sequence: 6 },
      ],
    }],
  },
];

export const nfcProducts: Product[] = [
  {
    id: Number(process.env.NEXT_PUBLIC_NFC_BAG_1_PRODUCT_ID ?? process.env.NEXT_PUBLIC_DEMO_PRODUCT_ID ?? 1),
    code: process.env.NEXT_PUBLIC_NFC_BAG_1_CODE ?? "STARK_BACKPACK",
    name: process.env.NEXT_PUBLIC_NFC_BAG_1_NAME ?? "Stark Backpack",
    category: "Backpack",
    description: "MCM의 아이코닉한 Visetos 소재와 구조적인 실루엣이 돋보이는 블랙 백팩입니다.",
    color: "Black",
    material: "Structured",
    silhouette: "Travel-ready",
    imageUrl: "/images/travel-backpack.png",
  },
  {
    id: Number(process.env.NEXT_PUBLIC_NFC_BAG_2_PRODUCT_ID ?? 2),
    code: process.env.NEXT_PUBLIC_NFC_BAG_2_CODE ?? "AREN_SHOPPER",
    name: process.env.NEXT_PUBLIC_NFC_BAG_2_NAME ?? "Aren Shopper",
    category: "Bag",
    description: "아이코닉한 Visetos 소재와 여유로운 실루엣을 담은 코냑 컬러 쇼퍼백입니다.",
    color: "Cognac",
    material: "Visetos",
    silhouette: "Everyday",
    imageUrl: "/images/figma-product-2.png",
  },
];

export const demoProduct = nfcProducts[0];

const now = () => new Date().toISOString();
const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export const mcmApi = {
  async createPassportSession(cardUid: string): Promise<PassportSession> {
    if (!isLiveApi) return { passportSessionId: 17, status: "EXPLORING", startedAt: now() };
    return request("/api/passport-sessions", {
      method: "POST",
      body: JSON.stringify({ cardUid }),
    }, [201]);
  },

  async getJourneySpots(): Promise<JourneySpot[]> {
    if (!isLiveApi) return structuredClone(demoSpots);
    const summaries = await request<Array<Omit<JourneySpot, "questions">>>("/api/journey-spots");
    return Promise.all(summaries.map(async (summary) => {
      const detail = await request<Pick<JourneySpot, "id" | "code" | "name" | "questions">>(
        `/api/journey-spots/${summary.id}`,
      );
      return { ...summary, ...detail };
    }));
  },

  async saveGuideResponse(sessionId: number, questionId: number, optionId?: number, answerText?: string): Promise<void> {
    if (!isLiveApi) return;
    await request(`/api/passport-sessions/${sessionId}/guide-responses/${questionId}`, {
      method: "PUT",
      body: JSON.stringify({ optionId, answerText }),
    });
  },

  async completeJourneySpot(sessionId: number, spotId: number): Promise<JourneyStamp> {
    if (!isLiveApi) return { journeyStampId: spotId, journeySpotId: spotId, stampedAt: now() };
    return request(`/api/passport-sessions/${sessionId}/journey-spots/${spotId}/complete`, {
      method: "POST",
    }, [201]);
  },

  async tagProduct(sessionId: number, productId: number): Promise<void> {
    if (!isLiveApi) return;
    await request(`/api/passport-sessions/${sessionId}/product-tags`, {
      method: "POST",
      body: JSON.stringify({ productId }),
    }, [201]);
  },

  async getProduct(productId: number): Promise<Product> {
    if (!isLiveApi) {
      return structuredClone(nfcProducts.find((product) => product.id === productId) ?? {
        ...demoProduct,
        id: productId,
        code: `PRODUCT_${productId}`,
        name: `MCM Bag ${productId}`,
      });
    }
    const product = await request<Omit<Product, "code"> & { code?: string }>(`/api/products/${productId}`);
    const localProduct = nfcProducts.find((candidate) => candidate.id === productId);
    return {
      ...product,
      code: product.code ?? localProduct?.code ?? `PRODUCT_${productId}`,
      imageUrl: product.imageUrl?.includes("example.com") ? localProduct?.imageUrl ?? null : product.imageUrl,
    };
  },

  async createBoardingPass(sessionId: number): Promise<BoardingPass> {
    if (!isLiveApi) return { boardingPassId: 1, passportSessionId: sessionId, gate: "STYLE_SPOT", issuedAt: now() };
    return request(`/api/passport-sessions/${sessionId}/boarding-pass`, { method: "POST" }, [200, 201]);
  },

  async connectStyleSpot(styleSpotId: string, sessionId: number): Promise<StyleSpotConnectResponse> {
    if (!isLiveApi) {
      await delay(900);
      return {
        styleSpotSessionId: 5,
        styleSpotId,
        passportSessionId: sessionId,
        status: "RESULT",
        styleResult: {
          id: 9,
          passportSessionId: sessionId,
          cityCode: "BERLIN_AFTERDARK_NOMAD",
          cityCodeName: "Berlin Afterdark Nomad",
          recommendedProductCode: "STARK_BACKPACK",
          recommendedProductName: "Stark Backpack",
          styleMood: "AFTERDARK_MOVEMENT",
          styleMoodName: "Afterdark Movement",
          backgroundCode: "BERLIN_AFTER_DARK",
          backgroundName: "Berlin After Dark",
          backgroundAssetKey: "berlin-after-dark",
          description: "질서 있는 구조와 자유로운 이동, 밤의 도시 에너지를 함께 선택한 스타일입니다.",
          matchScore: 92,
          usedFallback: false,
          createdAt: now(),
        },
      };
    }
    return request(`/api/style-spots/${styleSpotId}/connect`, {
      method: "POST",
      body: JSON.stringify({ passportSessionId: sessionId }),
    });
  },

  async savePortrait(sessionId: number, imageUrl: string): Promise<StylePortrait> {
    if (!isLiveApi) {
      return { id: 3, passportSessionId: sessionId, imageUrl, consent: true, createdAt: now() };
    }
    return request(`/api/passport-sessions/${sessionId}/portrait`, {
      method: "POST",
      body: JSON.stringify({ imageUrl, consent: true }),
    }, [201]);
  },

  async createSouvenir(sessionId: number, result: StyleResult, stamps: string[], taggedProduct?: Product): Promise<JourneySouvenir> {
    if (!isLiveApi) {
      return {
        id: 4,
        passportSessionId: sessionId,
        styleResultId: result.id,
        cityCode: result.cityCode,
        cityCodeName: result.cityCodeName,
        recommendedProductCode: result.recommendedProductCode,
        recommendedProductName: result.recommendedProductName,
        styleMood: result.styleMood,
        styleMoodName: result.styleMoodName,
        backgroundCode: result.backgroundCode,
        backgroundName: result.backgroundName,
        backgroundAssetKey: result.backgroundAssetKey,
        journeyStamps: stamps,
        taggedProductCodes: taggedProduct ? [taggedProduct.code] : [],
        createdAt: now(),
      };
    }
    return request(`/api/passport-sessions/${sessionId}/souvenir`, { method: "POST" }, [200, 201]);
  },
};
