import { URL } from 'url';
import * as Diagnostics from './diagnostics.js';
import os from 'os';
import path from 'path';

/**
 * @template T
 * @param {T} value 
 * @returns {Success<T>}
 */
export function success(value) {
  return { success: true, value };
}

/**
 * @param {Diagnostic} diagnostic
 * @param {Error=} error
 * @returns {Failure}
 */
export function fail(diagnostic, error) {
  return { success: false, diagnostic, error };
}

/**
 * @template T
 * @param {Result<T>} result
 * @returns {Success<T>}
 */
export function assertSuccess(result) {
  if (!result.success) throw new Error('Unhandled error: ' + result.diagnostic.message);
  return result;
}

/**
 * @template T
 * @param {T | undefined} x
 * @returns {T}
 */
export function assertDefined(x) {
  if (x === undefined) throw new Error('Unhandled error: expected input to be defined');
  return x;
}

/**
 * @template T
 * @template U
 * @param {() => Result<T>} f1
 * @param {() => Result<U>} f2
 * @returns {Success<T> | Result<U>}
 */
export function or(f1, f2) {
  const f1Result = f1();
  return f1Result.success ? f1Result : f2();
}

/**
 * @param {unknown} input
 * @returns {Result<number>} Position of the timestamp in seconds
 */
export function parseTimestamp(input) {
  const invalidResult = fail(Diagnostics.invalidTimestampInput);
  if (typeof input !== 'string') return invalidResult;
  const trimmed = input.trim();
  if (!trimmed) return invalidResult;
  const parts = trimmed.split(':');
  if (parts.length !== 2 && parts.length !== 3) return invalidResult;
  const first = parseFirstPart();
  if (!first.success) return first;
  const second = parseSubsequentPart(1);
  if (!second.success) return second;
  if (parts.length === 2) {
    return success(first.value * 60 + second.value);
  }
  const third = parseSubsequentPart(2);
  if (!third.success) return third;
  return success(first.value * 3600 + second.value * 60 + third.value);

  function parseFirstPart() {
    if (!/^\d+$/.test(parts[0])) return invalidResult;
    return success(parseInt(parts[0], 10));
  }
  /** @param {number} index */
  function parseSubsequentPart(index) {
    if (!/^\d\d?$/.test(parts[index])) return invalidResult;
    const number = parseInt(parts[index], 10);
    return number > 59 ? invalidResult : success(number);
  }
}

/**
 * @param {unknown} input
 * @returns {Result<number>}
 */
export function parseDuration(input) {
  if (typeof input !== 'string' || !/^\d+$/.test(input)) return fail(Diagnostics.invalidDurationInput);
  return success(parseInt(input, 10));
}

/** @param {string} url */
export function getYouTubeIdFromURL(url) {
  const match = /(\/|%3D|v=)([0-9A-z-_]{11})([%#?&]|$)/g.exec(url);
  if (match) return match[2].replace(/[^a-z0-9_-]/ig, '');
}

/** @param {string} absolutePath */
export function formatPath(absolutePath) {
  const relative = path.relative(process.cwd(), absolutePath);
  const withHome = os.platform() === 'darwin' && absolutePath.startsWith(os.homedir())
    ? absolutePath.replace(os.homedir(), '~')
    : absolutePath;
  return relative.length < withHome.length ? relative : withHome;
}

/** @param {string} url */
export function validateYouTubeURL(url) {
  const parsed = new URL(url);
  if (!parsed.protocol) return fail(Diagnostics.noURLProtocol);
  const isYouTube =
    parsed.host === 'youtube.com' ||
    parsed.host === 'www.youtube.com' ||
    parsed.host === 'youtu.be' ||
    parsed.host === 'm.youtube.com';
  if (!isYouTube) return fail(Diagnostics.notYouTubeURL);
  const id = getYouTubeIdFromURL(url);
  if (!id) return fail(Diagnostics.noYouTubeId);
  return success(id);
}
