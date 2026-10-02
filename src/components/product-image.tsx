import { AdireArt, describeArt, type ArtSpec } from "./adire/art";

type Props = {
  name: string;
  art: ArtSpec;
  imageUrl: string | null;
  /** Describe the image to screen readers (product pages); omit where the name is already next to it. */
  described?: boolean;
  className?: string;
};

/** A product photo when one is set in the database, otherwise its generated adire swatch. */
export function ProductImage({ name, art, imageUrl, described = false, className = "" }: Props) {
  if (imageUrl) {
    return (
      // Photos can live on any host (Supabase Storage, Cloudinary, ...), so a plain img keeps setup simple.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={described ? name : ""}
        loading="lazy"
        decoding="async"
        className={`block h-full w-full object-cover ${className}`}
      />
    );
  }
  return <AdireArt spec={art} label={described ? describeArt(art) : undefined} className={`block h-full w-full ${className}`} />;
}
