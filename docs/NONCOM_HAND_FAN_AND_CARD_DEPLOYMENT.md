Non-Combat Hand Fan Component: Technical Design Document
Executive Summary and Design Philosophy
The non-combat hand fan component represents a fundamental expansion of player agency outside the boundaries of STR combat encounters. Where the combat hand fan exists solely for card deployment during active confrontation, the non-combat variant serves as a comprehensive interface for proactive gameplay—enabling status effect application before combat begins, resource management through consumable items, item-to-card synergy activation, and tactical preparation that shapes how subsequent encounters will unfold. This component transforms the Gone Rogue experience from a reactive combat system into an active tradecraft simulator where skilled players can shape the battlefield before the first shot is fired.

The design philosophy emphasizes transparency and predictability. Players should understand exactly what will happen when they apply a card or use an item, with clear visual feedback for every action. The interface must support both precise interactions (aiming a card at a specific tile) and rapid-fire actions (spam-clicking a cigarette to manage the health-to-stat tradeoff) without requiring mode switching or context hunting. Everything the player needs should be accessible within this component's visual field, with the Gone Rogue game screen serving as the context layer that receives their commands.

This document presents a thorough analysis of existing database systems, identifies opportunities for consolidation and improvement, and provides detailed specifications for implementing a cohesive non-combat hand fan experience that maximizes ease of use while supporting the full range of pre-combat and out-of-combat gameplay options available in Gone Rogue.

Section 1: System Analysis and Database Audit
1.1 Current State Assessment
The existing non-combat systems exist in fragmented form across multiple database tables and UI components. A careful audit reveals the following distributed functionality:

The action_button_icons table stores available action button configurations but lacks unified state management. Each button operates independently, with no centralized tracking of cooldowns, resource costs, or interaction permissions. Designers can configure buttons through JSON definitions, but the system provides no visual preview of button state (ready, disabled, cooldown) beyond simple enabled/disabled flags.

The equipped_item_slot represents the currently equipped item but provides limited interaction beyond basic activation. The slot lacks integration with card systems, preventing designers from defining item+card synergies through the database. Item activation triggers a hardcoded effect list with no extensibility for conditional behaviors based on game state.

The tiny_grid_squares system exists as a conceptual representation of map interaction zones but lacks unified handling. Different parts of the codebase treat grid interactions differently—some as raycast targets, some as discrete click zones, some as animation triggers. This fragmentation makes consistent UI behavior nearly impossible to guarantee.

The card_applications table records historical card usage but provides no forward-looking functionality. Players cannot preview where cards will apply, understand conditional requirements, or receive feedback about application readiness. The system logs results but does not guide decisions.

1.2 Problem Identification
The current architecture suffers from five critical problems that this redesign must address:

State Fragmentation: No single source of truth for component state. The action buttons, item slot, and grid interactions maintain separate state stores that can become inconsistent. A button might appear enabled while the equipped item prevents its use, or a grid square might accept input while game state forbids it.

Feedback Absence: Players receive minimal feedback about action consequences. The cigarette item example—where spam-clicking drops health to increase another stat—likely exists as hidden behavior without visual indication of the health/stat tradeoff in progress. Players must learn through experimentation rather than understanding.

Interaction Inconsistency: Clicking a card in the combat hand fan triggers one behavior, while clicking the same card in the (hypothetical) non-combat context might trigger something entirely different. The non-combat context lacks the established interaction patterns that combat provides.

Synergy Opaque: Item+card synergies probably exist as undocumented combinations rather than discoverable interactions. Players cannot see what synergies are available, understand how to trigger them, or predict their outcomes with confidence.

Designer Friction: Adding new non-combat actions requires modifications across multiple systems (button definition, item behavior, card effect, grid interaction). The current architecture makes designer experimentation difficult and bug-prone.

1.3 Database Schema Redesign
The proposed database schema consolidates non-combat functionality into unified structures that support the full range of required behaviors:

Sql

Copy
-- Unified Component State Store
CREATE TABLE non_combat_component_state (
    component_id VARCHAR(64) PRIMARY KEY,
    state_type ENUM('idle', 'active', 'cooldown', 'disabled', 'locked') NOT NULL,
    current_value DECIMAL(8,2),
    max_value DECIMAL(8,2),
    cooldown_ends_at TIMESTAMP,
    lock_reason VARCHAR(128),
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON
);

-- Action Button Registry with Full State Tracking
CREATE TABLE action_button_registry (
    button_id VARCHAR(64) PRIMARY KEY,
    button_name VARCHAR(128) NOT NULL,
    icon_emoji VARCHAR(8),
    hotkey VARCHAR(16),
    default_state JSON NOT NULL,
    state_transitions JSON NOT NULL,
    cooldown_duration INT DEFAULT 0,
    cost_resource VARCHAR(32),
    cost_amount DECIMAL(8,2),
    requires_item_slot VARCHAR(64),
    requires_card_in_hand BOOLEAN DEFAULT FALSE,
    target_grid_pattern VARCHAR(32),
    effect_definition JSON NOT NULL,
    visual_feedback_config JSON
);

-- Card Application Definition with Preview Support
CREATE TABLE card_application_registry (
    card_id VARCHAR(64) PRIMARY KEY,
    card_name VARCHAR(128) NOT NULL,
    card_emoji VARCHAR(8),
    application_type ENUM('self', 'ground', 'enemy', 'npc', 'item') NOT NULL,
    effect_preview_template VARCHAR(256),
    valid_target_predicate VARCHAR(256),
    resource_cost JSON,
    pre_application_checks JSON,
    effect_resolution JSON NOT NULL,
    post_application_effects JSON,
    animation_definition JSON,
    sound_effect VARCHAR(64)
);

-- Item+Card Synergy Definitions
CREATE TABLE synergy_definitions (
    synergy_id VARCHAR(64) PRIMARY KEY,
    synergy_name VARCHAR(128) NOT NULL,
    item_id VARCHAR(64),
    card_id VARCHAR(64),
    trigger_condition ENUM('card_on_item', 'item_then_card', 'simultaneous', 'combo_chain') NOT NULL,
    effect_definition JSON NOT NULL,
    visual_indicator VARCHAR(32),
    max_uses_per_combat INT,
    metadata JSON
);

-- Grid Interaction Zones with Semantic Tags
CREATE TABLE grid_interaction_zones (
    zone_id VARCHAR(64) PRIMARY KEY,
    zone_type ENUM('movement', 'interaction', 'ground_effect', 'npc', 'enemy_spawn', 'hazard') NOT NULL,
    grid_coordinates JSON NOT NULL,
    valid_activators JSON,
    interaction_result JSON,
    visual_state JSON,
    linked_component VARCHAR(64)
);

-- Component State Change Log for Debugging
CREATE TABLE non_combat_state_history (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    component_id VARCHAR(64) NOT NULL,
    previous_state VARCHAR(32),
    new_state VARCHAR(32) NOT NULL,
    trigger_event VARCHAR(128),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    context JSON
);
This schema provides a single source of truth for component state, explicit definitions for all possible interactions, and comprehensive logging for debugging designer configuration issues.

Section 2: Component Architecture
2.1 Visual Layout and Spatial Organization
The non-combat hand fan component occupies the bottom portion of the Gone Rogue screen, positioned to maximize visibility of the game world while providing intuitive access to all controls. The layout follows a three-column design that separates functionality without fragmenting the visual experience:

Left Column: Action Button Container

The left column contains the action button icons that provide quick access to frequently-used non-combat actions. This column is approximately 20% of the total component width and displays buttons in a vertical stack. Each button occupies a fixed-height slot (approximately 48 pixels) with consistent internal padding. The column scrolls if configured buttons exceed available space, but designers should limit to 5-7 primary actions to maintain accessibility.

Buttons in this column are predominantly one-tap activations that trigger immediate effects without requiring target selection. The cigarette example—spam-clicking to trade health for a stat boost—maps perfectly to this column. Each tap produces immediate visual feedback (health decrement animation, stat increment overlay) while the button itself pulses or glows to indicate activity.

Center Column: Equipped Item Slot and Card Fan

The center column serves as the primary interaction zone, combining the equipped item slot with the action card hand fan. This column is approximately 50% of the total component width and centers visually on the player's current state.

The equipped item slot occupies the top portion of this column, displaying the currently equipped item with its icon, name, and available uses (if applicable). The slot is larger than action buttons (approximately 80×80 pixels) to emphasize its importance. Tapping the equipped item triggers its primary effect. Holding the equipped item (long-press) opens a context menu showing item details, available synergies, and configuration options.

The action card hand fan occupies the lower portion of this column, displaying available action cards in a horizontal fan arrangement. Cards fan outward with consistent angular spacing, ensuring all cards remain visible without excessive overlap. The fan adjusts dynamically based on card count—more cards spread wider, fewer cards cluster tighter. Each card displays its emoji, name (abbreviated if necessary), and a small indicator showing whether it has remaining uses or is single-use.

Right Column: Grid Interaction Preview

The right column provides context-aware grid interaction previews. When the player selects a card or activates an item that requires map targeting, this column transforms to show the valid target zones on the underlying game grid. The preview uses semi-transparent overlays to indicate where effects will apply, with animation showing effect radius, duration, and expected outcome.

When no targeting is active, this column displays status information—current player health, resource bars, active status effects, and environmental conditions. This transforms "dead space" into useful information display without cluttering the primary game view.

2.2 Component State Machine
The non-combat hand fan operates through a unified state machine that manages transitions between different interaction modes. This state machine ensures consistent behavior regardless of which entry point the player uses:

TypeScript

Copy
enum NonCombatState {
    IDLE = 'idle',
    BUTTON_PENDING = 'button_pending',
    CARD_PENDING = 'card_pending',
    ITEM_PENDING = 'item_pending',
    TARGETING = 'targeting',
    SYNERGY_MODE = 'synergy_mode',
    CONFIRMATION = 'confirmation',
    ANIMATING = 'animating',
    COOLDOWN = 'cooldown'
}

class NonCombatStateMachine {
    private currentState: NonCombatState = NonCombatState.IDLE;
    private pendingAction: PendingAction | null = null;
    private stateCallbacks: Map<NonCombatState, StateCallback[]> = new Map();
    
    // State transition logic with validation
    transitionTo(newState: NonCombatState, context?: ActionContext): boolean {
        const allowed = this.validateTransition(this.currentState, newState, context);
        if (!allowed) {
            this.triggerInvalidTransitionFeedback(newState);
            return false;
        }
        
        const previousState = this.currentState;
        this.currentState = newState;
        this.notifyStateChange(previousState, newState, context);
        return true;
    }
    
    // Pending action management
    setPendingAction(action: PendingAction): void {
        this.pendingAction = action;
        this.transitionTo(NonCombatState.TARGETING);
    }
    
    clearPendingAction(): void {
        this.pendingAction = null;
        this.transitionTo(NonCombatState.IDLE);
    }
}
State Descriptions:

The Idle state represents the default resting state where all components are visible and interactive. Buttons can be tapped, cards can be selected, and the equipped item can be activated. No targeting overlay is active.

The Button Pending state triggers when an action button is tapped but requires additional input. This state applies to buttons with sub-options (tap to see choices, then tap again to confirm) or buttons that show confirmation dialogs (dangerous actions requiring explicit consent).

The Card Pending state triggers when a card is selected from the fan. The card visually lifts from the fan and follows the cursor. Valid target zones highlight on the game grid. The player can drag to a new target, release to apply, or tap the card again to cancel.

The Item Pending state triggers when the equipped item is activated but requires targeting or configuration. This state shares visual language with Card Pending but includes item-specific options (use configuration menus, synergy mode indicators).

The Targeting state represents the active targeting phase where an action is ready to apply but awaiting final confirmation. The cursor displays a target preview, the underlying grid shows effect coverage, and release triggers the action. This state can be entered from Button Pending, Card Pending, or Item Pending through explicit confirmation.

The Synergy Mode state triggers when the system detects a potential item+card synergy. Visual indicators connect the equipped item slot to the relevant card, showing the combined effect preview. Tapping either component triggers the synergy; tapping elsewhere cancels.

The Confirmation state presents explicit confirmation dialogs for irreversible or costly actions. The dialog displays the action, its costs, and expected outcomes. Tapping "Confirm" triggers the action; tapping "Cancel" returns to the previous state.

The Animating state locks all input while action animations play. This prevents double-activation and ensures clean visual sequences. The state automatically transitions to Idle when animations complete.

The Cooldown state applies after certain actions prevent rapid re-activation. The affected component (button, card, item) displays cooldown progress. Other components remain interactive unless the cooldown is global.

Section 3: Interaction Patterns and Use Cases
3.1 Pre-Combat Status Effect Application
Pre-combat status effects represent one of the primary use cases for the non-combat hand fan. Players can apply effects to themselves, the ground, or designated NPCs before engaging in combat, shaping the conditions under which the upcoming fight will occur.

Self-Targeting Card Application

To apply a status effect to oneself, the player taps a card in the hand fan that has self-targeting capability. The card lifts from the fan and follows the cursor. A self-target indicator (perhaps a glowing outline around the player's avatar) confirms the targeting mode. Tapping anywhere applies the effect to the player character with appropriate visual feedback—status effect icons appear on the player's status bar, a brief animation plays, and any resource costs are deducted.

Cards that provide ongoing effects (armor, temporary stat boosts) should display their duration and magnitude clearly in the preview. The preview might show: "Armor: +5 for 3 rounds" or "Strength: +2 for this combat." This clarity helps players plan their combat approach.

Ground Effect Application

Ground effects persist on the map and affect whatever enters their area during combat. To apply a ground effect, the player selects a card with ground effect capability and drags it to the desired map location. Valid placement zones highlight as the card hovers—empty spaces accept placement, while occupied or restricted zones show rejection indicators.

Ground effects display their coverage area as a semi-transparent overlay. The preview shows the effect radius, any obstacle interactions (effects don't pass through walls), and expected duration. Placement near enemy spawn points, chokepoints, or tactical terrain features provides maximum utility.

NPC Status Application

Friendly NPCs can receive status effects that change their behavior or capabilities during subsequent interactions. To apply a status to an NPC, the player selects an applicable card and drags it to the NPC's position. The NPC highlights to confirm targeting. Status effects on NPCs might include "Alert" (NPC provides warning of danger), "Hidden" (NPC is harder for enemies to detect), or "Inspired" (NPC provides bonuses when rescued).

3.2 Resource Management and the Cigarette Paradigm
The cigarette item exemplifies a category of resources where players manage tradeoffs between competing values. Spam-clicking the cigarette to drop health while increasing another stat requires clear feedback about both dimensions of the tradeoff.

Feedback Implementation for Health-for-Stat Exchanges

When the player begins spam-clicking the cigarette, the component should transition to a rapid-feedback mode. Each click produces immediate dual animation: a health decrement indicator (red number or bar portion floating upward) and a stat increment indicator (blue number or bar portion appearing on the target stat). The animations should be rapid but readable—approximately 100ms per action cycle.

The component should display a running total of the tradeoff in progress: "Health: -12 | Focus: +3" in a small overlay near the cigarette button. This running total updates in real-time and resets when the player stops clicking for a configurable threshold (default 500ms).

Visual feedback should escalate with continued clicking. After 5 clicks in rapid succession, the button begins to glow. After 10 clicks, the glow intensifies and perhaps pulses. After 15 clicks, an audio cue might change to indicate approaching limits. These escalation signals help players recognize when they've applied enough of the effect without requiring them to track exact counts.

Resource Cap Management

The system should prevent resource exploitation by enforcing caps on both sides of the tradeoff. Health cannot drop below a minimum threshold (perhaps 10% of maximum) regardless of spam-clicking. The stat boost has a maximum value that cannot be exceeded. When either cap is reached, the button should provide clear feedback—perhaps a "full" indicator on the stat side, a "minimum health reached" message on the health side.

The cigarette might also have its own usage limits—each click consumes a "charge" from the cigarette, with charges regenerating slowly over time or refreshing on certain events. This creates a rhythm of use: spam-click while charges last, wait for regeneration, resume.

3.3 Item+Card Synergy Activation
Synergies between equipped items and action cards represent advanced gameplay that rewards experimentation and system knowledge. The non-combat hand fan must make synergies discoverable, confirmable, and satisfying to execute.

Synergy Discovery Interface

When the player has both an equipped item and a card that can synergy together, the component should indicate this possibility through subtle visual cues. The relevant card in the hand fan might have a small icon matching the equipped item. The equipped item slot might have a colored outline matching the card's color. These cues are discoverable but not intrusive—players learn to recognize them through observation.

The synergy preview displays when the player initiates either component while the other is ready. Dragging a card toward the equipped item slot triggers a "synergy detected" animation. The preview shows the combined effect: what the item does, what the card does, and what the synergy adds. The preview should be specific enough to be actionable: "Fire Upgrade: +3 damage per hit for 2 rounds" rather than vague language like "improved effect."

Synergy Execution Patterns

The system supports multiple synergy execution patterns based on how players prefer to interact:

The drag-to-combine pattern has the player drag a card onto the equipped item slot. When the card hovers over the item slot, both components highlight. Releasing the card triggers the synergy effect immediately.

The sequential activate pattern has the player tap the item, then tap the card (or vice versa). The first tap prepares the component; the second tap confirms the sequence and triggers the synergy.

The simultaneous pattern has the player tap both components within a short time window (default 300ms). The system recognizes the rapid sequence as intentional simultaneity and triggers the combined effect.

Designers can configure which execution patterns a specific synergy supports. Some synergies might require drag-to-combine for precision; others might support all three patterns for flexibility.

3.4 Combat Initialization with Pre-Applied Effects
One of the most important non-combat capabilities is initializing combat while carrying pre-applied effects. The transition from exploration to combat should feel seamless, with any pre-applied effects immediately active.

Engagement with Card Applied

When the player moves into an enemy engagement zone (approaching an enemy, entering a hostile area, or triggering a combat event), the non-combat hand fan provides a final opportunity to apply effects before combat begins. The engagement zone itself might have a "approach vector" that determines where effects should be applied for maximum impact.

The engagement interface shows pre-applied effects as icons on the player avatar. Combat start timers (brief delays before STR combat begins) allow effects like "bonus to first attack" to calculate correctly. The system ensures pre-applied effects persist through the transition and apply their modifiers correctly in the first combat round.

Card-in-Hand Combat Entry

Some effects must be held "in hand" to apply during combat—they cannot be pre-applied but are automatically activated when combat begins. The non-combat hand fan should clearly distinguish between cards that pre-apply and cards that activate on combat start. Cards with combat-start activation should have a distinctive visual indicator (perhaps a "ready" glow) that confirms their pending state.

3.5 Combat Evasion Techniques
Evasion techniques require preparation before combat and specific conditions to activate. The non-combat hand fan must support both the preparation phase and the evasion activation itself.

Pre-Combat Evasion Preparation

Evasion preparation involves applying effects that increase evasion chances or provide escape opportunities. These effects might have limited duration, creating urgency to initiate combat before they expire. The non-combat interface should display remaining duration clearly on prepared evasion effects.

The preparation interface might include "evasion routes" that the player can pre-select—paths through the map that lead to escape points. Pre-selecting a route provides bonus evasion during the extraction phase of combat. The route selection uses the grid interaction system, with the player tracing a path through safe zones.

Evasion Activation

During combat, evasion techniques can be activated through the non-combat interface (if the combat hand fan is minimized) or through specific combat interface controls. The key design requirement is consistency—evasion should feel like an extension of the preparation done in non-combat mode, not a completely different system.

Section 4: UI/UX Design Specifications
4.1 Visual Design Language
The non-combat hand fan uses a visual design language that establishes clear hierarchy, provides immediate feedback, and maintains accessibility across different viewing conditions.

Color System

The color system uses a limited palette with specific semantic meanings:

Color
RGB Values	Semantic Meaning
Primary Blue	rgb(33, 150, 243)	Player-facing actions, self-targeting
Primary Red	rgb(244, 67, 54)	Enemy targeting, dangerous actions
Primary Green	rgb(76, 175, 80)	Ground effects, environment actions
Neutral Gray	rgb(158, 158, 158)	Disabled states, unavailable actions
Warning Orange	rgb(255, 152, 0)	Cooldowns, resource costs, tradeoffs
Success Gold	rgb(255, 193, 7)	Synergies, bonus effects, completions
All interactive elements use the semantic colors consistently. A blue-tinted card targets the player; a red-tinted card targets enemies; green indicates ground effects. This color coding becomes intuitive quickly and reduces cognitive load during rapid interactions.

Typography

The typography system uses a single typeface family (system font with bold weights for emphasis) with size variations for hierarchy:

Component Title: 18px, Bold, Uppercase
Button/Item Name: 14px, Medium
Card Name: 12px, Regular
Status Text: 11px, Light
Timer/Count: 16px, Monospace
Text contrast is maximized for readability. White text on dark backgrounds; dark text on light backgrounds. No text appears smaller than 11px to ensure accessibility.

Spacing and Layout

The component uses an 8-pixel grid system for consistent spacing. Elements align to grid lines, and padding follows multiples of 4 pixels. Touch targets are minimum 44×44 pixels to ensure reliable interaction on touch devices. Spacing between interactive elements is minimum 8 pixels horizontally and 12 pixels vertically.

4.2 Animation Specifications
Animations provide feedback, guide attention, and create emotional response. The animation system must be performant (running at 60fps on target hardware) and purposeful (every animation serves a communicative purpose).

Entry/Exit Animations

Components slide in from their default positions when activating. The entry animation uses an ease-out curve over 200ms. Exit animations use an ease-in curve over 150ms. These durations feel snappy without being jarring.

Selection Animations

When a card is selected from the fan, it lifts upward (translateY: -8px over 100ms) and scales slightly (scale: 1.05). The card gains a glow effect (box-shadow with the card's semantic color). When deselected, the animations reverse smoothly.

Targeting Preview Animations

Valid target zones pulse gently when a targeting action is active. The pulse uses a sine wave with 2-second period and 15% opacity swing. Invalid targets show a rejection animation: rapid shake (translateX: ±4px over 50ms) with red tint.

Feedback Animations

Resource changes use floating number animations. Positive changes float upward (translateY: -20px over 400ms) with green color. Negative changes float downward (translateY: +20px) with red color. The numbers fade from opacity 1 to 0 over the animation duration.

4.3 Accessibility Considerations
The non-combat hand fan must be accessible to players with varying abilities. Accessibility features are integrated throughout rather than added as afterthoughts.

Touch Accessibility

All interactive elements meet minimum touch target sizes (44×44 pixels). Touch events have generous hitboxes that extend beyond visual boundaries. Multi-touch gestures are supported but not required—all functionality is accessible through single-tap interactions.

Visual Accessibility

High-contrast mode increases color saturation and contrast ratios. Text size scaling accommodates players who need larger text. Motion reduction mode reduces or eliminates animations for players sensitive to motion. Color-blind players receive additional visual cues beyond color—shapes, patterns, and labels distinguish states that color alone might confuse.

Audio Accessibility

Sound effects have visual equivalents for players with hearing impairments. Critical audio cues (combat start warnings, low resource alerts) trigger visual attention markers (screen edge flashes, notification overlays). The interface can be fully operated without audio feedback.

Section 5: Technical Implementation Specifications
5.1 Component Structure and Class Architecture
TypeScript

Copy
// Main component container
class NonCombatHandFan {
    private container: HTMLElement;
    private stateMachine: NonCombatStateMachine;
    private actionButtons: ActionButtonContainer;
    private cardFan: CardFanContainer;
    private equippedSlot: EquippedItemSlot;
    private gridPreview: GridInteractionPreview;
    private eventBus: EventBus;
    
    constructor(containerId: string, config: ComponentConfig) {
        this.container = document.getElementById(containerId);
        this.stateMachine = new NonCombatStateMachine();
        this.actionButtons = new ActionButtonContainer(this.container.querySelector('.action-buttons'));
        this.cardFan = new CardFanContainer(this.container.querySelector('.card-fan'));
        this.equippedSlot = new EquippedItemSlot(this.container.querySelector('.equipped-slot'));
        this.gridPreview = new GridInteractionPreview(this.container.querySelector('.grid-preview'));
        this.eventBus = new EventBus();
        
        this.initializeEventListeners();
        this.loadConfiguration(config);
    }
    
    private initializeEventListeners(): void {
        // Forward all child component events through the state machine
        this.actionButtons.onAction = (action) => this.handleAction(action);
        this.cardFan.onCardSelect = (card) => this.handleCardSelect(card);
        this.equippedSlot.onActivate = () => this.handleItemActivate();
        this.gridPreview.onTargetSelect = (target) => this.handleTargetSelect(target);
    }
}

// Action button container with full state management
class ActionButtonContainer {
    private buttons: Map<string, ActionButton> = new Map();
    private container: HTMLElement;
    private stateStore: StateStore;
    
    constructor(container: HTMLElement, stateStore: StateStore) {
        this.container = container;
        this.stateStore = stateStore;
    }
    
    registerButton(config: ButtonConfig): void {
        const button = new ActionButton(config, this.stateStore);
        this.buttons.set(config.buttonId, button);
        this.container.appendChild(button.render());
    }
    
    setButtonState(buttonId: string, state: ButtonState): void {
        const button = this.buttons.get(buttonId);
        if (button) {
            button.setState(state);
        }
    }
    
    handleAction(buttonId: string): void {
        const button = this.buttons.get(buttonId);
        if (button && button.canActivate()) {
            this.eventBus.emit('button:activated', { buttonId, timestamp: Date.now() });
        }
    }
}

// Card fan with drag-and-drop support
class CardFanContainer {
    private cards: Map<string, ActionCard> = new Map();
    private container: HTMLElement;
    private dragManager: DragDropManager;
    
    constructor(container: HTMLElement, dragManager: DragDropManager) {
        this.container = container;
        this.dragManager = dragManager;
    }
    
    registerCard(config: CardConfig): void {
        const card = new ActionCard(config, this.dragManager);
        this.cards.set(config.cardId, card);
        this.container.appendChild(card.render());
    }
    
    handleCardSelect(cardId: string): void {
        const card = this.cards.get(cardId);
        if (card && card.isSelectable()) {
            this.eventBus.emit('card:selected', { cardId, timestamp: Date.now() });
        }
    }
}

// Equipped item slot with synergy support
class EquippedItemSlot {
    private item: EquippedItem | null = null;
    private container: HTMLElement;
    private synergyDetector: SynergyDetector;
    
    constructor(container: HTMLElement, synergyDetector: SynergyDetector) {
        this.container = container;
        this.synergyDetector = synergyDetector;
    }
    
    equipItem(itemId: string): void {
        this.item = ItemDatabase.getItem(itemId);
        this.render();
        this.synergyDetector.scanForSynergies(this.item);
    }
    
    handleActivate(): void {
        if (!this.item) return;
        
        if (this.synergyDetector.hasActiveSynergy()) {
            this.eventBus.emit('item:synergy_ready', { 
                itemId: this.item.id,
                synergy: this.synergyDetector.getActiveSynergy() 
            });
        } else {
            this.eventBus.emit('item:activated', { itemId: this.item.id });
        }
    }
    
    showSynergyIndicator(synergy: SynergyDefinition): void {
        this.container.classList.add('synergy-active');
        this.container.querySelector('.synergy-icon').textContent = synergy.visual_indicator;
    }
}

// Grid preview with semantic zone highlighting
class GridInteractionPreview {
    private overlay: HTMLElement;
    private zoneRenderer: ZoneRenderer;
    private validZones: Set<string> = new Set();
    
    constructor(container: HTMLElement) {
        this.overlay = container;
        this.zoneRenderer = new ZoneRenderer(this.overlay);
    }
    
    setValidZones(zones: GridZone[]): void {
        this.validZones.clear();
        zones.forEach(zone => this.validZones.add(zone.zoneId));
        this.zoneRenderer.renderZones(zones);
    }
    
    clearZones(): void {
        this.validZones.clear();
        this.zoneRenderer.clear();
    }
}
5.2 State Management and Persistence
TypeScript

Copy
// Centralized state management
class NonCombatStateStore {
    private state: ComponentGlobalState = {
        playerHealth: 100,
        playerMaxHealth: 100,
        resourceCurrency: 0,
        resourceFocus: 0,
        statusEffects: [],
        activeCooldowns: new Map(),
        unlockedActions: [],
        equippedItemId: null,
        cardsInHand: []
    };
    
    private subscribers: Set<StateSubscriber> = new Set();
    
    // State mutation with validation
    modifyState(partial: Partial<ComponentGlobalState>): boolean {
        const previousState = { ...this.state };
        
        // Validate each mutation
        for (const [key, value] of Object.entries(partial)) {
            if (!this.isValidMutation(key, value)) {
                return false;
            }
        }
        
        // Apply mutations
        Object.assign(this.state, partial);
        
        // Notify subscribers
        this.subscribers.forEach(sub => sub(previousState, this.state));
        return true;
    }
    
    // Resource management with cap enforcement
    modifyResource(resourceType: ResourceType, delta: number): boolean {
        const currentValue = this.state[resourceType] as number;
        const maxValue = this.getResourceMax(resourceType);
        const minValue = this.getResourceMin(resourceType);
        
        const newValue = Math.max(minValue, Math.min(maxValue, currentValue + delta));
        return this.modifyState({ [resourceType]: newValue });
    }
    
    // Persistence for save/load
    serialize(): string {
        return JSON.stringify({
            playerHealth: this.state.playerHealth,
            resourceCurrency: this.state.resourceCurrency,
            resourceFocus: this.state.resourceFocus,
            statusEffects: this.state.statusEffects,
            activeCooldowns: Array.from(this.state.activeCooldowns.entries()),
            cardsInHand: this.state.cardsInHand
        });
    }
    
    deserialize(data: string): void {
        const parsed = JSON.parse(data);
        this.state = { ...this.state, ...parsed };
        this.notifySubscribers();
    }
}
5.3 Event System and Communication
TypeScript

Copy
// Event bus for component communication
class NonCombatEventBus {
    private handlers: Map<string, EventHandler[]> = new Map();
    private eventHistory: Event[] = [];
    private maxHistoryLength: number = 100;
    
    on(eventType: string, handler: EventHandler): void {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }
        this.handlers.get(eventType).push(handler);
    }
    
    emit(eventType: string, payload: any): void {
        const event = {
            type: eventType,
            payload,
            timestamp: Date.now()
        };
        
        this.eventHistory.push(event);
        if (this.eventHistory.length > this.maxHistoryLength) {
            this.eventHistory.shift();
        }
        
        const handlers = this.handlers.get(eventType) || [];
        handlers.forEach(handler => handler(event));
    }
    
    // Debug tools
    getEventHistory(filter?: string): Event[] {
        if (!filter) return this.eventHistory;
        return this.eventHistory.filter(e => e.type.includes(filter));
    }
}

// Common event types
const NON_COMBAT_EVENTS = {
    BUTTON_ACTIVATED: 'button:activated',
    CARD_SELECTED: 'card:selected',
    CARD_APPLIED: 'card:applied',
    ITEM_ACTIVATED: 'item:activated',
    SYNERGY_DETECTED: 'synergy:detected',
    SYNERGY_EXECUTED: 'synergy:executed',
    TARGET_SELECTED: 'target:selected',
    STATE_CHANGED: 'state:changed',
    COOLDOWN_STARTED: 'cooldown:started',
    COOLDOWN_COMPLETE: 'cooldown:complete',
    RESOURCE_CHANGED: 'resource:changed',
    STATUS_EFFECT_ADDED: 'status:added',
    STATUS_EFFECT_REMOVED: 'status:removed'
};
5.4 Integration with Existing Systems
TypeScript

Copy
// Integration layer for existing combat and game systems
class CombatSystemIntegration {
    constructor(
        private nonCombatState: NonCombatStateStore,
        private combatSystem: CombatSystem,
        private gameWorld: GameWorld
    ) {}
    
    // Apply pre-combat effects to combat start
    prepareCombatForEncounter(encounterId: string): void {
        const preAppliedEffects = this.nonCombatState.getStatusEffects()
            .filter(effect => effect.persistsIntoCombat);
        
        this.combatSystem.applyPreAppliedEffects(preAppliedEffects);
        
        // Check for engagement card usage
        const engagementCard = this.nonCombatState.getEngagementCard();
        if (engagementCard) {
            this.combatSystem.setInitialCard(engagementCard);
        }
    }
    
    // Handle combat exit with effect cleanup
    handleCombatEnd(result: CombatResult): void {
        // Persist effects that should continue after combat
        const persistentEffects = this.nonCombatState.getStatusEffects()
            .filter(effect => effect.persistsAfterCombat);
        
        // Remove effects that expire on combat end
        const expiredEffects = this.nonCombatState.getStatusEffects()
            .filter(effect => effect.expiresOnCombatEnd);
        
        expiredEffects.forEach(effect => {
            this.nonCombatState.removeStatusEffect(effect.id);
        });
        
        // Award rewards from evasion techniques if combat was avoided
        if (result.avoided) {
            this.applyEvasionRewards();
        }
    }
    
    // Sync state after game world changes
    handleWorldStateChange(change: WorldStateChange): void {
        // Update grid interaction zones based on world state
        if (change.type === 'npc_moved') {
            this.nonCombatState.updateNPCZone(change.npcId, change.newPosition);
        }
        
        if (change.type === 'environment_changed') {
            this.nonCombatState.updateEnvironmentStatus(change.newConditions);
        }
    }
}
Section 6: Designer Configuration Guide
6.1 Configuration File Structure
Designers configure the non-combat hand fan through a JSON