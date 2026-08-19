/* =========================================================================
 * lookdev.js — 고품질 브릭 룩의 단일 렌더 계약
 * 외부 HDRI 없이 PMREM 반사 환경을 런타임에서 한 번 굽고, 실제 게임에는
 * 키/필/헤미 조명만 남긴다. file:// 오프라인 실행과 정적 Pages 배포를 보존한다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;

  function lightCard(scene, rgb, intensity, position, scale) {
    const color = new THREE.Color(rgb);
    color.multiplyScalar(intensity);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color, toneMapped: false })
    );
    mesh.position.copy(position);
    mesh.scale.copy(scale);
    scene.add(mesh);
  }

  function reflectionEnvironment(renderer) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(C.lookSky);
    const room = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: C.lookSkySoft, side: THREE.BackSide, toneMapped: false })
    );
    room.scale.set(80, 54, 80);
    scene.add(room);
    lightCard(scene, C.lookWarm, 7.0, new THREE.Vector3(-27, 24, 18), new THREE.Vector3(0.2, 14, 22));
    lightCard(scene, C.lookCool, 4.2, new THREE.Vector3(23, 13, -18), new THREE.Vector3(0.2, 18, 15));
    lightCard(scene, C.white, 5.5, new THREE.Vector3(0, 27, 0), new THREE.Vector3(18, 0.2, 18));
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(70, 0.5, 70),
      new THREE.MeshBasicMaterial({ color: C.lookGround, toneMapped: false })
    );
    ground.position.y = -12;
    scene.add(ground);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileCubemapShader();
    const target = pmrem.fromScene(scene, 0.035, 0.1, 100);
    pmrem.dispose();
    scene.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      object.material.dispose();
    });
    return target;
  }

  function configureRenderer(renderer) {
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.physicallyCorrectLights = false;
  }

  function install(scene, renderer) {
    const environmentTarget = reflectionEnvironment(renderer);
    scene.environment = environmentTarget.texture;

    const hemi = new THREE.HemisphereLight(C.lookCool, C.lookHemiGround, 0.64);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(C.lookSun, 1.62);
    sun.position.set(58, 96, 62);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    const sc = sun.shadow.camera;
    sc.left = -58; sc.right = 58; sc.top = 58; sc.bottom = -58;
    sc.near = 20; sc.far = 240;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.018;
    sun.shadow.radius = 4;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(C.lookFill, 0.20);
    fill.position.set(-48, 34, -56);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(C.lookAmbient, 0.08));
    return { sun, hemi, fill, environmentTarget };
  }

  L.LookDev = { configureRenderer, install };
})(window.LEGO = window.LEGO || {});
