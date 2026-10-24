// Keep facing mirrors to one live bounce. Nested views may sample the previous
// image, but must never start another reflection render (or recurse forever).
export function singleBounce(surface) {
  surface.camera.userData.reflectionView = true;
  const renderReflection = surface.onBeforeRender;
  surface.onBeforeRender = function (renderer, scene, camera, ...args) {
    if (camera.userData.reflectionView) return;
    renderReflection.call(this, renderer, scene, camera, ...args);
  };
  return surface;
}
