export interface AutocompleteAnchorRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface AutocompleteDropdownFrame {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
}

const MIN_DROPDOWN_HEIGHT = 120;

interface GetAutocompleteDropdownFrameOptions {
  anchorRect: AutocompleteAnchorRect;
  edgePadding?: number;
  gap?: number;
  minHeight?: number;
  preferredMaxHeight?: number;
  windowHeight: number;
  windowWidth: number;
}

export function getAutocompleteDropdownFrame({
  anchorRect,
  edgePadding = 16,
  gap = 8,
  minHeight = 180,
  preferredMaxHeight = 320,
  windowHeight,
  windowWidth,
}: GetAutocompleteDropdownFrameOptions): AutocompleteDropdownFrame {
  const maxWidth = Math.max(0, windowWidth - edgePadding * 2);
  const clampedWidth = Math.min(anchorRect.width, maxWidth);
  const preferredLeft = Math.max(anchorRect.x, edgePadding);
  const left = Math.max(
    edgePadding,
    Math.min(preferredLeft, windowWidth - edgePadding - clampedWidth)
  );

  const availableBelow = Math.max(
    0,
    windowHeight - (anchorRect.y + anchorRect.height) - edgePadding - gap
  );
  const availableAbove = Math.max(0, anchorRect.y - edgePadding - gap);

  const placeAbove =
    availableBelow < minHeight && availableAbove > availableBelow;

  const maxHeight = Math.max(
    MIN_DROPDOWN_HEIGHT,
    Math.min(
      preferredMaxHeight,
      placeAbove ? availableAbove : availableBelow
    )
  );

  const top = placeAbove
    ? Math.max(edgePadding, anchorRect.y - maxHeight - gap)
    : anchorRect.y + anchorRect.height + gap;

  return {
    left,
    maxHeight,
    top,
    width: clampedWidth,
  };
}
