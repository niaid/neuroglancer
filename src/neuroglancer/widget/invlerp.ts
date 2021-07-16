/**
 * @license
 * Copyright 2020 Google Inc.
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

import './invlerp.css';

import svg_arrowLeft from 'ikonate/icons/arrow-left.svg';
import svg_arrowRight from 'ikonate/icons/arrow-right.svg';
import {DisplayContext, RenderedPanel} from 'neuroglancer/display_context';
import {WatchableValueInterface} from 'neuroglancer/trackable_value';
import {animationFrameDebounce} from 'neuroglancer/util/animation_frame_debounce';
import {DataType} from 'neuroglancer/util/data_type';
import {updateInputFieldWidth} from 'neuroglancer/util/dom';
import {Uint64} from 'neuroglancer/util/uint64';
import {WatchableVisibilityPriority} from 'neuroglancer/visibility_priority/frontend';
import {ParameterizedEmitterDependentShaderGetter, parameterizedEmitterDependentShaderGetter} from 'neuroglancer/webgl/dynamic_shader';
import {HistogramSpecifications} from 'neuroglancer/webgl/empirical_cdf';
import {
  computeInvlerp, dataTypeCompare, DataTypeInterval, defineLerpShaderFunction,
  enableLerpShaderFunction, getClampedInterval, getIntervalBoundsEffectiveFraction,
  getIntervalBoundsEffectiveOffset, parseDataTypeValue
} from 'neuroglancer/webgl/lerp';
import {getShaderType} from 'neuroglancer/webgl/shader_lib';
import {InvlerpParameters, ShaderInvlerpControl} from 'neuroglancer/webgl/shader_ui_controls';
import {getSquareCornersBuffer} from 'neuroglancer/webgl/square_corners_buffer';
import {makeIcon} from 'neuroglancer/widget/icon';
import {LegendShaderOptions, ShaderControlsOptions} from 'neuroglancer/widget/shader_controls';
import {Tab} from 'neuroglancer/widget/tab_view';
import {HistogramPanel} from "neuroglancer/widget/histogram";
import {getUpdatedParameters, NUM_CDF_LINES, histogramSamplerTextureUnit} from "neuroglancer/widget/invlerpUtils"

function dummyColorLegendShaderModule() {}

class ColorLegendPanel extends RenderedPanel {
  private shaderOptions: LegendShaderOptions;
  constructor(public parent: InvlerpWidget) {
    super(parent.display, document.createElement('div'), parent.visibility);
    const {element} = this;
    element.classList.add('neuroglancer-invlerp-legend-panel');
    const shaderOptions = this.shaderOptions = parent.shaderControlsOptions.legendShaderOptions!;
    this.shaderGetter = parameterizedEmitterDependentShaderGetter(this, this.gl, {
      ...shaderOptions,
      memoizeKey: {id: `colorLegendShader`, base: shaderOptions.memoizeKey},
      defineShader: (builder, parameters, extraParameters) => {
        builder.addOutputBuffer('vec4', 'v4f_fragData0', 0);
        builder.addAttribute('vec2', 'aVertexPosition');
        builder.addUniform('float', 'uLegendOffset');
        builder.addVarying('float', 'vLinearPosition');
        builder.setVertexMain(`
gl_Position = vec4(aVertexPosition, 0.0, 1.0);
vLinearPosition = -uLegendOffset + ((aVertexPosition.x + 1.0) * 0.5) * (1.0 + 2.0 * uLegendOffset);
`);
        const dataType = this.parent.dataType;
        const shaderDataType = getShaderType(dataType);
        builder.addFragmentCode(defineLerpShaderFunction(builder, 'ng_colorLegendLerp', dataType));
        builder.addFragmentCode(`
void emit(vec4 v) {
  v4f_fragData0 = v;
}
${shaderDataType} getDataValue() {
  return ng_colorLegendLerp(vLinearPosition);
}
${shaderDataType} getDataValue(int dummyChannel) {
  return getDataValue();
}
${shaderDataType} getInterpolatedDataValue() {
  return getDataValue();
}
${shaderDataType} getInterpolatedDataValue(int dummyChannel) {
  return getDataValue();
}
`);
        shaderOptions.defineShader(builder, parameters, extraParameters);
      },
    });
  }

  private shaderGetter: ParameterizedEmitterDependentShaderGetter;

  private cornersBuffer = getSquareCornersBuffer(this.gl, -1, -1, 1, 1);

  draw() {
    const shaderResult = this.shaderGetter(dummyColorLegendShaderModule);
    const {shader} = shaderResult;
    if (shader === null) return;
    this.setGLLogicalViewport();
    shader.bind();
    this.shaderOptions.initializeShader(shaderResult);
    const {gl} = this;
    gl.enable(WebGL2RenderingContext.BLEND);
    const {trackable: {value: {window}}, dataType} = this.parent;
    enableLerpShaderFunction(shader, 'ng_colorLegendLerp', this.parent.dataType, window);
    const legendOffset = getIntervalBoundsEffectiveOffset(dataType, window);
    gl.uniform1f(shader.uniform('uLegendOffset'), Number.isFinite(legendOffset) ? legendOffset : 0);
    gl.blendFunc(WebGL2RenderingContext.SRC_ALPHA, WebGL2RenderingContext.ONE_MINUS_SRC_ALPHA);
    gl.disable(WebGL2RenderingContext.DEPTH_TEST);
    gl.disable(WebGL2RenderingContext.STENCIL_TEST);
    const aVertexPosition = shader.attribute('aVertexPosition');
    this.cornersBuffer.bindToVertexAttrib(
        aVertexPosition, /*componentsPerVertexAttribute=*/ 2,
        /*attributeType=*/ WebGL2RenderingContext.FLOAT);
    gl.drawArrays(WebGL2RenderingContext.TRIANGLE_FAN, 0, 4);
    gl.disableVertexAttribArray(aVertexPosition);
  }

  isReady() {
    return true;
  }
}

function createRangeBoundInput(boundType: 'range'|'window', endpoint: number) {
  const e = document.createElement('input');
  e.addEventListener('focus', () => {
    e.select();
  });
  e.classList.add('neuroglancer-invlerp-widget-bound');
  e.classList.add(`neuroglancer-invlerp-widget-${boundType}-bound`);
  e.type = 'text';
  e.spellcheck = false;
  e.autocomplete = 'off';
  e.title = boundType === 'range' ? `Data value that maps to ${endpoint}` :
                                    `${endpoint === 0 ? 'Lower' : 'Upper'} bound for distribution`;
  return e;
}

function createRangeBoundInputs(
    boundType: 'range'|'window', dataType: DataType,
    model: WatchableValueInterface<InvlerpParameters>) {
  const container = document.createElement('div');
  container.classList.add('neuroglancer-invlerp-widget-bounds');
  container.classList.add(`neuroglancer-invlerp-widget-${boundType}-bounds`);
  const inputs = [
    createRangeBoundInput(boundType, 0), createRangeBoundInput(boundType, 1)
  ] as [HTMLInputElement, HTMLInputElement];
  for (let endpointIndex = 0; endpointIndex < 2; ++endpointIndex) {
    const input = inputs[endpointIndex];
    input.addEventListener('input', () => {
      updateInputBoundWidth(input);
    });
    input.addEventListener('change', () => {
      const existingBounds = model.value;
      const existingInterval = existingBounds[boundType];
      try {
        const value = parseDataTypeValue(dataType, input.value);
        model.value = getUpdatedParameters(
            existingBounds, boundType, endpointIndex, value, /*fitRangeInWindow=*/ true);
      } catch {
        updateInputBoundValue(input, existingInterval[endpointIndex]);
      }
    });
  }
  let spacers: [HTMLElement, HTMLElement, HTMLElement]|undefined;
  container.appendChild(inputs[0]);
  container.appendChild(inputs[1]);
  if (boundType === 'range') {
    spacers = [
      document.createElement('div'),
      document.createElement('div'),
      document.createElement('div'),
    ];
    spacers[1].classList.add('neuroglancer-invlerp-widget-range-spacer');
    container.insertBefore(spacers[0], inputs[0]);
    container.insertBefore(spacers[1], inputs[1]);
    container.appendChild(spacers[2]);
  }
  return {container, inputs, spacers};
}

function updateInputBoundWidth(inputElement: HTMLInputElement) {
  updateInputFieldWidth(inputElement, Math.max(1, inputElement.value.length + 0.1));
}

function updateInputBoundValue(inputElement: HTMLInputElement, bound: number|Uint64) {
  let boundString: string;
  if (bound instanceof Uint64 || Number.isInteger(bound)) {
    boundString = bound.toString();
  } else {
    boundString = bound.toPrecision(6);
  }
  inputElement.value = boundString;
  updateInputBoundWidth(inputElement);
}

export class InvlerpWidget extends Tab {
  histogramPanel = this.registerDisposer(new HistogramPanel(this, NUM_CDF_LINES, histogramSamplerTextureUnit))
  boundElements = {
    range: createRangeBoundInputs('range', this.dataType, this.trackable),
    window: createRangeBoundInputs('window', this.dataType, this.trackable),
  };
  invertArrows: HTMLElement[];
  get texture() {
    return this.histogramSpecifications.getFramebuffers(this.display.gl)[this.histogramIndex]
        .colorBuffers[0]
        .texture;
  }
  get dataType() {
    return this.control.dataType;
  }
  private invertRange() {
    const {trackable} = this;
    const bounds = trackable.value;
    const {range} = bounds;
    trackable.value = {...bounds, range: [range[1], range[0]] as DataTypeInterval};
  }
  constructor(
      visibility: WatchableVisibilityPriority, public display: DisplayContext,
      public control: ShaderInvlerpControl,
      public trackable: WatchableValueInterface<InvlerpParameters>,
      public histogramSpecifications: HistogramSpecifications, public histogramIndex: number,
      public shaderControlsOptions: ShaderControlsOptions) {
    super(visibility);
    this.registerDisposer(histogramSpecifications.visibility.add(this.visibility));
    const {element, boundElements} = this;
    if (control.default.channel.length === 0 &&
        shaderControlsOptions.legendShaderOptions !== undefined) {
      const legendPanel = this.registerDisposer(new ColorLegendPanel(this));
      element.appendChild(legendPanel.element);
    }
    const makeArrow = (svg: string) => {
      const icon = makeIcon({
        svg,
        title: 'Invert range',
        onClick: () => {
          this.invertRange();
        },
      });
      boundElements.range.spacers![1].appendChild(icon);
      return icon;
    };
    this.invertArrows = [makeArrow(svg_arrowRight), makeArrow(svg_arrowLeft)];
    element.appendChild(boundElements.range.container);
    element.appendChild(this.histogramPanel.element);
    element.classList.add('neuroglancer-invlerp-widget');
    element.appendChild(boundElements.window.container);
    this.updateView();
    this.registerDisposer(trackable.changed.add(
        this.registerCancellable(animationFrameDebounce(() => this.updateView()))));
  }

  updateView() {
    const {boundElements} = this;
    const {trackable: {value: bounds}, dataType} = this;
    for (let i = 0; i < 2; ++i) {
      updateInputBoundValue(boundElements.range.inputs[i], bounds.range[i]);
      updateInputBoundValue(boundElements.window.inputs[i], bounds.window[i]);
    }
    const reversed = dataTypeCompare(bounds.range[0], bounds.range[1]) > 0;
    boundElements.range.container.style.flexDirection = !reversed ? 'row' : 'row-reverse';
    const clampedRange = getClampedInterval(bounds.window, bounds.range);
    const spacers = boundElements.range.spacers!;
    const effectiveFraction = getIntervalBoundsEffectiveFraction(dataType, bounds.window);
    const leftOffset =
        computeInvlerp(bounds.window, clampedRange[reversed ? 1 : 0]) * effectiveFraction;
    const rightOffset =
        computeInvlerp(bounds.window, clampedRange[reversed ? 0 : 1]) * effectiveFraction +
        (1 - effectiveFraction);
    spacers[reversed ? 2 : 0].style.width = `${leftOffset * 100}%`;
    spacers[reversed ? 0 : 2].style.width = `${(1 - rightOffset) * 100}%`;
    const {invertArrows} = this;
    invertArrows[reversed ? 1 : 0].style.display = '';
    invertArrows[reversed ? 0 : 1].style.display = 'none';
  }
}
