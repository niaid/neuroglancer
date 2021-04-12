/**
 * @license
 * Copyright 2016 Google Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file Main entry point for default neuroglancer viewer.
 */
 import {bindDefaultCopyHandler, bindDefaultPasteHandler} from 'neuroglancer/ui/default_clipboard_handling';
 import {setDefaultInputEventBindings} from 'neuroglancer/ui/default_input_event_bindings';
 import {makeMinimalViewer} from 'neuroglancer/ui/minimal_viewer';
 import {disableContextMenu, disableWheel} from 'neuroglancer/ui/disable_default_actions';
 import 'neuroglancer/ui/default_viewer.css';
 
 (<any>window)['neuroglancerSetup'] = () =>
{
  disableContextMenu();
  disableWheel();
  let viewer = (<any>window)['viewer'] = makeMinimalViewer();
  setDefaultInputEventBindings(viewer.inputEventBindings);
  bindDefaultCopyHandler(viewer);
  bindDefaultPasteHandler(viewer);
  return viewer;
};
