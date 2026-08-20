export type NfcTagKind = "entry" | "product";

export type NfcPayload = {
  kind: NfcTagKind;
  productId?: number;
};

type NdefRecordLike = {
  recordType: string;
  mediaType?: string;
  data?: DataView;
};

type NdefReadingEventLike = Event & {
  message: { records: NdefRecordLike[] };
};

type NdefReaderLike = {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  write(message: string | { records: Array<Record<string, unknown>> }): Promise<void>;
  addEventListener(type: "reading", listener: (event: NdefReadingEventLike) => void): void;
  addEventListener(type: "readingerror", listener: () => void): void;
};

type NdefReaderConstructor = new () => NdefReaderLike;

function getNdefReader() {
  if (typeof window === "undefined") return null;
  return (window as Window & { NDEFReader?: NdefReaderConstructor }).NDEFReader ?? null;
}

export function isWebNfcSupported() {
  return Boolean(getNdefReader());
}

export function buildNfcUrl(origin: string, payload: NfcPayload) {
  const url = new URL("/", origin);
  url.searchParams.set("nfc", payload.kind);
  if (payload.kind === "product" && payload.productId) {
    url.searchParams.set("product", String(payload.productId));
  }
  return url.toString();
}

export function parseNfcUrl(value: string): NfcPayload | null {
  try {
    const url = new URL(value, typeof window === "undefined" ? "https://mcm.invalid" : window.location.origin);
    const kind = url.searchParams.get("nfc");
    if (kind === "entry") return { kind };
    if (kind === "product") {
      const productId = Number(url.searchParams.get("product"));
      return Number.isInteger(productId) && productId > 0 ? { kind, productId } : null;
    }
  } catch {}
  return null;
}

function decodeRecord(record: NdefRecordLike) {
  if (!record.data) return "";
  const encoding = record.recordType === "url" || record.mediaType === "text/uri-list" ? "utf-8" : "utf-8";
  return new TextDecoder(encoding).decode(record.data);
}

export async function scanNfcTag(options: {
  signal: AbortSignal;
  onRead: (payload: NfcPayload) => void;
  onError: (message: string) => void;
}) {
  const Reader = getNdefReader();
  if (!Reader) throw new Error("이 기기에서는 Web NFC를 지원하지 않아요. Android Chrome에서 이용해주세요.");

  const reader = new Reader();
  reader.addEventListener("reading", (event) => {
    const payload = event.message.records
      .map((record) => parseNfcUrl(decodeRecord(record)))
      .find((candidate): candidate is NfcPayload => Boolean(candidate));
    if (payload) options.onRead(payload);
    else options.onError("MCM Passport용 NFC 스티커가 아니에요.");
  });
  reader.addEventListener("readingerror", () => options.onError("NFC 스티커를 읽지 못했어요. 다시 가까이 대주세요."));
  await reader.scan({ signal: options.signal });
}

export async function writeNfcTag(url: string) {
  const Reader = getNdefReader();
  if (!Reader) throw new Error("이 기기에서는 NFC 기록을 지원하지 않아요. Android Chrome에서 열어주세요.");
  const reader = new Reader();
  await reader.write({ records: [{ recordType: "url", data: url }] });
}
