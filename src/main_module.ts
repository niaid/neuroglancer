import "#src/util/polyfills.js";
import "#src/layer/enabled_frontend_modules.js";
import "#src/datasource/enabled_frontend_modules.js";
import "#src/kvstore/enabled_frontend_modules.js";
import {
  bindDefaultCopyHandler,
  bindDefaultPasteHandler,
} from "#src/ui/default_clipboard_handling.js";
import { setDefaultInputEventBindings } from "#src/ui/default_input_event_bindings.js";
import { makeMinimalViewer } from "#src/ui/minimal_viewer.js";
import {
  disableContextMenu,
  disableWheel,
} from "#src/ui/disable_default_actions.js";
import "#src/datasource/precomputed/register_default.js";
import "#src/datasource/zarr/register_default.js";
import "#src/layer/image/index.js";
import "#src/layer/annotation/index.js";

export { makeLayer } from "#src/layer/index.js";
export { insertDimensionAt } from "#src/coordinate_transform.js";
export { DEFAULT_FRAGMENT_MAIN } from "#src/sliceview/volume/image_renderlayer.js";

export default class Neuroglancer {
  version() {
    return "0.0.1";
  }
}

/**
 * Sets up the default neuroglancer viewer.
 */

export const hedwigSetup = (options: {
  target: HTMLElement | undefined;
  hedwigShowScaleBar: boolean;
}) => {
  // registerDimensionToolForViewer()
  // registerDimensionToolForUserLayer()
  // registerDimensionToolForLayerGroupViewer()

  disableContextMenu();
  disableWheel();
  let viewer = makeMinimalViewer({
    target: options.target,
    hedwigShowScaleBar: options.hedwigShowScaleBar,
  });
  setDefaultInputEventBindings(viewer.inputEventBindings);
  bindDefaultCopyHandler(viewer);
  bindDefaultPasteHandler(viewer);
  return viewer;
};
