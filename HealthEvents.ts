import { LocalEvent, Player, Entity } from 'horizon/core';

// Event used to update the UI. `player` is optional; if present, UI will update only for that player.
export const setHealth = new LocalEvent<{ health: number; player?: Player }>('setHealth');

// Event used to tell the health manager to apply a delta in a player's health.
export const applyHealthDelta = new LocalEvent<{ player: Player; delta: number }>('applyHealthDelta');

// Request the current health for a player from the health manager.
// `requestor` is the entity that should receive the response.
export const requestHealth = new LocalEvent<{ player: Player; requestor?: Entity }>('requestHealth');

// Response from the health manager containing the current health for a player.
export const respondHealth = new LocalEvent<{ player: Player; health: number }>('respondHealth');

export default { setHealth, applyHealthDelta, requestHealth, respondHealth };
