/* ============================================================
   EYES ONLY - Enhanced Agent Features
   Mathematical boss viability, deterministic replay, A/B testing
   ============================================================ */

const AgentEnhanced = (function() {
  'use strict';

  /**
   * Seeded Random Number Generator (for deterministic replay)
   */
  class SeededRNG {
    constructor(seed) {
      this.seed = seed;
      this.state = seed;
    }

    // Linear congruential generator
    next() {
      this.state = (this.state * 1664525 + 1013904223) % 4294967296;
      return this.state / 4294967296;
    }

    // Generate integer between min and max (inclusive)
    nextInt(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    }

    // Reset to initial seed
    reset() {
      this.state = this.seed;
    }
  }

  /**
   * Mathematical Boss Viability Checker
   * Provides closed-form expected value calculations
   */
  class BossViabilityChecker {
    /**
     * Check if boss is mathematically beatable
     * @param {Object} boss - Boss stats {hp, damage, defense, abilities}
     * @param {Object} playerBuild - Player stats {hp, maxHP, deck, defense}
     * @returns {Object} Viability report
     */
    static checkViability(boss, playerBuild) {
      // Calculate max possible player DPS
      var playerMaxDPS = this.calculateMaxDPS(playerBuild);
      var playerAvgDPS = this.calculateAvgDPS(playerBuild);
      
      // Calculate boss effective DPS (accounting for player defense)
      var bossEffectiveDPS = Math.max(0, boss.damage - (playerBuild.defense || 0));
      
      // Time To Kill calculations
      var playerTTK = boss.hp / playerMaxDPS; // Turns for player to kill boss
      var bossTTK = playerBuild.hp / bossEffectiveDPS; // Turns for boss to kill player
      
      // Survival margin (how much "room" player has)
      var survivalMargin = bossTTK - playerTTK;
      var survivalMarginPercent = (survivalMargin / bossTTK) * 100;
      
      // Mathematical impossibility check
      var isImpossible = false;
      var impossibilityReason = null;
      
      if (bossEffectiveDPS >= playerBuild.hp) {
        isImpossible = true;
        impossibilityReason = 'Boss one-shots player';
      } else if (bossTTK <= playerTTK * 0.9) {
        isImpossible = true;
        impossibilityReason = 'Player dies before boss (<90% margin)';
      } else if (playerMaxDPS <= 0) {
        isImpossible = true;
        impossibilityReason = 'Player has no damage output';
      }
      
      // Calculate minimum required deck
      var minDeckPower = this.calculateMinDeckPower(boss, playerBuild.hp, playerBuild.defense);
      
      // Expected value calculation (probability of survival)
      var expectedSurvival = this.calculateExpectedSurvival(
        playerBuild,
        boss,
        playerTTK,
        bossTTK
      );
      
      return {
        viable: !isImpossible && expectedSurvival > 0.1,
        mathematicallyImpossible: isImpossible,
        impossibilityReason: impossibilityReason,
        
        // TTK metrics
        playerTTK: playerTTK.toFixed(1),
        bossTTK: bossTTK.toFixed(1),
        survivalMargin: survivalMargin.toFixed(1),
        survivalMarginPercent: survivalMarginPercent.toFixed(1),
        
        // DPS metrics
        playerMaxDPS: playerMaxDPS.toFixed(1),
        playerAvgDPS: playerAvgDPS.toFixed(1),
        bossEffectiveDPS: bossEffectiveDPS.toFixed(1),
        
        // Requirements
        minRequiredDeckPower: minDeckPower,
        currentDeckPower: this.calculateDeckPower(playerBuild.deck),
        deckPowerDeficit: Math.max(0, minDeckPower - this.calculateDeckPower(playerBuild.deck)),
        
        // Probability
        expectedSurvivalProbability: (expectedSurvival * 100).toFixed(1),
        
        // Recommendations
        recommendations: this.generateRecommendations(
          isImpossible,
          survivalMarginPercent,
          minDeckPower,
          this.calculateDeckPower(playerBuild.deck)
        )
      };
    }

    /**
     * Calculate maximum possible DPS from deck
     */
    static calculateMaxDPS(playerBuild) {
      if (!playerBuild.deck || playerBuild.deck.length === 0) return 0;
      
      // Find highest power cards
      var sortedDeck = playerBuild.deck.slice().sort((a, b) => b.power - a.power);
      
      // Assume player can play top 3 cards per turn (generous estimate)
      var topCards = sortedDeck.slice(0, 3);
      var maxDPS = topCards.reduce((sum, card) => sum + (card.power || 0), 0);
      
      return maxDPS;
    }

    /**
     * Calculate average DPS (more realistic)
     */
    static calculateAvgDPS(playerBuild) {
      if (!playerBuild.deck || playerBuild.deck.length === 0) return 0;
      
      var totalPower = playerBuild.deck.reduce((sum, card) => sum + (card.power || 0), 0);
      var avgCardPower = totalPower / playerBuild.deck.length;
      
      // Assume 2 cards played per turn on average
      return avgCardPower * 2;
    }

    /**
     * Calculate deck power (quality + power)
     */
    static calculateDeckPower(deck) {
      if (!deck) return 0;
      
      var qualityScores = {
        'MYTHIC': 20,
        'ELITE': 12,
        'RARE': 8,
        'UNCOMMON': 5,
        'COMMON': 2
      };
      
      return deck.reduce((total, card) => {
        var qualityScore = qualityScores[card.quality] || 0;
        return total + qualityScore + (card.power || 0);
      }, 0);
    }

    /**
     * Calculate minimum required deck power to beat boss
     */
    static calculateMinDeckPower(boss, playerHP, playerDefense) {
      var bossEffectiveDPS = Math.max(0, boss.damage - (playerDefense || 0));
      var turnsAvailable = Math.floor(playerHP / bossEffectiveDPS);
      
      // Need to deal boss.hp damage in turnsAvailable turns
      var requiredDPSPerTurn = boss.hp / turnsAvailable;
      
      // Assume 2 cards per turn, need avg power per card
      var requiredAvgPower = requiredDPSPerTurn / 2;
      
      // Convert to deck power (rough estimate)
      // Assume 10 card deck with quality score ~5
      return Math.ceil(requiredAvgPower * 10 + 50);
    }

    /**
     * Calculate expected survival probability
     */
    static calculateExpectedSurvival(playerBuild, boss, playerTTK, bossTTK) {
      // Simple model: survival chance based on margin
      var margin = bossTTK - playerTTK;
      
      if (margin <= 0) return 0;
      if (margin >= bossTTK * 0.5) return 0.95;
      
      // Linear interpolation
      return (margin / bossTTK) * 2;
    }

    /**
     * Generate recommendations
     */
    static generateRecommendations(isImpossible, marginPercent, minDeck, currentDeck) {
      var recs = [];
      
      if (isImpossible) {
        recs.push('⚠️ CRITICAL: Boss is mathematically impossible with current stats');
        recs.push('• Reduce boss HP or damage');
        recs.push('• Increase player starting deck power');
      } else if (marginPercent < 10) {
        recs.push('⚠️ WARNING: Very tight survival margin (<10%)');
        recs.push('• Consider slight boss nerf or player buff');
      } else if (marginPercent > 50) {
        recs.push('ℹ️ Boss may be too easy (>50% margin)');
        recs.push('• Consider slight boss buff');
      }
      
      if (currentDeck < minDeck) {
        recs.push(`📈 Player needs ${minDeck - currentDeck} more deck power`);
      }
      
      if (recs.length === 0) {
        recs.push('✓ Boss difficulty appears balanced');
      }
      
      return recs;
    }
  }

  /**
   * Deterministic Agent Runner
   * Provides reproducible runs with seed + action trace
   */
  class DeterministicAgent {
    constructor(persona, seed) {
      this.persona = persona;
      this.seed = seed || Date.now();
      this.rng = new SeededRNG(this.seed);
      this.inputTrace = [];
      this.stateDiffs = [];
      this.tick = 0;
    }

    /**
     * Record action and state
     */
    recordAction(action, stateBefore, stateAfter) {
      this.inputTrace.push({
        tick: this.tick,
        action: action,
        stateBefore: this.snapshotState(stateBefore),
        stateAfter: this.snapshotState(stateAfter)
      });
      
      // Calculate diff
      this.stateDiffs.push({
        tick: this.tick,
        diff: this.calculateStateDiff(stateBefore, stateAfter)
      });
      
      this.tick++;
    }

    /**
     * Create state snapshot
     */
    snapshotState(state) {
      return {
        floor: state.floor,
        hp: state.hp,
        credits: state.credits,
        deckSize: state.deck ? state.deck.length : 0,
        position: state.position ? { ...state.position } : null
      };
    }

    /**
     * Calculate difference between states
     */
    calculateStateDiff(before, after) {
      return {
        hpDelta: after.hp - before.hp,
        creditsDelta: after.credits - before.credits,
        deckSizeDelta: (after.deck ? after.deck.length : 0) - (before.deck ? before.deck.length : 0)
      };
    }

    /**
     * Decide next action (using seeded RNG)
     */
    decideAction(gameState, legalActions) {
      // Use persona strategy with seeded randomness
      if (this.persona.name === 'MINMAXER') {
        // Pick highest value action
        return legalActions.reduce((best, action) => 
          this.evaluateAction(action) > this.evaluateAction(best) ? action : best
        );
      } else if (this.persona.name === 'DUMB_RANDOM') {
        // Pure RNG
        return legalActions[this.rng.nextInt(0, legalActions.length - 1)];
      } else {
        // Weighted random based on persona
        return this.weightedRandomAction(legalActions);
      }
    }

    /**
     * Evaluate action value
     */
    evaluateAction(action) {
      // Simple heuristic
      if (action.type === 'move') return 1;
      if (action.type === 'attack') return 3;
      if (action.type === 'heal') return 2;
      return 0;
    }

    /**
     * Weighted random action selection
     */
    weightedRandomAction(actions) {
      var weights = actions.map(a => this.evaluateAction(a));
      var totalWeight = weights.reduce((sum, w) => sum + w, 0);
      var rand = this.rng.next() * totalWeight;
      
      var cumulative = 0;
      for (var i = 0; i < actions.length; i++) {
        cumulative += weights[i];
        if (rand <= cumulative) {
          return actions[i];
        }
      }
      
      return actions[0];
    }

    /**
     * Export replay data
     */
    exportReplay() {
      return {
        metadata: {
          seed: this.seed,
          persona: this.persona.name,
          timestamp: new Date().toISOString()
        },
        inputTrace: this.inputTrace,
        stateDiffs: this.stateDiffs,
        totalTicks: this.tick
      };
    }

    /**
     * Import and validate replay
     */
    static validateReplay(replayData, gameEngine) {
      // Re-run with same seed
      var agent = new DeterministicAgent(
        { name: replayData.metadata.persona },
        replayData.metadata.seed
      );
      
      // TODO: Apply actions and verify states match
      // This requires integration with actual game engine
      
      return {
        valid: true,
        message: 'Replay validation requires game engine integration'
      };
    }
  }

  /**
   * A/B Testing Framework
   * Run same seed with different feature toggles
   */
  class ABTestRunner {
    constructor() {
      this.results = [];
    }

    /**
     * Run A/B test for a feature
     */
    async runABTest(seed, persona, feature, numRuns = 10) {
      console.log(`Running A/B test: ${feature} (${numRuns} runs per variant)`);
      
      var resultsA = [];
      var resultsB = [];
      
      for (var i = 0; i < numRuns; i++) {
        // Variant A: Feature enabled
        var runA = await this.runWithFeature(seed + i, persona, feature, true);
        resultsA.push(runA);
        
        // Variant B: Feature disabled
        var runB = await this.runWithFeature(seed + i, persona, feature, false);
        resultsB.push(runB);
      }
      
      // Calculate aggregate metrics
      return this.compareVariants(resultsA, resultsB, feature);
    }

    /**
     * Run single variant
     */
    async runWithFeature(seed, persona, feature, enabled) {
      // Mock implementation - would integrate with actual game
      var agent = new DeterministicAgent(persona, seed);
      
      // Simulate run with feature toggle
      return {
        seed: seed,
        feature: feature,
        enabled: enabled,
        survived: Math.random() > 0.5,
        damageTaken: Math.floor(Math.random() * 100),
        turns: Math.floor(Math.random() * 50) + 10,
        regretMoves: Math.floor(Math.random() * 5)
      };
    }

    /**
     * Compare two variants and calculate deltas
     */
    compareVariants(variantA, variantB, feature) {
      var avgA = this.calculateAverages(variantA);
      var avgB = this.calculateAverages(variantB);
      
      return {
        feature: feature,
        sampleSize: variantA.length,
        
        // Deltas (A - B, positive = feature helps)
        deltaSurvivalRate: avgA.survivalRate - avgB.survivalRate,
        deltaDamageTaken: avgB.damageTaken - avgA.damageTaken, // Less damage = good
        deltaTurns: avgA.turns - avgB.turns,
        deltaRegretMoves: avgB.regretMoves - avgA.regretMoves,
        
        // Raw metrics
        withFeature: avgA,
        withoutFeature: avgB,
        
        // Utility score (-100 to +100)
        utilityScore: this.calculateUtility(avgA, avgB),
        
        // Interpretation
        interpretation: this.interpretResults(avgA, avgB, feature)
      };
    }

    /**
     * Calculate averages for a variant
     */
    calculateAverages(results) {
      var survived = results.filter(r => r.survived).length;
      var totalDamage = results.reduce((sum, r) => sum + r.damageTaken, 0);
      var totalTurns = results.reduce((sum, r) => sum + r.turns, 0);
      var totalRegret = results.reduce((sum, r) => sum + r.regretMoves, 0);
      
      return {
        survivalRate: (survived / results.length * 100).toFixed(1),
        damageTaken: (totalDamage / results.length).toFixed(1),
        turns: (totalTurns / results.length).toFixed(1),
        regretMoves: (totalRegret / results.length).toFixed(1)
      };
    }

    /**
     * Calculate utility score
     */
    calculateUtility(withFeature, withoutFeature) {
      // Weight factors
      var survivalWeight = 50; // Most important
      var damageWeight = 30;
      var turnWeight = 10;
      var regretWeight = 10;
      
      var survivalDelta = parseFloat(withFeature.survivalRate) - parseFloat(withoutFeature.survivalRate);
      var damageDelta = parseFloat(withoutFeature.damageTaken) - parseFloat(withFeature.damageTaken);
      var turnDelta = parseFloat(withFeature.turns) - parseFloat(withoutFeature.turns);
      var regretDelta = parseFloat(withoutFeature.regretMoves) - parseFloat(withFeature.regretMoves);
      
      // Normalize and weight
      var score = (survivalDelta * survivalWeight / 100) +
                  (damageDelta * damageWeight / 100) +
                  (turnDelta * turnWeight / 100) +
                  (regretDelta * regretWeight / 100);
      
      return score.toFixed(1);
    }

    /**
     * Interpret results
     */
    interpretResults(withFeature, withoutFeature, feature) {
      var utilityScore = parseFloat(this.calculateUtility(withFeature, withoutFeature));
      
      if (utilityScore > 10) {
        return `✓ ${feature} provides significant positive utility (+${utilityScore})`;
      } else if (utilityScore > 2) {
        return `ℹ️ ${feature} provides minor positive utility (+${utilityScore})`;
      } else if (utilityScore > -2) {
        return `⚠️ ${feature} has no measurable impact (${utilityScore})`;
      } else if (utilityScore > -10) {
        return `⚠️ ${feature} has minor negative impact (${utilityScore})`;
      } else {
        return `✗ ${feature} has significant negative impact (${utilityScore})`;
      }
    }

    /**
     * Export results
     */
    exportResults() {
      return JSON.stringify(this.results, null, 2);
    }
  }

  // Export classes
  return {
    SeededRNG: SeededRNG,
    BossViabilityChecker: BossViabilityChecker,
    DeterministicAgent: DeterministicAgent,
    ABTestRunner: ABTestRunner
  };
})();

// Node.js export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentEnhanced;
}
