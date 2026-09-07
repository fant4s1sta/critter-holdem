import assert from "node:assert/strict";
import {
  ITEM_FLIGHT_MS,
  isTableItemId,
  itemFlightPath,
  mapViewportRectToElement,
  TABLE_ITEMS,
  tableItemSrc,
} from "./table-items";

assert.equal(TABLE_ITEMS.length, 4);
assert.equal(tableItemSrc("bomb"), "/items/bomb.webp");
assert.equal(tableItemSrc("egg"), "/items/egg.webp");
assert.equal(tableItemSrc("tomato"), "/items/tomato.webp");
assert.equal(tableItemSrc("heart"), "/items/heart.webp");
assert.equal(isTableItemId("bomb"), true);
assert.equal(isTableItemId("egg"), true);
assert.equal(isTableItemId("tomato"), true);
assert.equal(isTableItemId("heart"), true);
assert.equal(isTableItemId("big"), false);
assert.equal(isTableItemId(""), false);

assert.equal(ITEM_FLIGHT_MS > 300, true);
assert.equal(ITEM_FLIGHT_MS < 900, true);

const path = itemFlightPath(
  { left: 10, top: 20, width: 40, height: 40 },
  { left: 110, top: 80, width: 40, height: 40 },
);
assert.equal(path.x0, 30);
assert.equal(path.y0, 40);
assert.equal(path.x1, 130);
assert.equal(path.y1, 100);
assert.equal(path.mx, 80);
assert.equal(path.my < (path.y0 + path.y1) / 2, true);

const short = itemFlightPath(
  { left: 0, top: 0, width: 10, height: 10 },
  { left: 10, top: 0, width: 10, height: 10 },
);
const long = itemFlightPath(
  { left: 0, top: 0, width: 10, height: 10 },
  { left: 400, top: 0, width: 10, height: 10 },
);
assert.equal(long.my < short.my, true);

const mapped = mapViewportRectToElement(
  { left: 140, top: 280, width: 80, height: 80 },
  { left: 100, top: 200, width: 880, height: 1600 },
  440,
  800,
);
assert.equal(mapped.left, 20);
assert.equal(mapped.top, 40);
assert.equal(mapped.width, 40);
assert.equal(mapped.height, 40);

console.log("table item catalog tests passed");
