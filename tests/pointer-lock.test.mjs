import test from "node:test";
import assert from "node:assert/strict";
import { requestGamePointerLock, pointerLockRequestPending } from "../src/pointer-lock.mjs";

const error = (name) => Object.assign(new Error(name), { name });
function fixture(method) {
  const document = new EventTarget();
  document.pointerLockElement = null;
  const element = { ownerDocument: document };
  element.requestPointerLock = options => method(document, element, options);
  return { document, element };
}
const acquire = (document, element) => {
  document.pointerLockElement = element;
  document.dispatchEvent(new Event("pointerlockchange"));
};

test("raw pointer capture is requested during the activation call and deduplicated", async () => {
  const options = [];
  let release;
  const { document, element } = fixture((_doc, _element, value) => {
    options.push(value);
    assert.equal(pointerLockRequestPending(element), true);
    return new Promise(resolve => { release = resolve; });
  });
  const request = requestGamePointerLock(element);
  assert.deepEqual(options, [{ unadjustedMovement: true }], "Do not defer the native request to a microtask");
  assert.equal(requestGamePointerLock(element), request);
  acquire(document, element);
  release();
  assert.deepEqual(await request, { unadjustedRequested: true, promiseAPI: true, alreadyLocked: false });
  assert.equal(pointerLockRequestPending(element), false);
});

test("unsupported raw input falls back once, preserving the Promise error reason", async () => {
  const options = [];
  const { element } = fixture((document, element, value) => {
    options.push(value);
    assert.equal(pointerLockRequestPending(element), true);
    if (value) {
      document.dispatchEvent(new Event("pointerlockerror"));
      return Promise.reject(error("NotSupportedError"));
    }
    acquire(document, element);
    return Promise.resolve();
  });
  const result = await requestGamePointerLock(element);
  assert.deepEqual(options, [{ unadjustedMovement: true }, undefined]);
  assert.equal(result.unadjustedRequested, false);
  assert.equal(result.promiseAPI, true);
  assert.equal(pointerLockRequestPending(element), false);
});

test("legacy synchronous TypeError falls back to event-based capture", async () => {
  const options = [];
  const { element } = fixture((document, element, value) => {
    options.push(value);
    if (value) throw error("TypeError");
    queueMicrotask(() => acquire(document, element));
  });
  const result = await requestGamePointerLock(element);
  assert.deepEqual(options, [{ unadjustedMovement: true }, undefined]);
  assert.equal(result.promiseAPI, false);
});

test("legacy void API waits for its real capture event", async () => {
  const { document, element } = fixture(() => undefined);
  let completed = false;
  const request = requestGamePointerLock(element).then(result => { completed = true; return result; });
  await Promise.resolve();
  assert.equal(completed, false);
  acquire(document, element);
  const result = await request;
  assert.equal(result.promiseAPI, false);
  assert.equal(result.unadjustedRequested, true, "Legacy option acceptance is not proof of physical raw input");
});

test("permission and focus rejection never retry capture", async () => {
  for (const name of ["NotAllowedError", "SecurityError", "InvalidStateError"]) {
    let calls = 0;
    const { element } = fixture(document => {
      calls++;
      document.dispatchEvent(new Event("pointerlockerror"));
      return Promise.reject(error(name));
    });
    await assert.rejects(requestGamePointerLock(element), { name });
    assert.equal(calls, 1);
    assert.equal(pointerLockRequestPending(element), false);
  }
});

test("legacy refusal settles and a later activation can retry", async () => {
  let denied = true;
  const { element } = fixture((document, element) => {
    queueMicrotask(() => denied
      ? document.dispatchEvent(new Event("pointerlockerror"))
      : acquire(document, element));
  });
  await assert.rejects(requestGamePointerLock(element), { name: "NotAllowedError" });
  assert.equal(pointerLockRequestPending(element), false);
  denied = false;
  await requestGamePointerLock(element);
});

test("already-owned capture is reused and a missing API fails explicitly", async () => {
  let calls = 0;
  const { document, element } = fixture(() => { calls++; });
  document.pointerLockElement = element;
  assert.equal((await requestGamePointerLock(element)).alreadyLocked, true);
  assert.equal(calls, 0);
  const absent = { ownerDocument: new EventTarget() };
  await assert.rejects(requestGamePointerLock(absent), { name: "NotSupportedError" });
});
