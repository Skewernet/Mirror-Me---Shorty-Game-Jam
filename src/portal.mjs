import * as T from "three";
import { EXIT, PORTAL } from "./layout.mjs";

// A rigid view through the rear threshold into the front entrance. The player
// controller applies the same half-turn at crossing; this renderer never edits
// movement, input, time or story progression.
export class ThresholdPortal {
  constructor(scene, backDoor) {
    this.scene = scene;
    this.backDoor = backDoor;
    this.enabled = false;
    this.rendering = false;
    this.camera = new T.PerspectiveCamera();
    this.target = new T.WebGLRenderTarget(1024, 1024, {
      type: T.HalfFloatType,
      depthBuffer: true,
      samples: 0,
    });
    this.target.texture.name = "Rear threshold / front entrance";
    this.textureMatrix = new T.Matrix4();
    this.transform = new T.Matrix4().makeRotationY(Math.PI);
    this.transform.setPosition(
      EXIT.x + PORTAL.returnX,
      0,
      PORTAL.thresholdZ + PORTAL.returnZ,
    );
    this.bias = new T.Matrix4().set(
      0.5,
      0,
      0,
      0.5,
      0,
      0.5,
      0,
      0.5,
      0,
      0,
      0.5,
      0.5,
      0,
      0,
      0,
      1,
    );
    this.clipPlane = new T.Plane(new T.Vector3(0, 0, -1), PORTAL.returnZ);
    this.cameraPlane = new T.Plane();
    this.clip = new T.Vector4();
    this.q = new T.Vector4();
    this.mappedCamera = new T.Matrix4();
    this.scale = new T.Vector3();
    this.viewport = new T.Vector4();
    this.scissor = new T.Vector4();
    this.surface = new T.Mesh(
      new T.PlaneGeometry(0.945, 2.08),
      new T.ShaderMaterial({
        name: "ThresholdPortal",
        uniforms: {
          portalImage: { value: this.target.texture },
          textureMatrix: { value: this.textureMatrix },
        },
        vertexShader: `
        uniform mat4 textureMatrix;
        varying vec4 portalUV;
        void main(){
          portalUV=textureMatrix*vec4(position,1.);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }`,
        fragmentShader: `
        uniform sampler2D portalImage;
        varying vec4 portalUV;
        void main(){
          gl_FragColor=vec4(texture2DProj(portalImage,portalUV).rgb,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
        side: T.FrontSide,
      }),
    );
    this.surface.name = "The rear door opens onto the front hall";
    this.surface.userData.portalSurface = true;
    this.surface.position.set(EXIT.x, 1.04, PORTAL.thresholdZ);
    this.surface.rotation.y = Math.PI;
    this.surface.visible = false;
    this.surface.castShadow = this.surface.receiveShadow = false;
    scene.add(this.surface);
    this.frames = 0;
  }
  sync(story) {
    this.enabled = story.stage <= 4 && !story.backdoorGone && !!story.doorOpen;
    this.surface.visible = this.enabled;
    return this.enabled;
  }
  setQuality(height = 1080) {
    const size = height >= 1080 ? 1024 : 768;
    if (this.target.width !== size) this.target.setSize(size, size);
  }
  warmup(renderer, sourceCamera) {
    // Allocate the portal target and compile its projected view before the
    // first latch opens, rather than doing that work on a crossing frame.
    const camera = sourceCamera.clone();
    camera.position.set(EXIT.x, 1.64, PORTAL.thresholdZ - 0.7);
    camera.rotation.set(0, Math.PI, 0, "YXZ");
    camera.updateMatrixWorld(true);
    const visible = this.surface.visible, enabled = this.enabled, frames = this.frames;
    try {
      return this.render(renderer, camera, { stage: 0, doorOpen: true });
    } finally {
      this.surface.visible = visible;
      this.enabled = enabled;
      this.frames = frames;
    }
  }
  render(renderer, sourceCamera, story) {
    if (!this.sync(story) || this.rendering) return false;
    // Match the presentation renderer's capability fallback. An unsupported
    // floating-point colour target must never turn an open door black.
    const colorType =
      renderer.capabilities.isWebGL2 &&
      renderer.extensions.has("EXT_color_buffer_float")
        ? T.HalfFloatType
        : T.UnsignedByteType;
    if (this.target.texture.type !== colorType) {
      this.target.texture.type = colorType;
      this.target.dispose();
    }
    const sourceZ = PORTAL.thresholdZ;
    if (
      sourceCamera.position.z > sourceZ + 0.08 ||
      Math.abs(sourceCamera.position.x - EXIT.x) > 5.5
    )
      return false;
    this.rendering = true;
    this.scene.updateMatrixWorld(true);
    sourceCamera.updateMatrixWorld();
    this.mappedCamera.multiplyMatrices(
      this.transform,
      sourceCamera.matrixWorld,
    );
    this.mappedCamera.decompose(
      this.camera.position,
      this.camera.quaternion,
      this.scale,
    );
    this.camera.near = sourceCamera.near;
    this.camera.far = sourceCamera.far;
    this.camera.layers.mask = sourceCamera.layers.mask;
    this.camera.updateMatrixWorld();
    this.camera.projectionMatrix.copy(sourceCamera.projectionMatrix);
    // Discard the destination front door, wake room and all geometry between
    // the virtual eye and the entrance. Only the continuing front hall survives.
    this.cameraPlane
      .copy(this.clipPlane)
      .applyMatrix4(this.camera.matrixWorldInverse);
    this.clip.set(
      this.cameraPlane.normal.x,
      this.cameraPlane.normal.y,
      this.cameraPlane.normal.z,
      this.cameraPlane.constant,
    );
    const projection = this.camera.projectionMatrix,
      e = projection.elements;
    this.q.set(
      (Math.sign(this.clip.x) + e[8]) / e[0],
      (Math.sign(this.clip.y) + e[9]) / e[5],
      -1,
      (1 + e[10]) / e[14],
    );
    this.clip.multiplyScalar(2 / this.clip.dot(this.q));
    e[2] = this.clip.x;
    e[6] = this.clip.y;
    e[10] = this.clip.z + 1 - 0.001;
    e[14] = this.clip.w;
    this.camera.projectionMatrixInverse.copy(projection).invert();
    this.textureMatrix
      .copy(this.bias)
      .multiply(projection)
      .multiply(this.camera.matrixWorldInverse)
      .multiply(this.transform)
      .multiply(this.surface.matrixWorld);
    const previousTarget = renderer.getRenderTarget(),
      previousCubeFace = renderer.getActiveCubeFace?.() || 0,
      previousMipmap = renderer.getActiveMipmapLevel?.() || 0;
    const xr = renderer.xr.enabled,
      shadowAutoUpdate = renderer.shadowMap.autoUpdate,
      scissorTest = renderer.getScissorTest(),
      autoClear = renderer.autoClear;
    renderer.getViewport(this.viewport);
    renderer.getScissor(this.scissor);
    const previousVisibility = this.surface.visible;
    try {
      this.surface.visible = false;
      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(this.target);
      renderer.setViewport(0, 0, this.target.width, this.target.height);
      renderer.setScissorTest(false);
      renderer.autoClear = true;
      renderer.render(this.scene, this.camera);
      this.frames++;
      return true;
    } finally {
      renderer.setRenderTarget(
        previousTarget,
        previousCubeFace,
        previousMipmap,
      );
      renderer.setViewport(this.viewport);
      renderer.setScissor(this.scissor);
      renderer.setScissorTest(scissorTest);
      renderer.xr.enabled = xr;
      renderer.shadowMap.autoUpdate = shadowAutoUpdate;
      renderer.autoClear = autoClear;
      this.surface.visible = previousVisibility;
      this.rendering = false;
    }
  }
  reset() {
    this.enabled = false;
    this.surface.visible = false;
    this.frames = 0;
  }
  snapshot() {
    return {
      enabled: this.enabled,
      frames: this.frames,
      source: { x: EXIT.x, z: PORTAL.thresholdZ },
      destination: { x: PORTAL.returnX, z: PORTAL.returnZ },
      width: this.target.width,
      height: this.target.height,
    };
  }
  dispose() {
    this.target.dispose();
    this.surface.geometry.dispose();
    this.surface.material.dispose();
    this.surface.removeFromParent();
  }
}
