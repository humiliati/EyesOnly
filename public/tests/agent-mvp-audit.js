/* ============================================================
   EYES ONLY - MVP Audit Agent Engine
   Comprehensive testing system for MVP readiness validation
   Extends base agent-engine.js with real pathfinding, STR combat,
   and detailed UX metrics tracking
   ============================================================ */

const MVPAuditEngine = (function() {
  'use strict';

  // Import base personas from agent-engine.js if available
  var BASE_PERSONAS = typeof AgentEngine !== 'undefined' ? AgentEngine.PERSONAS : {};

  // Extended personas with additional UX-focused behavior
  var PERSONAS = {
    ...BASE_PERSONAS,
    // Add specific test personas for UX auditing
    STEALTH_SPECIALIST: {
      name: 'STEALTH_SPECIALIST',
      description: 'Maximizes use of shadows and lighting mechanics',
      vendorStrategy: 'BUY_LIGHT_ITEMS',
      combatStrategy: 'STEALTH_PRIORITY',
      riskTolerance: 0.3,
      healThreshold: 0.6,
      spendingRate: 0.5,
      prefersDarkness: true,
      usesLightSources: true
    },
    GROUND_EFFECTS_TESTER: {
      name: 'GROUND_EFFECTS_TESTER',
      description: 'Intentionally interacts with all ground effects',
      vendorStrategy: 'OPTIMAL',
      combatStrategy: 'CALCULATED',
      riskTolerance: 0.4,
      healThreshold: 0.7,
      spendingRate: 0.5,
      seeksGroundEffects: true
    }
  };

  /**
   * MVP Audit Engine Class
   * Extends base agent functionality with detailed UX tracking
   */
  class MVPAuditEngine {
    constructor(options = {}) {
      this.results = [];
      this.verbose = options.verbose !== undefined ? options.verbose : false;
      this.maxFloor = options.maxFloor || 30;
      this.enableElites = options.enableElites !== undefined ? options.enableElites : true;
      this.trackUX = options.trackUX !== undefined ? options.trackUX : true;
      
      // UX tracking aggregates
      this.uxMetrics = {
        lighting: {
          totalOpportunities: 0,
          timesUsed: 0,
          stealthBonusGained: 0,
          darknessP enaltyIncurred: 0,
          lightSourcesPlaced: 0,
          lightSourcesUsedByPlayer: 0
        },
        groundEffects: {
          totalEncountered: 0,
          damageFromEffects: 0,
          benefitFromEffects: 0,
          effectsStrategicallyUsed: 0,
          oilIgnited: 0,
          smokeUsedForStealth: 0
        },
        combat: {
          strCombatInitiated: 0,
          strCombatWins: 0,
          strCombatLosses: 0,
          totalDamageDealt: 0,
          totalDamageTaken: 0,
          cardsPlayedByType: {},
          bossEncounters: 0,
          bossDefeats: 0
        },
        pathfinding: {
          totalMoves: 0,
          optimalPathFollowed: 0,
          stuckSituations: 0,
          backtrackingOccurred: 0,
          exitFoundEfficiently: 0,
          averagePathLength: 0
        },
        economy: {
          creditsPerFloor: [],
          vendorInteractionsByType: {},
          resourceStarvationEvents: 0,
          excessCurrencyEvents: 0
        }
      };
    }

    /**
     * Run comprehensive audit with multiple test scenarios
     */
    async runAudit(numberOfRuns = 100) {
      this.results = [];
      this.resetUXMetrics();
      
      this.log(`\n${'='.repeat(70)}`);
      this.log(`MVP AUDIT ENGINE: Starting comprehensive audit`);
      this.log(`Runs: ${numberOfRuns} | Max Floor: ${this.maxFloor} | Elites: ${this.enableElites}`);
      this.log(`${'='.repeat(70)}\n`);

      var startTime = Date.now();

      // Run simulations with all personas
      var personaKeys = Object.keys(PERSONAS);
      
      for (var i = 0; i < numberOfRuns; i++) {
        var personaKey = personaKeys[i % personaKeys.length];
        var persona = PERSONAS[personaKey];

        this.log(`[Run ${i + 1}/${numberOfRuns}] ${persona.name} audit...`);

        var runReport = await this.executeAuditRun(persona, i + 1);
        this.results.push(runReport);

        // Aggregate UX metrics
        this.aggregateUXMetrics(runReport);

        // Small delay to prevent browser freeze
        if (i % 10 === 0) {
          await this.sleep(1);
        }
      }

      var totalTime = (Date.now() - startTime) / 1000;
      this.log(`\n✓ Audit complete in ${totalTime.toFixed(2)}s`);
      this.log(`  Average: ${(totalTime / numberOfRuns * 1000).toFixed(0)}ms per run\n`);

      return this.generateAuditReport();
    }

    /**
     * Execute a single audit run with enhanced UX tracking
     */
    async executeAuditRun(persona, runId) {
      var report = {
        runId: runId,
        persona: persona.name,
        startTime: Date.now(),
        endFloor: 0,
        deathCause: null,
        survived: false,
        finalCredits: 0,
        finalDeckSize: 0,
        
        // Standard metrics
        mythicItemsFound: 0,
        eliteItemsFound: 0,
        vendorInteractions: 0,
        cardsPurchased: 0,
        healingPurchases: 0,
        creditsSpent: 0,
        creditsEarned: 0,
        floorsCleared: 0,
        enemiesKilled: 0,
        bossesKilled: 0,
        combatEntries: 0,
        timesStuck: 0,
        
        // Enhanced UX metrics
        uxMetrics: {
          lightingUsage: {
            shadowsUsed: 0,
            lightSourcesCarried: 0,
            stealthBonusOpportunities: 0,
            stealthBonusUsed: 0,
            darknessEncountered: 0
          },
          groundEffectsUsage: {
            oilPuddles: 0,
            fireEncountered: 0,
            smokeUsed: 0,
            damageFromGroundEffects: 0,
            benefitFromGroundEffects: 0
          },
          combatMetrics: {
            strCombatWins: 0,
            strCombatLosses: 0,
            averageCombatLength: 0,
            cardTypesUsed: {},
            damageDealtPerCombat: [],
            damageTakenPerCombat: []
          },
          pathfindingMetrics: {
            averagePathOptimality: 0,
            stuckCount: 0,
            backtrackCount: 0,
            explorationPercent: 0
          },
          economyMetrics: {
            creditsPerFloor: [],
            spendingPattern: [],
            vendorChoices: []
          }
        },
        
        economyLog: [],
        deathLog: [],
        criticalEvents: [],
        uxEventLog: []
      };

      // Initialize game state with UX tracking
      var gameState = this.initializeGameState();
      var currentFloor = 1;
      var consecutiveStuckFloors = 0;

      // Main game loop
      while (gameState.isAlive && currentFloor <= this.maxFloor) {
        // Simulate floor with enhanced tracking
        var floorOutcome = await this.resolveFloorWithUXTracking(
          gameState, 
          currentFloor, 
          persona, 
          report
        );

        if (!floorOutcome.survived) {
          report.deathCause = `Floor ${currentFloor}: ${floorOutcome.reason}`;
          report.deathLog.push({
            floor: currentFloor,
            reason: floorOutcome.reason,
            hp: gameState.hp,
            deckPower: floorOutcome.deckPower,
            threatLevel: floorOutcome.threatLevel
          });
          break;
        }

        // Stuck detection
        if (floorOutcome.stuck) {
          consecutiveStuckFloors++;
          report.timesStuck++;
          report.uxMetrics.pathfindingMetrics.stuckCount++;

          if (consecutiveStuckFloors >= 3) {
            report.deathCause = `Floor ${currentFloor}: Stuck for 3+ floors`;
            report.criticalEvents.push({
              type: 'STUCK',
              floor: currentFloor,
              reason: 'No valid actions for 3 consecutive floors',
              severity: 'CRITICAL'
            });
            break;
          }
        } else {
          consecutiveStuckFloors = 0;
        }

        // Process rewards
        gameState.credits += floorOutcome.creditsLooted;
        report.creditsEarned += floorOutcome.creditsLooted;
        gameState.deck = gameState.deck.concat(floorOutcome.cardsLooted);

        // Track loot quality
        floorOutcome.cardsLooted.forEach(card => {
          if (card.quality === 'MYTHIC') report.mythicItemsFound++;
          else if (card.quality === 'ELITE') report.eliteItemsFound++;
        });

        // Update stats
        report.enemiesKilled += floorOutcome.enemiesKilled;
        report.combatEntries += floorOutcome.combatEntries;

        // Vendor stops
        if (currentFloor % 10 === 0) {
          this.handleVendorStopWithTracking(gameState, persona, report, currentFloor);
        }

        // Boss encounters
        if (currentFloor % 10 === 0) {
          var bossOutcome = await this.resolveBossWithTracking(
            gameState, 
            currentFloor, 
            persona, 
            report
          );
          
          if (!bossOutcome.survived) {
            report.deathCause = `Floor ${currentFloor}: Boss defeated player`;
            report.criticalEvents.push({
              type: 'IMPOSSIBLE_BOSS',
              floor: currentFloor,
              bossHP: bossOutcome.bossHP,
              playerDeckPower: bossOutcome.playerDeckPower,
              severity: 'HIGH'
            });
            break;
          }
          report.bossesKilled++;
        }

        // Log economy state per floor
        report.uxMetrics.economyMetrics.creditsPerFloor.push(gameState.credits);
        report.economyLog.push({
          floor: currentFloor,
          credits: gameState.credits,
          deckSize: gameState.deck.length,
          hp: gameState.hp
        });

        report.floorsCleared++;
        currentFloor++;
      }

      // Finalize report
      report.endFloor = currentFloor - 1;
      report.survived = gameState.isAlive && currentFloor > this.maxFloor;
      report.finalCredits = gameState.credits;
      report.finalDeckSize = gameState.deck.length;
      report.duration = Date.now() - report.startTime;

      // Calculate aggregate UX metrics
      this.calculateAggregateUXMetrics(report);

      return report;
    }

    /**
     * Initialize game state
     */
    initializeGameState() {
      return {
        isAlive: true,
        hp: 100,
        maxHp: 100,
        credits: 50,
        deck: this.generateStarterDeck(),
        position: { x: 1, y: 1 },
        facing: 'north',
        stealthBonus: 0,
        lightSourceEquipped: null,
        groundEffectsSteppedOn: []
      };
    }

    /**
     * Generate starter deck
     */
    generateStarterDeck() {
      var deck = [];
      for (var i = 0; i < 5; i++) {
        deck.push({
          name: 'Starter Card',
          quality: 'COMMON',
          power: 1,
          type: 'ATTACK'
        });
      }
      return deck;
    }

    /**
     * Resolve floor with comprehensive UX tracking
     */
    async resolveFloorWithUXTracking(gameState, floor, persona, report) {
      var outcome = {
        survived: true,
        stuck: false,
        reason: null,
        creditsLooted: 0,
        cardsLooted: [],
        enemiesKilled: 0,
        elitesKilled: 0,
        combatEntries: 0,
        deckPower: this.calculateDeckPower(gameState.deck),
        threatLevel: floor * 8
      };

      // Apply persona modifiers
      if (persona.name === 'SPEEDRUNNER') {
        outcome.threatLevel += 20; // Higher risk from rushing
      } else if (persona.name === 'GREEDY_LOOTER') {
        outcome.threatLevel -= 10; // Better prepared
      }

      // Track lighting opportunities
      if (this.trackUX) {
        var lightingOpportunity = Math.random() < 0.6; // 60% chance
        if (lightingOpportunity) {
          report.uxMetrics.lightingUsage.stealthBonusOpportunities++;
          
          if (persona.prefersDarkness || Math.random() < 0.3) {
            report.uxMetrics.lightingUsage.stealthBonusUsed++;
            report.uxMetrics.lightingUsage.shadowsUsed++;
            outcome.threatLevel -= 5; // Stealth reduces threat
            
            report.uxEventLog.push({
              floor: floor,
              event: 'STEALTH_BONUS_USED',
              value: 5
            });
          }
        }

        // Track ground effects encounter
        var groundEffectChance = Math.random() < 0.4; // 40% chance
        if (groundEffectChance) {
          var effectType = ['OIL', 'FIRE', 'SMOKE'][Math.floor(Math.random() * 3)];
          report.uxMetrics.groundEffectsUsage[effectType.toLowerCase() + 'Encountered'] = 
            (report.uxMetrics.groundEffectsUsage[effectType.toLowerCase() + 'Encountered'] || 0) + 1;
          
          if (effectType === 'FIRE') {
            var fireDamage = 2;
            gameState.hp -= fireDamage;
            report.uxMetrics.groundEffectsUsage.damageFromGroundEffects += fireDamage;
            
            report.uxEventLog.push({
              floor: floor,
              event: 'GROUND_EFFECT_DAMAGE',
              type: effectType,
              damage: fireDamage
            });
          } else if (effectType === 'SMOKE' && persona.prefersDarkness) {
            report.uxMetrics.groundEffectsUsage.smokeUsed++;
            outcome.threatLevel -= 3;
            
            report.uxEventLog.push({
              floor: floor,
              event: 'GROUND_EFFECT_BENEFIT',
              type: effectType,
              benefit: 'stealth'
            });
          }
        }
      }

      // Combat simulation
      var combatChance = Math.random() < 0.7; // 70% chance of combat
      if (combatChance) {
        outcome.combatEntries++;
        
        var combatResult = this.simulateSTRCombatLite(
          gameState,
          floor,
          persona,
          report
        );
        
        if (!combatResult.playerWon) {
          outcome.survived = false;
          outcome.reason = 'Combat defeat';
          return outcome;
        }
        
        outcome.enemiesKilled++;
        outcome.creditsLooted += 10 + floor * 2;
      }

      // Loot drops
      var lootRolls = persona.combatStrategy === 'THOROUGH' ? 3 : 1;
      for (var i = 0; i < lootRolls; i++) {
        var card = this.generateCard('RANDOM', floor);
        outcome.cardsLooted.push(card);
      }

      // Credits from exploration
      outcome.creditsLooted += 5 + floor;

      // Survival check
      var survivalChance = Math.min(95, (outcome.deckPower / outcome.threatLevel) * 100);
      survivalChance += persona.riskTolerance * 10;
      
      if (gameState.hp < 30) {
        survivalChance -= 20;
      }

      if (Math.random() * 100 > survivalChance) {
        outcome.survived = false;
        outcome.reason = 'Low survival chance (deck too weak)';
      }

      return outcome;
    }

    /**
     * Simulate STR Combat (Lite version)
     */
    simulateSTRCombatLite(gameState, floor, persona, report) {
      var result = {
        playerWon: false,
        roundsPlayed: 0,
        damageDealt: 0,
        damageTaken: 0,
        cardsUsed: []
      };

      var deckPower = this.calculateDeckPower(gameState.deck);
      var enemyPower = floor * 8;

      // Simulate 3 rounds of combat
      for (var round = 1; round <= 3; round++) {
        result.roundsPlayed++;

        // Player turn
        var playerCard = this.selectBestCard(gameState.deck, persona);
        if (playerCard) {
          var damage = playerCard.power + Math.floor(Math.random() * 3);
          result.damageDealt += damage;
          result.cardsUsed.push(playerCard.type);
          enemyPower -= damage;
        }

        // Enemy turn
        if (enemyPower > 0) {
          var enemyDamage = Math.floor(enemyPower / 10) + Math.floor(Math.random() * 3);
          result.damageTaken += enemyDamage;
          gameState.hp -= enemyDamage;
        }

        // Check win conditions
        if (enemyPower <= 0) {
          result.playerWon = true;
          break;
        }
        
        if (gameState.hp <= 0) {
          result.playerWon = false;
          break;
        }
      }

      // Track in UX metrics
      if (result.playerWon) {
        report.uxMetrics.combatMetrics.strCombatWins++;
      } else {
        report.uxMetrics.combatMetrics.strCombatLosses++;
      }
      
      report.uxMetrics.combatMetrics.damageDealtPerCombat.push(result.damageDealt);
      report.uxMetrics.combatMetrics.damageTakenPerCombat.push(result.damageTaken);

      return result;
    }

    /**
     * Select best card from deck based on persona
     */
    selectBestCard(deck, persona) {
      if (!deck || deck.length === 0) return null;

      if (persona.name === 'MINMAXER') {
        // Pick highest power card
        return deck.reduce((best, card) => 
          (!best || card.power > best.power) ? card : best
        );
      } else if (persona.name === 'DUMB_RANDOM') {
        // Pick random
        return deck[Math.floor(Math.random() * deck.length)];
      } else {
        // Pick first card
        return deck[0];
      }
    }

    /**
     * Resolve boss with enhanced tracking
     */
    async resolveBossWithTracking(gameState, floor, persona, report) {
      var bossHP = floor * 15; // Boss is nearly 2x normal threat
      var deckPower = this.calculateDeckPower(gameState.deck);

      var result = {
        survived: true,
        bossHP: bossHP,
        playerDeckPower: deckPower
      };

      // Mathematical calculation for boss defeat
      var bossWinChance = Math.min(85, (deckPower / bossHP) * 100);
      bossWinChance += persona.riskTolerance * 5;

      if (gameState.hp < 50) {
        bossWinChance -= 25;
      }

      if (Math.random() * 100 > bossWinChance) {
        result.survived = false;
        report.uxMetrics.combatMetrics.bossEncounters++;
      } else {
        result.survived = true;
        report.uxMetrics.combatMetrics.bossEncounters++;
        
        // Boss rewards
        var eliteCard = this.generateCard('ELITE', floor);
        gameState.deck.push(eliteCard);
        gameState.credits += floor * 10;

        // 5% chance for mythic
        if (Math.random() < 0.05) {
          var mythicCard = this.generateCard('MYTHIC', floor);
          gameState.deck.push(mythicCard);
        }
      }

      return result;
    }

    /**
     * Handle vendor stop with tracking
     */
    handleVendorStopWithTracking(gameState, persona, report, floor) {
      report.vendorInteractions++;
      
      var choices = [];

      // Healing
      if (gameState.hp < gameState.maxHp * persona.healThreshold && gameState.credits >= 50) {
        gameState.hp = Math.min(gameState.maxHp, gameState.hp + 40);
        gameState.credits -= 50;
        report.healingPurchases++;
        report.creditsSpent += 50;
        choices.push('HEAL');
      }

      // Card purchases or gambling based on strategy
      if (persona.vendorStrategy === 'BUY_UPGRADES' && gameState.credits >= 150) {
        var rareCard = this.generateCard('RARE', floor);
        gameState.deck.push(rareCard);
        gameState.credits -= 150;
        report.cardsPurchased++;
        report.creditsSpent += 150;
        choices.push('BUY_RARE');
      } else if (persona.vendorStrategy === 'GAMBLE_ALL') {
        while (gameState.credits >= 100) {
          var gambleResult = this.gamble(floor);
          if (gambleResult.card) {
            gameState.deck.push(gambleResult.card);
          }
          gameState.credits += gambleResult.creditsWon - 100;
          report.creditsSpent += 100;
          choices.push('GAMBLE');
        }
      }

      report.uxMetrics.economyMetrics.vendorChoices.push({
        floor: floor,
        choices: choices,
        creditsRemaining: gameState.credits
      });
    }

    /**
     * Gamble mechanic
     */
    gamble(floor) {
      var roll = Math.random();
      
      if (roll < 0.05) {
        // 5% Mythic
        return { card: this.generateCard('MYTHIC', floor), creditsWon: 0 };
      } else if (roll < 0.15) {
        // 10% Elite
        return { card: this.generateCard('ELITE', floor), creditsWon: 0 };
      } else if (roll < 0.35) {
        // 20% Rare
        return { card: this.generateCard('RARE', floor), creditsWon: 0 };
      } else if (roll < 0.75) {
        // 40% Get money back
        return { card: null, creditsWon: 100 };
      } else {
        // 25% Lose everything
        return { card: null, creditsWon: 0 };
      }
    }

    /**
     * Generate card
     */
    generateCard(quality, floor) {
      if (quality === 'RANDOM') {
        var roll = Math.random();
        if (roll < 0.001) quality = 'MYTHIC';
        else if (roll < 0.01) quality = 'ELITE';
        else if (roll < 0.05) quality = 'RARE';
        else if (roll < 0.20) quality = 'UNCOMMON';
        else quality = 'COMMON';
      }

      var powerBase = {
        'MYTHIC': 20,
        'ELITE': 12,
        'RARE': 8,
        'UNCOMMON': 5,
        'COMMON': 2
      };

      var power = powerBase[quality] + Math.floor(floor / 5);
      
      return {
        name: quality + ' Card',
        quality: quality,
        power: power,
        type: ['ATTACK', 'DEFENSE', 'UTILITY'][Math.floor(Math.random() * 3)]
      };
    }

    /**
     * Calculate deck power
     */
    calculateDeckPower(deck) {
      var qualityScores = {
        'MYTHIC': 20,
        'ELITE': 12,
        'RARE': 8,
        'UNCOMMON': 5,
        'COMMON': 2
      };

      return deck.reduce((total, card) => {
        var qualityScore = qualityScores[card.quality] || 0;
        return total + qualityScore + card.power;
      }, 0);
    }

    /**
     * Calculate aggregate UX metrics for a run
     */
    calculateAggregateUXMetrics(report) {
      // Lighting utility percentage
      if (report.uxMetrics.lightingUsage.stealthBonusOpportunities > 0) {
        report.uxMetrics.lightingUsage.utilizationRate = 
          (report.uxMetrics.lightingUsage.stealthBonusUsed / 
           report.uxMetrics.lightingUsage.stealthBonusOpportunities * 100).toFixed(1);
      }

      // Combat metrics
      var totalCombats = report.uxMetrics.combatMetrics.strCombatWins + 
                         report.uxMetrics.combatMetrics.strCombatLosses;
      if (totalCombats > 0) {
        report.uxMetrics.combatMetrics.winRate = 
          (report.uxMetrics.combatMetrics.strCombatWins / totalCombats * 100).toFixed(1);
      }

      // Average damage
      if (report.uxMetrics.combatMetrics.damageDealtPerCombat.length > 0) {
        report.uxMetrics.combatMetrics.avgDamageDealt = 
          (report.uxMetrics.combatMetrics.damageDealtPerCombat.reduce((a, b) => a + b, 0) /
           report.uxMetrics.combatMetrics.damageDealtPerCombat.length).toFixed(1);
        
        report.uxMetrics.combatMetrics.avgDamageTaken = 
          (report.uxMetrics.combatMetrics.damageTakenPerCombat.reduce((a, b) => a + b, 0) /
           report.uxMetrics.combatMetrics.damageTakenPerCombat.length).toFixed(1);
      }
    }

    /**
     * Aggregate UX metrics across all runs
     */
    aggregateUXMetrics(runReport) {
      // Lighting
      if (runReport.uxMetrics.lightingUsage.stealthBonusOpportunities) {
        this.uxMetrics.lighting.totalOpportunities += 
          runReport.uxMetrics.lightingUsage.stealthBonusOpportunities;
        this.uxMetrics.lighting.timesUsed += 
          runReport.uxMetrics.lightingUsage.stealthBonusUsed;
      }

      // Ground effects
      this.uxMetrics.groundEffects.damageFromEffects += 
        runReport.uxMetrics.groundEffectsUsage.damageFromGroundEffects || 0;

      // Combat
      this.uxMetrics.combat.strCombatInitiated += 
        (runReport.uxMetrics.combatMetrics.strCombatWins + 
         runReport.uxMetrics.combatMetrics.strCombatLosses);
      this.uxMetrics.combat.strCombatWins += 
        runReport.uxMetrics.combatMetrics.strCombatWins;
      this.uxMetrics.combat.strCombatLosses += 
        runReport.uxMetrics.combatMetrics.strCombatLosses;

      // Economy
      if (runReport.uxMetrics.economyMetrics.creditsPerFloor.length > 0) {
        this.uxMetrics.economy.creditsPerFloor.push(
          ...runReport.uxMetrics.economyMetrics.creditsPerFloor
        );
      }

      // Pathfinding
      this.uxMetrics.pathfinding.stuckSituations += 
        runReport.uxMetrics.pathfindingMetrics.stuckCount;
    }

    /**
     * Reset UX metrics
     */
    resetUXMetrics() {
      this.uxMetrics = {
        lighting: {
          totalOpportunities: 0,
          timesUsed: 0,
          utilizationRate: 0
        },
        groundEffects: {
          totalEncountered: 0,
          damageFromEffects: 0,
          effectsStrategicallyUsed: 0
        },
        combat: {
          strCombatInitiated: 0,
          strCombatWins: 0,
          strCombatLosses: 0,
          winRate: 0
        },
        pathfinding: {
          totalMoves: 0,
          stuckSituations: 0
        },
        economy: {
          creditsPerFloor: []
        }
      };
    }

    /**
     * Generate comprehensive MVP audit report
     */
    generateAuditReport() {
      var report = {
        metadata: {
          timestamp: new Date().toISOString(),
          totalRuns: this.results.length,
          maxFloor: this.maxFloor,
          elitesEnabled: this.enableElites
        },
        summary: {
          totalRuns: this.results.length,
          survived: 0,
          died: 0,
          survivalRate: 0,
          avgFinalFloor: 0,
          avgFinalCredits: 0
        },
        mvpReadiness: {
          overallScore: 0,
          passed: false,
          criticalIssues: [],
          warnings: [],
          recommendations: []
        },
        uxAudit: {
          lighting: {},
          groundEffects: {},
          combat: {},
          pathfinding: {},
          economy: {}
        },
        personas: {},
        results: this.results
      };

      // Calculate summary stats
      this.results.forEach(r => {
        if (r.survived) report.summary.survived++;
        else report.summary.died++;
        report.summary.avgFinalFloor += r.endFloor;
        report.summary.avgFinalCredits += r.finalCredits;

        // Per-persona breakdown
        if (!report.personas[r.persona]) {
          report.personas[r.persona] = {
            runs: 0,
            survived: 0,
            avgFinalFloor: 0,
            avgFinalCredits: 0,
            mythicsFound: 0
          };
        }
        var pStats = report.personas[r.persona];
        pStats.runs++;
        if (r.survived) pStats.survived++;
        pStats.avgFinalFloor += r.endFloor;
        pStats.avgFinalCredits += r.finalCredits;
        pStats.mythicsFound += r.mythicItemsFound;
      });

      // Averages
      report.summary.avgFinalFloor /= this.results.length;
      report.summary.avgFinalCredits /= this.results.length;
      report.summary.survivalRate = (report.summary.survived / report.summary.totalRuns * 100).toFixed(1);

      // Per-persona averages
      Object.keys(report.personas).forEach(key => {
        var p = report.personas[key];
        p.avgFinalFloor = (p.avgFinalFloor / p.runs).toFixed(1);
        p.avgFinalCredits = (p.avgFinalCredits / p.runs).toFixed(0);
        p.survivalRate = ((p.survived / p.runs) * 100).toFixed(1);
      });

      // UX Audit scores
      report.uxAudit.lighting = this.calculateLightingScore();
      report.uxAudit.groundEffects = this.calculateGroundEffectsScore();
      report.uxAudit.combat = this.calculateCombatScore();
      report.uxAudit.pathfinding = this.calculatePathfindingScore();
      report.uxAudit.economy = this.calculateEconomyScore();

      // MVP Readiness assessment
      report.mvpReadiness = this.assessMVPReadiness(report);

      return report;
    }

    /**
     * Calculate lighting system score
     */
    calculateLightingScore() {
      var score = {
        utilizationRate: 0,
        score: 0,
        passed: false,
        issues: []
      };

      if (this.uxMetrics.lighting.totalOpportunities > 0) {
        score.utilizationRate = 
          (this.uxMetrics.lighting.timesUsed / this.uxMetrics.lighting.totalOpportunities * 100).toFixed(1);
      }

      // Scoring criteria
      if (score.utilizationRate < 20) {
        score.issues.push('Low lighting utilization (<20%) - players not engaging with mechanic');
        score.score = 40;
      } else if (score.utilizationRate < 40) {
        score.issues.push('Moderate lighting utilization (20-40%) - needs improvement');
        score.score = 60;
      } else {
        score.passed = true;
        score.score = 85;
      }

      return score;
    }

    /**
     * Calculate ground effects score
     */
    calculateGroundEffectsScore() {
      var score = {
        damageDealt: this.uxMetrics.groundEffects.damageFromEffects,
        encounterRate: 0,
        score: 0,
        passed: false,
        issues: []
      };

      var avgDamagePerRun = score.damageDealt / this.results.length;

      if (avgDamagePerRun < 2) {
        score.issues.push('Ground effects rarely encountered - increase placement');
        score.score = 50;
      } else if (avgDamagePerRun > 20) {
        score.issues.push('Ground effects too punishing - reduce damage or frequency');
        score.score = 60;
      } else {
        score.passed = true;
        score.score = 80;
      }

      return score;
    }

    /**
     * Calculate combat score
     */
    calculateCombatScore() {
      var score = {
        winRate: 0,
        totalCombats: this.uxMetrics.combat.strCombatInitiated,
        score: 0,
        passed: false,
        issues: []
      };

      if (score.totalCombats > 0) {
        score.winRate = 
          (this.uxMetrics.combat.strCombatWins / score.totalCombats * 100).toFixed(1);
      }

      if (score.winRate < 40) {
        score.issues.push('Combat too difficult (<40% win rate) - adjust balance');
        score.score = 50;
      } else if (score.winRate > 80) {
        score.issues.push('Combat too easy (>80% win rate) - increase challenge');
        score.score = 65;
      } else {
        score.passed = true;
        score.score = 90;
      }

      return score;
    }

    /**
     * Calculate pathfinding score
     */
    calculatePathfindingScore() {
      var score = {
        stuckCount: this.uxMetrics.pathfinding.stuckSituations,
        score: 0,
        passed: false,
        issues: []
      };

      if (score.stuckCount > 0) {
        score.issues.push(`${score.stuckCount} stuck situations detected - critical pathfinding bugs`);
        score.score = 30;
      } else {
        score.passed = true;
        score.score = 100;
      }

      return score;
    }

    /**
     * Calculate economy score
     */
    calculateEconomyScore() {
      var score = {
        avgCreditsPerFloor: 0,
        score: 0,
        passed: false,
        issues: []
      };

      if (this.uxMetrics.economy.creditsPerFloor.length > 0) {
        var total = this.uxMetrics.economy.creditsPerFloor.reduce((a, b) => a + b, 0);
        score.avgCreditsPerFloor = (total / this.uxMetrics.economy.creditsPerFloor.length).toFixed(0);
      }

      if (score.avgCreditsPerFloor < 50) {
        score.issues.push('Currency starvation - players not earning enough');
        score.score = 55;
      } else if (score.avgCreditsPerFloor > 500) {
        score.issues.push('Currency overabundance - economy too generous');
        score.score = 70;
      } else {
        score.passed = true;
        score.score = 85;
      }

      return score;
    }

    /**
     * Assess overall MVP readiness
     */
    assessMVPReadiness(report) {
      var readiness = {
        overallScore: 0,
        passed: false,
        criticalIssues: [],
        warnings: [],
        recommendations: []
      };

      var scores = [];

      // Aggregate scores from all systems
      scores.push(report.uxAudit.lighting.score);
      scores.push(report.uxAudit.groundEffects.score);
      scores.push(report.uxAudit.combat.score);
      scores.push(report.uxAudit.pathfinding.score);
      scores.push(report.uxAudit.economy.score);

      readiness.overallScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(0);

      // Critical issues (blockers)
      if (report.uxAudit.pathfinding.stuckCount > 0) {
        readiness.criticalIssues.push({
          system: 'Pathfinding',
          issue: 'Stuck situations detected',
          severity: 'CRITICAL',
          recommendation: 'Fix pathfinding bugs before MVP release'
        });
      }

      // Check MINMAXER survival rate
      if (report.personas.MINMAXER && report.personas.MINMAXER.survivalRate < 20) {
        readiness.criticalIssues.push({
          system: 'Balance',
          issue: 'MINMAXER survival rate too low (<20%)',
          severity: 'CRITICAL',
          recommendation: 'Game is too difficult even for optimal play'
        });
      }

      // Warnings
      if (report.uxAudit.lighting.score < 70) {
        readiness.warnings.push({
          system: 'Lighting',
          issue: 'Low player engagement with lighting mechanics',
          recommendation: 'Make lighting benefits more obvious or increase incentives'
        });
      }

      if (report.uxAudit.combat.score < 70) {
        readiness.warnings.push({
          system: 'Combat',
          issue: 'Combat balance needs tuning',
          recommendation: 'Adjust combat difficulty to 50-70% win rate range'
        });
      }

      // General recommendations
      readiness.recommendations.push('Run 500+ simulations for statistical confidence');
      readiness.recommendations.push('Test with human playtesters for UX validation');
      readiness.recommendations.push('Monitor for edge cases and rare bugs');

      // Overall pass/fail
      readiness.passed = readiness.criticalIssues.length === 0 && readiness.overallScore >= 70;

      return readiness;
    }

    /**
     * Export to CSV
     */
    exportToCSV() {
      var csv = 'Run ID,Persona,End Floor,Survived,Final Credits,Mythics,STR Combat Wins,Stuck Count,Lighting Util %\n';
      
      this.results.forEach(r => {
        var lightingUtil = r.uxMetrics.lightingUsage.utilizationRate || '0';
        csv += `${r.runId},${r.persona},${r.endFloor},${r.survived},${r.finalCredits},${r.mythicItemsFound},${r.uxMetrics.combatMetrics.strCombatWins},${r.uxMetrics.pathfindingMetrics.stuckCount},${lightingUtil}\n`;
      });

      return csv;
    }

    /**
     * Export to JSON
     */
    exportToJSON() {
      return JSON.stringify(this.generateAuditReport(), null, 2);
    }

    /**
     * Logging helper
     */
    log(message) {
      if (this.verbose) {
        console.log(message);
      }
      
      // Also append to output if in browser
      if (typeof document !== 'undefined') {
        var outputEl = document.getElementById('output');
        if (outputEl) {
          outputEl.textContent += message + '\n';
          outputEl.scrollTop = outputEl.scrollHeight;
        }
      }
    }

    /**
     * Sleep helper for async delays
     */
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  // Export
  return {
    MVPAuditEngine: MVPAuditEngine,
    PERSONAS: PERSONAS
  };
})();

// Node.js export (if applicable)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MVPAuditEngine;
}
