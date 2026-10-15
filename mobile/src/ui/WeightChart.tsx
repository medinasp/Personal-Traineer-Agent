import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { useTheme } from "../theme";
import { formatDate } from "../utils/date";

export interface WeightPoint {
  date: string; // ISO
  weight: number; // peso maximo do treino
}

const H = 220;
const PAD = { top: 16, right: 14, bottom: 26, left: 38 };

/** grafico de linha x=datas / y=peso maximo por treino */
export function WeightChart({ points }: { points: WeightPoint[] }) {
  const { c } = useTheme();
  const [w, setW] = useState(0);

  const plotW = Math.max(w - PAD.left - PAD.right, 1);
  const plotH = H - PAD.top - PAD.bottom;

  const weights = points.map((p) => p.weight);
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (!isFinite(min) || !isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (min === max) {
    min -= 5;
    max += 5;
  } else {
    const m = (max - min) * 0.15;
    min -= m;
    max += m;
  }

  const x = (i: number) =>
    PAD.left + (points.length <= 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
  const y = (v: number) => PAD.top + plotH * (1 - (v - min) / (max - min));

  // linha + area
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.weight)}`).join(" ");
  const area =
    points.length > 1
      ? `${line} L ${x(points.length - 1)} ${PAD.top + plotH} L ${x(0)} ${PAD.top + plotH} Z`
      : "";

  // 3 linhas-guia horizontais (min, meio, max)
  const gridVals = [min, (min + max) / 2, max];

  // rotulos de data: primeiro, meio, ultimo (evita apinhar)
  const labelIdx =
    points.length <= 1
      ? [0]
      : points.length === 2
        ? [0, points.length - 1]
        : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <View style={styles.wrap} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={H}>
          <Defs>
            <LinearGradient id="wc-area" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.primary} stopOpacity={0.28} />
              <Stop offset="1" stopColor={c.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {gridVals.map((v, i) => (
            <Line
              key={`g${i}`}
              x1={PAD.left}
              y1={y(v)}
              x2={w - PAD.right}
              y2={y(v)}
              stroke={c.border}
              strokeWidth={1}
            />
          ))}
          {gridVals.map((v, i) => (
            <SvgText
              key={`gl${i}`}
              x={PAD.left - 6}
              y={y(v) + 4}
              fontSize={10}
              fill={c.textMuted}
              textAnchor="end"
            >
              {Math.round(v)}
            </SvgText>
          ))}

          {area ? <Path d={area} fill="url(#wc-area)" /> : null}
          {points.length > 1 ? (
            <Path d={line} stroke={c.primary} strokeWidth={2.5} fill="none" />
          ) : null}

          {points.map((p, i) => (
            <Circle
              key={`p${i}`}
              cx={x(i)}
              cy={y(p.weight)}
              r={points.length > 30 ? 2 : 3.5}
              fill={c.primary}
              stroke={c.card}
              strokeWidth={1.5}
            />
          ))}

          {labelIdx.map((i) => (
            <SvgText
              key={`x${i}`}
              x={x(i)}
              y={H - 8}
              fontSize={10}
              fill={c.textMuted}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            >
              {formatDate(points[i].date)}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: H, width: "100%" },
});
