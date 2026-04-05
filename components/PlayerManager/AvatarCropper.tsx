// components/PlayerManager/AvatarCropper.tsx
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

type Props = {
  file: File;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
};

const CANVAS_SIZE = 300;
const RADIUS = 130;
const CENTER = CANVAS_SIZE / 2;

export function AvatarCropper({ file, onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, offsetX: 0, offsetY: 0 });

  // Load image from file
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Draw canvas whenever zoom/offset changes
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Base scale so the short side fits the circle diameter
    const baseScale = (RADIUS * 2) / Math.min(img.naturalWidth, img.naturalHeight);
    const scale = baseScale * zoom;
    const imgW = img.naturalWidth * scale;
    const imgH = img.naturalHeight * scale;
    const drawX = CENTER - imgW / 2 + offset.x;
    const drawY = CENTER - imgH / 2 + offset.y;

    // Draw image clipped to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, drawX, drawY, imgW, imgH);
    ctx.restore();

    // Dark overlay outside circle
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2, true); // counter-clockwise hole
    ctx.fill();

    // Circle border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }, [zoom, offset]);

  useEffect(() => { draw(); }, [draw]);

  // Mouse drag
  function onMouseDown(e: React.MouseEvent) {
    setDragging(true);
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, offsetX: offset.x, offsetY: offset.y };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.offsetX + (e.clientX - dragStart.current.mouseX),
      y: dragStart.current.offsetY + (e.clientY - dragStart.current.mouseY),
    });
  }

  function onMouseUp() { setDragging(false); }

  // Touch drag
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    setDragging(true);
    dragStart.current = { mouseX: t.clientX, mouseY: t.clientY, offsetX: offset.x, offsetY: offset.y };
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging) return;
    const t = e.touches[0];
    setOffset({
      x: dragStart.current.offsetX + (t.clientX - dragStart.current.mouseX),
      y: dragStart.current.offsetY + (t.clientY - dragStart.current.mouseY),
    });
  }

  // Export 256×256 crop
  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const out = document.createElement('canvas');
    out.width = 256;
    out.height = 256;
    const outCtx = out.getContext('2d')!;
    outCtx.drawImage(
      canvas,
      CENTER - RADIUS, CENTER - RADIUS, RADIUS * 2, RADIUS * 2,
      0, 0, 256, 256
    );
    out.toBlob(blob => { if (blob) onSave(blob); }, 'image/jpeg', 0.85);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-[#1e1e1e] border border-[#333] rounded-xl p-6 flex flex-col items-center gap-4 w-[360px]">
        <h3 className="text-[14px] font-semibold text-[#ccc] tracking-[1px] uppercase self-start">Обрезка аватарки</h3>

        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="rounded-lg cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onMouseUp}
        />

        {/* Zoom slider */}
        <div className="w-full flex items-center gap-3">
          <span className="text-[#555] text-[12px]">−</span>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.05"
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="flex-1 accent-violet-600"
          />
          <span className="text-[#555] text-[12px]">+</span>
          <span className="text-[#555] text-[11px] w-[36px] text-right">{Math.round(zoom * 100)}%</span>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3 self-start">
          <PreviewCircle canvasRef={canvasRef} zoom={zoom} offset={offset} />
          <span className="text-[#555] text-[12px]">Превью 48px</span>
        </div>

        <div className="flex gap-3 w-full">
          <button onClick={onCancel} className="flex-1 bg-transparent border border-[#333] text-[#666] rounded-lg py-2 text-[13px] cursor-pointer hover:border-[#555]">
            Отмена
          </button>
          <button onClick={handleSave} className="flex-1 bg-violet-700 text-white border-none rounded-lg py-2 text-[13px] font-semibold cursor-pointer hover:bg-violet-800">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// Small live preview circle
function PreviewCircle({ canvasRef, zoom, offset }: { canvasRef: React.RefObject<HTMLCanvasElement | null>; zoom: number; offset: { x: number; y: number } }) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const src = canvasRef.current;
    const preview = previewRef.current;
    if (!src || !preview) return;
    const ctx = preview.getContext('2d')!;
    ctx.clearRect(0, 0, 48, 48);
    ctx.save();
    ctx.beginPath();
    ctx.arc(24, 24, 24, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(src, CENTER - RADIUS, CENTER - RADIUS, RADIUS * 2, RADIUS * 2, 0, 0, 48, 48);
    ctx.restore();
  }, [canvasRef, zoom, offset]);  // re-draw when zoom/offset change

  return <canvas ref={previewRef} width={48} height={48} className="rounded-full" />;
}
