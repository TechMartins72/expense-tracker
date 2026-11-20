import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import type { ReactNode } from 'react';

/** Ring showing `value` of `max` (set aside versus due). */
export function ProgressRing({
  value,
  max,
  color,
  size = 64,
  stroke = 7,
  children,
}: {
  value: number;
  max: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max <= 0 ? 0 : Math.min(Math.max(value / max, 0), 1);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.colors.track} strokeWidth={stroke} fill="none" />
          {pct > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${c * pct} ${c}`}
            />
          ) : null}
        </G>
      </Svg>
      {children}
    </View>
  );
}

/** Donut of category totals. Segments are separated by a small gap in the surface colour. */
export function Donut({
  parts,
  size = 168,
  stroke = 22,
  children,
}: {
  parts: { value: number; color: string }[];
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((a, p) => a + Math.max(p.value, 0), 0);
  const gap = parts.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.colors.track} strokeWidth={stroke} fill="none" />
          {total > 0
            ? parts.map((p, i) => {
                const len = (Math.max(p.value, 0) / total) * c;
                const seg = (
                  <Circle
                    key={i}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={p.color}
                    strokeWidth={stroke}
                    fill="none"
                    strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return seg;
              })
            : null}
        </G>
      </Svg>
      {children}
    </View>
  );
}
