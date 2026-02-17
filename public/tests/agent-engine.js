/* ============================================================
   EYES ONLY - Agent Testing Engine
   Headless simulation for economy tuning and balance testing
   ============================================================ */

const AgentEngine = (function() {
  'use strict';

  // Personas define different playstyles
  var PERSONAS = {
    GREEDY_LOOTER: {
      name: 'GREEDY_LOOTER',
      description: 'Opens every chest, fights every enemy, explores everything',
      vendorStrategy: 'BUY_UPGRADES', // Buys upgrades when available
      combatStrategy: 'THOROUGH',     // Fights all enemies
      riskTolerance: 0.3,              // 30% risk tolerance
      healThreshold: 0.6,              // Heals below 60% HP
      spendingRate: 0.5                // Spends 50% of currency at vendors
    },
    SPEEDRUNNER: {
      name: 'SPEEDRUNNER',
      description: 'Ignores loot, heads for exit immediately, avoids combat',
      vendorStrategy: 'SKIP',
      combatStrategy: 'AVOIDANCE',
      riskTolerance: 0.7,              // 70% risk tolerance (takes shortcuts)
      healThreshold: 0.4,              // Only heals below 40% HP
      spendingRate: 0.1                // Minimal spending
    },
    RISKY_GAMBLER: {
      name: 'RISKY_GAMBLER',
      description: 'Burns all currency at vendors for mythic chance',
      vendorStrategy: 'GAMBLE_ALL',
      combatStrategy: 'SELECTIVE',
      riskTolerance: 0.5,
      healThreshold: 0.7,              // Heals frequently to stay alive for gambling
      spendingRate: 0.95               // Spends 95% of currency gambling
    },
    SAVER_HOARDER: {
      name: 'SAVER_HOARDER',
      description: 'Never spends, tries to brute force with starter deck',
      vendorStrategy: 'NEVER',
      combatStrategy: 'CONSERVATIVE',
      riskTolerance: 0.2,              // Very risk-averse
      healThreshold: 0.5,              // Won't heal to save money
      spendingRate: 0.0                // Never spends
    },
    MINMAXER: {
      name: 'MINMAXER',
      description: 'Always chooses highest quality options, optimal play',
      vendorStrategy: 'OPTIMAL',
      combatStrategy: 'CALCULATED',
      riskTolerance: 0.4,
      healThreshold: 0.65,
      spendingRate: 0.6                // Spends on best value items only
    },
    DUMB_RANDOM: {
      name: 'DUMB_RANDOM',
      description: 'Totally random decisions (baseline chaos)',
      vendorStrategy: 'RANDOM',
      combatStrategy: 'RANDOM',
      riskTolerance: 0.5,
      healThreshold: 0.5,
      spendingRate: 0.5
    }
  };

  /**
   * Main Agent Engine Class
   */
  class AgentEngine {
    constructor(options = {}) {
      this.results = [];
      this.verbose = options.verbose !== undefined ? options.verbose : false;
      this.maxFloor = options.maxFloor || 30;
      this.enableElites = options.enableElites !== undefined ? options.enableElites : true;
    }

    /**
     * Run multiple simulations
     */
    async runSimulations(numberOfRuns, personaFilter = null) {
      this.results = [];
      var startTime = Date.now();

      this.log(`\n${'='.repeat(60)}`);
      this.log(`AGENT ENGINE: Starting ${numberOfRuns} simulations`);
      this.log(`${'='.repeat(60)}\n`);

      var personas = personaFilter ? [personaFilter] : Object.keys(PERSONAS);

      for (var i = 0; i < numberOfRuns; i++) {
        // Pick persona (round-robin or random)
        var personaKey = personas[i % personas.length];
        var persona = PERSONAS[personaKey];

        this.log(`[Run ${i + 1}/${numberOfRuns}] Starting ${persona.name} simulation...`);

        var runReport = await this.executeSingleRun(persona, i + 1);
        this.results.push(runReport);

        // Progress indicator
        if ((i + 1) % 10 === 0) {
          var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          this.log(`  Progress: ${i + 1}/${numberOfRuns} runs complete (${elapsed}s)`);
        }
      }

      var totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      this.log(`\n✓ Completed ${numberOfRuns} runs in ${totalTime}s`);
      this.log(`  Average: ${(totalTime / numberOfRuns * 1000).toFixed(0)}ms per run\n`);

      return this.generateReport();
    }

    /**
     * Execute a single simulation run
     */
    async executeSingleRun(persona, runId) {
      var report = {
        runId: runId,
        persona: persona.name,
        startTime: Date.now(),
        endFloor: 0,
        deathCause: null,
        survived: false,
        finalCredits: 0,
        startingDeckSize: 5,
        finalDeckSize: 0,
        mythicItemsFound: 0,
        eliteItemsFound: 0,
        rareItemsFound: 0,
        vendorInteractions: 0,
        cardsPurchased: 0,
        cardsBurned: 0,
        healingPurchases: 0,
        creditsSpent: 0,
        creditsEarned: 0,
        floorsCleared: 0,
        enemiesKilled: 0,
        elitesKilled: 0,
        bossesKilled: 0,
        combatEntries: 0,
        timesStuck: 0,
        economyLog: [],
        deathLog: [],
        criticalEvents: []
      };

      // Initialize game state
      var gameState = this.initializeGameState();
      report.startingDeckSize = gameState.deck.length;

      // Main game loop
      var currentFloor = 1;
      var consecutiveStuckFloors = 0;

      while (gameState.isAlive && currentFloor <= this.maxFloor) {
        // Simulate floor
        var floorOutcome = this.resolveFloor(gameState, currentFloor, persona, report);

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

        // Check if stuck (no progress indicators)
        if (floorOutcome.stuck) {
          consecutiveStuckFloors++;
          report.timesStuck++;

          if (consecutiveStuckFloors >= 3) {
            report.deathCause = `Floor ${currentFloor}: Stuck for 3+ floors (game-breaking bug)`;
            report.criticalEvents.push({
              type: 'STUCK',
              floor: currentFloor,
              reason: 'No valid actions for 3 consecutive floors'
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
          else if (card.quality === 'RARE') report.rareItemsFound++;
        });

        // Update stats
        report.enemiesKilled += floorOutcome.enemiesKilled;
        report.elitesKilled += floorOutcome.elitesKilled;
        report.combatEntries += floorOutcome.combatEntries;

        // Bonfire/Vendor logic (Floors 10, 16, 22)
        if (currentFloor === 10 || currentFloor === 16 || currentFloor === 22) {
          this.handleVendorStop(gameState, persona, report, currentFloor);
        }

        // Boss floors
        if (currentFloor === 10 || currentFloor === 16 || currentFloor === 22 || currentFloor === 30) {
          var bossOutcome = this.resolveBoss(gameState, currentFloor, persona, report);
          if (!bossOutcome.survived) {
            report.deathCause = `Floor ${currentFloor}: Boss Defeated Player (${bossOutcome.reason})`;
            break;
          }
          report.bossesKilled++;
        }

        // Log economy state
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

      return report;
    }

    /**
     * Initialize fresh game state
     */
    initializeGameState() {
      return {
        isAlive: true,
        hp: 100,
        maxHp: 100,
        credits: 0,
        deck: this.generateStarterDeck(),
        activeCard: null
      };
    }

    /**
     * Generate starter deck (5 basic cards)
     */
    generateStarterDeck() {
      return [
        { name: 'SINGLE_SHOT', quality: 'COMMON', power: 2, type: 'ATTACK' },
        { name: 'PRONE', quality: 'COMMON', power: 1, type: 'STANCE' },
        { name: 'KATCHUP', quality: 'COMMON', power: 1, type: 'HEAL' },
        { name: 'DODGE', quality: 'COMMON', power: 1, type: 'DEFENSE' },
        { name: 'BURST_SHOT', quality: 'COMMON', power: 3, type: 'ATTACK' }
      ];
    }

    /**
     * Resolve a floor (combat + exploration)
     */
    resolveFloor(gameState, floorNum, persona, report) {
      // Calculate deck power
      var deckPower = this.calculateDeckPower(gameState.deck);

      // Calculate floor threat (scales with depth)
      var baseThreat = floorNum * 8;
      var threatLevel = baseThreat;

      // Persona modifiers
      if (persona.name === 'SPEEDRUNNER') {
        threatLevel += 20; // Penalty for rushing past enemies
      } else if (persona.name === 'GREEDY_LOOTER') {
        threatLevel -= 10; // Bonus from thorough exploration
      }

      // Elite enemy threat (10% chance)
      var hasElite = this.enableElites && Math.random() < 0.1 && floorNum >= 3;
      if (hasElite) {
        threatLevel += 15;
      }

      // Survival calculation
      var survivalChance = Math.min(95, (deckPower / threatLevel) * 100);
      survivalChance += persona.riskTolerance * 10; // Risk tolerance bonus

      // HP penalty if low
      if (gameState.hp < 30) {
        survivalChance -= 20;
      }

      // The "break" check - can the agent survive?
      var roll = Math.random() * 100;
      if (roll > survivalChance && floorNum > 2) {
        return {
          survived: false,
          reason: `Low Survival Chance (${survivalChance.toFixed(1)}% vs roll ${roll.toFixed(1)})`,
          deckPower: deckPower,
          threatLevel: threatLevel
        };
      }

      // Check if stuck (no valid cards for current threat)
      var stuck = false;
      if (deckPower < threatLevel * 0.3 && floorNum > 5) {
        stuck = true;
      }

      // Calculate loot
      var creditsLooted = Math.floor(Math.random() * floorNum * 15) + floorNum * 5;
      var cardsLooted = [];

      // Loot drops (based on persona exploration style)
      var lootRolls = persona.name === 'GREEDY_LOOTER' ? 3 : persona.name === 'SPEEDRUNNER' ? 1 : 2;

      for (var i = 0; i < lootRolls; i++) {
        var lootRoll = Math.random();
        if (lootRoll < 0.001) {
          // Mythic (0.1%)
          cardsLooted.push(this.generateCard('MYTHIC', floorNum));
        } else if (lootRoll < 0.01) {
          // Elite (1%)
          cardsLooted.push(this.generateCard('ELITE', floorNum));
        } else if (lootRoll < 0.05) {
          // Rare (5%)
          cardsLooted.push(this.generateCard('RARE', floorNum));
        } else if (lootRoll < 0.20) {
          // Uncommon (20%)
          cardsLooted.push(this.generateCard('UNCOMMON', floorNum));
        }
      }

      // HP loss from combat
      var hpLoss = Math.floor(Math.random() * (threatLevel / 10)) + 5;
      gameState.hp = Math.max(1, gameState.hp - hpLoss);

      // Enemy counts
      var enemiesKilled = persona.name === 'SPEEDRUNNER' ? 1 : Math.floor(Math.random() * 3) + 2;
      var elitesKilled = hasElite ? 1 : 0;

      return {
        survived: true,
        stuck: stuck,
        creditsLooted: creditsLooted,
        cardsLooted: cardsLooted,
        enemiesKilled: enemiesKilled,
        elitesKilled: elitesKilled,
        combatEntries: enemiesKilled,
        deckPower: deckPower,
        threatLevel: threatLevel
      };
    }

    /**
     * Resolve boss encounter
     */
    resolveBoss(gameState, floorNum, persona, report) {
      var deckPower = this.calculateDeckPower(gameState.deck);
      var bossThreat = floorNum * 15; // Bosses are significantly harder

      // Boss survival calculation
      var survivalChance = (deckPower / bossThreat) * 100;

      // Persona-specific boss strategies
      if (persona.name === 'MINMAXER') {
        survivalChance += 15; // Optimal play bonus
      } else if (persona.name === 'DUMB_RANDOM') {
        survivalChance -= 15; // Random play penalty
      }

      var roll = Math.random() * 100;
      if (roll > survivalChance) {
        return {
          survived: false,
          reason: `Boss Too Strong (${survivalChance.toFixed(1)}% vs roll ${roll.toFixed(1)})`,
          mathematicallyImpossible: survivalChance < 10
        };
      }

      // Boss defeated - big rewards
      gameState.credits += floorNum * 100;
      report.creditsEarned += floorNum * 100;

      // Guaranteed elite drop
      var bossCard = this.generateCard('ELITE', floorNum);
      gameState.deck.push(bossCard);
      report.eliteItemsFound++;

      // Mythic chance (5% with correct conditions)
      if (Math.random() < 0.05) {
        var mythicCard = this.generateCard('MYTHIC', floorNum);
        gameState.deck.push(mythicCard);
        report.mythicItemsFound++;
        report.criticalEvents.push({
          type: 'MYTHIC_DROP',
          floor: floorNum,
          source: 'BOSS'
        });
      }

      return { survived: true };
    }

    /**
     * Handle vendor stop (bonfire floors)
     */
    handleVendorStop(gameState, persona, report, floorNum) {
      report.vendorInteractions++;

      // Healing logic
      var healCost = 50;
      var healAmount = 40;
      var hpPercent = gameState.hp / gameState.maxHp;

      if (hpPercent < persona.healThreshold && gameState.credits >= healCost) {
        if (persona.name !== 'SAVER_HOARDER') {
          gameState.credits -= healCost;
          gameState.hp = Math.min(gameState.maxHp, gameState.hp + healAmount);
          report.healingPurchases++;
          report.creditsSpent += healCost;
        }
      }

      // Vendor strategy
      var availableCredits = Math.floor(gameState.credits * persona.spendingRate);

      switch (persona.vendorStrategy) {
        case 'GAMBLE_ALL':
          this.handleGambling(gameState, availableCredits, report, floorNum);
          break;

        case 'BUY_UPGRADES':
          this.handleUpgradePurchases(gameState, availableCredits, report, floorNum);
          break;

        case 'OPTIMAL':
          this.handleOptimalPurchases(gameState, availableCredits, report, floorNum);
          break;

        case 'RANDOM':
          if (Math.random() < 0.5) {
            this.handleGambling(gameState, availableCredits * 0.5, report, floorNum);
          } else {
            this.handleUpgradePurchases(gameState, availableCredits * 0.5, report, floorNum);
          }
          break;

        case 'SKIP':
        case 'NEVER':
          // Do nothing
          break;
      }
    }

    /**
     * Handle gambling at vendor
     */
    handleGambling(gameState, availableCredits, report, floorNum) {
      var gambleCost = 100;
      var gamblesPerformed = 0;

      while (gameState.credits >= gambleCost && availableCredits > 0 && gamblesPerformed < 10) {
        gameState.credits -= gambleCost;
        availableCredits -= gambleCost;
        report.creditsSpent += gambleCost;
        gamblesPerformed++;

        var roll = Math.random();
        if (roll < 0.002) {
          // Perfect roll (0.2%)
          var perfectCard = this.generateCard('MYTHIC', floorNum);
          gameState.deck.push(perfectCard);
          report.mythicItemsFound++;
          report.cardsPurchased++;
          report.criticalEvents.push({
            type: 'MYTHIC_GAMBLE',
            floor: floorNum,
            cost: gambleCost * gamblesPerformed
          });
          break; // Stop gambling after jackpot
        } else if (roll < 0.05) {
          // Elite (5%)
          var eliteCard = this.generateCard('ELITE', floorNum);
          gameState.deck.push(eliteCard);
          report.eliteItemsFound++;
          report.cardsPurchased++;
        } else if (roll < 0.20) {
          // Usable (20%)
          var usableCard = this.generateCard('RARE', floorNum);
          gameState.deck.push(usableCard);
          report.rareItemsFound++;
          report.cardsPurchased++;
        } else {
          // Junk - burn it
          report.cardsBurned++;
        }
      }
    }

    /**
     * Handle upgrade purchases at vendor
     */
    handleUpgradePurchases(gameState, availableCredits, report, floorNum) {
      var cardCost = 75 + floorNum * 5;
      var purchasesMade = 0;

      while (gameState.credits >= cardCost && availableCredits > 0 && purchasesMade < 3) {
        gameState.credits -= cardCost;
        availableCredits -= cardCost;
        report.creditsSpent += cardCost;

        // Always get decent card when buying (not gambling)
        var quality = Math.random() < 0.15 ? 'ELITE' : 'RARE';
        var card = this.generateCard(quality, floorNum);
        gameState.deck.push(card);
        report.cardsPurchased++;

        if (quality === 'ELITE') report.eliteItemsFound++;
        else report.rareItemsFound++;

        purchasesMade++;
      }
    }

    /**
     * Handle optimal purchases (best value)
     */
    handleOptimalPurchases(gameState, availableCredits, report, floorNum) {
      // Min-maxer: Calculate best value - upgrade if deck is weak, gamble if strong
      var deckPower = this.calculateDeckPower(gameState.deck);
      var expectedThreat = floorNum * 8;

      if (deckPower < expectedThreat * 1.2) {
        // Deck is weak, buy upgrades for guaranteed power
        this.handleUpgradePurchases(gameState, availableCredits, report, floorNum);
      } else {
        // Deck is strong, gamble for mythics
        this.handleGambling(gameState, availableCredits * 0.5, report, floorNum);
      }
    }

    /**
     * Calculate deck power score
     */
    calculateDeckPower(deck) {
      var qualityValues = {
        'MYTHIC': 20,
        'ELITE': 12,
        'RARE': 8,
        'UNCOMMON': 5,
        'COMMON': 2
      };

      var power = 0;
      deck.forEach(card => {
        var baseValue = qualityValues[card.quality] || 2;
        power += baseValue + (card.power || 0);
      });

      return power;
    }

    /**
     * Generate a card of specific quality
     */
    generateCard(quality, floorNum) {
      var powerScale = Math.floor(floorNum / 5) + 1;

      return {
        name: `${quality}_CARD_${Math.floor(Math.random() * 100)}`,
        quality: quality,
        power: (quality === 'MYTHIC' ? 10 : quality === 'ELITE' ? 6 : quality === 'RARE' ? 4 : 2) * powerScale,
        type: ['ATTACK', 'DEFENSE', 'UTILITY'][Math.floor(Math.random() * 3)]
      };
    }

    /**
     * Generate comprehensive report
     */
    generateReport() {
      this.log(`\n${'='.repeat(60)}`);
      this.log(`AGENT ENGINE REPORT`);
      this.log(`${'='.repeat(60)}\n`);

      // Summary statistics
      var totalRuns = this.results.length;
      var survived = this.results.filter(r => r.survived).length;
      var died = totalRuns - survived;

      this.log(`Total Runs: ${totalRuns}`);
      this.log(`Survived: ${survived} (${(survived / totalRuns * 100).toFixed(1)}%)`);
      this.log(`Died: ${died} (${(died / totalRuns * 100).toFixed(1)}%)\n`);

      // Per-persona breakdown
      this.log(`PER-PERSONA RESULTS:`);
      this.log(`${'='.repeat(60)}`);

      var personas = {};
      this.results.forEach(r => {
        if (!personas[r.persona]) {
          personas[r.persona] = {
            runs: 0,
            survived: 0,
            avgFloor: 0,
            avgCredits: 0,
            avgDeckSize: 0,
            mythicsFound: 0,
            elitesFound: 0,
            creditsSpent: 0,
            creditsEarned: 0,
            stuck: 0
          };
        }

        var p = personas[r.persona];
        p.runs++;
        if (r.survived) p.survived++;
        p.avgFloor += r.endFloor;
        p.avgCredits += r.finalCredits;
        p.avgDeckSize += r.finalDeckSize;
        p.mythicsFound += r.mythicItemsFound;
        p.elitesFound += r.eliteItemsFound;
        p.creditsSpent += r.creditsSpent;
        p.creditsEarned += r.creditsEarned;
        p.stuck += r.timesStuck;
      });

      Object.keys(personas).forEach(name => {
        var p = personas[name];
        this.log(`\n${name}:`);
        this.log(`  Runs: ${p.runs}`);
        this.log(`  Survival Rate: ${(p.survived / p.runs * 100).toFixed(1)}%`);
        this.log(`  Avg Final Floor: ${(p.avgFloor / p.runs).toFixed(1)}`);
        this.log(`  Avg Final Credits: ${Math.floor(p.avgCredits / p.runs)}`);
        this.log(`  Avg Final Deck Size: ${(p.avgDeckSize / p.runs).toFixed(1)}`);
        this.log(`  Total Mythics Found: ${p.mythicsFound}`);
        this.log(`  Total Elites Found: ${p.elitesFound}`);
        this.log(`  Avg Credits Earned: ${Math.floor(p.creditsEarned / p.runs)}`);
        this.log(`  Avg Credits Spent: ${Math.floor(p.creditsSpent / p.runs)}`);
        this.log(`  Times Stuck: ${p.stuck}`);
      });

      // Critical events
      this.log(`\n${'='.repeat(60)}`);
      this.log(`CRITICAL EVENTS:`);
      this.log(`${'='.repeat(60)}`);

      var stuckEvents = this.results.filter(r => r.timesStuck > 0);
      if (stuckEvents.length > 0) {
        this.log(`\n⚠ STUCK AGENTS: ${stuckEvents.length} runs`);
        stuckEvents.slice(0, 5).forEach(r => {
          this.log(`  Run ${r.runId}: ${r.persona} stuck ${r.timesStuck} times (died floor ${r.endFloor})`);
        });
      }

      var mythicGambles = this.results.filter(r =>
        r.criticalEvents.some(e => e.type === 'MYTHIC_GAMBLE')
      );
      if (mythicGambles.length > 0) {
        this.log(`\n✨ MYTHIC GAMBLES: ${mythicGambles.length} successful`);
      }

      var impossibleBosses = this.results.filter(r =>
        r.deathCause && r.deathCause.indexOf('Boss') !== -1
      );
      if (impossibleBosses.length > 0) {
        this.log(`\n💀 BOSS DEATHS: ${impossibleBosses.length} runs`);
        var bossDeathRate = (impossibleBosses.length / totalRuns * 100).toFixed(1);
        this.log(`  Boss Death Rate: ${bossDeathRate}%`);
        if (bossDeathRate > 50) {
          this.log(`  ⚠ WARNING: Bosses may be too difficult!`);
        }
      }

      // Economy analysis
      this.log(`\n${'='.repeat(60)}`);
      this.log(`ECONOMY ANALYSIS:`);
      this.log(`${'='.repeat(60)}`);

      var totalMythics = this.results.reduce((sum, r) => sum + r.mythicItemsFound, 0);
      var mythicRate = (totalMythics / totalRuns * 100).toFixed(2);
      this.log(`\nMythic Drop Rate: ${totalMythics} found in ${totalRuns} runs (${mythicRate}% per run)`);

      var avgFinalCredits = this.results.reduce((sum, r) => sum + r.finalCredits, 0) / totalRuns;
      this.log(`Average Final Credits: ${Math.floor(avgFinalCredits)}`);

      if (avgFinalCredits > 5000) {
        this.log(`  ⚠ WARNING: Players finishing with too much currency!`);
      } else if (avgFinalCredits < 100) {
        this.log(`  ⚠ WARNING: Players may be starved for currency!`);
      }

      var saverRuns = this.results.filter(r => r.persona === 'SAVER_HOARDER');
      if (saverRuns.length > 0) {
        var saverAvgCredits = saverRuns.reduce((sum, r) => sum + r.finalCredits, 0) / saverRuns.length;
        if (saverAvgCredits > 10000) {
          this.log(`\n⚠ SAVER TRAP DETECTED:`);
          this.log(`  SAVER_HOARDER averaging ${Math.floor(saverAvgCredits)} credits at end`);
          this.log(`  Vendors may not be attractive enough!`);
        }
      }

      var gamblerRuns = this.results.filter(r => r.persona === 'RISKY_GAMBLER');
      if (gamblerRuns.length > 0) {
        var gamblerDeaths = gamblerRuns.filter(r => !r.survived).length;
        var gamblerDeathFloor = gamblerRuns.reduce((sum, r) => sum + r.endFloor, 0) / gamblerRuns.length;
        if (gamblerDeathFloor < 15 && gamblerDeaths > gamblerRuns.length * 0.8) {
          this.log(`\n⚠ GAMBLER'S RUIN DETECTED:`);
          this.log(`  RISKY_GAMBLER dying at floor ${gamblerDeathFloor.toFixed(1)} (${(gamblerDeaths / gamblerRuns.length * 100).toFixed(0)}% death rate)`);
          this.log(`  Gambling odds or costs may be too punishing!`);
        }
      }

      this.log(`\n${'='.repeat(60)}\n`);

      return {
        summary: { totalRuns, survived, died },
        personas: personas,
        mythicRate: parseFloat(mythicRate),
        avgFinalCredits: Math.floor(avgFinalCredits),
        results: this.results
      };
    }

    /**
     * Export results to CSV
     */
    exportToCSV() {
      var csv = 'Run ID,Persona,Death Floor,Survived,Cause,Final Credits,Deck Size,Mythics Found,Elites Found,Credits Spent,Credits Earned,Enemies Killed,Bosses Killed,Times Stuck\n';

      this.results.forEach(r => {
        csv += `${r.runId},${r.persona},${r.endFloor},${r.survived},${r.deathCause || 'Completed'},${r.finalCredits},${r.finalDeckSize},${r.mythicItemsFound},${r.eliteItemsFound},${r.creditsSpent},${r.creditsEarned},${r.enemiesKilled},${r.bossesKilled},${r.timesStuck}\n`;
      });

      return csv;
    }

    /**
     * Export results to JSON
     */
    exportToJSON() {
      return JSON.stringify({
        metadata: {
          totalRuns: this.results.length,
          timestamp: new Date().toISOString(),
          maxFloor: this.maxFloor
        },
        results: this.results
      }, null, 2);
    }

    /**
     * Logging utility
     */
    log(message) {
      if (this.verbose) {
        console.log(message);
      }
    }
  }

  // Export
  return {
    AgentEngine: AgentEngine,
    PERSONAS: PERSONAS
  };
})();

// Node.js export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentEngine;
}
