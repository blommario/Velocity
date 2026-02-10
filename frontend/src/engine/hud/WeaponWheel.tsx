/**
 * Radial weapon wheel HUD overlay — displays weapon slots in a circle, highlights hovered/selected weapon, shows ammo.
 * Uses O(1) angle-based index calculation, memoized SVG geometry, and sticky selection (center dead-zone keeps last pick).
 * Depends on: none (pure props)
 * Used by: Game-specific WeaponWheelOverlay wrapper
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface WeaponWheelSlot {
  id: string;
  label: string;
  short: string;
  color: string;
  keybind: string;
  ammo: { magazine?: number; magSize?: number; current: number; max: number } | null;
  hasAmmo: boolean;
}

export interface WeaponWheelProps {
  open: boolean;
  slots: readonly WeaponWheelSlot[];
  activeWeaponId: string;
  /** Called when the user confirms a selection (mouse click on a slot). */
  onSelect: (weaponId: string) => void;
  /** Called when the wheel is dismissed without a selection. */
  onClose: () => void;
  className?: string;
}

const WHEEL_RADIUS = 140;
const SLOT_RADIUS = 36;
const CENTER_RADIUS = 32;

/** Angle offset so slot 0 starts at top (-90deg). */
const ANGLE_OFFSET = -Math.PI / 2;
const TWO_PI = 2 * Math.PI;

/** Pre-computed slice geometry — only depends on slot count + layout constants. */
interface SliceGeometry {
  /** SVG path `d` string for the annular slice. */
  d: string;
  /** Label position (px offset from center). */
  labelX: number;
  labelY: number;
}

function buildSliceGeometry(slotCount: number): SliceGeometry[] {
  const sliceAngle = TWO_PI / slotCount;
  const innerR = CENTER_RADIUS;
  const outerR = WHEEL_RADIUS + SLOT_RADIUS - 4;
  const largeArc = sliceAngle > Math.PI ? 1 : 0;

  const result: SliceGeometry[] = [];
  for (let i = 0; i < slotCount; i++) {
    const startAngle = ANGLE_OFFSET + i * sliceAngle - sliceAngle / 2;
    const endAngle = startAngle + sliceAngle;

    const x1i = Math.cos(startAngle) * innerR;
    const y1i = Math.sin(startAngle) * innerR;
    const x1o = Math.cos(startAngle) * outerR;
    const y1o = Math.sin(startAngle) * outerR;
    const x2i = Math.cos(endAngle) * innerR;
    const y2i = Math.sin(endAngle) * innerR;
    const x2o = Math.cos(endAngle) * outerR;
    const y2o = Math.sin(endAngle) * outerR;

    const d = `M ${x1i} ${y1i} L ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1i} ${y1i} Z`;

    const centerAngle = ANGLE_OFFSET + i * sliceAngle;
    result.push({
      d,
      labelX: Math.cos(centerAngle) * WHEEL_RADIUS,
      labelY: Math.sin(centerAngle) * WHEEL_RADIUS,
    });
  }
  return result;
}

export function WeaponWheel({
  open,
  slots,
  activeWeaponId,
  onSelect,
  onClose,
  className,
}: WeaponWheelProps) {
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoize SVG geometry — only recompute when slot count changes
  const geometry = useMemo(() => buildSliceGeometry(slots.length), [slots.length]);

  // Init hovered index to active weapon when wheel opens (avoids dead-zone dismiss on center click)
  useEffect(() => {
    if (open) {
      const activeIdx = slots.findIndex((s) => s.id === activeWeaponId);
      setHoveredIdx(activeIdx >= 0 ? activeIdx : 0);
    }
  }, [open, slots, activeWeaponId]);

  // O(1) angle-based index lookup with sticky selection (center keeps last pick)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Dead zone — keep current selection (sticky)
    if (dist < CENTER_RADIUS) return;

    // O(1) index from angle
    let angle = Math.atan2(dy, dx) - ANGLE_OFFSET;
    if (angle < 0) angle += TWO_PI;
    const slotCount = slots.length;
    const idx = Math.floor(angle / (TWO_PI / slotCount)) % slotCount;
    setHoveredIdx(idx);
  }, [slots.length]);

  const handleClick = useCallback(() => {
    if (hoveredIdx >= 0 && hoveredIdx < slots.length) {
      onSelect(slots[hoveredIdx].id);
    } else {
      onClose();
    }
  }, [hoveredIdx, slots, onSelect, onClose]);

  if (!open) return null;

  const svgExtent = WHEEL_RADIUS + SLOT_RADIUS;

  return (
    <div
      ref={containerRef}
      className={className ?? 'absolute inset-0 flex items-center justify-center'}
      style={{ pointerEvents: 'auto', zIndex: 50 }}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    >
      {/* Dimmed background */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Wheel container */}
      <div className="relative" style={{ width: svgExtent * 2, height: svgExtent * 2 }}>
        {/* SVG slice highlights */}
        <svg
          className="absolute inset-0"
          viewBox={`${-svgExtent} ${-svgExtent} ${svgExtent * 2} ${svgExtent * 2}`}
          style={{ width: '100%', height: '100%' }}
        >
          {slots.map((slot, i) => {
            const isHovered = hoveredIdx === i;
            const isActive = slot.id === activeWeaponId;
            return (
              <path
                key={slot.id}
                d={geometry[i].d}
                fill={isHovered ? slot.color + '30' : isActive ? slot.color + '18' : 'rgba(0,0,0,0.3)'}
                stroke={isHovered ? slot.color : isActive ? slot.color + '60' : 'rgba(255,255,255,0.1)'}
                strokeWidth={isHovered ? 2 : 1}
              />
            );
          })}
        </svg>

        {/* Slot labels positioned around the wheel */}
        {slots.map((slot, i) => {
          const { labelX, labelY } = geometry[i];
          const isHovered = hoveredIdx === i;
          const isActive = slot.id === activeWeaponId;

          return (
            <div
              key={slot.id}
              className="absolute flex flex-col items-center"
              style={{
                left: `calc(50% + ${labelX}px - ${SLOT_RADIUS}px)`,
                top: `calc(50% + ${labelY}px - ${SLOT_RADIUS}px)`,
                width: SLOT_RADIUS * 2,
                height: SLOT_RADIUS * 2,
              }}
            >
              <div
                className="flex items-center justify-center rounded-full font-mono text-xs font-bold transition-transform duration-100"
                style={{
                  width: SLOT_RADIUS * 2 - 8,
                  height: SLOT_RADIUS * 2 - 8,
                  color: isHovered || isActive ? slot.color : '#888',
                  backgroundColor: isHovered ? slot.color + '20' : 'transparent',
                  transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                  opacity: slot.hasAmmo || slot.id === 'knife' ? 1 : 0.35,
                }}
              >
                <div className="text-center leading-tight">
                  <div className="text-sm">{slot.short}</div>
                  <div className="text-[8px] opacity-60">{slot.keybind}</div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Center: hovered weapon detail */}
        <div
          className="absolute font-mono text-center"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: CENTER_RADIUS * 2.5,
          }}
        >
          {hoveredIdx >= 0 && hoveredIdx < slots.length ? (
            <HoveredDetail slot={slots[hoveredIdx]} />
          ) : (
            <div className="text-[10px] text-white/40">SELECT</div>
          )}
        </div>
      </div>
    </div>
  );
}

function HoveredDetail({ slot }: { slot: WeaponWheelSlot }) {
  return (
    <>
      <div className="text-sm font-bold" style={{ color: slot.color }}>
        {slot.label}
      </div>
      {slot.ammo && (
        <div className="text-[10px] text-white/60 mt-0.5">
          {slot.ammo.magazine !== undefined
            ? `${slot.ammo.magazine}/${slot.ammo.magSize} [${Math.floor(slot.ammo.current)}]`
            : slot.ammo.current === Infinity
              ? '\u221E'
              : `${Math.floor(slot.ammo.current)}/${slot.ammo.max}`}
        </div>
      )}
    </>
  );
}
