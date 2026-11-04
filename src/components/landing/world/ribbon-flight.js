import { CubicBezierCurve3, CatmullRomCurve3, Vector3, MathUtils } from 'three';
import { progress, smooth } from './story-time.js';

const START = [0, .025, .055], END = [.965, .985, 1];

export function ribbonProgress(index, value) { return progress(START[index], END[index], value); }

// The source directions are part of the hero composition, rather than a rotation
// of the whole scene: right, up, left.
export function createRibbonCurve(index) {
  const points = [
    [[-10,-2,-2],[-5,3.5,-.3],[0,-2,1],[4,-.5,.3],[7,1.5,-1]],
    [[-2,-8,-2],[-3,-2,0],[1,0,1],[1.2,2,.3],[1.6,3.7,-1]],
    [[10,3,-3],[5,1.5,0],[0,3.5,.5],[-4,-2,1],[-7,-1.5,-1]],
  ];
  return new CatmullRomCurve3(points[index].map(point => new Vector3(...point)), false, 'centripetal');
}

// Monotone Hermite timing keeps velocity continuous at the route's waypoints.
// Only the departure and the final landing come to rest.
function distanceClock(times, distances) {
  const slopes = distances.slice(1).map((value, i) => (value - distances[i]) / (times[i + 1] - times[i]));
  const tangents = [0, 0, 0, 0];
  for (let i = 1; i < 3; i++) {
    const before = times[i] - times[i - 1], after = times[i + 1] - times[i];
    const w1 = 2 * after + before, w2 = after + 2 * before;
    tangents[i] = (w1 + w2) / (w1 / slopes[i - 1] + w2 / slopes[i]);
  }
  return value => {
    if (value <= 0) return 0;
    if (value >= 1) return distances[3];
    const i = value < times[1] ? 0 : value < times[2] ? 1 : 2;
    const span = times[i + 1] - times[i], u = (value - times[i]) / span, u2 = u * u, u3 = u2 * u;
    return (2*u3-3*u2+1)*distances[i] + (u3-2*u2+u)*span*tangents[i]
      + (-2*u3+3*u2)*distances[i+1] + (u3-u2)*span*tangents[i+1];
  };
}

export function createFlightRoute(index, source, rect, factor, width, height) {
  const point = (x, y, z = -.07) => new Vector3((x - width / 2) * factor, (height / 2 - y) * factor, z);
  const head = source.getPointAt(1), tangent = source.getTangentAt(1);
  const exits = [point(width*1.14,height*.24,.3), point(width*.55,-height*.35,-.8), point(-width*.14,height*.28,.1)];
  const exit = exits[index];
  const exitControl = exit.clone().add(new Vector3(index === 1 ? width*.18*factor : 0, -height*.22*factor, 0));
  const above = point(rect.left + rect.width / 2, -height * (.18 + index * .025));
  const bottom = point(rect.left + rect.width / 2, rect.top + rect.height);
  const outgoing = new CubicBezierCurve3(head, head.clone().addScaledVector(tangent, 2.5), exitControl, exit);
  const turn = new CubicBezierCurve3(exit, exit.clone().add(exit.clone().sub(exitControl).multiplyScalar(1.8)),
    above.clone().add(new Vector3(0, height*.5*factor, 0)), above);
  const drop = new CubicBezierCurve3(above, above.clone().lerp(bottom, 1/3), above.clone().lerp(bottom, 2/3), bottom);

  const points = source.getSpacedPoints(360), sections = [outgoing, turn, drop];
  const lengths = [0], boundaries = [];
  const append = next => {
    for (const p of next) {
      const previous = points[points.length - 1];
      const length = previous.distanceTo(p);
      if (length < 1e-7) continue;
      points.push(p); lengths.push(lengths[lengths.length - 1] + length);
    }
  };
  // Build the source table first. A moving tail can still occupy the old hero
  // curve while its head is already leaving the screen.
  const sourcePoints = points.splice(0);
  points.push(sourcePoints[0]); append(sourcePoints.slice(1));
  const sourceLength = lengths[lengths.length - 1];
  for (const section of sections) {
    append(section.getSpacedPoints(160));
    boundaries.push(lengths[lengths.length - 1] - sourceLength);
  }
  const packed = new Float32Array(points.length * 3);
  points.forEach((p, i) => p.toArray(packed, i * 3));
  const times = [[0,.28,.74,1],[0,.23,.77,1],[0,.31,.80,1]][index];
  const clock = distanceClock(times, [0, ...boundaries]);
  const direction = new Vector3(), a = new Vector3(), b = new Vector3();

  function sample(distance, position, across, normal) {
    let lo = 0, hi = lengths.length - 1;
    if (distance < 0) {
      a.fromArray(packed, 0); b.fromArray(packed, 3); direction.subVectors(b, a).normalize();
      position.copy(a).addScaledVector(direction, distance);
    } else {
      distance = Math.min(distance, lengths[hi]);
      while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (lengths[mid] <= distance) lo = mid; else hi = mid; }
      a.fromArray(packed, lo * 3); b.fromArray(packed, hi * 3);
      position.lerpVectors(a, b, (distance - lengths[lo]) / Math.max(1e-8, lengths[hi] - lengths[lo]));
      // Average neighbouring segments to avoid a visible frame change at a table point.
      a.fromArray(packed, Math.max(0, lo - 1) * 3); b.fromArray(packed, Math.min(points.length - 1, hi + 1) * 3);
      direction.subVectors(b, a).normalize();
    }
    across.set(-direction.y, direction.x, 0).normalize();
    if (across.lengthSq() < .01) across.set(1, 0, 0);
    normal.crossVectors(direction, across).normalize();
  }
  return {
    sourceLength,
    halfWidth: rect.width * factor / 2,
    state(value) {
      const p = ribbonProgress(index, value);
      return { p, head: sourceLength + clock(p), length: MathUtils.lerp(sourceLength, rect.height * factor, smooth(.72, 1, p)), open: smooth(.84, 1, p) };
    },
    sample,
  };
}
