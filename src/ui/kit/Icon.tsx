// A small inline icon set (16px, 1.5px stroke, currentColor): standard DAW glyphs instead of text labels. Every icon button
// still carries a title (tooltip) and an aria-label, so meaning is never icon-only for assistive tech.
import type { SVGProps } from "react";

const P = {
  menu: "M2.5 4.5h11M2.5 8h11M2.5 11.5h11",
  play: "M5 3.5v9l7.5-4.5z",
  pause: "M5.5 3.5v9M10.5 3.5v9",
  stop: "M4.5 4.5h7v7h-7z",
  playFrom: "M3.5 3v10M6.5 3.5v9l7-4.5z",
  marker: "M4.5 3h7v5.5L8 12.5 4.5 8.5z",
  skipStart: "M4 3.5v9M12 3.5L6.5 8 12 12.5z",
  record: "M8 4.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z",
  undo: "M6 4L3 7l3 3M3 7h6.5a3.5 3.5 0 010 7H7",
  redo: "M10 4l3 3-3 3M13 7H6.5a3.5 3.5 0 000 7H9",
  plus: "M8 3.5v9M3.5 8h9",
  minus: "M3.5 8h9",
  close: "M4 4l8 8M12 4l-8 8",
  check: "M3.5 8.5l3 3 6-7",
  chevronDown: "M4 6.5l4 4 4-4",
  chevronRight: "M6.5 4l4 4-4 4",
  chevronLeft: "M9.5 4L5.5 8l4 4",
  copy: "M5.5 5.5h7v7h-7zM3.5 10.5v-7h7",
  trash: "M3.5 4.5h9M6.5 4.5v-1.5h3v1.5M5 4.5l.5 8h5l.5-8",
  folder: "M2.5 5v7.5h11V6.5H8L6.5 5z",
  save: "M3.5 3.5h7.5l1.5 1.5v7.5h-9zM5.5 3.5v3h4v-3M5.5 12.5v-3.5h5v3.5",
  download: "M8 3v7M5 7.5l3 3 3-3M3.5 12.5h9",
  upload: "M8 10.5v-7M5 6l3-3 3 3M3.5 12.5h9",
  file: "M4 2.5h5l3 3v8H4zM9 2.5v3h3",
  help: "M6 6.2a2 2 0 113 1.7c-.7.4-1 .8-1 1.6M8 11.5v.5",
  midi: "M2.5 8a5.5 5.5 0 1011 0 5.5 5.5 0 10-11 0M5 7v.01M8 5.5v.01M11 7v.01M6 10.5v.01M10 10.5v.01",
  keys: "M2.5 4h11v8h-11zM6 4v8M10 4v8M4.5 8.5v3.5M8 8.5v3.5M11.5 8.5v3.5",
  wave: "M2 8h1.5M5 5v6M7.5 3v10M10 5.5v5M12.5 7v2M14 8",
  grid: "M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z",
  steps: "M2.5 5h2v2h-2zM6.5 5h2v2h-2zM10.5 5h3v2h-3zM2.5 9h3v2h-3zM8.5 9h2v2h-2z",
  arrange: "M2.5 4h5v2.5h-5zM6 8h7.5v2.5H6zM2.5 12h4v1.5h-4M9 12h4.5",
  mixer: "M4 2.5v11M8 2.5v11M12 2.5v11M2.5 6h3M6.5 9.5h3M10.5 5h3",
  loop: "M4 6.5V6a2 2 0 012-2h5M10 2.5l1.5 1.5L10 5.5M12 9.5v.5a2 2 0 01-2 2H5M6 13.5L4.5 12 6 10.5",
  song: "M2.5 4h4v2h-4zM8 7h5.5v2H8zM2.5 10h6v2h-6z",
  key: "M5 6.5a2 2 0 102.8 2.4l5.2 4M10.5 11l1.5-1.5",
  shuffle: "M2.5 5h2.5l5 6h3M2.5 11h2.5l1.8-2.2M9.5 5h4M12 3.5L13.5 5 12 6.5M12 9.5L13.5 11 12 12.5",
  pencil: "M3 13l.7-3L10.5 3.2l2.3 2.3L6 12.3zM9.3 4.5l2.2 2.2",
  link: "M6.5 9.5l3-3M5.2 7.8L4 9a2.5 2.5 0 003.5 3.5l1.2-1.2M10.8 8.2L12 7a2.5 2.5 0 00-3.5-3.5L7.3 4.7",
  spark: "M8 2.5l1.3 3.7 3.7 1.3-3.7 1.3L8 12.5 6.7 8.8 3 7.5l3.7-1.3z",
  arrangeAdd: "M2.5 4h5v2.5h-5zM2.5 9.5h5V12h-5zM11 6.5v5M8.5 9h5",
  settings: "M3 5h4M10 5h3M3 11h2M8 11h5M8.5 3.5v3M6.5 9.5v3",
  more: "M4 8v.01M8 8v.01M12 8v.01",
  arrangeBack: "M7 4h6.5v2.5H7zM7 8.5h6.5V11H7zM7 13h3.5M4.5 4.5L2.5 7l2 2.5",
  back: "M7 4L3.5 7.5 7 11M3.5 7.5h6.5a3 3 0 010 6H8",
  maximise: "M3 6.5V3h3.5M13 6.5V3H9.5M3 9.5V13h3.5M13 9.5V13H9.5",
  restore: "M6.5 3v3.5H3M9.5 3v3.5H13M6.5 13V9.5H3M9.5 13V9.5H13",
  graph: "M3 12.5V9M6.5 12.5V5M10 12.5V7.5M13.5 12.5V3.5",
  roll: "M2.5 4.5h4M7.5 7h5M4.5 9.5h4M9.5 12h4",
  note: "M6 12.5a1.8 1.5 0 100-.01M7.8 11.5V3.5l4 1.2",
  paste: "M5.5 3.5h5v2h-5zM4 4.5v8.5h8V4.5",
  chevronUp: "M4 9.5l4-4 4 4",
  queueAdd: "M2.5 4.5h8M2.5 8h6M2.5 11.5h4M12 8.5v5M9.5 11h5",
  sample: "M2 8h1.5M5 5v6M7.5 3v10M10 5.5v5M12.5 7v2",
} as const;

export type IconName = keyof typeof P;

interface Props extends Omit<SVGProps<SVGSVGElement>, "name" | "fill"> {
  name: IconName;
  size?: number;
  /** Solid shape rather than outline (play, stop, record). */
  fill?: boolean;
}

export function Icon({ name, size = 16, fill, ...rest }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" {...rest}>
      <path d={P[name]} />
    </svg>
  );
}
