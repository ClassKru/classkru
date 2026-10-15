'use strict';

// Experimental defaults: tune here after collecting safe aggregate telemetry.
// These are independent dimensions; token estimates are not derived from file size.
module.exports = Object.freeze({
  complexityBudget: Object.freeze({
    maxScenes: 3,
    maxMechanics: 2,
    maxAnimationComplexity: 2,
    maxAssets: 2,
    maxExternalDependencies: 0,
    maxEstimatedHtmlCharacters: 45000,
    maxEstimatedOutputTokens: 12000
  }),
  retryPolicy: Object.freeze({
    conversationMaxTokens: 700,
    builderMaxTokens: 14000,
    repairMaxTokens: 14000,
    maxRetries: 2,
    retryableCategories: Object.freeze(['timeout', 'rate_limit', 'provider_error']),
    initialBackoffMs: 300,
    maxBackoffMs: 1200,
    maxBuildDurationMs: 270000,
    requestTimeoutMs: 150000,
    minRetryWindowMs: 12000,
    maxRepairAttempts: 1,
    maxRuntimeRepairAttempts: 1
  })
});
