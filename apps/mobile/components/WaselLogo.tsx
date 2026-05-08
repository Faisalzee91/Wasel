import { Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

const PRIMARY = "#0A5C4A";
const ACCENT = "#12967A";

function CarInPinIcon({ size = 52, color = PRIMARY, accent = ACCENT }: { size?: number; color?: string; accent?: string }) {
  const s = size / 52;
  return (
    <Svg width={52 * s} height={68 * s} viewBox="0 0 52 68" fill="none">
      <Path
        d="M26 0C11.641 0 0 11.641 0 26c0 17 26 42 26 42s26-25 26-42C52 11.641 40.359 0 26 0z"
        fill={color}
      />
      <Circle cx="26" cy="24" r="18" fill="white" opacity={0.12} />
      <Rect x="10" y="26" width="32" height="8" rx="2.5" fill="white" opacity={0.9} />
      <Path d="M15 26 L19 19 L33 19 L37 26Z" fill="white" opacity={0.9} />
      <Path d="M20.5 25.5 L23 20.5 L29 20.5 L31.5 25.5Z" fill={color} opacity={0.4} />
      <Circle cx="17" cy="34" r="4" fill={color} opacity={0.6} />
      <Circle cx="17" cy="34" r="2" fill="white" opacity={0.5} />
      <Circle cx="35" cy="34" r="4" fill={color} opacity={0.6} />
      <Circle cx="35" cy="34" r="2" fill="white" opacity={0.5} />
      <Circle cx="26" cy="60" r="3" fill={accent} opacity={0.7} />
    </Svg>
  );
}

interface WaselLogoProps {
  iconSize?: number;
  /** "horizontal" = icon left of text, "stacked" = icon above text */
  layout?: "horizontal" | "stacked";
  /** invert = white text + white icon (for dark/teal backgrounds) */
  inverted?: boolean;
}

export function WaselLogo({ iconSize = 48, layout = "horizontal", inverted = false }: WaselLogoProps) {
  const textColor = inverted ? "#FFFFFF" : PRIMARY;
  const iconColor = inverted ? "rgba(255,255,255,0.9)" : PRIMARY;
  const iconAccent = inverted ? "rgba(255,255,255,0.5)" : ACCENT;
  const dividerColor = inverted ? "rgba(255,255,255,0.3)" : `${PRIMARY}33`;

  if (layout === "stacked") {
    return (
      <View style={{ alignItems: "center", gap: 10 }}>
        <CarInPinIcon size={iconSize} color={iconColor} accent={iconAccent} />
        <View style={{ alignItems: "center", gap: 3 }}>
          <Text
            style={{
              fontSize: 36,
              fontWeight: "700",
              color: textColor,
              lineHeight: 40,
              writingDirection: "rtl",
            }}
          >
            واصل
          </Text>
          <View style={{ width: 56, height: 1, backgroundColor: dividerColor }} />
          <Text
            style={{
              fontSize: 12,
              letterSpacing: 3.5,
              color: textColor,
              fontWeight: "600",
              opacity: inverted ? 0.85 : 0.7,
            }}
          >
            WASEL
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <CarInPinIcon size={iconSize} color={iconColor} accent={iconAccent} />
      <View style={{ alignItems: "flex-end", gap: 3 }}>
        <Text
          style={{
            fontSize: 34,
            fontWeight: "700",
            color: textColor,
            lineHeight: 38,
            writingDirection: "rtl",
          }}
        >
          واصل
        </Text>
        <View style={{ width: 52, height: 1, backgroundColor: dividerColor }} />
        <Text
          style={{
            fontSize: 11,
            letterSpacing: 3,
            color: textColor,
            fontWeight: "600",
            opacity: inverted ? 0.85 : 0.7,
          }}
        >
          WASEL
        </Text>
      </View>
    </View>
  );
}
