import { EventActionMap } from "#src/util/event_action_map.js";
import type { InvlerpParameters } from "#src/webgl/shader_ui_controls.js";
import type { DataTypeInterval } from "#src/util/lerp.js";
import { dataTypeCompare } from "#src/util/lerp.js";

export const histogramSamplerTextureUnit = Symbol("histogramSamplerTexture");

export const inputEventMap = EventActionMap.fromObject({
  mousedown0: { action: "set" },
  "shift+mousedown0": { action: "adjust-window-via-drag" },
  wheel: { action: "zoom-via-wheel" },
});

export function getUpdatedParameters(
  existingBounds: InvlerpParameters,
  boundType: "range" | "window",
  endpointIndex: number,
  newEndpoint: number | bigint,
  fitRangeInWindow = false,
) {
  const newBounds = { ...existingBounds };
  const existingInterval = existingBounds[boundType];
  newBounds[boundType] = [
    existingInterval[0],
    existingInterval[1],
  ] as DataTypeInterval;
  newBounds[boundType][endpointIndex] = newEndpoint;
  if (
    boundType === "window" &&
    dataTypeCompare(newEndpoint, existingInterval[1 - endpointIndex]) *
      (2 * endpointIndex - 1) <
      0
  ) {
    newBounds[boundType][1 - endpointIndex] = newEndpoint;
  }
  if (boundType === "range" && fitRangeInWindow) {
    // Also adjust `window` endpoint to contain the new endpoint.
    const newWindowInterval = [
      existingBounds.window[0],
      existingBounds.window[1],
    ] as DataTypeInterval;
    for (let i = 0; i < 2; ++i) {
      if (
        dataTypeCompare(newEndpoint, newWindowInterval[i]) * (2 * i - 1) >
        0
      ) {
        newWindowInterval[i] = newEndpoint;
      }
    }
    newBounds.window = newWindowInterval;
  }
  return newBounds;
}
