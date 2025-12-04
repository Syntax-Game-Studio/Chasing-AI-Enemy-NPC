import * as hz from 'horizon/core';
import { CodeBlockEvents, Component, Entity, Player, PropTypes } from 'horizon/core';
import { applyHealthDelta, requestHealth, respondHealth } from './HealthEvents';

/**
 * HealthPack component — upgraded to support pick-up-and-drink consumables.
 * Behavior:
 * - Player picks up the item (grab).
 * - While holding, pressing the index/primary trigger will "drink" the item.
 * - The component queries the health manager; if player's health < 100, it
 *   applies the configured `delta`, plays the `gulpSound` (if provided), and
 *   disables/hides the item so it cannot be reused.
 */
class HealthPack extends Component<typeof HealthPack> {
  static propsDefinition = {
    // The player health manager entity (usually the PlayerHealth component's entity)
    target: { type: PropTypes.Entity },
    // Heal amount (positive) or damage (negative). Default is +25.
    delta: { type: PropTypes.Number, default: 25 },
    // Optional entity containing a gulp sound (Audio source). If provided, we attempt to play it.
    gulpSound: { type: PropTypes.Entity },
    // Optional: visual entity to hide when consumed. Defaults to this.entity.
    itemEntity: { type: PropTypes.Entity },
  };

  private consumed = false;
  private heldByPlayerId?: number;
  private pendingRequests = new Set<number>();

  preStart() {
    // Trigger-based pickup (legacy) — still supported
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterTrigger, this.OnPlayerEnterTrigger.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnEntityEnterTrigger, this.OnEntityEnterTrigger.bind(this));

    // Grab events to detect when a player is holding this item
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnGrabStart, (isRight: boolean, player: Player) => {
      try {
        this.heldByPlayerId = player?.id;
      } catch (e) {
        this.heldByPlayerId = undefined;
      }
    });
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnGrabEnd, (player: Player) => {
      try {
        if (this.heldByPlayerId === player?.id) this.heldByPlayerId = undefined;
      } catch (e) {
        this.heldByPlayerId = undefined;
      }
    });

    // When the player presses the index trigger (primary action) while interacting with this entity
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnIndexTriggerDown, (player: Player) => {
      // Only allow consumption if the player is the one currently holding this item
      if (this.consumed) return;
      if (this.heldByPlayerId && player && this.heldByPlayerId === player.id) {
        this.attemptConsume(player);
      }
    });

    // Listen for health manager responses to our health queries
    this.connectLocalEvent(this.entity, respondHealth, (data: { player: Player; health: number }) => {
      this.handleHealthResponse(data.player, data.health);
    });
  }

  start() {}

  // Legacy trigger-based consumption (keeps backwards compatibility)
  OnPlayerEnterTrigger(player: Player) {
    if (this.consumed) return;
    console.log(`[HealthPack] Player ${player.name.get()} entered trigger.`);
    this.attemptConsume(player);
  }

  OnEntityEnterTrigger(entity: Entity) {
    console.log(`Entity ${entity.name.get()} entered trigger`);
  }

  // Begin the consume flow by requesting current health from the manager
  private attemptConsume(player: Player) {
    if (!this.props.target) {
      console.warn('[HealthPack] no target manager set on props. Add the PlayerHealth entity to `target`.');
      return;
    }
    const pid = player.id;
    // track pending request so response is correlated
    this.pendingRequests.add(pid);
    this.sendLocalEvent(this.props.target, requestHealth, { player, requestor: this.entity });
  }

  private handleHealthResponse(player: Player, health: number) {
    if (this.consumed) return;
    const pid = player.id;
    if (!this.pendingRequests.has(pid)) return;
    this.pendingRequests.delete(pid);

    if (health >= 100) {
      console.log('[HealthPack] player at full health; not consuming item for', pid);
      return;
    }

    // Play gulp sound if available
    if (this.props.gulpSound) {
      this.tryPlaySound(this.props.gulpSound);
    }

    // Apply health delta via manager
    if (this.props.target) {
      this.sendLocalEvent(this.props.target, applyHealthDelta, { player, delta: this.props.delta });
    }

    // Disable / hide the item so it cannot be reused
    this.disableItemAndTrigger();
    this.consumed = true;
    console.log('[HealthPack] consumed by player', pid);
  }

  private tryPlaySound(ent?: Entity) {
    if (!ent) return;
    const eAny = ent as any;
    try {
      // If the entity exposes a direct play method, try it first
      if (typeof eAny.play === 'function') { eAny.play(); return; }
      if (typeof eAny.playOnce === 'function') { eAny.playOnce(); return; }
      if (typeof eAny.playOneShot === 'function') { eAny.playOneShot(); return; }
      if (typeof eAny.playSound === 'function') { eAny.playSound(); return; }

      // Preferred: use the AudioGizmo API
      try {
        const audioGizmo = eAny.as ? eAny.as(hz.AudioGizmo) : null;
        if (audioGizmo && typeof audioGizmo.play === 'function') { audioGizmo.play(); return; }
      } catch (err) {
        // ignore
      }
    } catch (e) {
      console.warn('[HealthPack] sound play failed', e);
    }
  }

  private disableItemAndTrigger() {
    try {
      const itemEnt = this.props.itemEntity ?? this.entity;
      if (itemEnt) {
        if ((itemEnt as any).visible && typeof (itemEnt as any).visible.set === 'function') (itemEnt as any).visible.set(false);
        if ((itemEnt as any).collidable && typeof (itemEnt as any).collidable.set === 'function') (itemEnt as any).collidable.set(false);
        if ((itemEnt as any).simulated && typeof (itemEnt as any).simulated.set === 'function') (itemEnt as any).simulated.set(false);
        if ((itemEnt as any).enabled && typeof (itemEnt as any).enabled.set === 'function') {
          try { (itemEnt as any).enabled.set(false); } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('[HealthPack] failed to hide item entity', e);
    }

    try {
      const trig = this.entity; // assume trigger is the same as entity for grab-use items
      if (trig) {
        if ((trig as any).visible && typeof (trig as any).visible.set === 'function') (trig as any).visible.set(false);
        if ((trig as any).collidable && typeof (trig as any).collidable.set === 'function') (trig as any).collidable.set(false);
        if ((trig as any).simulated && typeof (trig as any).simulated.set === 'function') (trig as any).simulated.set(false);
        if ((trig as any).enabled && typeof (trig as any).enabled.set === 'function') {
          try { (trig as any).enabled.set(false); } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('[HealthPack] failed to disable trigger entity', e);
    }
  }
}

Component.register(HealthPack);