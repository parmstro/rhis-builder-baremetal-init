import { randomUUID } from 'node:crypto';

const EXPIRY_MS = 60_000; // release lock after 60 s without a heartbeat

let lock = null; // { token: string, lastSeen: number } | null

function expired() {
  return lock && Date.now() - lock.lastSeen > EXPIRY_MS;
}

function current() {
  if (expired()) lock = null;
  return lock;
}

export function isLocked()       { return current() !== null; }
export function validate(token)  { return current()?.token === token; }

export function claim() {
  if (isLocked()) return null;
  lock = { token: randomUUID(), lastSeen: Date.now() };
  return lock.token;
}

export function heartbeat(token) {
  if (!validate(token)) return false;
  lock.lastSeen = Date.now();
  return true;
}

export function release(token) {
  if (!validate(token)) return false;
  lock = null;
  return true;
}

// steal() always succeeds — caller must clear deployment data before calling.
export function steal() {
  lock = { token: randomUUID(), lastSeen: Date.now() };
  return lock.token;
}

export function status() {
  return { locked: isLocked() };
}
