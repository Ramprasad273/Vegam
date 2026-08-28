import test from 'node:test';
import assert from 'node:assert/strict';
import { SynthesisEngine, FieldSynthesisRule } from '../simulation/synthesis-engine.js';

test('SynthesisEngine - evaluates literal strings and numbers', () => {
  const rules: FieldSynthesisRule[] = [
    { fieldName: 'str', ruleExpression: '"HELLO"' },
    { fieldName: 'num', ruleExpression: '42' },
    { fieldName: 'bool', ruleExpression: 'true' }
  ];
  const payload = SynthesisEngine.synthesizePayload(rules);
  assert.equal(payload['str'], 'HELLO');
  assert.equal(payload['num'], 42);
  assert.equal(payload['bool'], true);
});

test('SynthesisEngine - evaluates $NOW_MS and $NOW_ISO system variables', () => {
  const rules: FieldSynthesisRule[] = [
    { fieldName: 'ts', ruleExpression: '$NOW_MS' },
    { fieldName: 'iso', ruleExpression: '$NOW_ISO' }
  ];
  const payload = SynthesisEngine.synthesizePayload(rules);
  assert.equal(typeof payload['ts'], 'number');
  assert.equal(typeof payload['iso'], 'string');
  assert.ok(String(payload['iso']).includes('T'));
});

test('SynthesisEngine - evaluates $PREV correlation inheritance', () => {
  const rules: FieldSynthesisRule[] = [
    { fieldName: 'parentId', ruleExpression: '$PREV.id' },
    { fieldName: 'user', ruleExpression: '$PREV.username' }
  ];
  const context = { id: 'ID-888', username: 'alice' };
  const payload = SynthesisEngine.synthesizePayload(rules, context);
  assert.equal(payload['parentId'], 'ID-888');
  assert.equal(payload['user'], 'alice');
});

test('SynthesisEngine - evaluates string concatenation', () => {
  const rules: FieldSynthesisRule[] = [
    { fieldName: 'concat', ruleExpression: '"PREFIX-" + $PREV.id + "-SUFFIX"' }
  ];
  const context = { id: '123' };
  const payload = SynthesisEngine.synthesizePayload(rules, context);
  assert.equal(payload['concat'], 'PREFIX-123-SUFFIX');
});

test('SynthesisEngine - evaluates customer and device pool references', () => {
  const rules: FieldSynthesisRule[] = [
    { fieldName: 'cust', ruleExpression: '$CUSTOMER_POOL[rand]' },
    { fieldName: 'dev', ruleExpression: '$DEVICE_POOL[rand]' }
  ];
  const payload = SynthesisEngine.synthesizePayload(rules);
  assert.ok(String(payload['cust']).startsWith('C-'));
  assert.ok(String(payload['dev']).startsWith('DEV-'));
});

test('SynthesisEngine - evaluates regex pattern expressions', () => {
  const rules: FieldSynthesisRule[] = [
    { fieldName: 'code', ruleExpression: '/^1Z[A-Z0-9]{16}$/' }
  ];
  const payload = SynthesisEngine.synthesizePayload(rules);
  const val = String(payload['code']);
  assert.ok(val.startsWith('1Z'));
  assert.equal(val.length, 18);
});

test('SynthesisEngine - evaluates weighted arrays and gaussians', () => {
  const rules: FieldSynthesisRule[] = [
    { fieldName: 'w1', ruleExpression: 'weighted(["A"])' },
    { fieldName: 'g1', ruleExpression: 'gaussian(100, 10)' }
  ];
  const payload = SynthesisEngine.synthesizePayload(rules);
  assert.equal(payload['w1'], 'A');
  assert.ok(typeof payload['g1'] === 'number');
});

test('SynthesisEngine - evaluates weighted helpers and numeric bounds without eval()', () => {
  const rules: FieldSynthesisRule[] = [
    { fieldName: 'currency', ruleExpression: 'faker.helpers.weighted([{v:"USD",w:1.0},{v:"EUR",w:0.0}])' },
    { fieldName: 'amount', ruleExpression: 'faker.number.float({min:10,max:20,fractionDigits:2})' },
    { fieldName: 'count', ruleExpression: 'faker.number.int({min:1,max:5})' },
    { fieldName: 'active', ruleExpression: 'true' }
  ];
  const payload = SynthesisEngine.synthesizePayload(rules);
  assert.equal(payload['currency'], 'USD');
  assert.equal(typeof payload['amount'], 'number');
  assert.ok(Number(payload['amount']) >= 10 && Number(payload['amount']) <= 20);
  assert.equal(typeof payload['count'], 'number');
  assert.equal(payload['active'], true);
});

test('SynthesisEngine - throws on invalid syntax', () => {
  assert.throws(() => {
    SynthesisEngine.synthesizePayload([{ fieldName: 'err', ruleExpression: 'invalid_function()' }]);
  }, /Invalid or unsupported expression/);

  assert.throws(() => {
    SynthesisEngine.synthesizePayload([{ fieldName: 'err', ruleExpression: '/^(unclosed/' }]);
  }, /Invalid regex pattern/);

  assert.throws(() => {
    const hugePattern = '/' + 'a'.repeat(200) + '/';
    SynthesisEngine.synthesizePayload([{ fieldName: 'err', ruleExpression: hugePattern }]);
  }, /exceeds maximum allowed length/);

  assert.throws(() => {
    const hugeWeighted = 'weighted([' + '"a",'.repeat(200) + '"b"])';
    SynthesisEngine.synthesizePayload([{ fieldName: 'err', ruleExpression: hugeWeighted }]);
  }, /exceeds maximum allowed length/);
});

test('SynthesisEngine - handles extended faker namespaces and single-parameter float/int', () => {
  const rules: FieldSynthesisRule[] = [
    { fieldName: 'prod', ruleExpression: 'faker.commerce.productName()' },
    { fieldName: 'dept', ruleExpression: 'faker.commerce.department()' },
    { fieldName: 'iban', ruleExpression: 'faker.finance.iban()' },
    { fieldName: 'flt', ruleExpression: 'faker.number.float({min:50})' },
    { fieldName: 'integer', ruleExpression: 'faker.number.int({min:10})' }
  ];
  const payload = SynthesisEngine.synthesizePayload(rules);
  assert.ok(typeof payload['prod'] === 'string' && payload['prod'].length > 0);
  assert.ok(typeof payload['dept'] === 'string' && payload['dept'].length > 0);
  assert.ok(typeof payload['iban'] === 'string' && payload['iban'].length > 0);
  assert.ok(typeof payload['flt'] === 'number' && !Number.isNaN(payload['flt']) && Number(payload['flt']) >= 50);
  assert.ok(typeof payload['integer'] === 'number' && !Number.isNaN(payload['integer']) && Number(payload['integer']) >= 10);
});
