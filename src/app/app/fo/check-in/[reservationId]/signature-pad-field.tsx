"use client";

import { useEffect, useRef } from "react";
import SignaturePad from "signature_pad";

type SignaturePadFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SignaturePadField({
  value,
  onChange,
}: SignaturePadFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const signaturePad = new SignaturePad(canvas, {
      penColor: "#0a0e1a",
      minWidth: 0.75,
      maxWidth: 2.5,
    });
    signaturePadRef.current = signaturePad;

    function resizeCanvas() {
      const currentCanvas = canvasRef.current;

      if (!currentCanvas) {
        return;
      }

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const width = currentCanvas.offsetWidth;
      const height = currentCanvas.offsetHeight;

      if (
        currentCanvas.width === width * ratio &&
        currentCanvas.height === height * ratio
      ) {
        return;
      }

      currentCanvas.width = width * ratio;
      currentCanvas.height = height * ratio;
      currentCanvas.getContext("2d")?.scale(ratio, ratio);
      signaturePad.redraw();
    }

    function captureSignature() {
      onChangeRef.current(signaturePad.toDataURL("image/png"));
    }

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);
    signaturePad.addEventListener("endStroke", captureSignature);
    resizeCanvas();

    return () => {
      resizeObserver.disconnect();
      signaturePad.removeEventListener("endStroke", captureSignature);
      signaturePad.off();
      signaturePadRef.current = null;
    };
  }, []);

  function clearSignature() {
    signaturePadRef.current?.clear();
    onChange("");
  }

  return (
    <div>
      <div className="border border-console-border bg-white p-1">
        <canvas
          ref={canvasRef}
          aria-label="Area tanda tangan tamu"
          className="block h-36 w-full touch-none"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500">
          {value
            ? "Tanda tangan sudah direkam. Gunakan Hapus untuk mengulang."
            : "Tamu menandatangani area di atas dengan jari atau mouse."}
        </p>
        <button
          type="button"
          onClick={clearSignature}
          disabled={!value}
          className="h-7 shrink-0 border border-console-border bg-console-surface px-2.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-console-ink hover:border-console-ink hover:bg-console-bg disabled:cursor-not-allowed disabled:opacity-45"
        >
          Hapus
        </button>
      </div>
    </div>
  );
}
