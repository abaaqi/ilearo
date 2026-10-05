import { Image } from "expo-image";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { shopUrl } from "@/lib/config";
import type { Image as ApiImage } from "@/lib/types";
import { colors } from "./theme";

/*
 * The website textures its swatches with SVG filters, which phones don't
 * draw. These two images are those same filters, rendered once
 * (see scripts/render-app-textures.mjs in the website project), laid over the
 * flat pattern from the API.
 */
const CLOUD = require("@/assets/textures/cloud.png");
const WEAVE = require("@/assets/textures/weave.png");

type Props = {
  image: ApiImage;
  style?: StyleProp<ViewStyle>;
  /** Describe the picture to screen readers. Leave out where the product name is right next to it. */
  described?: boolean;
  recyclingKey?: string;
};

/** A product photo, or its generated adire swatch with the cloth texture on top. */
export function Swatch({ image, style, described = false, recyclingKey }: Props) {
  return (
    <View
      style={[styles.frame, style]}
      accessible={described}
      accessibilityRole={described ? "image" : undefined}
      accessibilityLabel={described ? image.description : undefined}
      importantForAccessibility={described ? "yes" : "no-hide-descendants"}
    >
      <Image
        source={{ uri: shopUrl(image.url) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey}
        accessible={false}
      />
      {image.kind === "art" ? (
        <>
          <Image source={CLOUD} style={[StyleSheet.absoluteFill, styles.cloud]} contentFit="cover" accessible={false} />
          <Image source={WEAVE} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.pit, overflow: "hidden" },
  cloud: { opacity: 0.42 },
});
