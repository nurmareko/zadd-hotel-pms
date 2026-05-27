export const RESTAURANT_FLOOR_CANVAS_WIDTH = 900;
export const RESTAURANT_FLOOR_CANVAS_HEIGHT = 560;
export const RESTAURANT_TABLE_BOX_SIZE = 72;
export const RESTAURANT_TABLE_LAYOUT_MARGIN = 20;
export const RESTAURANT_TABLE_LAYOUT_GAP = 28;
export const RESTAURANT_TABLE_DRAG_GRID = 20;

const layoutStep = RESTAURANT_TABLE_BOX_SIZE + RESTAURANT_TABLE_LAYOUT_GAP;

export const RESTAURANT_TABLE_LAYOUT_COLUMNS = Math.max(
  1,
  Math.floor(
    (RESTAURANT_FLOOR_CANVAS_WIDTH -
      RESTAURANT_TABLE_LAYOUT_MARGIN * 2 +
      RESTAURANT_TABLE_LAYOUT_GAP) /
      layoutStep,
  ),
);

export type RestaurantTablePosition = {
  posX: number;
  posY: number;
};

export function getRestaurantTableGridPosition(
  index: number,
): RestaurantTablePosition {
  const column = index % RESTAURANT_TABLE_LAYOUT_COLUMNS;
  const row = Math.floor(index / RESTAURANT_TABLE_LAYOUT_COLUMNS);

  return {
    posX: RESTAURANT_TABLE_LAYOUT_MARGIN + column * layoutStep,
    posY: RESTAURANT_TABLE_LAYOUT_MARGIN + row * layoutStep,
  };
}

export function clampRestaurantTablePosition({
  posX,
  posY,
}: RestaurantTablePosition): RestaurantTablePosition {
  return {
    posX: Math.min(
      Math.max(Math.round(posX), 0),
      RESTAURANT_FLOOR_CANVAS_WIDTH - RESTAURANT_TABLE_BOX_SIZE,
    ),
    posY: Math.min(
      Math.max(Math.round(posY), 0),
      RESTAURANT_FLOOR_CANVAS_HEIGHT - RESTAURANT_TABLE_BOX_SIZE,
    ),
  };
}
