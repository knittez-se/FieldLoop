"use client";

import { useRef, useState } from "react";
import { Camera, LoaderCircle } from "lucide-react";
import { fileToCompressedDataUrl } from "@/lib/image";
import { Button } from "./ui";

/** Camera / file picker that returns a downscaled JPEG data URL. */
export function PhotoInput({
  onPhoto,
  label = "Add photo",
  disabled,
  size = "sm",
}: {
  onPhoto: (dataUrl: string) => void;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onPhoto(await fileToCompressedDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process the photo.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
        data-testid="photo-file-input"
      />
      <Button variant="secondary" size={size} className={size === "md" ? "min-h-11 w-full" : undefined} icon={busy ? LoaderCircle : Camera} disabled={disabled || busy} onClick={() => ref.current?.click()}>
        {busy ? "Processing…" : label}
      </Button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
