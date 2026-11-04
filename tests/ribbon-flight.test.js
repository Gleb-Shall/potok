import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createRibbonCurve, createFlightRoute } from '../src/components/landing/world/ribbon-flight.js';

const factor = 2 * Math.tan(20 * Math.PI / 180) * 13.5 / 720;
const fixtures = [32,442,852].map((left,index) => {
  const curve = createRibbonCurve(index), rect = {left,top:235,width:396,height:380};
  return {curve,rect,route:createFlightRoute(index,curve,rect,factor,1280,720)};
});
const sample = (route,distance) => {
  const point = new Vector3(), across = new Vector3(), normal = new Vector3();
  route.sample(distance,point,across,normal);
  return {point,across,normal};
};
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-4, `${a} != ${b}`);

test('the three heads depart right, upward and left instead of sharing a wave', () => {
  const heads = fixtures.map(({curve,route}) => ({start:curve.getPointAt(1),now:sample(route,route.state(.2).head).point}));
  assert.ok(heads[0].now.x > heads[0].start.x);
  assert.ok(heads[1].now.y > heads[1].start.y);
  assert.ok(heads[2].now.x < heads[2].start.x);
});
test('each trail arrives vertically at the real day rectangle with an aligned front', () => {
  for (const {rect,route} of fixtures) {
    const state = route.state(1), head = sample(route,state.head), tail = sample(route,state.head-state.length);
    near(head.point.x,(rect.left+rect.width/2-640)*factor);
    near(tail.point.x,head.point.x);
    near(head.point.y,(360-rect.top-rect.height)*factor);
    near(tail.point.y,(360-rect.top)*factor);
    near(head.point.z,-.07); near(head.across.x,1); near(head.normal.z,1);
    near(route.halfWidth,rect.width*factor/2);
  }
});
test('route timing is monotone and bounded across departure, turn and landing', () => {
  for (const {route} of fixtures) {
    let previous = route.state(0).head;
    const end = route.state(1).head;
    for (let i=1;i<=200;i++) {
      const state = route.state(i/200);
      assert.ok(state.head >= previous-1e-7 && state.head <= end+1e-7);
      assert.ok(state.length > 0);
      previous = state.head;
    }
  }
});
test('phone trails land on vertically stacked days, including days below the viewport', () => {
  const height=844, width=390;
  const phoneFactor=2*Math.tan(20*Math.PI/180)*13.5/height;
  for (let index=0;index<3;index++) {
    const rect={left:18,top:226+index*320,width:354,height:308};
    const route=createFlightRoute(index,createRibbonCurve(index),rect,phoneFactor,width,height);
    const state=route.state(1), head=sample(route,state.head), tail=sample(route,state.head-state.length);
    near(head.point.x,0); near(tail.point.x,0);
    near(head.point.y,(height/2-rect.top-rect.height)*phoneFactor);
    near(tail.point.y,(height/2-rect.top)*phoneFactor);
    near(head.normal.z,1); near(route.halfWidth,177*phoneFactor);
  }
});
