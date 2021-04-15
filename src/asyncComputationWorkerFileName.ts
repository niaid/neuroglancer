// Note: this acts like a global variable and must be set before invoking
// neuroglancer. It is a hack to allow us to inject a custom path to the async
// computation worker Webpack bundle and force neuroglancer to load that bundle.
// There is no other easy way to accomplish this task currently.
export const asyncComputationWorkerFileName = {
  fileName: ""
}
