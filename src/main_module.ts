import {bindDefaultCopyHandler, bindDefaultPasteHandler} from 'neuroglancer/ui/default_clipboard_handling';
import {setDefaultInputEventBindings} from 'neuroglancer/ui/default_input_event_bindings';
import {makeMinimalViewer} from 'neuroglancer/ui/minimal_viewer';
import {registerLayerType, registerVolumeLayerType} from 'neuroglancer/layer';
import {VolumeType} from 'neuroglancer/sliceview/volume/base';
import {ImageUserLayer} from 'neuroglancer/image_user_layer';
import {PrecomputedDataSource} from 'neuroglancer/datasource/precomputed/frontend';
import {registerProvider} from 'neuroglancer/datasource/default_provider';
import {disableContextMenu, disableWheel} from 'neuroglancer/ui/disable_default_actions';
import {asyncComputationWorkerFileName} from "./asyncComputationWorkerFileName"
export {SHADER_JSON_KEY } from "./neuroglancer/image_user_layer"
export {DEFAULT_FRAGMENT_MAIN} from "./neuroglancer/sliceview/volume/image_renderlayer"

export default class Neuroglancer {
  version() {
    return '0.0.1';
  }
}

export const hedwigSetup = (options: {
  target: HTMLElement | undefined,
  chunkWorkerFileName: string,
  asyncComputationWorkerFileName: string
}) => {
  // Note: need to set this value before invoking neuroglancer.
  asyncComputationWorkerFileName.fileName = options.asyncComputationWorkerFileName

  registerLayerType('image', ImageUserLayer);
  registerVolumeLayerType(VolumeType.IMAGE, ImageUserLayer);

  registerProvider('precomputed', () => new PrecomputedDataSource());


  disableContextMenu();
  disableWheel();
  let viewer = makeMinimalViewer({
    chunkWorkerFileName: options.chunkWorkerFileName,
  }, options.target);
  setDefaultInputEventBindings(viewer.inputEventBindings);
  bindDefaultCopyHandler(viewer);
  bindDefaultPasteHandler(viewer);
  return viewer;
}
