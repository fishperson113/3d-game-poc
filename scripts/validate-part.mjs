import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const partId = process.argv[2];
if (!partId) {
  console.error("Usage: npm run part:validate -- <part-id>");
  process.exit(1);
}

const folder = partId.replace(/^core\./, "");
const manifestPath = resolve("src", "parts", folder, "manifest.json");
const lockPath = resolve("tools", "img2threejs.lock.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function finiteTuple(value, path) {
  assert(Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === "number" && Number.isFinite(entry)), `${path} must be a finite vec3`);
}

try {
  await access(manifestPath);
  const [manifest, lock] = await Promise.all([
    readFile(manifestPath, "utf8").then((text) => JSON.parse(text)),
    readFile(lockPath, "utf8").then((text) => JSON.parse(text)),
  ]);
  assert(manifest.schemaVersion === 1 && manifest.kind === "core.part", "manifest schema/kind mismatch");
  assert(manifest.id === partId, "manifest id mismatch");
  assert(Number.isInteger(manifest.revision) && manifest.revision > 0, "revision must be a positive integer");
  assert(Array.isArray(manifest.assembly?.sockets) && manifest.assembly.sockets.length > 0, "assembly sockets are required");
  const socketIds = new Set();
  for (const [index, socket] of manifest.assembly.sockets.entries()) {
    assert(typeof socket.id === "string" && socket.id.length > 0, `assembly.sockets[${index}].id is required`);
    assert(!socketIds.has(socket.id), `duplicate socket id: ${socket.id}`);
    socketIds.add(socket.id);
    assert(Array.isArray(socket.accepts) && socket.accepts.length > 0, `assembly.sockets[${index}].accepts is required`);
    finiteTuple(socket.position, `assembly.sockets[${index}].position`);
    finiteTuple(socket.rotation, `assembly.sockets[${index}].rotation`);
  }
  const body = manifest.physics?.body;
  assert(body && Number.isFinite(body.mass) && body.mass > 0, "physics.body.mass must be positive");
  assert(Number.isFinite(body.linearDamping) && body.linearDamping >= 0, "physics.body.linearDamping must be non-negative");
  assert(Number.isFinite(body.angularDamping) && body.angularDamping >= 0, "physics.body.angularDamping must be non-negative");
  assert(Array.isArray(manifest.physics?.colliders) && manifest.physics.colliders.length > 0, "physics colliders are required");
  for (const [index, collider] of manifest.physics.colliders.entries()) {
    assert(collider.shape === "cuboid" || collider.shape === "cylinder", `physics.colliders[${index}].shape is invalid`);
    finiteTuple(collider.position, `physics.colliders[${index}].position`);
    finiteTuple(collider.rotation, `physics.colliders[${index}].rotation`);
    assert(Number.isFinite(collider.friction) && collider.friction >= 0, `physics.colliders[${index}].friction is invalid`);
    assert(Number.isFinite(collider.restitution) && collider.restitution >= 0 && collider.restitution <= 1, `physics.colliders[${index}].restitution is invalid`);
    if (collider.shape === "cuboid") {
      finiteTuple(collider.halfExtents, `physics.colliders[${index}].halfExtents`);
      assert(collider.halfExtents.every((entry) => entry > 0), `physics.colliders[${index}].halfExtents must be positive`);
    } else {
      assert(Number.isFinite(collider.halfHeight) && collider.halfHeight > 0 && Number.isFinite(collider.radius) && collider.radius > 0, `physics.colliders[${index}] cylinder dimensions are invalid`);
    }
  }
  if (manifest.physics.actuator) {
    const actuator = manifest.physics.actuator;
    assert(actuator.kind === "wheel" || actuator.kind === "steering", "physics.actuator.kind is invalid");
    finiteTuple(actuator.axis, "physics.actuator.axis");
    assert(actuator.axis.some((entry) => entry !== 0), "physics.actuator.axis must be non-zero");
    assert(Number.isFinite(actuator.maxForce) && actuator.maxForce > 0, "physics.actuator.maxForce must be positive");
    assert(Number.isFinite(actuator.targetSpeed) && actuator.targetSpeed > 0, "physics.actuator.targetSpeed must be positive");
  }
  const visual = manifest.visual;
  assert(typeof visual.factory === "string" && visual.factory.length > 0, "visual.factory is required");
  assert(visual.normalization?.metersPerUnit === 1 && visual.normalization.upAxis === "y" && visual.normalization.forwardAxis === "z" && visual.normalization.origin === "part-frame", "visual normalization must be meters/Y-up/+Z/part-frame");
  assert(Array.isArray(visual.variants) && visual.variants.length >= 2, "at least visual variants A and B are required");
  assert(new Set(visual.variants.map((variant) => variant.id)).size === visual.variants.length, "visual variant ids must be unique");
  assert(typeof manifest.provenance?.brief === "string" && manifest.provenance.brief.length > 0, "provenance brief is required");
  await access(resolve(manifest.provenance.brief));
  assert(typeof manifest.provenance.license === "string" && manifest.provenance.license.length > 0, "provenance license is required");
  assert(manifest.provenance.toolCommit === lock.commit, "provenance toolCommit does not match img2threejs lock");
  assert(manifest.visual.sourceCommit === lock.commit, "visual sourceCommit does not match img2threejs lock");
  console.log(`Validated ${partId}: manifest, sockets, colliders, visual variants, provenance`);
} catch (error) {
  console.error(`Part validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
