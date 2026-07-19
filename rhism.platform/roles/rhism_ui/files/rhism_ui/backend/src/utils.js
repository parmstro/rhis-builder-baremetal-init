import yaml from 'js-yaml';
import { resolve, sep } from 'node:path';

// Path-traversal guard — added by rhism (see ../SECURITY-REVIEW.md
// "HIGH — path traversal / arbitrary file write via the `domain` value").
// The original app did `join(BASE_DIR, userSuppliedValue)` with zero
// validation in three places (deployment.js export, deployments.js :domain,
// catalog.js :id) — path.join() does not strip `../` segments, so a value
// like `../../../../etc/cron.d` could write/read outside the intended
// directory. Two layers of defense: (1) restrict the raw value to a safe
// charset up front — a real domain name or catalog ID never legitimately
// contains `/`, `\`, or `..`; (2) resolve the final joined path and confirm
// it is still inside the base directory, so even a charset bug elsewhere
// can't silently regress this.

const SAFE_SEGMENT = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,253}[a-zA-Z0-9])?$/;

export class UnsafePathError extends Error {
  constructor(label, value) {
    super(`Unsafe ${label}: ${JSON.stringify(value)}`);
    this.name = 'UnsafePathError';
  }
}

// Validate a single path segment (a domain name or catalog entry id) before
// it is ever joined onto a base directory. Throws UnsafePathError on any
// value containing a path separator, a `..` traversal, or characters outside
// a safe charset (letters, digits, dot, hyphen, underscore).
export function assertSafeSegment(value, label = 'path segment') {
  if (typeof value !== 'string' || value.length === 0) {
    throw new UnsafePathError(label, value);
  }
  if (value.includes('..') || value.includes('/') || value.includes('\\')) {
    throw new UnsafePathError(label, value);
  }
  if (!SAFE_SEGMENT.test(value)) {
    throw new UnsafePathError(label, value);
  }
  return value;
}

// Defense in depth: after joining, confirm the resolved absolute path is
// still inside baseDir. Call this even after assertSafeSegment — cheap, and
// catches anything the charset check didn't anticipate.
export function assertWithinBase(joinedPath, baseDir, label = 'path') {
  const resolvedBase = resolve(baseDir) + sep;
  const resolvedPath = resolve(joinedPath);
  if (!(resolvedPath + sep).startsWith(resolvedBase)) {
    throw new UnsafePathError(label, joinedPath);
  }
  return joinedPath;
}

export function toYaml(obj) {
  return yaml.dump(obj, { lineWidth: 120, noRefs: true });
}

export function fromYaml(str) {
  return yaml.load(str);
}

// Walk a catalog entry and resolve {{ variable }} markers against a values map.
// Unresolved markers are left as-is so the aggregation step can handle them.
export function resolveTemplateVars(obj, vars) {
  if (typeof obj === 'string') {
    return obj.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? `{{ ${k} }}`);
  }
  if (Array.isArray(obj)) return obj.map(item => resolveTemplateVars(item, vars));
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, resolveTemplateVars(v, vars)])
    );
  }
  return obj;
}
