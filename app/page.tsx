"use client";

import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  Check,
  ChevronRight,
  Compass,
  Mic,
  Plane,
  QrCode,
  ScanLine,
  ShieldCheck,
  Stamp,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  demoProduct,
  getPassportCardUid,
  isLiveApi,
  JourneySouvenir,
  JourneySpot,
  mcmApi,
  nfcProducts,
  Product,
  resetVirtualPassportCardUid,
  StyleResult,
} from "@/lib/mcm-api";
import { isWebNfcSupported, parseNfcUrl, scanNfcTag } from "@/lib/nfc";

type Phase = "welcome" | "consent" | "journey" | "boarding" | "connecting" | "analysis" | "destination" | "portrait" | "completion" | "passport";
type JourneyView = "question" | "checkpoint" | "tag" | "product" | "map" | "spot-detail" | "passport-offer";
type EntryMethod = "nfc" | "qr";
const storageKeyPrefix = isLiveApi ? "mcm-passport-v4-live" : "mcm-passport-v4-demo";
const getStorageKey = () => `${storageKeyPrefix}:${getPassportCardUid()}`;
const sessionSchemaKey = "mcm-passport-session-schema";
const currentSessionSchema = "journey-details-v2";

type PersistedState = {
  phase: Phase;
  journeyView: JourneyView;
  sessionId: number | null;
  activeSpotIndex: number;
  answers: Record<number, number>;
  stamps: number[];
  tagged: boolean;
  taggedProductId: number | null;
  productReason: string | null;
  tagConnected: boolean;
  portraitSaved: boolean;
  styleResult: StyleResult | null;
  souvenir: JourneySouvenir | null;
  entryMethod: EntryMethod;
  souvenirSaved: boolean;
  accountLinked: boolean;
};

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [journeyView, setJourneyView] = useState<JourneyView>("question");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [spots, setSpots] = useState<JourneySpot[]>([]);
  const [activeSpotIndex, setActiveSpotIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [stamps, setStamps] = useState<number[]>([]);
  const [tagged, setTagged] = useState(false);
  const [taggedProductId, setTaggedProductId] = useState<number | null>(null);
  const [productReason, setProductReason] = useState<string | null>(null);
  const [tagConnected, setTagConnected] = useState(false);
  const [portraitSaved, setPortraitSaved] = useState(false);
  const [portraitImageUrl, setPortraitImageUrl] = useState<string | null>(null);
  const [styleResult, setStyleResult] = useState<StyleResult | null>(null);
  const [souvenir, setSouvenir] = useState<JourneySouvenir | null>(null);
  const [entryMethod, setEntryMethod] = useState<EntryMethod>("nfc");
  const [journeyConsent, setJourneyConsent] = useState(false);
  const [portraitConsent, setPortraitConsent] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [souvenirSaved, setSouvenirSaved] = useState(false);
  const [accountLinked, setAccountLinked] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [enteredByNfc, setEnteredByNfc] = useState(false);
  const persistenceReady = useRef(false);
  const pendingNfcProduct = useRef<number | null>(null);

  useEffect(() => {
    persistenceReady.current = false;
    const sessionSchemaMatches = window.localStorage.getItem(sessionSchemaKey) === currentSessionSchema;
    const incomingNfc = parseNfcUrl(window.location.href);
    queueMicrotask(() => setEnteredByNfc(incomingNfc?.kind === "entry"));
    pendingNfcProduct.current = incomingNfc?.kind === "product" ? incomingNfc.productId ?? null : null;
    if (!sessionSchemaMatches || incomingNfc?.kind === "entry") {
      window.localStorage.removeItem(getStorageKey());
      resetVirtualPassportCardUid();
      window.localStorage.setItem(sessionSchemaKey, currentSessionSchema);
      queueMicrotask(() => {
        setPhase("welcome");
        setJourneyView("question");
        setSessionId(null);
        setActiveSpotIndex(0);
        setAnswers({});
        setStamps([]);
        setTagged(false);
        setTaggedProductId(null);
        setProductReason(null);
        setTagConnected(false);
        setStyleResult(null);
        setSouvenir(null);
      });
    }
    const portraitFromDisplay = new URLSearchParams(window.location.search).get("portraitImageUrl");
    // Client-only URL and localStorage state must be applied after hydration.
    queueMicrotask(() => setPortraitImageUrl(portraitFromDisplay ?? (!isLiveApi ? `${window.location.origin}/images/berlin-ember.png` : null)));
    const cached = sessionSchemaMatches && incomingNfc?.kind !== "entry"
      ? window.localStorage.getItem(getStorageKey())
      : null;
    if (cached) {
      try {
        const state = JSON.parse(cached) as PersistedState;
        queueMicrotask(() => {
          setPhase(state.phase);
          setJourneyView(state.journeyView);
          setSessionId(state.sessionId);
          setActiveSpotIndex(state.activeSpotIndex);
          setAnswers(state.answers);
          setStamps(state.stamps);
          setTagged(state.tagged);
          setTaggedProductId(state.taggedProductId ?? null);
          setProductReason(state.productReason ?? null);
          setTagConnected(state.tagConnected ?? false);
          setPortraitSaved(state.portraitSaved ?? false);
          setStyleResult(state.styleResult);
          setSouvenir(state.souvenir);
          setEntryMethod(state.entryMethod ?? "nfc");
          setSouvenirSaved(state.souvenirSaved ?? false);
          setAccountLinked(state.accountLinked ?? false);
        });
      } catch {}
    }

    if (incomingNfc) window.history.replaceState({}, "", window.location.pathname);

    mcmApi.getJourneySpots()
      .then((data) => setSpots(data.sort((a, b) => a.sequence - b.sequence)))
      .catch((caught) => setError(toMessage(caught)))
      .finally(() => {
        persistenceReady.current = true;
        setHydrated(true);
      });
  }, []);

  useEffect(() => {
    if (!hydrated || !persistenceReady.current) return;
    const state: PersistedState = {
      phase,
      journeyView,
      sessionId,
      activeSpotIndex,
      answers,
      stamps,
      tagged,
      taggedProductId,
      productReason,
      tagConnected,
      portraitSaved,
      styleResult,
      souvenir,
      entryMethod,
      souvenirSaved,
      accountLinked,
    };
    window.localStorage.setItem(getStorageKey(), JSON.stringify(state));
  }, [phase, journeyView, sessionId, activeSpotIndex, answers, stamps, tagged, taggedProductId, productReason, tagConnected, portraitSaved, styleResult, souvenir, entryMethod, souvenirSaved, accountLinked, hydrated]);

  const activeSpot = spots[activeSpotIndex];
  const activeQuestion = activeSpot?.questions
    .sort((a, b) => a.sequence - b.sequence)
    .find((question) => answers[question.id] === undefined) ?? activeSpot?.questions[0];

  const requiredSpots = useMemo(() => spots.filter((spot) => spot.required), [spots]);
  const requiredComplete = requiredSpots.length > 0 && requiredSpots.every((spot) => stamps.includes(spot.id));
  const stampCodes = spots.filter((spot) => stamps.includes(spot.id)).map((spot) => spot.code);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const startJourney = () => run(async () => {
    const session = await mcmApi.createPassportSession(getPassportCardUid());
    setSessionId(session.passportSessionId);
    setActiveSpotIndex(0);
    setPhase("journey");
    setJourneyView("question");
  });

  const chooseAnswer = (optionId: number) => run(async () => {
    if (!sessionId || !activeSpot || !activeQuestion) return;
    await mcmApi.saveGuideResponse(sessionId, activeQuestion.id, optionId);
    const nextAnswers = { ...answers, [activeQuestion.id]: optionId };
    setAnswers(nextAnswers);

    const requiredQuestionsComplete = activeSpot.questions
      .filter((question) => question.required)
      .every((question) => nextAnswers[question.id] !== undefined);

    const isOpeningMood = activeSpotIndex === 0 && activeQuestion.sequence === 1;
    if (isOpeningMood && !requiredQuestionsComplete) {
      setJourneyView("checkpoint");
      return;
    }

    if (requiredQuestionsComplete || activeSpot.questions.length === 1) {
      await mcmApi.completeJourneySpot(sessionId, activeSpot.id);
      setStamps((previous) => previous.includes(activeSpot.id) ? previous : [...previous, activeSpot.id]);
      setJourneyView("map");
    }
  });

  const tagProduct = (productId = nfcProducts[0].id) => run(async () => {
    if (!sessionId) return;
    if (tagged && taggedProductId === productId) {
      setJourneyView("product");
      return;
    }
    await mcmApi.tagProduct(sessionId, productId);
    setTagged(true);
    setTaggedProductId(productId);
    setJourneyView("product");
  });

  useEffect(() => {
    const productId = pendingNfcProduct.current;
    if (!hydrated || !sessionId || !productId) return;
    pendingNfcProduct.current = null;
    if (tagged && taggedProductId === productId) {
      queueMicrotask(() => {
        setPhase("journey");
        setJourneyView("product");
      });
      return;
    }
    setBusy(true);
    setError(null);
    void mcmApi.tagProduct(sessionId, productId)
      .then(() => {
        setTagged(true);
        setTaggedProductId(productId);
        setPhase("journey");
        setJourneyView("product");
      })
      .catch((caught) => setError(toMessage(caught)))
      .finally(() => setBusy(false));
  }, [hydrated, sessionId, tagged, taggedProductId]);

  const closeTaggedProduct = () => {
    setJourneyView("map");
  };

  const openSpot = (index: number) => {
    setActiveSpotIndex(index);
    setJourneyView("spot-detail");
  };

  const issueBoarding = () => run(async () => {
    if (!sessionId) return;
    await mcmApi.createBoardingPass(sessionId);
    setPhase("boarding");
  });

  const connectStyleSpot = async () => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    setConnectionFailed(false);
    try {
      const connected = await mcmApi.connectStyleSpot("GATE-S1", sessionId);
      setStyleResult(connected.styleResult);
      setTagConnected(true);
      setPhase("analysis");
    } catch (caught) {
      setConnectionFailed(true);
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const prepareSouvenir = () => run(async () => {
    if (!sessionId || !styleResult) return;
    const taggedProduct = nfcProducts.find((product) => product.id === taggedProductId);
    const created = await mcmApi.createSouvenir(sessionId, styleResult, stampCodes, taggedProduct);
    setSouvenir(created);
    setPhase("completion");
  });

  const saveSouvenir = () => {
    setSouvenirSaved(true);
    setPhase("passport");
  };

  const savePortrait = () => run(async () => {
    if (!sessionId || !portraitImageUrl) throw new Error("Style Spot에서 Portrait가 준비되면 저장할 수 있어요.");
    await mcmApi.savePortrait(sessionId, portraitImageUrl);
    setPortraitSaved(true);
  });

  const reset = () => {
    setPhase("welcome");
    setJourneyView("question");
    setSessionId(null);
    setActiveSpotIndex(0);
    setAnswers({});
    setStamps([]);
    setTagged(false);
    setTaggedProductId(null);
    setProductReason(null);
    setTagConnected(false);
    setPortraitSaved(false);
    setStyleResult(null);
    setSouvenir(null);
    setEntryMethod("nfc");
    setJourneyConsent(false);
    setPortraitConsent(false);
    setConnectionFailed(false);
    setSouvenirSaved(false);
    setAccountLinked(false);
    setAccountOpen(false);
    setError(null);
    window.localStorage.removeItem(getStorageKey());
  };

  return (
    <main className="experience-shell">
      <section className="mobile-app" aria-label="MCM Passport mobile experience">
        <StatusBar light={phase === "journey" || phase === "analysis" || phase === "destination" || phase === "portrait"} />

        {phase === "welcome" && <Welcome connected={enteredByNfc} onStart={startJourney} onQr={startJourney} />}
        {phase === "consent" && <Consent entryMethod={entryMethod} required={journeyConsent} portrait={portraitConsent} onRequired={setJourneyConsent} onPortrait={setPortraitConsent} onBack={() => setPhase("welcome")} onStart={startJourney} />}
        {phase === "journey" && activeSpot && activeQuestion && journeyView === "question" && (
          <QuestionScreen spot={activeSpot} question={activeQuestion} answeredCount={Object.keys(answers).length} totalQuestions={spots.reduce((count, spot) => count + spot.questions.length, 0) + 1} selected={answers[activeQuestion.id]} onAnswer={chooseAnswer} />
        )}
        {phase === "journey" && journeyView === "checkpoint" && <NextStepScreen title="Origin Gate" message="오늘의 무드가 Passport에 기록됐어요. Origin Gate부터 여정을 시작해볼게요." button="Origin Gate로 이동" onContinue={() => setJourneyView("tag")} />}
        {phase === "journey" && journeyView === "tag" && <TagYourFind onContinue={() => setJourneyView("map")} onTag={tagProduct} />}
        {phase === "journey" && journeyView === "product" && <TaggedProductScreen product={nfcProducts.find((product) => product.id === taggedProductId) ?? demoProduct} onClose={closeTaggedProduct} />}
        {phase === "journey" && activeSpot && journeyView === "spot-detail" && (
          <SpotDetailScreen spot={activeSpot} previousSpotName={spots[activeSpotIndex - 1]?.name} complete={stamps.includes(activeSpot.id)} signalCount={stamps.length + (tagged ? 1 : 0)} totalSignals={spots.length + 1} onStart={() => setJourneyView("question")} onMap={() => setJourneyView("map")} />
        )}
        {phase === "journey" && journeyView === "map" && (
          <JourneyMap spots={spots} stamps={stamps} tagged={tagged} requiredComplete={requiredComplete} onSpot={openSpot} onTag={() => tagProduct()} onBoard={() => setJourneyView("passport-offer")} />
        )}
        {phase === "journey" && journeyView === "passport-offer" && <PassportOffer onIssue={issueBoarding} onBack={() => setJourneyView("map")} />}
        {phase === "boarding" && <Boarding stampCount={stamps.length + (tagged ? 1 : 0)} onBack={() => { setPhase("journey"); setJourneyView("map"); }} onContinue={() => { setTagConnected(false); setPhase("connecting"); }} />}
        {phase === "connecting" && <Connecting failed={connectionFailed} onBack={() => setPhase("boarding")} onTag={connectStyleSpot} />}
        {phase === "analysis" && styleResult && <Analysis result={styleResult} tagged={tagged} onReady={() => setPhase("destination")} />}
        {phase === "destination" && styleResult && <Destination result={styleResult} onContinue={prepareSouvenir} />}
        {phase === "portrait" && styleResult && <Portrait result={styleResult} saved={portraitSaved} available={Boolean(portraitImageUrl) && portraitConsent} consented={portraitConsent} onConsent={() => setPortraitConsent(true)} onSave={savePortrait} onContinue={prepareSouvenir} />}
        {phase === "completion" && souvenir && <Completion souvenir={souvenir} portraitSaved={portraitSaved} onSave={saveSouvenir} />}
        {phase === "passport" && souvenir && <Passport souvenir={souvenir} saved={souvenirSaved} accountLinked={accountLinked} onAccount={() => setAccountOpen(true)} onReset={reset} />}

        {accountOpen && <AccountLinkSheet linked={accountLinked} onLink={() => { setAccountLinked(true); setAccountOpen(false); }} onClose={() => setAccountOpen(false)} />}

        {stampOpen && activeSpot && <StampModal spot={activeSpot} onClose={() => setStampOpen(false)} />}
        {busy && <BusyOverlay />}
        {error && <ErrorToast message={error} onClose={() => setError(null)} />}
      </section>
    </main>
  );
}

function StatusBar({ light = false }: { light?: boolean }) {
  return <div className={`status-bar ${light ? "light" : ""}`}><span>9:41</span><span className="status-icons">▮▮▮ ᴡɪꜰɪ ▰</span></div>;
}

function Header({ title, onBack, light = false }: { title: string; onBack?: () => void; light?: boolean }) {
  return (
    <header className={`app-header ${light ? "light" : ""}`}>
      <button className="icon-button" onClick={onBack} aria-label="뒤로 가기" disabled={!onBack}><ArrowLeft /></button>
      <span>{title}</span>
      <button className="icon-button" aria-label="메뉴">•••</button>
    </header>
  );
}

function Welcome({ connected, onStart, onQr }: { connected: boolean; onStart: () => void; onQr: () => void }) {
  return (
    <div className="screen welcome-screen">
      <div className="micro-logo">MCM PASSPORT</div>
      <div className={`connection ${connected ? "is-connected" : ""}`}><span>{connected ? "NFC BRAND CARD CONNECTED" : "MCM PASSPORT READY"}</span><FlightLine /></div>
      <p className="welcome-copy">고객님의 선택으로 오늘의 목적지가 완성됩니다.<br />AI Guide와 대화하며 스타일 여정을 시작해보세요.</p>
      <div className="passport-card">
        <div className="passport-title">STYLE JOURNEY<br />PASSPORT</div>
        <div className="passport-data"><small>GUEST</small><strong>JIYOON</strong><br /><small>DESTINATION</small><strong>CURATED BY YOU</strong></div>
        <div className="passport-seal"><Compass /><span>STYLE<br />JOURNEY</span></div>
      </div>
      <div className="guide-bubble"><GuideCharacter /><div><small>AI GUIDE · AMY</small><p>“설문 대신 대화로,<br />고객님의 취향을 함께 발견할게요.”</p></div></div>
      <button className="text-cta" onClick={onStart}>여정 시작하기 <ArrowRight /></button>
      <button className="qr-entry" onClick={onQr}><QrCode /> NFC가 인식되지 않나요? QR로 열기</button>
    </div>
  );
}

function Consent({ entryMethod, required, portrait, onRequired, onPortrait, onBack, onStart }: {
  entryMethod: EntryMethod;
  required: boolean;
  portrait: boolean;
  onRequired: (checked: boolean) => void;
  onPortrait: (checked: boolean) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <div className="screen consent-screen">
      <Header title="PASSPORT ACTIVATION" onBack={onBack} />
      <div className="consent-hero"><ShieldCheck /><small>{entryMethod === "nfc" ? "NFC PASSPORT VERIFIED" : "QR PASSPORT VERIFIED"}</small><h1>여정을 시작하기 전에<br />기록 방식을 확인해주세요.</h1><p>오늘의 선택과 Journey Stamp는 개인화된 City Code와 추천을 만들기 위해 이 Passport 세션에 저장됩니다.</p></div>
      <div className="consent-list">
        <label><input type="checkbox" checked={required} onChange={(event) => onRequired(event.target.checked)} /><span><strong>[필수] 여정 데이터 수집·이용</strong><small>Spot 반응, Stamp, 태그 제품, 개인화 결과를 여정 운영과 추천에 사용합니다.</small></span></label>
        <label><input type="checkbox" checked={portrait} onChange={(event) => onPortrait(event.target.checked)} /><span><strong>[선택] Style Portrait 저장</strong><small>촬영 결과는 동의한 경우에만 My Passport에 연결합니다. 나중에 다시 선택할 수 있습니다.</small></span></label>
      </div>
      <p className="consent-note">AI 결과는 고정된 스타일 판정이 아니라 오늘 매장에서 반응한 취향을 바탕으로 한 제안입니다.</p>
      <button className="primary-button consent-start" onClick={onStart} disabled={!required}>동의하고 Journey Map 열기 <ArrowRight /></button>
    </div>
  );
}

function QuestionScreen({ spot, question, answeredCount, totalQuestions, selected, onAnswer }: {
  spot: JourneySpot;
  question: JourneySpot["questions"][number];
  answeredCount: number;
  totalQuestions: number;
  selected?: number;
  onAnswer: (optionId: number) => void;
}) {
  const guide = guideCopy(question.code, spot.name);
  return (
    <div className="screen question-screen latest-guide-screen">
      <Header title="AI Guide" light />
      <div className="guide-progress"><span>{guide.eyebrow}</span><div><i style={{ width: `${Math.max(8, ((answeredCount + 1) / Math.max(totalQuestions, 1)) * 100)}%` }} /></div><small>{answeredCount + 1}/{Math.max(totalQuestions, 1)}</small></div>
      <section className="ai-guide-stage">
        <div className="ai-message"><small>AI GUIDE · AMY</small><p>{guide.message}</p></div>
        <GuideCharacter />
      </section>
      <div className="question-context"><span>{guide.label}</span><FlightLine /></div>
      <h1 className="guide-question">{question.questionText}</h1>
      <div className="choice-list question-choices">
        {question.options.sort((a, b) => a.sequence - b.sequence).map((option) => (
          <button className={selected === option.id ? "chosen" : ""} key={option.id} onClick={() => onAnswer(option.id)}>
            {option.label}<ChevronRight />
          </button>
        ))}
      </div>
      <button className="voice-answer" aria-label="음성으로 답하기"><span>마이크를 누르고 음성으로 답해도 좋아요.</span><Mic /></button>
    </div>
  );
}

function NextStepScreen({ title, message, button, onContinue }: {
  title: string;
  message: string;
  button: string;
  onContinue: () => void;
}) {
  return (
    <div className="screen signal-screen">
      <Header title="AI Guide" light />
      <section className="signal-guide"><div><small>AI GUIDE · AMY</small><p>{message}</p></div><GuideCharacter /></section>
      <section className="signal-sheet">
        <div className="sheet-handle" />
        <small>현재 상태</small>
        <span className="signal-label">MY JOURNEY · NEXT DESTINATION</span>
        <div className="next-destination-card"><small>NEXT SPOT</small><strong>{title}</strong><span>당신의 선택을 이어서 다음 여정을 열어보세요.</span></div>
        <button className="primary-button next-step-button" onClick={onContinue}>{button} <ArrowRight /></button>
      </section>
    </div>
  );
}

function SpotDetailScreen({ spot, previousSpotName, complete, signalCount, totalSignals, onStart, onMap }: {
  spot: JourneySpot;
  previousSpotName?: string;
  complete: boolean;
  signalCount: number;
  totalSignals: number;
  onStart: () => void;
  onMap: () => void;
}) {
  const guideMessage = previousSpotName
    ? `${previousSpotName} 여정을 즐기셨어요. 다음은 ${spot.name}으로 가볼게요.`
    : `오늘의 무드를 선택했어요. 다음은 ${spot.name}로 가볼게요.`;
  return (
    <div className="screen frame42-screen">
      <Header title="AI Guide" onBack={onMap} light />
      <section className="frame42-guide">
        <div className="ai-message"><small>AI GUIDE · AMY</small><p>{complete ? `${spot.name} 여정을 이미 완료했어요. 기록된 내용을 다시 확인해볼까요?` : guideMessage}</p></div>
        <GuideCharacter />
      </section>
      <section className="frame42-status"><span>현재 상태</span><small>MY JOURNEY · {signalCount} / {totalSignals} SIGNALS</small></section>
      <section className="frame42-next">
        <span>NEXT STEP</span>
        <div className="frame42-card">
          <small>{String(spot.sequence).padStart(2, "0")}</small>
          <strong>{spot.name}</strong>
          <i />
          <p>{spot.description}</p>
        </div>
      </section>
      <button className="frame42-cta" onClick={complete ? onMap : onStart}>{complete ? "Journey Map으로 돌아가기" : "다음 spot으로 이동"}<ArrowRight /></button>
    </div>
  );
}

function TagYourFind({ onContinue, onTag }: { onContinue: () => void; onTag: (productId?: number) => void }) {
  const [supported, setSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanController = useRef<AbortController | null>(null);

  useEffect(() => {
    queueMicrotask(() => setSupported(isWebNfcSupported()));
    return () => scanController.current?.abort();
  }, []);

  const startScan = async () => {
    if (!supported) return;
    scanController.current?.abort();
    const controller = new AbortController();
    scanController.current = controller;
    setScanError(null);
    setScanning(true);
    try {
      await scanNfcTag({
        signal: controller.signal,
        onRead: (payload) => {
          if (payload.kind !== "product" || !payload.productId) {
            setScanError("가방에 부착된 제품 NFC 스티커를 태그해주세요.");
            return;
          }
          controller.abort();
          setScanning(false);
          onTag(payload.productId);
        },
        onError: setScanError,
      });
    } catch (caught) {
      if (!controller.signal.aborted) {
        setScanning(false);
        setScanError(caught instanceof Error ? caught.message : "NFC 스캔을 시작하지 못했어요.");
      }
    }
  };

  return (
    <div className="screen tag-find-screen">
      <Header title="AI Guide" light />
      <div className="tag-find-content">
        <button className={`tag-find-visual ${scanning ? "is-scanning" : ""}`} onClick={startScan} disabled={scanning || !supported} aria-label="NFC 가방 태그 스캔 시작"><Image src="/images/nfc-tag-visual.svg" alt="가방과 MCM Passport NFC 태깅" width={210} height={210} loading="eager" /></button>
        <h1>TAG YOUR FIND</h1>
        <p>{supported ? "스캔을 시작한 뒤 마음에 드는 가방의\n스티커에 휴대폰을 가까이 대주세요." : "가방의 NFC 스티커를 휴대폰으로 태그하면\n제품이 Passport에 기록돼요."}</p>
        <div className={`nfc-ready ${scanning ? "scanning" : ""}`}><strong>{scanning ? "NFC · SCANNING…" : supported ? "NFC · TAP TO SCAN" : "NFC · URL TAG READY"}</strong></div>
        {scanError && <span className="nfc-scan-error" role="alert">{scanError}</span>}
        {!supported && <div className="nfc-demo-actions"><small>PC·iPhone 데모</small>{nfcProducts.map((product, index) => <button key={product.id} onClick={() => onTag(product.id)}>가방 {String(index + 1).padStart(2, "0")}</button>)}</div>}
      </div>
      <div className="tag-find-actions"><button className="text-cta" onClick={onContinue}>다음 미션 진행하기 <ArrowRight /></button></div>
    </div>
  );
}

function TaggedProductScreen({ product, onClose }: { product: Product; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const hold = window.setTimeout(() => setLeaving(true), 2000);
    const close = window.setTimeout(onClose, 3500);
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(close);
    };
  }, [onClose]);

  return (
    <div className={`screen product-reason-screen prototype-product-event ${leaving ? "is-leaving" : ""}`}>
      <Header title="AI Guide" light />
      <section className="product-reason-hero"><div className="ai-message"><small>AI GUIDE · AMY</small><p>{product.name}이 Passport에 기록됐어요.<br />Movement 선택과 연결되는 제품이에요.</p></div><GuideCharacter /></section>
      <section className="product-reason-sheet">
        <small>TAGGED PRODUCT · SIGNAL 01</small>
        <div className="mini-tagged-product"><Image src={product.imageUrl ?? "/images/travel-backpack.png"} alt={product.name} width={82} height={82} /><div><strong>{product.name}</strong><span>{product.color} · {product.material} · {product.silhouette}</span></div><Check /></div>
        <h1>이 제품이 취향에 남긴 신호</h1>
        <div className="tag-signal-copy"><span>MOVEMENT</span><strong>Afterdark</strong><p>도시의 밤처럼 구조적이고 자유로운 이동 감각이 오늘의 선택과 연결됐어요.</p></div>
        <button className="primary-button tagged-close" onClick={onClose}>Journey Map으로 돌아가기 <ArrowRight /></button>
      </section>
    </div>
  );
}

function JourneyMap({ spots, stamps, tagged, requiredComplete, onSpot, onTag, onBoard }: {
  spots: JourneySpot[];
  stamps: number[];
  tagged: boolean;
  requiredComplete: boolean;
  onSpot: (index: number) => void;
  onTag: () => void;
  onBoard: () => void;
}) {
  useEffect(() => {
    if (!requiredComplete) return;
    const timer = window.setTimeout(onBoard, 1500);
    return () => window.clearTimeout(timer);
  }, [requiredComplete, onBoard]);

  const nextSpot = spots.find((spot) => !stamps.includes(spot.id));
  const guideMessage = requiredComplete
    ? "모든 스탬프를 다 모았어요. 이제 MCM Passport를 발급받을 수 있어요."
    : stamps.length === 0
      ? "아직 모은 Journey Stamp가 없어요. 각 Spot을 눌러 디테일 여정을 시작해주세요."
      : `지금까지 ${stamps.length}개의 Journey Stamp를 모았어요. 다음은 ${nextSpot?.name ?? "다음 Spot"}이에요.`;
  return (
    <div className="screen map-screen">
      <Header title="AI Guide" light />
      <section className="map-guide"><div><small>AI GUIDE · AMY</small><p>{guideMessage}</p></div><GuideCharacter /></section>
      <section className="map-sheet">
        <div className="sheet-handle" />
        <small>MY JOURNEY · {stamps.length + (tagged ? 1 : 0)} / {spots.length + 1} SIGNALS</small>
        <h2>SPOT별 스탬프 현황</h2>
        <div className="spot-list">
          {spots.map((spot, index) => {
            const complete = stamps.includes(spot.id);
            const completionLabels = ["Mood selected", "Texture signal", "Motion signal", "배경 무드 발견"];
            return <button className={complete ? "complete" : ""} key={spot.id} onClick={() => onSpot(index)}><div><strong>{spot.name}</strong><span>{complete ? `완료 · ${completionLabels[index] ?? "Stamp collected"}` : index === stamps.length ? `NEXT · ${completionLabels[index] ?? "다음 감각 발견"}` : spot.description}</span></div>{complete ? <Stamp /> : <ChevronRight />}</button>;
          })}
          <button className={`product-list-row ${tagged ? "complete" : ""}`} onClick={onTag}><div><strong>Product Tagging</strong><span>{tagged ? "완료 · 1 product saved" : "1 product saved"}</span></div>{tagged ? <Stamp /> : <ScanLine />}</button>
        </div>
        {requiredComplete && <button className="primary-button map-boarding" onClick={onBoard}>MCM Passport 발급받기 <ArrowRight /></button>}
      </section>
    </div>
  );
}

function PassportOffer({ onIssue, onBack }: { onIssue: () => void; onBack: () => void }) {
  return (
    <div className="screen passport-offer-screen">
      <Header title="AI Guide" light />
      <section className="passport-offer-guide"><div className="ai-message"><small>AI GUIDE · AMY</small><p>이제 MCM PASSPORT를 발급받을 수 있어요.<br />MCM PASSPORT를 화면으로 받아볼까요?</p></div><GuideCharacter /></section>
      <div className="passport-offer-card figma-passport-ticket"><small>STYLE JOURNEY<br />PASSPORT</small><div className="passport-offer-name">GUEST · JIYOON</div><div className="passport-offer-destination">DESTINATION · CURATED BY YOU</div><Compass /></div>
      <div className="passport-offer-actions"><button className="figma-choice primary" onClick={onIssue}>네, 발급해주세요.</button><button className="figma-choice" onClick={onBack}>아니요, 조금 더 둘러볼래요.</button></div>
    </div>
  );
}

function Boarding({ stampCount, onBack, onContinue }: { stampCount: number; onBack: () => void; onContinue: () => void }) {
  return (
    <div className="screen boarding-screen">
      <Header title="MCM PASSPORT" onBack={onBack} />
      <div className="boarding-kicker">{stampCount} SIGNALS COMPLETE <FlightLine /></div>
      <h1>Your Private Boarding is ready.</h1>
      <div className="ticket figma-boarding-pass">
        <div className="ticket-top"><span>PRIVATE BOARDING PASS</span><span>GATE S1</span></div>
        <div className="boarding-pass-copy"><strong>GUEST · JIYOON</strong><span>DEPARTURE · MCM SEOUL</span><span>MOOD SIGNAL · AFTERDARK / MOVEMENT</span></div>
        <div className="boarding-stamp">READY TO<br />BOARD</div>
        <div className="boarding-qr"><QrCode /><Plane /><small>SCAN TO OPEN<br />YOUR PASSPORT</small></div>
      </div>
      <section className="boarding-guide"><div className="ai-message"><small>AI GUIDE · AMY</small><p>여정이 완료됐어요.<br />Style Spot에서 AI Guide가 정리한 고객님의<br />City Code를 확인해보세요.</p></div><GuideCharacter /></section>
      <button className="text-cta boarding-connect" onClick={onContinue}>Style spot으로 이동 <ArrowRight /></button>
    </div>
  );
}

function Connecting({ failed, onBack, onTag }: {
  failed: boolean;
  onBack: () => void;
  onTag: () => void;
}) {
  return (
    <div className="screen connecting-screen">
      <Header title="STYLE SPOT · GATE S1" onBack={onBack} />
      <div className="boarding-kicker">PRIVATE BOARDING <FlightLine /></div>
      <h1>Passport를 태그하면<br />당신의 배경이 열립니다.</h1>
      <p>{failed ? "연결이 완료되지 않았어요. QR로 다시 연결하거나 직원에게 도움을 요청해주세요." : "디스플레이 오른쪽 NFC 영역에 Passport를 가까이 대주세요."}</p>
      <div className={`gate-tap-card ${failed ? "failed" : ""}`} role="status" aria-label={failed ? "Style Spot 연결 실패" : "NFC Passport 태깅 대기"}>
        <span>{failed ? "CONNECTION INTERRUPTED" : "CITY CODE · LOCKED"}</span>
        <div className="nfc-target">{failed ? <><WifiOff /><strong>TRY AGAIN</strong></> : <><i /><i /><ScanLine /><strong>TAP HERE</strong></>}</div>
        <div className="tap-meta"><small>{failed ? "QR RETRY" : "TAP"}</small><small>IDENTIFY</small><small>NEXT LAYER</small></div>
      </div>
      <p className="gate-explainer">태그가 인식되면 취향에 맞는 도시 배경과 추천 제품이 디스플레이에 나타나요.</p>
      <button className="text-cta gate-ready" onClick={onTag}>{failed ? <QrCode /> : null}{failed ? "QR로 다시 연결" : "태그 준비 완료"} <ArrowRight /></button>
      <button className="connection-help">Journey Host에게 연결 도움 요청</button>
      <span className="cookie-note">쿠키 관리 또는 옵트 아웃</span>
    </div>
  );
}

function Analysis({ result, tagged, onReady }: { result: StyleResult; tagged: boolean; onReady: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onReady, 2900);
    return () => window.clearTimeout(timer);
  }, [onReady]);

  return (
    <div className="screen analysis-screen figma-tap-animation">
      <Header title="AI Guide" light />
      <div className="tap-hand"><ScanLine /><i /><i /></div>
      <h1>Passport를 태그해주세요</h1>
      <div className="analysis-reveal"><Image src="/images/berlin-ember.png" alt="" fill sizes="(max-width: 430px) 100vw, 430px" loading="eager" /><span>{result.cityCodeName}</span><small>{tagged ? "TAGGED PRODUCT + JOURNEY SIGNAL" : "JOURNEY SIGNAL CONNECTED"}</small></div>
    </div>
  );
}

function Destination({ result, onContinue }: { result: StyleResult; onContinue: () => void }) {
  return (
    <div className="screen destination-screen">
      <Image className="destination-image" src="/images/berlin-ember.png" alt={result.backgroundName} fill priority sizes="(max-width: 430px) 100vw, 430px" />
      <div className="destination-overlay" />
      <Header title="YOUR STYLE DESTINATION" light />
      <div className="destination-copy">
        <span>CITY CODE · REVEALED</span><FlightLine />
        <small>{result.cityCodeName}</small>
        <h1>{result.description}</h1>
        <p>고객님은 ‘내가 원하는 이미지’에 가까운 제품을 고를 때<br />구조감과 도시 무드를 중요하게 봐요.</p>
        <div className="destination-product">
          <Image src="/images/travel-backpack.png" alt={result.recommendedProductName} width={82} height={82} />
          <div><small>AI RECOMMENDATION</small><strong>{result.recommendedProductName}</strong><span>{result.styleMoodName}</span></div>
        </div>
        <div className="destination-ribbon">{result.matchScore}% MATCH · {result.cityCodeName}</div>
      </div>
      <button className="light-button" onClick={onContinue}>이 결과로 Souvenir 만들기 <ArrowRight /></button>
    </div>
  );
}

function Portrait({ result, saved, available, consented, onConsent, onSave, onContinue }: { result: StyleResult; saved: boolean; available: boolean; consented: boolean; onConsent: () => void; onSave: () => void; onContinue: () => void }) {
  return (
    <div className="screen portrait-screen">
      <Image className="portrait-background" src="/images/berlin-ember.png" alt="" fill sizes="(max-width: 430px) 100vw, 430px" loading="eager" />
      <div className="portrait-shade" />
      <Header title="STYLE PORTRAIT" light />
      <section className="portrait-copy"><small>STYLE FIT · OPTIONAL</small><h1>추천 가방을 들고<br />당신의 장면을 확인해보세요.</h1><p>{result.cityCodeName}의 무드 속에서 제품과 나의 어울림을 확인할 수 있어요.</p></section>
      <div className="portrait-product"><Image src="/images/travel-backpack.png" alt={result.recommendedProductName} width={76} height={76} /><div><small>RECOMMENDED MCM PRODUCT</small><strong>{result.recommendedProductName}</strong><span>{result.matchScore}% Style Fit</span></div></div>
      <div className="portrait-actions">
        {!consented && <button className="portrait-consent" onClick={onConsent}><ShieldCheck /> Portrait 저장에 동의하기</button>}
        <button className={`light-button ${saved ? "saved" : ""}`} onClick={onSave} aria-pressed={saved} disabled={!available || saved}>{saved ? <Check /> : <ScanLine />}{saved ? "Style Portrait 저장 완료" : consented ? available ? "Style Portrait 저장하기" : "디스플레이에서 Portrait 준비 중" : "동의 후 Portrait 저장하기"}</button>
        <button className="portrait-skip" onClick={onContinue}>{saved ? "Souvenir 발급하기" : "Portrait 없이 계속하기"} <ArrowRight /></button>
        <small>Portrait 저장은 선택 사항입니다. 실패해도 다시 시도하거나 저장 없이 여정을 완료할 수 있습니다.</small>
      </div>
    </div>
  );
}

function Completion({ souvenir, onSave }: { souvenir: JourneySouvenir; portraitSaved: boolean; onSave: () => void }) {
  const [benefitOpen, setBenefitOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setBenefitOpen(true), 800);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="screen completion-screen latest-passport-screen figma-souvenir-screen">
      <Header title="MCM PASSPORT" />
      <div className="completion-heading"><span>JOURNEY COMPLETE</span><FlightLine /><h1>Your Souvenir is ready.</h1><p>오늘의 선택이<br />하나의 City Code와 제품 이야기로 저장됩니다.</p></div>
      <SouvenirCard souvenir={souvenir} />
      <p className="souvenir-login-note">로그인하면 오늘의 결과를 저장하고, 고객님에게 어울리는 제품 추천과 Souvenir Benefit을 받을 수 있어요.</p>
      <button className="text-cta souvenir-save" onClick={() => setBenefitOpen(true)}>My Passport 가기 <ArrowRight /></button>
      {benefitOpen && <div className="benefit-overlay" role="dialog" aria-modal="true" aria-label="Souvenir benefit"><section className="benefit-sheet"><div className="sheet-handle" /><small>Souvenir benefit</small><h2>오늘의 City Code를 기반으로 준비된 고객님만의<br />Private Benefit입니다.</h2><h3><b>01</b> 추천 제품 전용 할인 쿠폰</h3><div className="coupon-card"><span>✂︎</span><div><small>SOUVENIR COUPON</small><strong>10% OFF</strong><p>추천 제품에 사용 가능</p></div></div><h3><b>02</b> City Code 기반 추가 제품 추천</h3><div className="benefit-tags"><span>Black tone</span><span>Wide silhouette</span><span>Metallic detail</span><span>Urban</span></div><h3><b>03</b> 오늘의 Journey 결과 다시 보기</h3><p className="benefit-note">로그인하면 My Passport에 결과가 안전하게 저장되며,<br />고객님에게 더 맞는 추천을 받아보실 수 있습니다.</p><button className="primary-button" onClick={onSave}>로그인 하고 My Passport에 저장</button><button className="benefit-skip" onClick={onSave}>로그인 없이 계속 여행하기</button></section></div>}
    </div>
  );
}

function Passport({ souvenir, onAccount, onReset }: { souvenir: JourneySouvenir; saved: boolean; accountLinked: boolean; onAccount: () => void; onReset: () => void }) {
  return (
    <div className="screen completion-screen latest-passport-screen my-passport-screen figma-my-passport">
      <Header title="MCM PASSPORT" />
      <div className="passport-saved-title"><Check /><div><h1>My passport에 저장 완료!</h1><p>오늘의 여정 결과와 혜택이 저장되었습니다.</p></div></div>
      <section className="saved-coupon"><span>✂︎</span><div><small>SOUVENIR COUPON</small><strong>10% OFF</strong><p>추천 제품에 사용 가능</p></div><div className="coupon-download"><BookmarkCheck /><small>쿠폰 다운로드</small></div></section>
      <div className="passport-products-title"><h2>City Code에 더 어울리는 제품</h2><button onClick={onAccount}>전체 보기 <ChevronRight /></button></div>
      <div className="passport-products">{[1,2,3,4].map((number) => <div key={number}><Image src={`/images/figma-product-${number}.png`} alt={`${souvenir.cityCodeName} 추천 제품 ${number}`} fill sizes="110px" loading="eager" /></div>)}</div>
      <p className="passport-footnote">오늘의 Journey를 다시 보고싶으신가요?<br />My Passport → My Journey에서 확인할 수 있어요.</p>
      <button className="text-cta completion-reset" onClick={onReset}>메인으로 돌아가기 <ArrowRight /></button>
    </div>
  );
}

function SouvenirCard({ souvenir }: { souvenir: JourneySouvenir }) {
  return (
    <section className="completion-card">
      <Image className="completion-card-image" src="/images/berlin-ember.png" alt={souvenir.backgroundName} fill sizes="(max-width: 430px) 100vw, 430px" loading="eager" />
      <div className="completion-card-shade" />
      <div className="completion-card-content">
        <small>MCM · STYLE JOURNEY 2026</small>
        <h2>{souvenir.cityCodeName}</h2>
        <div><small>STYLE MOOD</small><strong>{souvenir.styleMoodName}</strong></div>
        <div><small>JOURNEY STAMPS</small><strong>{souvenir.journeyStamps.join(" · ")}</strong></div>
        <div><small>RECOMMENDED PRODUCT</small><strong>{souvenir.recommendedProductName}</strong></div>
      </div>
    </section>
  );
}

function AccountLinkSheet({ linked, onLink, onClose }: { linked: boolean; onLink: () => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="MCM 온라인 계정 연동">
      <div className="account-sheet"><button className="modal-close" onClick={onClose} aria-label="닫기"><X /></button><UserRound /><small>MCM ONLINE</small><h2>{linked ? "이미 계정에 저장됐어요." : "오늘의 취향을 MCM 계정에 이어갈까요?"}</h2><p>로그인 후 City Code, Style Mood와 추천 제품을 온라인에서도 다시 확인할 수 있어요.</p>{!linked && <button className="primary-button" onClick={onLink}>MCM 로그인 후 저장 <ArrowRight /></button>}<button className="secondary-button" onClick={onClose}>{linked ? "확인" : "나중에 하기"}</button></div>
    </div>
  );
}

function StampModal({ spot, onClose }: { spot: JourneySpot; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Journey stamp acquired">
      <div className="stamp-modal"><button className="modal-close" onClick={onClose} aria-label="닫기"><X /></button><div className="stamp-medal"><Compass /><span>{String(spot.sequence).padStart(2, "0")}</span></div><small>JOURNEY STAMP ACQUIRED</small><h2>{spot.name}</h2><p>오늘의 감각이 Passport에 기록되었어요.</p><button className="primary-button" onClick={onClose}>Signal 확인하기 <ArrowRight /></button></div>
    </div>
  );
}

function BusyOverlay() {
  return <div className="busy-overlay" role="status"><span /><p>여정 데이터를 연결하고 있어요.</p></div>;
}

function ErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="error-toast" role="alert"><span>{message}</span><button onClick={onClose} aria-label="오류 닫기"><X /></button></div>;
}

function GuideCharacter() {
  return <Image className="guide-character" src="/images/amy-guide.png" alt="" width={152} height={190} loading="eager" aria-hidden="true" />;
}

function FlightLine() {
  return <span className="flight-line" aria-hidden="true"><i /><b>✦</b><i /></span>;
}

function guideCopy(questionCode: string, spotName: string) {
  const copy: Record<string, { eyebrow: string; label: string; message: string }> = {
    TODAY_MOOD: { eyebrow: "JOURNEY START", label: "MOOD SIGNAL", message: "안녕하세요. 오늘의 MCM Journey를 함께할 AI Guide 에이미입니다. 끌리는 감각부터 시작해볼게요." },
    JOURNEY_START_MOOD: { eyebrow: "JOURNEY START", label: "MOOD SIGNAL", message: "안녕하세요. 오늘의 MCM Journey를 함께할 AI Guide 에이미입니다. 끌리는 감각부터 시작해볼게요." },
    ORIGIN_SIGNAL: { eyebrow: "ORIGIN GATE", label: "BRAND DNA", message: "MCM은 도시와 도시를 자유롭게 이동하는 글로벌 노마드의 감각을 담아온 브랜드입니다." },
    BRAND_SENSATION: { eyebrow: "ORIGIN GATE", label: "BRAND DNA", message: "MCM은 도시와 도시를 자유롭게 이동하는 글로벌 노마드의 감각을 담아온 브랜드입니다." },
    MATERIAL_SIGNAL: { eyebrow: "MATERIAL LOUNGE", label: "MATERIAL SENSE", message: "소재와 패턴을 가까이 살펴보세요. 손끝의 질감과 빛에 비치는 표면을 천천히 느껴보세요." },
    MATERIAL_SENSATION: { eyebrow: "MATERIAL LOUNGE", label: "MATERIAL SENSE", message: "소재와 패턴을 가까이 살펴보세요. 손끝의 질감과 빛에 비치는 표면을 천천히 느껴보세요." },
    COLOR_PATTERN_SIGNAL: { eyebrow: "MATERIAL LOUNGE", label: "COLOR & PATTERN", message: "같은 가방도 컬러와 패턴에 따라 전혀 다른 분위기를 만듭니다." },
    COLOR_PATTERN_MOOD: { eyebrow: "MATERIAL LOUNGE", label: "COLOR & PATTERN", message: "같은 가방도 컬러와 패턴에 따라 전혀 다른 분위기를 만듭니다." },
    MOVEMENT_SIGNAL: { eyebrow: "MOVEMENT DECK", label: "STYLE SCENE", message: "가방을 직접 들어보고 움직여보세요. 이 가방과 함께 이동하는 나의 장면을 떠올려볼게요." },
    WEARING_SCENE: { eyebrow: "MOVEMENT DECK", label: "STYLE SCENE", message: "가방을 직접 들어보고 움직여보세요. 이 가방과 함께 이동하는 나의 장면을 떠올려볼게요." },
    CITY_SIGNAL: { eyebrow: "CITY MOOD ROOM", label: "CITY SENSE", message: "도시별 사운드, 조명과 컬러를 경험해보세요. 어떤 도시보다 오래 남는 감각을 선택해주세요." },
    CITY_MOOD_SIGNAL: { eyebrow: "CITY MOOD ROOM", label: "CITY SENSE", message: "도시별 사운드, 조명과 컬러를 경험해보세요. 어떤 도시보다 오래 남는 감각을 선택해주세요." },
  };
  return copy[questionCode] ?? { eyebrow: spotName.toUpperCase(), label: "MOOD SELECT", message: `${spotName}에서 가장 오래 남은 감각을 선택해주세요.` };
}

function toMessage(caught: unknown) {
  if (caught instanceof ApiError) return caught.message;
  if (caught instanceof Error) return caught.message;
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
}
