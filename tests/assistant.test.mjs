import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { analyzedPoints, summarizePoints } from '../src/lib/assistant/statistics.ts';
import { COMPATIBLE_ENDPOINTS, resolveCompatibleEndpoint } from '../src/lib/assistant/constants.ts';

test('resumen numérico usa todos los puntos válidos, sin inventar datos', () => {
  const points = analyzedPoints(JSON.stringify([[2,6],[0,2],['bad',3],[1,4],[3,8]]));
  assert.deepEqual(points, [[0,2],[1,4],[2,6],[3,8]]);
  const result = summarizePoints(points);
  assert.equal(result.count,4);
  assert.deepEqual(result.xRange,[0,3]);
  assert.deepEqual(result.yMin,{x:0,y:2});
  assert.deepEqual(result.yMax,{x:3,y:8});
  assert.equal(result.linearSlope,2);
  assert.equal(result.linearRSquared,1);
});
test('una serie constante no inventa correlación',()=>{
  const stats = summarizePoints([[1,3],[2,3],[3,3]]);
  assert.equal(stats.linearSlope,0);
  assert.equal(stats.linearRSquared,null);
});
test('serie vacía',()=> assert.deepEqual(summarizePoints([]),{count:0}));
test('serie grande recorta la muestra, pero estadísticas usan todos los puntos',()=>{
  const stats = summarizePoints(Array.from({length:200},(_,i)=>[i,i*i]));
  assert.equal(stats.count,200);
  assert.equal(stats.samplePoints.length,12);
  assert.equal(stats.sampleIsReduced,true);
  assert.equal(stats.yMax.y,199*199);
});
test('endpoint compatible: solo HTTPS y URL exacta aprobada',()=>{
  assert.equal(resolveCompatibleEndpoint(COMPATIBLE_ENDPOINTS[0].url),COMPATIBLE_ENDPOINTS[0].url);
  for (const endpoint of [
    'http://localhost:11434/v1/chat/completions',
    'http://169.254.169.254/latest/meta-data',
    'https://127.0.0.1/v1/chat/completions',
    'https://openrouter.ai.evil.com/api/v1/chat/completions',
    COMPATIBLE_ENDPOINTS[0].url+'?redirect=1',
    'https://api.groq.com/something-else',
  ]) assert.equal(resolveCompatibleEndpoint(endpoint),null,`se bloquea ${endpoint}`);
});
