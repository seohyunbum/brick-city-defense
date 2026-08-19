/*
 * RoundedBoxGeometry adapter for the classic-script Three.js r150 runtime.
 * Derived from three.js r150 examples/jsm/geometries/RoundedBoxGeometry.js (MIT).
 */
(function (L) {
  'use strict';

  const tempNormal = new THREE.Vector3();

  function getUv(faceDir, normal, uvAxis, projectionAxis, radius, sideLength) {
    const arcLength = Math.PI * radius * 0.5;
    const centerLength = Math.max(sideLength - 2 * radius, 0);
    tempNormal.copy(normal);
    tempNormal[projectionAxis] = 0;
    tempNormal.normalize();
    const arcRatio = 0.5 * arcLength / (arcLength + centerLength);
    const angleRatio = 1 - tempNormal.angleTo(faceDir) / (Math.PI * 0.25);
    if (Math.sign(tempNormal[uvAxis]) === 1) return angleRatio * arcRatio;
    return centerLength / (arcLength + centerLength) + arcRatio + arcRatio * (1 - angleRatio);
  }

  function RoundedBoxGeometry(width, height, depth, segments, radius) {
    width = width === undefined ? 1 : width;
    height = height === undefined ? 1 : height;
    depth = depth === undefined ? 1 : depth;
    segments = (segments === undefined ? 1 : segments) * 2 + 1;
    radius = Math.min(width * 0.5, height * 0.5, depth * 0.5, radius === undefined ? 0.08 : radius);

    const base = new THREE.BoxGeometry(1, 1, 1, segments, segments, segments).toNonIndexed();
    base.type = 'RoundedBoxGeometry';
    const positions = base.attributes.position.array;
    const normals = base.attributes.normal.array;
    const uvs = base.attributes.uv.array;
    const position = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const box = new THREE.Vector3(width, height, depth).multiplyScalar(0.5).subScalar(radius);
    const faceTriangles = positions.length / 6;
    const faceDir = new THREE.Vector3();
    const halfSegment = 0.5 / segments;

    for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
      position.fromArray(positions, i);
      normal.copy(position);
      normal.x -= Math.sign(normal.x) * halfSegment;
      normal.y -= Math.sign(normal.y) * halfSegment;
      normal.z -= Math.sign(normal.z) * halfSegment;
      normal.normalize();
      positions[i] = box.x * Math.sign(position.x) + normal.x * radius;
      positions[i + 1] = box.y * Math.sign(position.y) + normal.y * radius;
      positions[i + 2] = box.z * Math.sign(position.z) + normal.z * radius;
      normals[i] = normal.x; normals[i + 1] = normal.y; normals[i + 2] = normal.z;

      const side = Math.floor(i / faceTriangles);
      if (side === 0 || side === 1) {
        faceDir.set(side === 0 ? 1 : -1, 0, 0);
        uvs[j] = side === 0
          ? getUv(faceDir, normal, 'z', 'y', radius, depth)
          : 1 - getUv(faceDir, normal, 'z', 'y', radius, depth);
        uvs[j + 1] = 1 - getUv(faceDir, normal, 'y', 'z', radius, height);
      } else if (side === 2 || side === 3) {
        faceDir.set(0, side === 2 ? 1 : -1, 0);
        uvs[j] = 1 - getUv(faceDir, normal, 'x', 'z', radius, width);
        uvs[j + 1] = side === 2
          ? getUv(faceDir, normal, 'z', 'x', radius, depth)
          : 1 - getUv(faceDir, normal, 'z', 'x', radius, depth);
      } else {
        faceDir.set(0, 0, side === 4 ? 1 : -1);
        uvs[j] = side === 4
          ? 1 - getUv(faceDir, normal, 'x', 'y', radius, width)
          : getUv(faceDir, normal, 'x', 'y', radius, width);
        uvs[j + 1] = 1 - getUv(faceDir, normal, 'y', 'x', radius, height);
      }
    }

    base.computeBoundingBox();
    base.computeBoundingSphere();
    return base;
  }

  L.RoundedBoxGeometry = RoundedBoxGeometry;
})(window.LEGO = window.LEGO || {});
