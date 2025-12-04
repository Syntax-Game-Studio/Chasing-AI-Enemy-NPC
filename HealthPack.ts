import * as hz from 'horizon/core';
import { CodeBlockEvents, Component, Entity, Player, PropTypes } from 'horizon/core';
import { applyHealthDelta } from './HealthEvents';

class HealthPack extends Component<typeof HealthPack>{
  static propsDefinition = {
    target: { type: PropTypes.Entity },
    // Delta can be positive (heal) or negative (damage). Default is +25 (for Health packs).
    delta: { type: PropTypes.Number, default: 25 },
    // Optional sound entity to play when this pack deals damage (delta < 0)
    damageSound: { type: PropTypes.Entity },
  };

  tryPlaySound(ent?: Entity): void {
    if (!ent) return;
    const eAny = ent as any;
    try {
      // Prefer AudioGizmo when available
      if (eAny.as) {
        try {
          const audioGizmo = eAny.as(hz.AudioGizmo);
          if (audioGizmo && typeof audioGizmo.play === 'function') { audioGizmo.play(); return; }
        } catch (err) {
          // ignore
        }
      }
      // Fallback to direct play methods if present
      if (typeof eAny.play === 'function') { eAny.play(); return; }
      if (typeof eAny.playOnce === 'function') { eAny.playOnce(); return; }
    } catch (err) {
      console.warn('[HealthPack] sound play failed', err);
    }
  }

  preStart() {
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterTrigger, this.OnPlayerEnterTrigger.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnEntityEnterTrigger, this.OnEntityEnterTrigger.bind(this));
  }

  start() {

  }

  OnPlayerEnterTrigger(player: Player) {
    // Add code here that you want to run when a player enters the trigger.
    // For more details and examples go to:
    // https://developers.meta.com/horizon-worlds/learn/documentation/code-blocks-and-gizmos/use-the-trigger-zone
    console.log(`Player ${player.name.get()} entered trigger.`);
    if (!this.props.target) {
      console.warn('[HealthPack] no target manager set on props. Add the HealthManager entity to the `target` property.');
      return;
    }
    // Send an applyHealthDelta event for this player to the health manager
    this.sendLocalEvent(this.props.target, applyHealthDelta, { player, delta: this.props.delta });
    // If this pack deals damage (negative delta), optionally play a sound
    try {
      if (this.props.delta < 0 && this.props.damageSound) {
        this.tryPlaySound(this.props.damageSound);
      }
    } catch (e) {
      console.warn('[HealthPack] failed to play damage sound', e);
    }
  }

  OnEntityEnterTrigger(entity: Entity) {
    // Add code here that you want to run when an entity enters the trigger.
    // The entity will need to have a Gameplay Tag that matches the tag your
    // trigger is configured to detect.
    console.log(`Entity ${entity.name.get()} entered trigger`);
  }
}
Component.register(HealthPack);