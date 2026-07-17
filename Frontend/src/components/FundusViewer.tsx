import { useCallback, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { LESION_TYPES, lesionColor, type Lesion, type LesionType } from "./lesions";

export interface FundusViewerProps {
  imageUrl: string;
  /** natural image size (square viewBox) */
  size: number;
  lesions: Lesion[];
  visible: Record<LesionType, boolean>;
  redFree: boolean;
  /** unique id so multiple viewers don't share the same SVG filter def */
  viewId?: string;
  label?: string;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 8;

// Presentational: no data fetching, no context. Pans/zooms locally.
export function FundusViewer({
  imageUrl,
  size,
  lesions,
  visible,
  redFree,
  viewId = "v",
  label,
}: FundusViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      setScale((prev) => {
        const next = clampScale(prev * factor);
        const ratio = next / prev;
        // keep the point under the cursor stable
        setTx((t) => px - ratio * (px - t));
        setTy((t) => py - ratio * (py - t));
        return next;
      });
    },
    [],
  );

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, px, py);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx, ty };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setTx(drag.current.tx + (e.clientX - drag.current.x));
    setTy(drag.current.ty + (e.clientY - drag.current.y));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const reset = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };

  const filterId = `redfree-${viewId}`;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md bg-fundus-canvas select-none">
      {label && (
        <div className="absolute left-2 top-2 z-10 rounded-xs bg-fundus-chrome/90 px-2 py-0.5 font-mono text-micro text-white/90">
          {label}
        </div>
      )}

      <div
        ref={containerRef}
        className="h-full w-full cursor-grab active:cursor-grabbing touch-none"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div
          style={{
            width: size,
            height: size,
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          {/* SVG channel filter for red-free (map output RGB to input green) */}
          <svg width="0" height="0" className="absolute">
            <defs>
              <filter id={filterId}>
                <feColorMatrix
                  type="matrix"
                  values="0 1 0 0 0
                          0 1 0 0 0
                          0 1 0 0 0
                          0 0 0 1 0"
                />
              </filter>
            </defs>
          </svg>

          <img
            src={imageUrl}
            width={size}
            height={size}
            draggable={false}
            alt="fundus"
            style={{ filter: redFree ? `url(#${filterId})` : "none", display: "block" }}
          />

          {/* lesion overlay — same coordinate space as the image, scales together */}
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="pointer-events-none absolute left-0 top-0"
          >
            {lesions
              .filter((l) => visible[l.type])
              .map((l) => (
                <circle
                  key={l.id}
                  cx={l.cx}
                  cy={l.cy}
                  r={l.r}
                  fill={lesionColor(l.type)}
                  fillOpacity={0.28}
                  stroke={lesionColor(l.type)}
                  strokeWidth={1.5}
                />
              ))}
          </svg>
        </div>
      </div>

      {/* zoom controls */}
      <div className="absolute bottom-2 right-2 z-10 flex flex-col gap-1">
        <ViewerBtn onClick={() => zoomAt(1.2, 0, 0)} title="Phóng to">
          <ZoomIn size={15} />
        </ViewerBtn>
        <ViewerBtn onClick={() => zoomAt(1 / 1.2, 0, 0)} title="Thu nhỏ">
          <ZoomOut size={15} />
        </ViewerBtn>
        <ViewerBtn onClick={reset} title="Về mặc định">
          <Maximize size={15} />
        </ViewerBtn>
      </div>

      <div className="absolute bottom-2 left-2 z-10 rounded-xs bg-fundus-chrome/90 px-1.5 py-0.5 font-mono text-micro text-white/70 tabular-nums">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
}

function ViewerBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid h-7 w-7 place-items-center rounded-sm border border-white/15 bg-fundus-chrome/90 text-white/80 hover:bg-fundus-chrome hover:text-white"
    >
      {children}
    </button>
  );
}

export { LESION_TYPES };
