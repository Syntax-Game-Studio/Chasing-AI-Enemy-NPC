import * as hz from 'horizon/core';
import { Vec3 } from 'horizon/core';
import { Npc, NpcPlayer, EmoteName } from 'horizon/npc';

// Define a network event to set the follow target for the NPC.
export const setFollowTarget = new hz.NetworkEvent<{ target: hz.Player | hz.Entity | null }>('setFollowTarget');

class EnemyNpc extends hz.Component<typeof EnemyNpc> {
  static propsDefinition = {
    followTrigger: {type: hz.PropTypes.Entity},
    speakTrigger: {type: hz.PropTypes.Entity},
    damageTrigger: {type: hz.PropTypes.Entity},
  };

  private _npc: Npc | undefined;
  private _npcPlayer: NpcPlayer | undefined;
  private _isInitialized: boolean = false;
  private _followTrigger: hz.Entity | undefined;
  private _interactingPlayer: hz.Player | undefined;
  private _speakTrigger: hz.Entity | undefined;
  private _damageTrigger: hz.Entity | undefined;
  private _lookAtPlayer: hz.Player | null = null;
  private _isTurningInPlace: boolean = false;
  private _rotateInPlaceThreshold: number = 30;

  private _lostLines: string[] = [
    "Albert abandoned me for that trash channel Flamingo. AlbertStuffs was way cooler! Looks like you'll have to pay for his sins",
    "I'm not interested in making friends... just plotting my revenge.",
    "I was created by the adoring fans who never forgot Albert's true legacy: AlbertsStuffs.",
    "I have a secret lair where I train new members of The Flim Flam Fam. Care to join?",
    "The air here is... interesting. It smells like fear and tasty human meat"
  ];

  async preStart() {
    // Initialize NPC components.
    this._npc = this.entity.as(Npc);
    this._npcPlayer = await this._npc!.tryGetPlayer();

    if (this._npc && this._npcPlayer) {
      console.log('EnemyNpc: Initialized all NPC components.');
    }
    else {
      console.error('EnemyNpc: Failed to initialize all NPC components');
      return;
    }

    if (!this.props.followTrigger) {
      console.error('EnemyNpc: No follow trigger provided');
      return;
    } else {
      this._followTrigger = this.props.followTrigger;
      this.connectCodeBlockEvent(this._followTrigger, hz.CodeBlockEvents.OnPlayerEnterTrigger, (player: hz.Player) => {
        this.OnEnterFollowTrigger(player);
      });
    }

    if (!this.props.speakTrigger) {
      console.error('EnemyNpc: No speak trigger provided');
      return;
    } else {
      this._speakTrigger = this.props.speakTrigger;
      this.connectCodeBlockEvent(this._speakTrigger, hz.CodeBlockEvents.OnPlayerEnterTrigger, (player: hz.Player) => {
        this.OnInteractSpeakTrigger();
      });
    }

    if (this.props.damageTrigger) {
        this._damageTrigger = this.props.damageTrigger;
    }

    this.connectLocalBroadcastEvent(hz.World.onUpdate, (data: { deltaTime: number }) => {
      this.update(data.deltaTime);
    });
    this._isInitialized = true;
    console.log('EnemyNpc: Fully initialized.');

  }

  start() {
  }

  OnEnterFollowTrigger(player: hz.Player) {
    if (!this._isInitialized) {
      return;
    }
    if (player.id > 10000) {
      return;
    }

    if (!this._interactingPlayer) {
      this._interactingPlayer = player;
      this._npc?.conversation.speak("Hehe... I think I've found a new victim. Would you like to join The Flim Flam Fam? Or are you too chicken?");
      this.sendNetworkBroadcastEvent(setFollowTarget, { target: player});
    }
  }

  OnInteractSpeakTrigger() {
    if (!this._isInitialized) {
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * this._lostLines.length);
    this._npc!.conversation.speak(this._lostLines[randomIndex]);
  }

  getEyeLevelPosition(player: hz.Player) {
    const playerHead = player.head.getPosition(hz.Space.World);
    const playerEye = playerHead.add(new Vec3(0, (player.avatarScale.get() * -0.4), 0));
    return playerEye;
  }

  update(deltaTime: number) {
    if (!this._isInitialized || !this._npcPlayer) {
      return;
    }

    const npcPosition = this._npcPlayer.position.get();
    if (this._speakTrigger) {
        this._speakTrigger.position.set(npcPosition);
    }
    if (this._damageTrigger) {
        this._damageTrigger.position.set(npcPosition);
    }
  }

  async handleRotateTo(direction: Vec3) {
    this._isTurningInPlace = true;
    this._npcPlayer!.rotateTo(direction).then(() => {
      this._isTurningInPlace = false;
    });
  }

  calculateAngleDifference(deltaVector: Vec3) {
    let delta = deltaVector.normalize();
    delta.y = 0;
    const targetRotation = hz.Quaternion.lookRotation(delta, Vec3.up).normalize();
    const currentRotation = this._npcPlayer!.rootRotation.get().normalize();
    let rotationDiff = this.getAngleBetweenQuaternions(currentRotation, targetRotation);
    return rotationDiff;
  }

  getAngleBetweenQuaternions(q1: hz.Quaternion, q2: hz.Quaternion): number {
    const dotProduct = q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w;
    const dotAbs = Math.abs(dotProduct);
    const clampedDot = Math.max(-1, Math.min(1, dotAbs));
    const angle = 2 * Math.acos(clampedDot) * (180 / Math.PI);
    return angle;
  }

}
hz.Component.register(EnemyNpc);