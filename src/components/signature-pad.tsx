"use client";

// ALT-14: signature capture component. Shared by PAR and procurement.

import { useEffect, useRef, useState } from "react";
import SignaturePadLib from "signature_pad";
import { Button } from "@/components/ui/button";

export type SignerRole = "employee" | "supervisor";

export type SignatureResult = {
  png: string; // data URL, "data:image/png;base64,..."
  signerName: string;
  signerEmail: string;
  role: SignerRole;
  signedAt: string; // ISO timestamp
};

type SignaturePadProps = {
  signerName: string;
  signerEmail: string;
  role: SignerRole;
  onSign: (result: SignatureResult) => void;
};

export function SignaturePad({
  signerName,
  signerEmail,
  role,
  onSign,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePadLib(canvas, { penColor: "#000" });
    padRef.current = pad;

    function resizeCanvas() {
      if (!canvas) return;
      if (!canvas.offsetWidth) return; // hidden or collapsed, keep existing strokes
      // At least 2x, so even desktop signatures stay sharp on a PDF
      const ratio = Math.max(window.devicePixelRatio || 1, 2);
      const data = pad.toData(); // resizing wipes the canvas, so save strokes
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad.fromData(data); // redraw them
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const handleEndStroke = () => setIsEmpty(pad.isEmpty());
    pad.addEventListener("endStroke", handleEndStroke);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      pad.removeEventListener("endStroke", handleEndStroke);
      pad.off();
      padRef.current = null;
    };
  }, []);

  function handleClear() {
    padRef.current?.clear();
    setIsEmpty(true);
  }

  function handleUndo() {
    const pad = padRef.current;
    if (!pad) return;
    const data = pad.toData();
    data.pop(); // each entry is one stroke
    pad.fromData(data);
    setIsEmpty(pad.isEmpty());
  }

  function handleConfirm() {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return; // safeguard besides the disabled button
    onSign({
      png: pad.toDataURL("image/png"),
      signerName,
      signerEmail,
      role,
      signedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="flex w-full max-w-[500px] flex-col gap-2">
      <canvas
        ref={canvasRef}
        className="aspect-[10/3] w-full touch-none rounded-md border select-none"
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleUndo}
          disabled={isEmpty}
        >
          Undo
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleClear}
          disabled={isEmpty}
        >
          Clear
        </Button>
        <Button type="button" onClick={handleConfirm} disabled={isEmpty}>
          Confirm
        </Button>
      </div>
    </div>
  );
}
