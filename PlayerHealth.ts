import * as hz from 'horizon/core';
import { Component, PropTypes, Player } from 'horizon/core';
import { setHealth, requestHealth, respondHealth } from './HealthEvents';
import { applyHealthDelta } from './HealthEvents';

class PlayerHealth extends Component<typeof PlayerHealth> {
  static propsDefinition = {
    // The UI Gizmo entity which has the HealthBarUI component attached
    target: { type: PropTypes.Entity },
    // Optional starting health value (defaults to 100)
    startingHealth: { type: PropTypes.Number, default: 100 },
    // Optional simulation for test purposes (send damage every `simulateIntervalMs` milliseconds)
    simulateIntervalMs: { type: PropTypes.Number, default: 0 },
    // Spawn point entity where we will teleport players upon death
    spawnPoint: { type: PropTypes.Entity },
    // Time in ms to wait before respawn after death
    respawnDelayMs: { type: PropTypes.Number, default: 2000 },
    // Health to set for player on respawn
    respawnHealth: { type: PropTypes.Number, default: 100 },
  };

  private globalHealth!: number;
  private simulateIntervalId?: number;
  private healthByPlayer = new Map<Player, number>();
  private isDeadByPlayer = new Map<Player, boolean>();
  private respawnTimeouts = new Map<Player, number>();

  start() {
    // Initialize global health from props (used only for global UI updates / defaults)
    this.globalHealth = this.props.startingHealth ?? 100;

    // Immediately tell the UI the initial health so it can render correctly
    if (this.props.target) {
      // Send a global UI initial health value (no player specified)
      this.sendLocalEvent(this.props.target, setHealth, { health: this.globalHealth });
      console.log('[PlayerHealth] start: sent initial global health to target', this.props.target.id, this.globalHealth);
    } else {
      console.warn('[PlayerHealth] start: no target UI entity set; health will not be displayed until you set `target` in the inspector.');
    }

    // Log spawn point status for debugging
    if (this.props.spawnPoint) {
      try {
        console.log('[PlayerHealth] start: spawnPoint set to', this.props.spawnPoint.id, this.props.spawnPoint.toString());
      } catch (e) {
        console.log('[PlayerHealth] start: spawnPoint set but toString threw', e);
      }
    } else {
      console.log('[PlayerHealth] start: spawnPoint not configured');
    }

    // Optional: simple simulation for test purposes — decrease health over time.
    const ms = this.props.simulateIntervalMs ?? 0;
    if (ms > 0) {
      // If a simulate interval is provided, just pick an example player or target players, here we affect the first player we track.
      this.simulateIntervalId = this.async.setInterval(() => {
        // Choose any tracked player for simulation or stop if none
        const players = Array.from(this.healthByPlayer.keys());
        if (players.length > 0) {
          const player = players[0];
          this.applyHealthDeltaForPlayer(player, -7);
        }
      }, ms) as unknown as number;
    }

    // Listen for applyHealthDelta so other entities (Health/Damage) can affect health
    this.connectLocalEvent(this.entity, applyHealthDelta, (data) => {
      this.applyHealthDeltaForPlayer(data.player, data.delta);
    });

    // Listen for health requests from other entities (e.g., consumable items)
    this.connectLocalEvent(this.entity, requestHealth, (data) => {
      try {
        const health = this.getHealthForPlayer(data.player);
        if (data.requestor) {
          this.sendLocalEvent(data.requestor, respondHealth, { player: data.player, health });
        }
      } catch (e) {
        console.warn('[PlayerHealth] requestHealth handler error', e);
      }
    });

    // When a player enters the world, initialize their health and send UI update
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterWorld, (player: Player) => {
      this.healthByPlayer.set(player, this.props.startingHealth ?? 100);
      this.isDeadByPlayer.set(player, false);
      if (this.props.target) {
        this.sendLocalEvent(this.props.target, setHealth, { health: this.getHealthForPlayer(player), player });
      }
      console.log('[PlayerHealth] OnPlayerEnterWorld initialized health for player', player.id, this.getHealthForPlayer(player));
    });

    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerExitWorld, (player: Player) => {
      this.healthByPlayer.delete(player);
      this.isDeadByPlayer.delete(player);
      const timeoutId = this.respawnTimeouts.get(player);
      if (timeoutId) {
        this.async.clearTimeout(timeoutId);
        this.respawnTimeouts.delete(player);
      }
      console.log('[PlayerHealth] OnPlayerExitWorld cleaned up player data', player.id);
    });
  }

  // Clean up intervals when the component stops (or world unloads)
  stop() {
    if (this.simulateIntervalId) {
      this.async.clearInterval(this.simulateIntervalId);
      this.simulateIntervalId = undefined;
    }
  }

  // Set global health (affects default UI for players w/out per-player override)
  setGlobalHealth(value: number) {
    this.globalHealth = Math.max(0, Math.min(100, Math.round(value)));
    console.log('[PlayerHealth] setGlobalHealth', this.globalHealth);
    if (this.props.target) {
      this.sendLocalEvent(this.props.target, setHealth, { health: this.globalHealth });
    }
  }

  // Player-specific helpers
  getHealthForPlayer(player: Player) {
    return this.healthByPlayer.get(player) ?? this.props.startingHealth ?? 100;
  }

  setHealthForPlayer(player: Player, value: number) {
    const newHealth = Math.max(0, Math.min(100, Math.round(value)));
    this.healthByPlayer.set(player, newHealth);
    console.log('[PlayerHealth] setHealthForPlayer', player.id, newHealth);
    if (this.props.target) {
      this.sendLocalEvent(this.props.target, setHealth, { health: newHealth, player });
    }
  }

  // Convenience helper for damage & heal
  // Convenience helper for damage & heal for the global manager: affects all players or optional specific
  takeDamageForAll(amount: number) {
    // Apply damage to any tracked player
    for (const player of Array.from(this.healthByPlayer.keys())) {
      this.applyHealthDeltaForPlayer(player, -Math.abs(amount));
    }
  }

  heal(amount: number) {
    this.setGlobalHealth(this.globalHealth + Math.abs(amount));
  }

  applyHealthDeltaForPlayer(player: Player, delta: number) {
    const current = this.getHealthForPlayer(player);
    const newValue = Math.max(0, Math.min(100, current + delta));
    this.setHealthForPlayer(player, newValue);
    // If health reached 0, start respawn
    if (newValue <= 0) {
      if (!this.isDeadByPlayer.get(player)) {
        this.isDeadByPlayer.set(player, true);
        console.log('[PlayerHealth] player died', player.id);
        const delay = this.props.respawnDelayMs ?? 2000;
        const timeoutId = this.async.setTimeout(() => {
          // Ensure player is still valid before respawn
          if (!(player as any).isValidReference || !(player as any).isValidReference.get || (player as any).isValidReference.get() === false) {
            console.log('[PlayerHealth] respawn aborted, player invalid or disconnected', player.id);
            return;
          }
          this.respawnPlayer(player);
        }, delay) as unknown as number;
        this.respawnTimeouts.set(player, timeoutId);
      }
    } else {
      // If the player was previously dead and healed some amount, clear dead state
      if (this.isDeadByPlayer.get(player)) {
        this.isDeadByPlayer.set(player, false);
        const existingTimeout = this.respawnTimeouts.get(player);
        if (existingTimeout) {
          this.async.clearTimeout(existingTimeout);
          this.respawnTimeouts.delete(player);
        }
      }
    }
  }

  respawnPlayer(player: Player) {
    const spawnEntity = this.props.spawnPoint;
    if (!spawnEntity) {
      console.warn('[PlayerHealth] respawn requested but no spawnPoint set');
      return;
    }

    // Try to use the SpawnPointGizmo teleport API (preferred)
    try {
      spawnEntity.as(hz.SpawnPointGizmo).teleportPlayer(player);
      console.log('[PlayerHealth] respawnPlayer: player teleported via spawnPoint.teleportPlayer', player.id);
    } catch (e) {
      // Fallback: try to copy position from spawnEntity to player
      console.warn('[PlayerHealth] spawnPoint.teleportPlayer failed; attempting position fallback', e);
      try {
        const spawnPos = (spawnEntity as any).position?.get?.();
        if (spawnPos) {
          if ((player as any).position && typeof (player as any).position.set === 'function') {
            (player as any).position.set(spawnPos);
            console.log('[PlayerHealth] respawnPlayer: player.position.set used as fallback', player.id);
          } else if ((player as any).entity && (player as any).entity.position && typeof (player as any).entity.position.set === 'function') {
            (player as any).entity.position.set(spawnPos);
            console.log('[PlayerHealth] respawnPlayer: player.entity.position.set used as fallback', player.id);
          } else {
            console.warn('[PlayerHealth] respawnPlayer: failed to set player position during fallback', player.id);
          }
        } else {
          console.warn('[PlayerHealth] respawnPlayer: spawnPoint has no position to fallback to', spawnEntity.id);
        }
      } catch (ee) {
        console.warn('[PlayerHealth] respawnPlayer: fallback set position failed', ee);
      }
    }

    // Reset player's health to respawnHealth and clear death state
    const respawnValue = this.props.respawnHealth ?? 100;
    this.setHealthForPlayer(player, respawnValue);
    this.isDeadByPlayer.set(player, false);
  }
}

Component.register(PlayerHealth);

export default PlayerHealth;