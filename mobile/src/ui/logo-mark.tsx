import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "./theme";

const RAYS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const point = (r: number) => `${(16 + Math.cos(a) * r).toFixed(2)} ${(16 + Math.sin(a) * r).toFixed(2)}`;
  return `M${point(6.2)}L${point(11.2)}`;
}).join("");

/** A single tied oniko "moon": the mark beside the wordmark, as on the website. */
export function LogoMark({ size = 32, ink = colors.pit, resist = colors.starch }: { size?: number; ink?: string; resist?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessible={false}>
      <Circle cx={16} cy={16} r={14} fill={ink} />
      <Circle cx={16} cy={16} r={12.4} fill="none" stroke={resist} strokeWidth={1.8} />
      <Path d={RAYS} stroke={resist} strokeWidth={1.2} strokeLinecap="round" />
      <Circle cx={16} cy={16} r={4.2} fill={resist} />
      <Circle cx={16} cy={16} r={1.4} fill={ink} />
    </Svg>
  );
}
