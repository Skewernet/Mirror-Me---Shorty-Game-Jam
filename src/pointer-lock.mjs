const requests = new WeakMap();

const failure = (name, message) => Object.assign(new Error(message), { name });

export function pointerLockRequestPending(element) {
  return requests.has(element);
}

// Both API generations are in use: current Chromium returns a Promise, while
// older browsers return void and signal completion through document events.
function capture(element, unadjustedRequested) {
  const document = element.ownerDocument;
  return new Promise((resolve, reject) => {
    let mode = "calling", errorEvent = false, settled = false;
    const cleanup = () => {
      clearTimeout(timeout);
      document.removeEventListener("pointerlockchange", changed);
      document.removeEventListener("pointerlockerror", failed);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve({ unadjustedRequested, promiseAPI: mode === "promise", alreadyLocked: false });
    };
    const changed = () => {
      if (mode !== "calling" && document.pointerLockElement === element) finish();
    };
    const failed = () => {
      errorEvent = true;
      // A Promise rejection preserves NotSupportedError. The generic error
      // event has no reason and must not replace it before raw-input fallback.
      if (mode === "legacy") finish(failure("NotAllowedError", "Mouse capture was refused."));
    };
    const timeout = setTimeout(() => finish(failure("TimeoutError", "Mouse capture did not complete.")), 10000);
    document.addEventListener("pointerlockchange", changed);
    document.addEventListener("pointerlockerror", failed);
    try {
      const result = unadjustedRequested
        ? element.requestPointerLock({ unadjustedMovement: true })
        : element.requestPointerLock();
      if (result && typeof result.then === "function") {
        mode = "promise";
        Promise.resolve(result).then(changed, finish);
      } else {
        mode = "legacy";
        if (errorEvent) failed();
        else changed();
      }
    } catch (error) {
      finish(error);
    }
  });
}

// Invoke directly from the activation click, before awaiting audio or other
// work. Handle acquisition errors through this returned promise, not a second
// global error listener: native pointerlockerror can arrive after a successful
// fallback (even after that capture has subsequently been released).
export function requestGamePointerLock(element) {
  if (requests.has(element)) return requests.get(element);
  if (element.ownerDocument.pointerLockElement === element)
    return Promise.resolve({ unadjustedRequested: false, promiseAPI: false, alreadyLocked: true });
  if (typeof element.requestPointerLock !== "function")
    return Promise.reject(failure("NotSupportedError", "This browser does not support mouse capture."));
  let accept, refuse;
  const request = new Promise((resolve, reject) => { accept = resolve; refuse = reject; });
  requests.set(element, request);
  capture(element, true).catch(error => {
    if (error?.name !== "NotSupportedError" && error?.name !== "TypeError") throw error;
    return capture(element, false);
  }).then(accept, refuse);
  request.then(
    () => requests.delete(element),
    () => requests.delete(element),
  );
  return request;
}
