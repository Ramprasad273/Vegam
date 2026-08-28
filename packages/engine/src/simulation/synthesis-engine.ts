import { faker } from '@faker-js/faker';
import RandExp from 'randexp';

/**
 * Field generation rule specification.
 */
export interface FieldSynthesisRule {
  readonly fieldName: string;
  readonly ruleExpression: string;
}

/**
 * Sandboxed Synthesis Engine.
 * Safely evaluates declarative data generation expressions (`faker.*`, regex `/pattern/`, `$NOW_MS`,
 * `$PREV.*`, and correlation pools) without ever executing raw `eval()`, `new Function()`, or `vm`.
 */
export class SynthesisEngine {
  private static readonly CUSTOMER_POOL = Array.from({ length: 100 }, (_, i) => `C-${800 + i}`);
  private static readonly DEVICE_POOL = Array.from({ length: 50 }, (_, i) => `DEV-${1000 + i}`);

  /**
   * Synthesizes an entire payload record by evaluating each declarative rule.
   *
   * @param rules - Array of field synthesis rules.
   * @param correlationContext - Previous node state or inherited IDs (`$PREV.orderId`).
   * @returns Synthesized, immutable payload record.
   */
  public static synthesizePayload(
    rules: ReadonlyArray<FieldSynthesisRule>,
    correlationContext: Readonly<Record<string, unknown>> = {}
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    for (const rule of rules) {
      payload[rule.fieldName] = this.evaluateRule(rule.ruleExpression, correlationContext, payload);
    }

    return payload;
  }

  /**
   * Evaluates a single declarative rule string against safe generators.
   */
  public static evaluateRule(
    expr: string,
    correlationContext: Readonly<Record<string, unknown>>,
    currentPayload: Readonly<Record<string, unknown>>
  ): unknown {
    const trimmed = expr.trim();

    // 0. String Concatenation ("PREFIX-" + $PREV.id)
    if (trimmed.includes(' + ')) {
      const parts = this.splitSafeConcatenation(trimmed);
      if (parts.length > 1) {
        return parts.map(p => this.evaluateRule(p, correlationContext, currentPayload)).join('');
      }
    }

    // 1. System variable checks
    if (trimmed === '$NOW_MS' || trimmed === 'Date.now()') return Date.now();
    if (trimmed === '$NOW_ISO') return new Date().toISOString();
    if (trimmed === 'uuid()' || trimmed === 'faker.string.uuid()') return faker.string.uuid();

    // 2. Correlation inheritance ($PREV.fieldName)
    if (trimmed.startsWith('$PREV.')) {
      const parentField = trimmed.substring(6);
      return correlationContext[parentField] ?? currentPayload[parentField] ?? faker.string.uuid();
    }

    // 3. Pool references ($CUSTOMER_POOL[rand])
    if (trimmed === '$CUSTOMER_POOL[rand]' || trimmed === '$CUSTOMER_POOL') {
      return faker.helpers.arrayElement(this.CUSTOMER_POOL);
    }
    if (trimmed === '$DEVICE_POOL[rand]' || trimmed === '$DEVICE_POOL') {
      return faker.helpers.arrayElement(this.DEVICE_POOL);
    }

    // 4. Regex string generation (/pattern/)
    if (trimmed.startsWith('/') && trimmed.endsWith('/')) {
      const pattern = trimmed.slice(1, -1);
      if (pattern.length > 128) {
        throw new Error(`[SynthesisEngine] Regex pattern exceeds maximum allowed length (128 chars): "${pattern.slice(0, 32)}..."`);
      }
      try {
        const randexp = new RandExp(new RegExp(pattern));
        return randexp.gen();
      } catch (err) {
        if (err instanceof Error && err.message.includes('exceeds maximum allowed length')) {
          throw err;
        }
        throw new Error(`[SynthesisEngine] Invalid regex pattern: "${pattern}"`);
      }
    }

    // 5. Statistical Distributions (weighted, gaussian)
    if (trimmed.startsWith('weighted([')) {
      if (trimmed.length > 512) {
        throw new Error(`[SynthesisEngine] Weighted expression exceeds maximum allowed length (512 chars).`);
      }
      try {
        const arrayStr = trimmed.match(/weighted\((.*)\)/)?.[1];
        if (arrayStr) {
          const parsed = JSON.parse(arrayStr.replace(/'/g, '"'));
          if (Array.isArray(parsed)) return faker.helpers.arrayElement(parsed);
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('exceeds maximum allowed length')) {
          throw err;
        }
        throw new Error(`[SynthesisEngine] Invalid weighted array expression: ${trimmed}`);
      }
    }
    if (trimmed.includes('faker.helpers.weighted')) {
      if (trimmed.length > 512) {
        throw new Error(`[SynthesisEngine] Weighted expression exceeds maximum allowed length (512 chars).`);
      }
      try {
        const match = trimmed.match(/\[(.*)\]/s);
        if (match && match[1]) {
          const itemMatches = Array.from(match[1].matchAll(/\{[^}]*v\s*:\s*['"]?([^'",}]+)['"]?\s*,\s*w\s*:\s*([\d.]+)[^}]*\}/g));
          if (itemMatches.length > 0) {
            const totalW = itemMatches.reduce((sum, m) => sum + parseFloat(m[2] || '1'), 0);
            let rand = Math.random() * totalW;
            for (const item of itemMatches) {
              const val = item[1];
              const w = parseFloat(item[2] || '0');
              if (rand <= w) return val;
              rand -= w;
            }
            return itemMatches[0]?.[1] ?? 'default';
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('exceeds maximum allowed length')) {
          throw err;
        }
        throw new Error(`[SynthesisEngine] Invalid weighted categorical expression: ${trimmed}`);
      }
    }
    if (trimmed.startsWith('gaussian(')) {
        const match = trimmed.match(/gaussian\(([\d.]+),\s*([\d.]+)\)/);
        if (match) {
            const mean = parseFloat(match[1]!);
            const std = parseFloat(match[2]!);
            const u = 1 - Math.random(); 
            const v = Math.random();
            const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            return mean + z * std;
        }
        throw new Error(`[SynthesisEngine] Invalid gaussian expression: ${trimmed}`);
    }

    // 6. Faker float generation: faker.number.float({min:10,max:2500,fractionDigits:2}) or rand.float(...)
    if (trimmed.includes('.float(')) {
      const argsPart = trimmed.slice(trimmed.indexOf('.float('));
      const minNamed = argsPart.match(/min\s*:\s*([\d.]+)/)?.[1];
      const maxNamed = argsPart.match(/max\s*:\s*([\d.]+)/)?.[1];
      const digitsNamed = argsPart.match(/fractionDigits\s*:\s*(\d+)/)?.[1];

      const numMatches = Array.from(argsPart.matchAll(/\d+(?:\.\d+)?/g)).map((m) => parseFloat(m[0]));
      let min = minNamed !== undefined ? parseFloat(minNamed) : (numMatches[0] ?? 10);
      let max = maxNamed !== undefined ? parseFloat(maxNamed) : (numMatches[1] ?? (min + 100));
      const digits = digitsNamed !== undefined ? parseInt(digitsNamed, 10) : (numMatches[2] ?? 2);

      if (min > max) [min, max] = [max, min];
      const raw = Math.random() * (max - min) + min;
      return Number(raw.toFixed(digits));
    }

    // 7. Faker integer generation: faker.number.int({min:1,max:100})
    if (trimmed.includes('.int(')) {
      const argsPart = trimmed.slice(trimmed.indexOf('.int('));
      const minNamed = argsPart.match(/min\s*:\s*(\d+)/)?.[1];
      const maxNamed = argsPart.match(/max\s*:\s*(\d+)/)?.[1];

      const numMatches = Array.from(argsPart.matchAll(/\d+/g)).map((m) => parseInt(m[0], 10));
      let min = minNamed !== undefined ? parseInt(minNamed, 10) : (numMatches[0] ?? 1);
      let max = maxNamed !== undefined ? parseInt(maxNamed, 10) : (numMatches[1] ?? (min + 100));

      if (min > max) [min, max] = [max, min];
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 8. Standard declarative Faker calls
    if (trimmed.includes('faker.string.uuid') || trimmed === 'uuid()') return faker.string.uuid();
    if (trimmed.includes('faker.string.alphanumeric')) return faker.string.alphanumeric(10);
    if (trimmed.includes('faker.string.nanoid')) return faker.string.nanoid(12);
    if (trimmed.includes('faker.internet.email')) return faker.internet.email();
    if (trimmed.includes('faker.internet.ip') || trimmed.includes('faker.internet.ipv4')) return faker.internet.ip();
    if (trimmed.includes('faker.internet.ipv6')) return faker.internet.ipv6();
    if (trimmed.includes('faker.internet.userAgent')) return faker.internet.userAgent();
    if (trimmed.includes('faker.internet.url')) return faker.internet.url();
    if (trimmed.includes('faker.internet.port')) return faker.internet.port();
    if (trimmed.includes('faker.location.latitude')) return faker.location.latitude();
    if (trimmed.includes('faker.location.longitude')) return faker.location.longitude();
    if (trimmed.includes('faker.location.city')) return faker.location.city();
    if (trimmed.includes('faker.location.country')) return faker.location.country();
    if (trimmed.includes('faker.location.zipCode')) return faker.location.zipCode();
    if (trimmed.includes('faker.person.fullName')) return faker.person.fullName();
    if (trimmed.includes('faker.person.firstName')) return faker.person.firstName();
    if (trimmed.includes('faker.person.lastName')) return faker.person.lastName();
    if (trimmed.includes('faker.company.name')) return faker.company.name();
    if (trimmed.includes('faker.finance.accountNumber')) return faker.finance.accountNumber();
    if (trimmed.includes('faker.finance.amount')) return faker.finance.amount();
    if (trimmed.includes('faker.finance.currencyCode')) return faker.finance.currencyCode();
    if (trimmed.includes('faker.finance.transactionType')) return faker.finance.transactionType();
    if (trimmed.includes('faker.finance.iban')) return faker.finance.iban();
    if (trimmed.includes('faker.commerce.productName') || trimmed.includes('faker.commerce.product')) return faker.commerce.productName();
    if (trimmed.includes('faker.commerce.department')) return faker.commerce.department();
    if (trimmed.includes('faker.commerce.price')) return faker.commerce.price();
    if (trimmed.includes('faker.datatype.boolean')) return faker.datatype.boolean();

    // 9. Boolean / string literal check
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (!Number.isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed);
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    // Throw error if it looks like an unsupported expression/variable
    if (trimmed.includes('(') || trimmed.startsWith('$')) {
      throw new Error(`[SynthesisEngine] Invalid or unsupported expression: "${trimmed}"`);
    }

    // Default: return literal string
    return trimmed;
  }
  /**
   * Safely splits an expression by ' + ' but ignores it if it's inside quotes or parentheses.
   */
  private static splitSafeConcatenation(expr: string): string[] {
    const parts: string[] = [];
    let currentPart = '';
    let depth = 0;
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];
      
      // Handle quotes
      if ((char === '"' || char === "'") && expr[i - 1] !== '\\') {
        if (!inQuote) {
          inQuote = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuote = false;
        }
      } else if (!inQuote) {
        if (char === '(' || char === '{' || char === '[') depth++;
        else if (char === ')' || char === '}' || char === ']') depth--;
      }

      // Check for ' + ' outside quotes and parentheses
      if (!inQuote && depth === 0 && expr.substring(i, i + 3) === ' + ') {
        parts.push(currentPart.trim());
        currentPart = '';
        i += 2; // skip the ' + '
      } else {
        currentPart += char;
      }
    }
    
    parts.push(currentPart.trim());
    return parts;
  }
}
