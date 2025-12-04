import { Component, Color, LocalEvent, Player } from 'horizon/core';
import { UIComponent, View, Text, Binding } from 'horizon/ui';
import { setHealth as setHealthEvent } from './HealthEvents';

// Event to update the health value
// Event to update the health value (imported from HealthEvents)
export const setHealth = setHealthEvent;

class HealthBarUI extends UIComponent<typeof HealthBarUI> {
  static propsDefinition = {};

  // Set the size of the UI panel
  panelWidth = 500;
  panelHeight = 50;

  // Create a binding for health, initialized to 100
  health = new Binding<number>(100);

  override preStart() {
    // Listen for the setHealth event to update the health value
    console.log('[HealthBarUI] preStart: mounting health bar UI for entity', this.entity?.id);
    console.log('[HealthBarUI] initial health value: (shown by UI binding default)');

    this.connectLocalEvent(this.entity, setHealth, (data) => {
      // Clamp health value between 0 and 100
      const newHealth = Math.max(0, Math.min(100, data.health));
      if (data.player) {
        // Set a player-specific binding when a player is specified on the event
        this.health.set(newHealth, [data.player]);
      } else {
        this.health.set(newHealth);
      }
      console.log(`[HealthBarUI] received setHealth event, new value: ${newHealth}`);
    });

    // Quick debug: uncomment to test the UI quickly in editor
    // this.sendLocalEvent(this.entity, setHealth, {health: 42});
  }

  override start() {
    // Log that the UI started and show panel dimensions
    console.log('[HealthBarUI] start: panelWidth, panelHeight', this.panelWidth, this.panelHeight);
  }

  initializeUI() {
    console.log('[HealthBarUI] initializeUI() - building UI');
    // The main container for the health bar with a black border
    return View({
      children: [
        // The inner red bar that represents the current health
        View({
          style: {
            // The width is derived from the health binding, scaling from 0 to 100%
            width: this.health.derive((h) => `${h}%`),
            height: '100%',
            backgroundColor: Color.red,
          },
        }),
        // Text label to show the current numeric health percentage for debugging
        Text({
          text: this.health.derive((h) => `${Math.round(h)}%`),
          style: {
            // Align to the right using auto margin so it doesn't rely on absolute positioning
            marginLeft: 'auto',
            right: 8,
            color: Color.white,
            fontSize: 14,
          },
        }),
      ],
      style: {
        // Make sure the bar sits at the top of the screen and covers the screen width
        top: 0,
        left: 0,
        width: '100%',
        height: this.panelHeight,
        zIndex: 9999,
        padding: 6,
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent background
        borderWidth: 2,
        borderColor: Color.black,
        borderRadius: 5,
      },
    });
  }
}

Component.register(HealthBarUI);