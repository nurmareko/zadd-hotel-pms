"use client";

import { useEffect, useRef } from "react";
import SignaturePad from "signature_pad";

import { Button } from "@/components/ui/button";

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
      <div className="rounded-lg border border-slate-300 bg-white p-1 overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          aria-label="Area tanda tangan tamu"
          className="block h-36 w-full touch-none"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
        <p className="text-xs text-slate-500">
          {value
            ? "Tanda tangan sudah direkam. Gunakan Hapus untuk mengulang."
            : "Tamu menandatangani area di atas dengan jari atau mouse."}
        </p>
        <Button
                  type="button"
                  variant="outline"
                  onClick={clearSignature}
                  disabled={!value}
                  className="shrink-0 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Hapus
                </Button>
      </div>
    </div>
  );
}
