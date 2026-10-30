// Animate UI uses React 19's use(Context). Route contexts through Preact's
// established hook; promise resources retain Preact's Suspense implementation.
import compat, { use as useResource, useContext } from 'preact/compat';
export * from 'preact/compat';
export function use(resource) {
  return resource && typeof resource.then === 'function' ? useResource(resource) : useContext(resource);
}
export default { ...compat, use };
