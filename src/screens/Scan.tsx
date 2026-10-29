import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { emptyDraft, type View } from "../lib/draft";
import { prepareFile, type Prepared } from "../lib/image";
import { useSettings } from "../lib/settings";

type Step = { kind: "choose" } | { kind: "reading"; preview?: string } | { kind: "error"; message: string; file?: Prepared };

export function Scan({ go }: { go: (v: View) => void }) {
  const { apiKey } = useSettings();
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const camera = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  async function read(file: Prepared) {
    const preview = file.kind === "image" ? URL.createObjectURL(file.blob) : undefined;
    setStep({ kind: "reading", preview });
    // Loaded on first scan so the rest of the app opens fast.
    const { ReadError, readReceipt } = await import("../lib/claude");
    try {
      const result = await readReceipt(file, apiKey);
      if (!alive.current) return;
      go({
        name: "review",
        draft: { ...result, image: file.blob },
        suggested: result.items,
      });
    } catch (err) {
      if (!alive.current) return;
      const message = err instanceof ReadError ? err.message : "Something went wrong while reading. Try again.";
      setStep({ kind: "error", message, file });
    } finally {
      if (preview) URL.revokeObjectURL(preview);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await read(await prepareFile(file));
    } catch {
      setStep({ kind: "error", message: "That file could not be opened. Use a photo (JPG, PNG) or a PDF." });
    }
  }

  return (
    <div className="stack pad">
      <h1>Add a receipt</h1>

      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={upload} type="file" accept="image/*,application/pdf" hidden onChange={onFile} />

      {step.kind === "reading" && (
        <section className="reading">
          <div className="viewfinder">
            {step.preview ? <img src={step.preview} alt="Your receipt" /> : <div className="pdf-doc"><Icon name="receipt" size={48} /> PDF</div>}
            <div className="sweep" />
          </div>
          <p className="reading-title"><span className="spinner" /> Reading your receipt</p>
          <p className="muted">Finding the shop, date and every item, then sorting each one into a category.</p>
        </section>
      )}

      {step.kind === "error" && (
        <section className="notice notice-error" role="alert">
          <Icon name="alert" />
          <span>{step.message}</span>
        </section>
      )}

      {step.kind !== "reading" && (
        <>
          <button type="button" className="big-choice primary" onClick={() => camera.current?.click()}>
            <span className="big-icon"><Icon name="camera" size={28} /></span>
            <span>
              <b>Scan with camera</b>
              <span>Lay the receipt flat in good light</span>
            </span>
          </button>
          <button type="button" className="big-choice" onClick={() => upload.current?.click()}>
            <span className="big-icon"><Icon name="upload" size={26} /></span>
            <span>
              <b>Upload photo or PDF</b>
              <span>From your gallery, files or an email receipt</span>
            </span>
          </button>
          {step.kind === "error" && step.file && (
            <button type="button" className="btn" onClick={() => read(step.file!)}>Try again</button>
          )}
          <button type="button" className="btn ghost" onClick={() => go({ name: "review", draft: emptyDraft() })}>
            <Icon name="pen" size={18} /> Type it in without a receipt
          </button>
        </>
      )}
    </div>
  );
}
