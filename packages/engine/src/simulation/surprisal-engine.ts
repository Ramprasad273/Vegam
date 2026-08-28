/**
 * Surprisal Mathematical Engine (`I(x)` / Shannon Entropy / KL Divergence).
 *
 * Information-theoretic scoring engine that evaluates every single event packet before emission.
 * Computes self-information in bits (`I(x) = -log2(P(x))`), tracks running average entropy `H(X)`,
 * and detects anomalies (`I(x) > anomalyThresholdBits`).
 */

export interface FieldSurprisalRule {
  readonly fieldName: string;
  readonly type: 'categorical' | 'gaussian' | 'lognormal';
  readonly weight?: number; // Relative contribution weight (default 1.0)
  // For categorical distributions: map of value -> exact probability [0..1]
  readonly categoricalWeights?: Readonly<Record<string, number>>;
  // For gaussian or lognormal: mean (mu) and standard deviation (sigma)
  readonly mu?: number;
  readonly sigma?: number;
}

export interface PacketSurprisalScore {
  readonly totalSurprisalBits: number;
  readonly isAnomaly: boolean;
  readonly fieldBreakdown: Readonly<Record<string, { probability: number; surprisalBits: number }>>;
}

export class SurprisalEngine {
  private static readonly DEFAULT_ANOMALY_THRESHOLD_BITS = 6.0;
  private static readonly EPSILON = 1e-12; // To avoid log2(0)

  // Running statistics for entropy H(X) estimation
  private totalPacketsScored = 0;
  private runningEntropySumBits = 0;

  constructor(private readonly anomalyThresholdBits: number = SurprisalEngine.DEFAULT_ANOMALY_THRESHOLD_BITS) {}

  /**
   * Evaluates the self-information (`I(x)`) of an event payload across all configured field rules.
   *
   * @param payload - Readonly event payload record.
   * @param rules - List of probability rules governing individual field distributions.
   * @returns PacketSurprisalScore containing total bits, anomaly boolean, and per-field breakdown.
   */
  public scorePacket(
    payload: Readonly<Record<string, unknown>>,
    rules: ReadonlyArray<FieldSurprisalRule>
  ): PacketSurprisalScore {
    let weightedSurprisalSum = 0;
    let totalWeights = 0;
    const fieldBreakdown: Record<string, { probability: number; surprisalBits: number }> = {};

    for (const rule of rules) {
      const value = payload[rule.fieldName];
      const weight = rule.weight ?? 1.0;
      totalWeights += weight;

      const prob = this.evaluateFieldProbability(value, rule);
      const clampedProb = Math.max(SurprisalEngine.EPSILON, Math.min(1.0, prob));
      const fieldBits = -Math.log2(clampedProb);

      fieldBreakdown[rule.fieldName] = {
        probability: clampedProb,
        surprisalBits: Number(fieldBits.toFixed(4))
      };

      weightedSurprisalSum += fieldBits * weight;
    }

    // Normalized weighted surprisal
    const totalBits = totalWeights > 0 ? weightedSurprisalSum / totalWeights : 0;
    const roundedBits = Number(totalBits.toFixed(4));
    const isAnomaly = roundedBits > this.anomalyThresholdBits;

    // Update running entropy sum for H(X)
    this.totalPacketsScored++;
    this.runningEntropySumBits += roundedBits;

    return {
      totalSurprisalBits: roundedBits,
      isAnomaly,
      fieldBreakdown
    };
  }

  /**
   * Returns the running average Shannon Entropy `H(X)` across all evaluated packets.
   */
  public getShannonEntropy(): number {
    if (this.totalPacketsScored === 0) {
      return 0.0;
    }
    return Number((this.runningEntropySumBits / this.totalPacketsScored).toFixed(4));
  }

  /**
   * Computes Kullback-Leibler (KL) Divergence `D(P || Q)` between generated distribution P
   * and baseline reference distribution Q over categorical buckets or probability bins.
   *
   * @param generatedProbs - Observed probability distribution P(x)
   * @param referenceProbs - Baseline probability distribution Q(x)
   * @returns Exact KL divergence measured in bits (or nats if using ln, here using log2 for bits).
   */
  public static computeKLDivergence(
    generatedProbs: ReadonlyArray<number>,
    referenceProbs: ReadonlyArray<number>
  ): number {
    if (generatedProbs.length !== referenceProbs.length || generatedProbs.length === 0) {
      return 0.0;
    }

    let klSum = 0;
    for (let i = 0; i < generatedProbs.length; i++) {
      const p = Math.max(SurprisalEngine.EPSILON, generatedProbs[i] || SurprisalEngine.EPSILON);
      const q = Math.max(SurprisalEngine.EPSILON, referenceProbs[i] || SurprisalEngine.EPSILON);
      klSum += p * Math.log2(p / q);
    }
    return Number(Math.max(0, klSum).toFixed(4));
  }

  /**
   * Evaluates probability P(f_i = v_i) based on distribution rules.
   */
  private evaluateFieldProbability(value: unknown, rule: FieldSurprisalRule): number {
    if (value === undefined || value === null) {
      return 0.01; // Missing values trigger moderate-high surprisal
    }

    if (rule.type === 'categorical') {
      const strVal = String(value);
      if (rule.categoricalWeights && strVal in rule.categoricalWeights) {
        return rule.categoricalWeights[strVal] || SurprisalEngine.EPSILON;
      }
      return 0.05; // Unseen categorical item
    }

    if (rule.type === 'gaussian' || rule.type === 'lognormal') {
      const numVal = typeof value === 'number' ? value : parseFloat(String(value));
      if (Number.isNaN(numVal)) {
        return SurprisalEngine.EPSILON;
      }
      const mu = rule.mu ?? 0;
      const sigma = rule.sigma ?? 1;
      if (sigma <= 0) {
        return SurprisalEngine.EPSILON;
      }

      const targetVal = rule.type === 'lognormal' && numVal > 0 ? Math.log(numVal) : numVal;
      return this.computeGaussianBucketProbability(targetVal, mu, sigma);
    }

    return 0.5; // Default neutral probability
  }

  /**
   * Computes the probability density normalized area under +/- 0.5 * sigma around target `t`.
   */
  private computeGaussianBucketProbability(t: number, mu: number, sigma: number): number {
    const delta = 0.5 * sigma;
    const z1 = (t - delta - mu) / (sigma * Math.SQRT2);
    const z2 = (t + delta - mu) / (sigma * Math.SQRT2);
    const prob = Math.abs(this.errorFunction(z2) - this.errorFunction(z1)) * 0.5;
    return Math.max(SurprisalEngine.EPSILON, prob);
  }

  /**
   * Numerical approximation of the Error Function `erf(z)` with maximum error < 1.5e-7.
   */
  private errorFunction(z: number): number {
    const sign = z < 0 ? -1 : 1;
    const x = Math.abs(z);

    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
    return sign * y;
  }
}
