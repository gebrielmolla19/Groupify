import { useMemo } from "react";
import { cn } from "../../../lib/utils";
import { makeGroupCover } from "../../../lib/groupCover";

interface GroupCoverProps {
  groupId: string;
  /** Size and corner radius come from the caller (e.g. `size-10 rounded-sm`). */
  className?: string;
}

/**
 * A group's generated cover. Decorative: the group's name is always shown
 * next to it, so it's hidden from assistive technology.
 */
export default function GroupCover({ groupId, className }: GroupCoverProps) {
  const cover = useMemo(() => makeGroupCover(groupId), [groupId]);

  return (
    <div
      aria-hidden="true"
      data-pattern={cover.pattern}
      className={cn("relative h-full w-full shrink-0 overflow-hidden", className)}
      style={{ background: cover.background, containerType: "size" }}
    >
      {/* The art is drawn square. In a non-square box it's centred and
          cropped (like object-fit: cover) so circles stay round. */}
      <div
        className="absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2"
        style={{ width: "max(100cqw, 100cqh)" }}
      >
        {cover.shapes.map((shape) => (
          <span
            // No two shapes in a cover share a position and width (rings share a
            // centre but differ in size; bars and tiles each have their own slot).
            key={`${shape.left}|${shape.top}|${shape.width}`}
            className="absolute"
            style={{
              left: shape.left,
              top: shape.top,
              width: shape.width,
              height: shape.height,
              background: shape.color,
              borderRadius: shape.radius,
            }}
          />
        ))}
      </div>
    </div>
  );
}
