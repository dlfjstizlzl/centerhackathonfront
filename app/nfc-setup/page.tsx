"use client";

import { Check, Radio, ScanLine, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildNfcUrl, isWebNfcSupported, writeNfcTag } from "@/lib/nfc";

type SetupTag = "entry" | "bag-1" | "bag-2";

const bagOneId = Number(process.env.NEXT_PUBLIC_NFC_BAG_1_PRODUCT_ID ?? process.env.NEXT_PUBLIC_DEMO_PRODUCT_ID ?? 1);
const bagTwoId = Number(process.env.NEXT_PUBLIC_NFC_BAG_2_PRODUCT_ID ?? 2);

export default function NfcSetupPage() {
  const [writing, setWriting] = useState<SetupTag | null>(null);
  const [written, setWritten] = useState<SetupTag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://example.com";
  const tags = useMemo(() => [
    { id: "entry" as const, title: "사이트 입장", detail: "첫 화면을 여는 스티커", url: buildNfcUrl(origin, { kind: "entry" }) },
    { id: "bag-1" as const, title: "가방 01", detail: `Product ID · ${bagOneId}`, url: buildNfcUrl(origin, { kind: "product", productId: bagOneId }) },
    { id: "bag-2" as const, title: "가방 02", detail: `Product ID · ${bagTwoId}`, url: buildNfcUrl(origin, { kind: "product", productId: bagTwoId }) },
  ], [origin]);

  useEffect(() => {
    queueMicrotask(() => setSupported(isWebNfcSupported()));
  }, []);

  const write = async (tag: (typeof tags)[number]) => {
    setWriting(tag.id);
    setError(null);
    try {
      await writeNfcTag(tag.url);
      setWritten((current) => current.includes(tag.id) ? current : [...current, tag.id]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "NFC 기록에 실패했어요.");
    } finally {
      setWriting(null);
    }
  };

  return (
    <main className="nfc-setup-page">
      <section className="nfc-setup-card">
        <Radio />
        <small>MCM PASSPORT · STORE SETUP</small>
        <h1>NFC 스티커 설정</h1>
        <p>Android Chrome에서 HTTPS로 접속한 뒤, 아래 순서대로 새 스티커를 휴대폰 뒷면에 대주세요.</p>
        <div className={`nfc-support ${supported ? "supported" : "unsupported"}`}>
          {supported ? <Check /> : <WifiOff />}
          <span>{supported ? "이 기기에서 NFC 기록 가능" : "Web NFC 미지원 기기"}</span>
        </div>
        <div className="nfc-setup-list">
          {tags.map((tag, index) => {
            const complete = written.includes(tag.id);
            return <button key={tag.id} disabled={!supported || Boolean(writing)} onClick={() => write(tag)}><b>{complete ? <Check /> : index + 1}</b><span><strong>{tag.title}</strong><small>{tag.detail}</small></span><em>{writing === tag.id ? "스티커를 대주세요…" : complete ? "기록 완료" : "기록하기"}</em></button>;
          })}
        </div>
        {error && <div className="nfc-setup-error" role="alert">{error}</div>}
        <div className="nfc-setup-tip"><ScanLine /><span>금속 표면에 붙이면 인식률이 낮아질 수 있어요. 먼저 기록과 테스트를 마친 뒤 가방에 부착해주세요.</span></div>
      </section>
    </main>
  );
}
