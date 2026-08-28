import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../schemas/schema-registry.js';

test('SchemaRegistry - register protobuf and validate payload conformance', () => {
  const registry = new SchemaRegistry();
  const protoDef = `
    syntax = "proto3";
    message Order {
      string order_id = 1;
      double amount_usd = 2;
      bool is_confirmed = 3;
    }
  `;

  const def = registry.registerSchema('order.proto', 'protobuf', protoDef);
  assert.equal(def.fields.length, 3);

  // Validate valid payload
  const validPayload = { order_id: 'ord_123', amount_usd: 145.5, is_confirmed: true };
  const resValid = registry.validatePayload('order.proto', validPayload);
  assert.equal(resValid.valid, true);

  // Validate invalid payload (wrong type and missing field)
  const invalidPayload = { order_id: 12345, is_confirmed: 'yes' };
  const resInvalid = registry.validatePayload('order.proto', invalidPayload);
  assert.equal(resInvalid.valid, false);
  assert.ok(resInvalid.errors.length >= 2);
});

test('SchemaRegistry - auto-complete missing fields with schema defaults', () => {
  const registry = new SchemaRegistry();
  const avroDef = JSON.stringify({
    type: 'record',
    name: 'Customer',
    fields: [
      { name: 'customer_id', type: 'string' },
      { name: 'age', type: 'int' },
      { name: 'active', type: 'boolean' }
    ]
  });

  registry.registerSchema('customer.avsc', 'avro', avroDef);

  const partial = { customer_id: 'cust_999' };
  const completed = registry.autoCompletePayload('customer.avsc', partial);

  assert.equal(completed.customer_id, 'cust_999');
  assert.equal(completed.age, 0);
  assert.equal(completed.active, false);
});
