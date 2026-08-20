"use client";

import { Check, Radio, ScanLine, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildNfcUrl, isWebNfcSupported, writeNfcTag } from "@/lib/nfc";
import { mcmApi, Product } from "@/lib/mcm-api";

type SetupTag = "entry" | "bag-1" | "bag-2";
type BagDraft = { productId: string; product: Product | null; checking: boolean; error: string | null };

const bagOneId = Number(process.env.NEXT_PUBLIC_NFC_BAG_1_PRODUCT_ID ?? process.env.NEXT_PUBLIC_DEMO_PRODUCT_ID ?? 1);
const bagTwoId = Number(process.env.NEXT_PUBLIC_NFC_BAG_2_PRODUCT_ID ?? 2);

export default function NfcSetupPage() {
  const [writing, setWriting] = useState<SetupTag | null>(null);
  const [written, setWritten] = useState<SetupTag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const [bags, setBags] = useState<BagDraft[]>([
    { productId: String(bagOneId), product: null, checking: false, error: null },
    { productId: String(bagTwoId), product: null, checking: false, error: null },
  ]);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://example.com";
  const tags = useMemo(() => ({
    entry: { id: "entry" as const, title: "사이트 입장", detail: "첫 화면을 여는 스티커", url: buildNfcUrl(origin, { kind: "entry" }) },
    bags: bags.map((bag, index) => ({
      id: `bag-${index + 1}` as SetupTag,
      title: `가방 ${String(index + 1).padStart(2, "0")}`,
      detail: `${bag.product?.name ?? "상품 확인 필요"} · Product ID ${bag.productId || "-"}`,
      url: buildNfcUrl(origin, { kind: "product", productId: Number(bag.productId) }),
    })),
  }), [bags, origin]);

  useEffect(() => {
    queueMicrotask(() => setSupported(isWebNfcSupported()));
  }, []);

  const updateBag = (index: number, productId: string) => {
    setBags((current) => current.map((bag, bagIndex) => bagIndex === index ? { ...bag, productId, product: null, error: null } : bag));
    setWritten((current) => current.filter((id) => id !== `bag-${index + 1}`));
  };

  const verifyProduct = async (index: number) => {
    const productId = Number(bags[index].productId);
    if (!Number.isInteger(productId) || productId < 1) {
      setBags((current) => current.map((bag, bagIndex) => bagIndex === index ? { ...bag, error: "올바른 Product ID를 입력해주세요." } : bag));
      return;
    }
    setBags((current) => current.map((bag, bagIndex) => bagIndex === index ? { ...bag, checking: true, error: null, product: null } : bag));
    try {
      const product = await mcmApi.getProduct(productId);
      setBags((current) => current.map((bag, bagIndex) => bagIndex === index ? { ...bag, checking: false, product } : bag));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "상품 정보를 불러오지 못했어요.";
      setBags((current) => current.map((bag, bagIndex) => bagIndex === index ? { ...bag, checking: false, error: message } : bag));
    }
  };

  const write = async (tag: { id: SetupTag; title: string; detail: string; url: string }) => {
    if (tag.id !== "entry") {
      const bag = bags[Number(tag.id.at(-1)) - 1];
      if (!bag?.product || bag.product.id !== Number(bag.productId)) {
        setError("먼저 Product ID로 상품 정보를 확인해주세요.");
        return;
      }
    }
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
          <button className="nfc-entry-write" disabled={!supported || Boolean(writing)} onClick={() => write(tags.entry)}><b>{written.includes("entry") ? <Check /> : 1}</b><span><strong>{tags.entry.title}</strong><small>{tags.entry.detail}</small></span><em>{writing === "entry" ? "스티커를 대주세요…" : written.includes("entry") ? "기록 완료" : "기록하기"}</em></button>
          {tags.bags.map((tag, index) => {
            const complete = written.includes(tag.id);
            return <section className="nfc-bag-editor" key={tag.id}>
              <header><b>{complete ? <Check /> : index + 2}</b><span><strong>{tag.title}</strong><small>{tag.detail}</small></span></header>
              <label><span>Backend Product ID</span><input value={bags[index].productId} type="number" min="1" inputMode="numeric" placeholder="예: 1" onChange={(event) => updateBag(index, event.target.value)} /></label>
              <button className="nfc-lookup-button" disabled={bags[index].checking || Boolean(writing)} onClick={() => verifyProduct(index)}>{bags[index].checking ? "상품 조회 중…" : "상품 정보 확인"}</button>
              {bags[index].product && <div className="nfc-product-preview"><Check /><div><strong>{bags[index].product.name}</strong><span>{bags[index].product.category} · {bags[index].product.color} · {bags[index].product.material}</span>{bags[index].product.description && <p>{bags[index].product.description}</p>}</div></div>}
              {bags[index].error && <small className="nfc-field-error" role="alert">{bags[index].error}</small>}
              <button className="nfc-write-button" disabled={!supported || Boolean(writing) || !bags[index].product} onClick={() => write(tag)}>{writing === tag.id ? "스티커를 휴대폰에 대주세요…" : complete ? <><Check /> 기록 완료 · 다시 기록하기</> : "이 상품 ID로 NFC 기록하기"}</button>
            </section>;
          })}
        </div>
        {error && <div className="nfc-setup-error" role="alert">{error}</div>}
        <div className="nfc-setup-tip"><ScanLine /><span>금속 표면에 붙이면 인식률이 낮아질 수 있어요. 먼저 기록과 테스트를 마친 뒤 가방에 부착해주세요.</span></div>
      </section>
    </main>
  );
}
