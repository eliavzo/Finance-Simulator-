/**
 * Lightweight SVG line chart for equity / price series. No external chart
 * library — just react-native-svg so we keep full control of the look.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../utils/theme';

interface Props {
  data: number[];
  width: number;
  height: number;
  color?: string;
  /** Draw a soft area fill under the line. */
  fill?: boolean;
  /** Optional horizontal baseline value (e.g. starting capital). */
  baseline?: number;
}

export function LineChart({ data, width, height, color = colors.primary, fill = true, baseline }: Props) {
  if (data.length < 2) {
    return <View style={{ width, height }} />;
  }

  const pad = 6;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const values = baseline !== undefined ? [...data, baseline] : data;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) => pad + (i / (data.length - 1)) * w;
  const y = (v: number) => pad + h - ((v - min) / span) * h;

  let d = `M ${x(0)} ${y(data[0])}`;
  for (let i = 1; i < data.length; i++) {
    d += ` L ${x(i)} ${y(data[i])}`;
  }

  const areaPath = `${d} L ${x(data.length - 1)} ${pad + h} L ${x(0)} ${pad + h} Z`;
  const lastIdx = data.length - 1;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {baseline !== undefined ? (
        <Line
          x1={pad}
          y1={y(baseline)}
          x2={pad + w}
          y2={y(baseline)}
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ) : null}

      {fill ? <Path d={areaPath} fill="url(#areaGrad)" /> : null}
      <Path d={d} stroke={color} strokeWidth={2} fill="none" />
      <Circle cx={x(lastIdx)} cy={y(data[lastIdx])} r={3.5} fill={color} />
    </Svg>
  );
}
