Player Onboarding & Death Handling System: Technical Design Document
Executive Summary
This document specifies the complete player lifecycle system for the Gone Rogue browser-based game, spanning from initial terminal engagement through character selection, gameplay, and either victory or death. The system leverages existing infrastructure including the terminal UI, DOM game rendering, card-based hand systems, and scene management while introducing new state management for player persistence, death handling, and onboarding flow control.

The architecture separates concerns between the terminal layer (account management, command processing) and the game layer (rogue gameplay, combat, progression). A unified player state object persists across sessions, tracking unlocked avatars, completed tiers, inventory, and high scores while enforcing gating rules for locked content.

Section 1: Terminal Entry & Command System
Current State Assessment
The existing terminal system provides a command interface with a blinking underscore prompt. The infrastructure supports command parsing and basic routing. This system requires extension to handle the new onboarding flow and maintain state across the account lifecycle.

Implementation: Terminal Command Router
JavaScript

Copy
// public/js/terminal/command-router.js

class TerminalCommandRouter {
    constructor(terminalOutput, inputElement) {
        this.output = terminalOutput;
        this.input = inputElement;
        this.commandHistory = [];
        this.historyIndex = -1;
        this.playerState = null;
        
        this.setupInputHandling();
        this.loadPlayerState();
    }
    
    setupInputHandling() {
        this.input.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'Enter':
                    this.processCommand(this.input.value);
                    break;
                case 'ArrowUp':
                    this.navigateHistory(-1);
                    break;
                case 'ArrowDown':
                    this.navigateHistory(1);
                    break;
                case 'Tab':
                    this.handleAutocomplete();
                    break;
            }
        });
    }
    
    processCommand(rawInput) {
        const trimmed = rawInput.trim();
        if (!trimmed) return;
        
        // Add to history
        this.commandHistory.push(trimmed);
        this.historyIndex = this.commandHistory.length;
        
        // Clear input
        this.input.value = '';
        
        // Parse and execute
        const [command, ...args] = trimmed.toLowerCase().split(' ');
        const handler = this.getCommandHandler(command);
        
        if (handler) {
            handler(args, { raw: trimmed });
        } else {
            this.showHelp();
        }
    }
    
    getCommandHandler(command) {
        const handlers = {
            'help': () => this.showHelp(),
            'rogue': () => this.enterRogueMode(),
            'quit': () => this.quitToTerminal(),
            'stats': () => this.showPlayerStats(),
            'inventory': () => this.showInventory(),
            'highscore': () => this.showHighScores(),
            'reset': () => this.confirmReset(),
            'dev': () => this.enterDevMode()
        };
        
        return handlers[command] || null;
    }
    
    showHelp() {
        const helpText = `
=== GONE ROGUE TERMINAL v1.0 ===

AVAILABLE COMMANDS:
  rogue      - Enter the rogue simulation
  stats      - Display player statistics
  inventory  - View current inventory
  highscore  - View session high scores
  quit       - Exit simulation (saves progress)
  reset      - Reset all progress (requires confirmation)
  help       - Display this help message

TIPS:
  - Type 'rogue' to begin your mission
  - Use arrow keys to navigate command history
  - Tab for command autocomplete

========================================
`;
        this.output.write(helpText);
    }
    
    async enterRogueMode() {
        // Check if player has completed onboarding
        if (!this.playerState.onboardingComplete) {
            // Launch onboarding flow
            await this.launchOnboarding();
            return;
        }
        
        // Player has selected avatar - launch directly to game
        this.output.write('Initializing rogue protocol...\n');
        WindowManager.openRogueGame(this.playerState);
    }
    
    async launchOnboarding() {
        // Show onboarding splash
        await WindowManager.showOnboardingSplash();
        
        // Launch character selection
        const selection = await WindowManager.showCharacterSelection(this.playerState);
        
        if (selection) {
            // Save player choice
            this.playerState.selectedAvatar = selection.avatarId;
            this.playerState.callsign = selection.callsign;
            this.playerState.avatarStats = selection.stats;
            this.playerState.onboardingComplete = true;
            this.savePlayerState();
            
            // Launch into pre-start cutscene then game
            WindowManager.runPreStartCutscene(this.playerState, () => {
                WindowManager.openRogueGame(this.playerState);
            });
        }
    }
    
    enterDevMode() {
        // Dev mode bypasses onboarding
        if (this.playerState.isDevModeEnabled) {
            // Create random player state
            const devPlayer = this.generateDevPlayerState();
            WindowManager.openRogueGame(devPlayer);
        } else {
            this.output.write('Error: Dev mode not enabled for this account.\n');
        }
    }
    
    generateDevPlayerState() {
        const defaultAvatars = ['AVA-001', 'AVA-002', 'AVA-003'];
        const defaultNames = ['Operative', 'Agent', 'Cipher', 'Echo', 'Proxy'];
        
        return {
            isDevModeEnabled: true,
            onboardingComplete: true,
            selectedAvatar: defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)],
            callsign: defaultNames[Math.floor(Math.random() * defaultNames.length)] + '-' + 
                      Math.floor(Math.random() * 900 + 100),
            avatarStats: { health: 10, luck: 1, stamina: 5 },
            inventory: [],
            persistentCards: ['ACT-001', 'ACT-002', 'ACT-003'],
            unlockedAvatars: ['AVA-001', 'AVA-002'],
            completedTiers: [],
            highScores: {}
        };
    }
}
Terminal Visual Styling
CSS

Copy
/* Terminal styling for classic feel */
.terminal-container {
    background: #0a0a0a;
    color: #33ff33;
    font-family: 'Courier New', monospace;
    padding: 20px;
    min-height: 100vh;
    position: relative;
}

.terminal-output {
    white-space: pre-wrap;
    line-height: 1.5;
    margin-bottom: 60px;
}

.terminal-input-line {
    position: fixed;
    bottom: 20px;
    left: 20px;
    right: 20px;
    display: flex;
    align-items: center;
}

.terminal-prompt {
    margin-right: 10px;
    font-weight: bold;
}

.terminal-input {
    background: transparent;
    border: none;
    color: #33ff33;
    font-family: inherit;
    font-size: 16px;
    flex: 1;
    outline: none;
}

.blinking-cursor::after {
    content: '█';
    animation: blink 1s step-end infinite;
    margin-left: 2px;
}

@keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
}
Section 2: Onboarding Splash Screen
Design Specification
The onboarding splash screen serves as the transition from terminal to game world. It displays "YOU'VE GONE ROGUE" with appropriate visual weight and provides a brief moment of anticipation before character selection.

Implementation: Onboarding Splash Component
JavaScript

Copy
// public/js/ui/onboarding-splash.js

class OnboardingSplash {
    constructor(container) {
        this.container = container;
        this.overlay = null;
    }
    
    async show() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'onboarding-overlay';
        this.overlay.innerHTML = `
            <div class="onboarding-content">
                <div class="onboarding-title">
                    <span class="title-text">YOU'VE GONE</span>
                    <span class="title-accent">ROGUE</span>
                </div>
                <div class="onboarding-subtitle">
                    Initialize your operative profile
                </div>
                <div class="onboarding-progress">
                    <div class="progress-bar"></div>
                </div>
            </div>
        `;
        
        this.container.appendChild(this.overlay);
        
        // Animate in
        await this.animateIn();
        
        // Hold for dramatic effect
        await this.delay(2000);
        
        // Animate out
        await this.animateOut();
        
        this.overlay.remove();
        this.overlay = null;
    }
    
    async animateIn() {
        return new Promise(resolve => {
            const content = this.overlay.querySelector('.onboarding-content');
            const title = this.overlay.querySelector('.onboarding-title');
            
            // Initial state
            content.style.opacity = '0';
            title.style.transform = 'scale(0.9)';
            
            // Animate
            requestAnimationFrame(() => {
                content.style.transition = 'opacity 0.5s ease-out';
                title.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                
                content.style.opacity = '1';
                title.style.transform = 'scale(1)';
                
                setTimeout(resolve, 600);
            });
        });
    }
    
    async animateOut() {
        return new Promise(resolve => {
            const content = this.overlay.querySelector('.onboarding-content');
            const progress = this.overlay.querySelector('.progress-bar');
            
            // Fill progress
            progress.style.transition = 'width 0.3s ease-out';
            progress.style.width = '100%';
            
            setTimeout(() => {
                content.style.transition = 'opacity 0.3s ease-in, transform 0.3s ease-in';
                content.style.opacity = '0';
                content.style.transform = 'translateY(-20px)';
                
                setTimeout(resolve, 400);
            }, 300);
        });
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
CSS for Onboarding Splash
CSS

Copy
.onboarding-overlay {
    position: fixed;
    inset: 0;
    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.onboarding-content {
    text-align: center;
    padding: 40px;
}

.onboarding-title {
    margin-bottom: 20px;
}

.title-text {
    display: block;
    font-size: 48px;
    font-weight: bold;
    color: #33ff33;
    text-shadow: 0 0 20px rgba(51, 255, 51, 0.5);
    letter-spacing: 8px;
}

.title-accent {
    display: block;
    font-size: 64px;
    font-weight: 900;
    color: #ff3333;
    text-shadow: 0 0 30px rgba(255, 51, 51, 0.7);
    letter-spacing: 12px;
    margin-top: 10px;
}

.onboarding-subtitle {
    font-size: 18px;
    color: #888;
    margin-bottom: 40px;
}

.onboarding-progress {
    width: 200px;
    height: 4px;
    background: #333;
    border-radius: 2px;
    margin: 0 auto;
    overflow: hidden;
}

.progress-bar {
    width: 0%;
    height: 100%;
    background: linear-gradient(90deg, #33ff33, #00ff88);
}
Section 3: Character Selection Screen
Design Specification
Character selection uses the existing card-based UI pattern, presenting avatar options as cards. Selected avatar determines starting stats and unlocks progressively based on player account state.

Implementation: Character Selection Component
JavaScript

Copy
// public/js/ui/character-selection.js

class CharacterSelectionScreen {
    constructor(container, playerState) {
        this.container = container;
        this.playerState = playerState;
        this.selectedAvatar = null;
        this.selectedCallsign = '';
    }
    
    async show() {
        // Create selection UI
        this.render();
        
        // Wait for user interaction
        return new Promise(resolve => {
            this.onSelectionComplete = resolve;
        });
    }
    
    render() {
        this.container.innerHTML = `
            <div class="character-selection">
                <div class="selection-header">
                    <h2>SELECT YOUR OPERATIVE</h2>
                    <p>Choose your identity and codename</p>
                </div>
                
                <div class="avatar-grid">
                    ${this.renderAvatarCards()}
                </div>
                
                <div class="callsign-input-section" style="display: none;">
                    <input type="text" 
                           class="callsign-input" 
                           placeholder="ENTER CALLSIGN"
                           maxlength="12"
                           autocomplete="off">
                    <button class="confirm-button" disabled>CONFIRM</button>
                </div>
            </div>
        `;
        
        this.setupEventListeners();
    }
    
    renderAvatarCards() {
        const avatars = this.getAvailableAvatars();
        
        return avatars.map(avatar => `
            <div class="avatar-card ${avatar.locked ? 'locked' : ''}" 
                 data-avatar-id="${avatar.id}">
                <div class="card-front">
                    ${avatar.locked ? `
                        <div class="locked-overlay">
                            <span class="joker-emoji">🃏</span>
                            <span class="lock-reason">${avatar.lockReason || 'LOCKED'}</span>
                        </div>
                    ` : `
                        <div class="avatar-emoji">${avatar.emoji}</div>
                        <div class="avatar-name">${avatar.name}</div>
                        <div class="avatar-stats">
                            ${this.renderStats(avatar.stats)}
                        </div>
                    `}
                </div>
                <div class="card-back" style="display: none;">
                    <div class="avatar-emoji">${avatar.emoji}</div>
                </div>
            </div>
        `).join('');
    }
    
    getAvailableAvatars() {
        const allAvatars = [
            {
                id: 'AVA-001',
                name: 'Operative',
                emoji: '🕵️',
                stats: { health: 10, luck: 1, stamina: 5 },
                unlocked: true,
                unlockCondition: null
            },
            {
                id: 'AVA-002',
                name: 'Medic',
                emoji: '👨‍⚕️',
                stats: { health: 12, luck: 0, stamina: 4 },
                unlocked: true,
                unlockCondition: null,
                lockReason: '+1 HEALTH'
            },
            {
                id: 'AVA-003',
                name: 'Scout',
                emoji: '🧭',
                stats: { health: 8, luck: 2, stamina: 6 },
                unlocked: this.playerState?.unlockedAvatars?.includes('AVA-003') || false,
                unlockCondition: 'Complete Tier 1'
            },
            {
                id: 'AVA-004',
                name: 'Heavy',
                emoji: '💪',
                stats: { health: 15, luck: 0, stamina: 3 },
                unlocked: false,
                unlockCondition: 'Complete Tier 2'
            },
            {
                id: 'AVA-005',
                name: 'Ghost',
                emoji: '👻',
                stats: { health: 9, luck: 3, stamina: 5 },
                unlocked: false,
                unlockCondition: 'Complete Tier 3'
            },
            {
                id: 'AVA-006',
                name: 'Tech',
                emoji: '🤖',
                stats: { health: 10, luck: 1, stamina: 6 },
                unlocked: false,
                unlockCondition: 'Complete Tier 4'
            }
        ];
        
        return allAvatars;
    }
    
    renderStats(stats) {
        return `
            <div class="stat-row">
                <span class="stat-icon">❤️</span>
                <span class="stat-value">${stats.health}</span>
            </div>
            <div class="stat-row">
                <span class="stat-icon">🍀</span>
                <span class="stat-value">${stats.luck}</span>
            </div>
            <div class="stat-row">
                <span class="stat-icon">⚡</span>
                <span class="stat-value">${stats.stamina}</span>
            </div>
        `;
    }
    
    setupEventListeners() {
        // Card selection
        this.container.querySelectorAll('.avatar-card:not(.locked)').forEach(card => {
            card.addEventListener('click', () => {
                this.selectAvatar(card.dataset.avatarId);
            });
        });
        
        // Callsign input
        const input = this.container.querySelector('.callsign-input');
        const confirmBtn = this.container.querySelector('.confirm-button');
        
        input.addEventListener('input', () => {
            this.selectedCallsign = input.value.trim().toUpperCase();
            confirmBtn.disabled = this.selectedCallsign.length < 2;
        });
        
        confirmBtn.addEventListener('click', () => {
            this.confirmSelection();
        });
        
        // Enter key to confirm
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !confirmBtn.disabled) {
                this.confirmSelection();
            }
        });
    }
    
    selectAvatar(avatarId) {
        // Update visual selection
        this.container.querySelectorAll('.avatar-card').forEach(card => {
            card.classList.remove('selected');
            if (card.dataset.avatarId === avatarId) {
                card.classList.add('selected');
                // Flip animation
                card.querySelector('.card-front').style.display = 'none';
                card.querySelector('.card-back').style.display = 'flex';
            } else {
                card.querySelector('.card-front').style.display = 'flex';
                card.querySelector('.card-back').style.display = 'none';
            }
        });
        
        this.selectedAvatar = avatarId;
        
        // Show callsign input
        const inputSection = this.container.querySelector('.callsign-input-section');
        inputSection.style.display = 'block';
        inputSection.querySelector('input').focus();
    }
    
    confirmSelection() {
        if (!this.selectedAvatar || this.selectedCallsign.length < 2) return;
        
        const avatar = this.getAvailableAvatars().find(a => a.id === this.selectedAvatar);
        
        this.onSelectionComplete({
            avatarId: this.selectedAvatar,
            callsign: this.selectedCallsign,
            stats: avatar.stats,
            emoji: avatar.emoji
        });
    }
}
CSS for Character Selection
CSS

Copy
.character-selection {
    padding: 30px;
    max-width: 900px;
    margin: 0 auto;
}

.selection-header {
    text-align: center;
    margin-bottom: 40px;
}

.selection-header h2 {
    font-size: 28px;
    color: #fff;
    margin-bottom: 8px;
}

.selection-header p {
    color: #888;
    font-size: 14px;
}

.avatar-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
}

.avatar-card {
    position: relative;
    aspect-ratio: 3/4;
    background: linear-gradient(145deg, #1a1a2e, #16213e);
    border: 2px solid #333;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    overflow: hidden;
}

.avatar-card:hover:not(.locked) {
    border-color: #33ff33;
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(51, 255, 51, 0.2);
}

.avatar-card.selected {
    border-color: #33ff33;
    box-shadow: 0 0 30px rgba(51, 255, 51, 0.4);
}

.avatar-card.locked {
    cursor: not-allowed;
    opacity: 0.6;
}

.card-front {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
}

.avatar-emoji {
    font-size: 48px;
    margin-bottom: 12px;
}

.avatar-name {
    font-size: 12px;
    color: #fff;
    text-align: center;
    margin-bottom: 8px;
}

.avatar-stats {
    font-size: 10px;
    color: #888;
}

.stat-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 2px 0;
}

.locked-overlay {
    text-align: center;
}

.joker-emoji {
    font-size: 36px;
    display: block;
    margin-bottom: 8px;
    filter: grayscale(100%);
    opacity: 0.5;
}

.lock-reason {
    font-size: 10px;
    color: #ff6b6b;
}

.callsign-input-section {
    max-width: 400px;
    margin: 0 auto;
    text-align: center;
}

.callsign-input {
    width: 100%;
    padding: 16px 20px;
    font-size: 18px;
    text-align: center;
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid #333;
    border-radius: 8px;
    color: #33ff33;
    font-family: 'Courier New', monospace;
    text-transform: uppercase;
    letter-spacing: 4px;
    outline: none;
    transition: border-color 0.3s;
}

.callsign-input:focus {
    border-color: #33ff33;
}

.confirm-button {
    margin-top: 20px;
    padding: 16px 48px;
    font-size: 16px;
    font-weight: bold;
    background: #33ff33;
    color: #000;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
}

.confirm-button:disabled {
    background: #333;
    color: #666;
    cursor: not-allowed;
}

.confirm-button:not(:disabled):hover {
    transform: scale(1.05);
    box-shadow: 0 0 20px rgba(51, 255, 51, 0.4);
}
Section 4: Pre-Start Cutscene & Level Entry
Design Specification
After character selection, the system plays a cinematic transition: screen fades to black with selected emoji, then fades in to the T1 cozy biome with light emanating from the player position. An automatic pathing sequence guides the player through the first scene to the tutorial level.

Implementation: Pre-Start Cutscene System
JavaScript

Copy
// public/js/game/cutscenes/pre-start-cutscene.js

class PreStartCutscene {
    constructor(gameEngine, playerState) {
        this.engine = gameEngine;
        this.playerState = playerState;
        this.isPlaying = false;
    }
    
    async play() {
        this.isPlaying = true;
        
        // Phase 1: Fade to black with emoji
        await this.phaseFadeOut();
        
        // Phase 2: Position player in T1 cozy biome
        await this.phasePositionPlayer();
        
        // Phase 3: Fade in with light emanating from player
        await this.phaseFadeIn();
        
        // Phase 4: Auto-path to tutorial level
        await this.phaseAutoPath();
        
        this.isPlaying = false;
        
        // Hand off to normal gameplay
        this.engine.setGameState('PLAYING');
    }
    
    async phaseFadeOut() {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'cutscene-overlay fade-out';
            overlay.innerHTML = `
                <div class="fade-emoji">${this.playerState.selectedEmoji}</div>
            `;
            document.body.appendChild(overlay);
            
            setTimeout(() => {
                overlay.classList.remove('fade-out');
                overlay.classList.add('fade-in');
            }, 100);
            
            setTimeout(() => {
                overlay.remove();
                resolve();
            }, 800);
        });
    }
    
    async phasePositionPlayer() {
        // Load T1 cozy biome
        await this.engine.loadBiome('T1_FOREST_COZY');
        
        // Position player at pre-start area
        const preStartPosition = { x: 8, y: 8 };
        this.engine.player.setPosition(preStartPosition);
        
        // Initialize player visual with selected emoji
        this.engine.player.setAvatarEmoji(this.playerState.selectedEmoji);
        this.engine.player.setStats(this.playerState.avatarStats);
    }
    
    async phaseFadeIn() {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'cutscene-overlay fade-in';
            overlay.innerHTML = `
                <div class="light-emitter"></div>
            `;
            document.body.appendChild(overlay);
            
            // Player position for light origin
            const playerScreen = this.engine.camera.worldToScreen(
                this.engine.player.position
            );
            
            const light = overlay.querySelector('.light-emitter');
            light.style.left = playerScreen.x + 'px';
            light.style.top = playerScreen.y + 'px';
            
            // Trigger fade
            setTimeout(() => {
                overlay.classList.remove('fade-in');
            }, 50);
            
            setTimeout(() => {
                overlay.remove();
                resolve();
            }, 1500);
        });
    }
    
    async phaseAutoPath() {
        // Tutorial waypoints
        const waypoints = [
            { x: 10, y: 8, message: 'Use arrow keys to move' },
            { x: 12, y: 8, message: 'Watch for enemy sightlines' },
            { x: 14, y: 8, message: 'Press SPACE to interact' },
            { x: 16, y: 8, message: 'Welcome to the training grounds' }
        ];
        
        for (const waypoint of waypoints) {
            await this.pathToWaypoint(waypoint);
        }
        
        // Mark tutorial complete
        this.playerState.tutorialComplete = true;
        this.savePlayerState();
    }
    
    async pathToWaypoint(waypoint) {
        return new Promise(resolve => {
            // Show guidance message
            this.engine.ui.showToast(waypoint.message, 2000);
            
            // Auto-path player to waypoint
            this.engine.player.autoMoveTo(waypoint, () => {
                resolve();
            });
        });
    }
}
Cutscene CSS
CSS

Copy
.cutscene-overlay {
    position: fixed;
    inset: 0;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
}

.fade-out {
    background: #000;
    animation: fadeOut 0.8s ease-in forwards;
}

.fade-in {
    background: #000;
    animation: fadeIn 1.5s ease-out forwards;
}

@keyframes fadeOut {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes fadeIn {
    from { opacity: 1; }
    to { opacity: 0; }
}

.fade-emoji {
    font-size: 120px;
    animation: emojiPulse 2s ease-in-out;
}

@keyframes emojiPulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.8; }
}

.light-emitter {
    position: absolute;
    width: 2000px;
    height: 2000px;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
    animation: lightExpand 2s ease-out forwards;
}

@keyframes lightExpand {
    from { transform: translate(-50%, -50%) scale(0); }
    to { transform: translate(-50%, -50%) scale(1); }
}
Section 5: Victory Flow & High Score Display
Design Specification
On successful completion, the player returns to the opening cutscene area where other humanoid emojis await. A congratulations tooltip appears, confetti overlays the screen, and the player automatically paths back to the center before fading out. A high score popup appears while the game screen cleans up.

Implementation: Victory Flow Controller
JavaScript

Copy
// public/js/game/victory-flow.js

class VictoryFlowController {
    constructor(gameEngine, playerState) {
        this.engine = gameEngine;
        this.playerState = playerState;
    }
    
    async execute() {
        // Phase 1: Spawn other humanoids at completion point
        await this.phaseSpawnWitnesses();
        
        // Phase 2: Player paths back to center
        await this.phasePlayerReturn();
        
        // Phase 3: Fade out game, show high score
        await this.phaseCleanupAndScore();
        
        // Phase 4: Return to terminal
        this.phaseReturnToTerminal();
    }
    
    async phaseSpawnWitnesses() {
        // Spawn Mok and other NPCs at completion area
        const witnesses = [
            { emoji: '🤖', name: 'MOK', position: { x: 14, y: 8 }, emotion: 'excited' },
            { emoji: '🕵️', name: 'Operative', position: { x: 16, y: 7 }, emotion: 'neutral' },
            { emoji: '👨‍⚕️', name: 'Medic', position: { x: 12, y: 9 }, emotion: 'happy' }
        ];
        
        for (const witness of witnesses) {
            const npc = this.engine.spawnNPC(witness);
            npc.setEmotion(witness.emotion);
        }
        
        // Show congratulations tooltip
        this.engine.ui.showTooltip({
            content: '🎉 CONGRATULATIONS! 🎉\nMission Complete',
            position: 'center',
            duration: 4000,
            type: 'success'
        });
        
        // Trigger confetti
        this.engine.effects.triggerConfetti({
            coverage: 0.8,
            colors: ['#33ff33', '#ff3333', '#3333ff', '#ffff33'],
            duration: 5000
        });
        
        await this.delay(2000);
    }
    
    async phasePlayerReturn() {
        // Clear witnesses
        this.engine.npcs.forEach(npc => npc.remove());
        
        // Auto-path player back to center (16, 8)
        return new Promise(resolve => {
            this.engine.player.autoMoveTo({ x: 16, y: 8 }, () => {
                this.engine.player.setEmotion('victorious');
                resolve();
            });
        });
    }
    
    async phaseCleanupAndScore() {
        // Calculate high score
        const score = this.calculateHighScore();
        
        // Save to player state
        this.playerState.highScores = this.playerState.highScores || {};
        this.playerState.highScores[this.engine.currentTier] = 
            Math.max(score, this.playerState.highScores[this.engine.currentTier] || 0);
        
        this.playerState.completedTiers = this.playerState.completedTiers || [];
        if (!this.playerState.completedTiers.includes(this.engine.currentTier)) {
            this.playerState.completedTiers.push(this.engine.currentTier);
        }
        
        this.savePlayerState();
        
        // Fade out game screen
        await this.engine.ui.fadeOut(1000);
        
        // Close game window
        WindowManager.closeRogueGame();
        
        // Show high score popup
        await WindowManager.showHighScorePopup(score, this.playerState);
        
        await this.delay(1500);
    }
    
    phaseReturnToTerminal() {
        // Clean terminal display
        TerminalManager.clear();
        TerminalManager.write('=== MISSION COMPLETE ===\n');
        TerminalManager.write(`High Score: ${this.playerState.highScores[this.engine.currentTier]}\n`);
        TerminalManager.write('Type "rogue" to begin next mission.\n');
        TerminalManager.write('\n');
        TerminalManager.write('Available tiers:\n');
        this.playerState.completedTiers.forEach(tier => {
            TerminalManager.write(`  ✓ ${tier}\n`);
        });
        
        // Unlock difficulty selection if applicable
        if (this.playerState.completedTiers.length >= 2) {
            WindowManager.enableDifficultySelector();
        }
    }
    
    calculateHighScore() {
        // Score based on: time, resources remaining, enemies defeated, cards used
        const baseScore = 1000;
        const timeBonus = Math.max(0, Math.floor((600 - this.engine.elapsedTime) / 10));
        const resourceBonus = this.engine.player.resources * 50;
        const enemyBonus = this.engine.enemiesDefeated * 100;
        const efficiencyBonus = (this.engine.cardsPlayed > 0) ? 
            Math.floor(this.engine.damageDealt / this.engine.cardsPlayed * 10) : 0;
        
        return baseScore + timeBonus + resourceBonus + enemyBonus + efficiencyBonus;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    savePlayerState() {
        localStorage.setItem('GONE_ROGUE_PLAYER', JSON.stringify(this.playerState));
    }
}
Section 6: Death Handling & YOU DIED Screen
Design Specification
On player death, the game screen vanishes, a "YOU DIED" screen appears, and the player returns to the terminal. Inventory is preserved, but hand, backup, and equipped item are lost.

Implementation: Death Handler
JavaScript

Copy
// public/js/game/death-handler.js

class DeathHandler {
    constructor(gameEngine, playerState) {
        this.engine = gameEngine;
        this.playerState = playerState;
    }
    
    async execute() {
        // Phase 1: Save what's preserved (inventory only)
        await this.phasePreserveInventory();
        
        // Phase 2: Visual death sequence
        await this.phaseDeathSequence();
        
        // Phase 3: YOU DIED screen
        await this.phaseYouDied();
        
        // Phase 4: Cleanup and return to terminal
        this.phaseReturnToTerminal();
    }
    
    async phasePreserveInventory() {
        // Inventory persists
        this.playerState.inventory = this.engine.player.inventory;
        
        // Save state
        localStorage.setItem('GONE_ROGUE_PLAYER', JSON.stringify(this.playerState));
    }
    
    async phaseDeathSequence() {
        // Play death animation
        this.engine.player.playDeathAnimation();
        
        // Shake screen
        this.engine.camera.shake(10, 500);
        
        // Fade to dark red
        await this.engine.ui.fadeToColor('#330000', 500);
        
        await this.delay(500);
    }
    
    async phaseYouDied() {
        // Create YOU DIED overlay
        const overlay = document.createElement('div');
        overlay.className = 'you-died-overlay';
        overlay.innerHTML = `
            <