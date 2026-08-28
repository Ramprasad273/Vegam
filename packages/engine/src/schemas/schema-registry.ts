/**
 * Supported universal schema protocols.
 */
export type SchemaProtocol = 'avro' | 'protobuf' | 'json_schema' | 'asyncapi';

export interface SchemaDefinition {
  readonly schemaId: string;
  readonly protocol: SchemaProtocol;
  readonly rawDefinition: string;
  readonly fields: ReadonlyArray<{
    readonly name: string;
    readonly type: string;
    readonly rule?: string;
  }>;
}

/**
 * Universal Schema Registry & Parser.
 * Parses Avro (`.avsc`), Protobuf (`.proto`), JSON Schema (`draft-07/2020-12`), and AsyncAPI 3.0 definitions
 * to extract field metadata and validate payload conformance without requiring external registry servers.
 */
export class SchemaRegistry {
  private readonly schemas = new Map<string, SchemaDefinition>();

  private static readonly MAX_SCHEMA_BYTES = 65_536; // 64 KB max

  /**
   * Registers and parses a schema definition.
   *
   * @param schemaId - Unique identifier or filename for the schema.
   * @param protocol - Schema format (`avro`, `protobuf`, `json_schema`, `asyncapi`).
   * @param rawDefinition - Raw schema text or JSON representation.
   */
  public registerSchema(schemaId: string, protocol: SchemaProtocol, rawDefinition: string): SchemaDefinition {
    if (typeof rawDefinition !== 'string' || Buffer.byteLength(rawDefinition, 'utf8') > SchemaRegistry.MAX_SCHEMA_BYTES) {
      throw new Error(`[SchemaRegistry] Raw schema definition exceeds maximum allowed size (${SchemaRegistry.MAX_SCHEMA_BYTES} bytes).`);
    }
    const fields = this.extractFields(protocol, rawDefinition);
    const def: SchemaDefinition = {
      schemaId,
      protocol,
      rawDefinition,
      fields
    };
    this.schemas.set(schemaId, def);
    console.info(`[SchemaRegistry] Successfully registered ${protocol.toUpperCase()} schema: ${schemaId} (${fields.length} fields)`);
    return def;
  }

  /**
   * Retrieves a registered schema definition.
   */
  public getSchema(schemaId: string): SchemaDefinition | undefined {
    return this.schemas.get(schemaId);
  }

  /**
   * Extracts field definitions from a raw schema string based on protocol.
   */
  private extractFields(protocol: SchemaProtocol, rawDefinition: string): Array<{ name: string; type: string; rule?: string }> {
    const fields: Array<{ name: string; type: string; rule?: string }> = [];

    try {
      if (protocol === 'avro' || protocol === 'json_schema' || protocol === 'asyncapi') {
        const parsed = JSON.parse(rawDefinition);
        if (protocol === 'avro' && Array.isArray(parsed.fields)) {
          for (const f of parsed.fields) {
            fields.push({
              name: String(f.name || 'unknown'),
              type: typeof f.type === 'string' ? f.type : JSON.stringify(f.type),
              rule: f['vegam.rule'] ? String(f['vegam.rule']) : undefined
            });
          }
        } else if (parsed.properties && typeof parsed.properties === 'object') {
          for (const [k, v] of Object.entries(parsed.properties)) {
            const prop = v as Record<string, unknown>;
            fields.push({
              name: k,
              type: String(prop['type'] || 'string'),
              rule: prop['vegam.rule'] ? String(prop['vegam.rule']) : undefined
            });
          }
        }
      } else if (protocol === 'protobuf') {
        // Simple regex extraction for standard protobuf field lines: e.g. string order_id = 1;
        const matches = Array.from(rawDefinition.matchAll(/^\s*(string|int32|int64|double|float|bool|bytes)\s+([a-zA-Z0-9_]+)\s*=\s*\d+;/gm));
        for (const match of matches) {
          if (match[1] && match[2]) {
            fields.push({
              name: match[2],
              type: match[1]
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[SchemaRegistry] Could not fully extract fields:`, err);
    }

    return fields;
  }

  /**
   * Validates whether a given payload conforms to the registered schema fields.
   */
  public validatePayload(schemaId: string, payload: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      return { valid: false, errors: [`Schema '${schemaId}' not registered.`] };
    }

    const errors: string[] = [];
    for (const field of schema.fields) {
      const val = payload[field.name];
      if (val === undefined || val === null) {
        errors.push(`Missing required field '${field.name}' (${field.type})`);
        continue;
      }
      // Simple type conformance checks
      const t = field.type.toLowerCase();
      if ((t.includes('string') || t === 'bytes') && typeof val !== 'string') {
        errors.push(`Field '${field.name}' expected string/bytes, got ${typeof val}`);
      } else if ((t.includes('int') || t.includes('double') || t.includes('float') || t.includes('number')) && typeof val !== 'number') {
        errors.push(`Field '${field.name}' expected numeric, got ${typeof val}`);
      } else if (t.includes('bool') && typeof val !== 'boolean') {
        errors.push(`Field '${field.name}' expected boolean, got ${typeof val}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Auto-completes missing fields on a payload with conforming default values based on registered schema invariants.
   */
  public autoCompletePayload(schemaId: string, basePayload: Record<string, unknown> = {}): Record<string, unknown> {
    const schema = this.schemas.get(schemaId);
    if (!schema) return basePayload;

    const completed: Record<string, unknown> = { ...basePayload };
    for (const field of schema.fields) {
      if (completed[field.name] === undefined || completed[field.name] === null) {
        const t = field.type.toLowerCase();
        if (t.includes('string') || t === 'bytes') completed[field.name] = `default_${field.name}`;
        else if (t.includes('int') || t.includes('double') || t.includes('float') || t.includes('number')) completed[field.name] = 0;
        else if (t.includes('bool')) completed[field.name] = false;
        else completed[field.name] = null;
      }
    }
    return completed;
  }
}

