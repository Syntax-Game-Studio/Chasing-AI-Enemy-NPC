import * as hz from 'horizon/core';
import { Vec3 } from 'horizon/core';
import { Npc, NpcPlayer } from 'horizon/npc';
import NavMeshManager, { INavMesh } from 'horizon/navmesh';

export const setFollowTarget = new hz.NetworkEvent<{ target: hz.Player | hz.Entity | null }>('setFollowTarget');

class NpcFollow extends hz.Component<typeof NpcFollow>{
  static propsDefinition = {
    npc: {type: hz.PropTypes.Entity!},
    followDistance: { type: hz.PropTypes.Number, default: 3 },
    abandonDistance: { type: hz.PropTypes.Number, default: 6 },
    useNavMesh: { type: hz.PropTypes.Boolean, default: false },
    navProfileName: { type: hz.PropTypes.String, default: "" },
    rotateToTarget: { type: hz.PropTypes.Boolean, default: true },
    rotateInPlaceThreshold: { type: hz.PropTypes.Number, default: 30 },
    useDynamicSpeed: { type: hz.PropTypes.Boolean, default: true },
    minDynamicSpeed: { type: hz.PropTypes.Number, default: 1.0 },
    maxDynamicSpeed: { type: hz.PropTypes.Number, default: 6.0 },
    dynamicSpeedSmoothFactor: { type: hz.PropTypes.Number, default: 0.1 },
    defaultSpeed: { type: hz.PropTypes.Number, default: 2.5 },
    enableLookAtTarget: { type: hz.PropTypes.Boolean, default: false },
  }

  private _isInitialized: boolean = false;

  private _navMesh?: INavMesh | null = null;
  private _npc?: Npc | null = null;
  private _npcPlayer?: NpcPlayer | null = null;
  private _npcPosition!: Vec3;
  private _isTurningInPlace: boolean = false;
  private _followTarget?: hz.Entity | hz.Player | null = null;
  private _followUrgency: number = 4.5;
  private _isAbandoned: boolean = false;


  async preStart() {
    // Initialize all components.
    this._npc = this.props.npc!.as(Npc);
    this._npcPlayer = await this._npc!.tryGetPlayer();

    if (this._npcPlayer && this._npc) {
      console.log('NpcFollow: Initialized all NPC components');
      this._isInitialized = true;
    }
    else {
      console.error('NpcFollow: Failed to initialize all NPC components');
    }

    if (this.props.useNavMesh) {
      // Initialize the navmesh
      const navMeshManager = NavMeshManager.getInstance(this.world);
      this._navMesh = await navMeshManager.getByName(this.props.navProfileName);
      if (!this._navMesh) {
        console.error("NpcFollow: Could not find a nav mesh with name: " + this.props.navProfileName);
        return;
      }
    }
    this.connectLocalBroadcastEvent(hz.World.onUpdate, data => this.update(data.deltaTime));
    this.connectNetworkBroadcastEvent(setFollowTarget, (data: {target: hz.Player | hz.Entity}) => this.setFollowTarget(data.target));
  }

  start() {
  }

  setFollowTarget(target: hz.Player | hz.Entity) {
    this._followTarget = target;
    if (target){
      console.log(`NPC now following: ${target.name.get()}.`);
    } else {
      console.log(`NPC no longer following any target.`);
    }
  }

  update(deltaTime: number) {
    if (!this._isInitialized) {
      return;
    }

    if (!this._npcPlayer) {
      console.error("NpcFollow: No NPC found");
      return;
    }

    // if no target, return
    if (!this._followTarget) {
      return;
    }

    this._npcPosition = this._npcPlayer.position.get();
    if (!this._npcPosition) {
      console.error("NpcFollow: No NPC position found");
      return;
    }

    // look at target logic (only if target is a player)
    if (this.props.enableLookAtTarget) {
      if (this._followTarget instanceof hz.Player) {
        const targetPlayerHead = this._followTarget!.head.getPosition(hz.Space.World);
        const targetPlayerEye = targetPlayerHead.add(new Vec3(0, (this._followTarget.avatarScale.get() * -0.4), 0));
        this._npcPlayer.setLookAtTarget(targetPlayerEye);
      }
      else {
        this._npcPlayer.clearLookAtTarget();
      }
    }
    else {
      this._npcPlayer.clearLookAtTarget();
    }

    const targetPos = this._followTarget.position.get();
    const npcPos : Vec3 =  this._npcPlayer.position.get();
    npcPos!.y = targetPos.y;
    const deltaVector : Vec3 = targetPos.sub(npcPos);

    // _followUrgency is a smoothed value based on distance to target.
    // Used to determine whether or not the NPC needs to follow, and if so, how fast.
    this._followUrgency = this.lerp(this._followUrgency, deltaVector.magnitude(), this.props.dynamicSpeedSmoothFactor);
    const rotationDiff = this.calculateAngleDifference(deltaVector);

    // has the NPC reached its destination? i.e. within follow distance of player, or within 0.1 of the default position
    const followThreshold =  this.props.followDistance;
    if (this._followUrgency < followThreshold) {
      // if NPC is currently moving, stop movement
      if (this._npcPlayer.isMoving.get()) {
        this._npcPlayer.stopMovement();
      }
      // NPC is already done moving
      else {
        // NPC wants to re-orient (turn in place) and isn't already turning
        if (this.props.rotateToTarget && !this._isTurningInPlace) {
          // re-orient to face player if necessary
          if (rotationDiff > this.props.rotateInPlaceThreshold) {
            this.handleRotateTo(deltaVector.normalize());
          }
        }
      }
      this._isAbandoned = false;
    }
    // NPC needs to continue moving
    else if (this._followUrgency < this.props.abandonDistance) {
      // use dynamic speed?
      if (this.props.useDynamicSpeed) {
        var movementSpeed = this._followTarget ? this._followUrgency - this.props.followDistance : this._followUrgency;
        movementSpeed = hz.clamp(movementSpeed + 1, this.props.minDynamicSpeed, this.props.maxDynamicSpeed)
      }
      else {
        var movementSpeed = this.props.defaultSpeed;
      }
      // should the NPC re-orient? make sure the NPC is moving fast enough to change movement direction or they may appear to spin in place.
      if (this.props.rotateToTarget) {
        if (movementSpeed > 0.5) {
          // this is to get the NPC to always face the player.
          // alternatively, we could use the faceMovementDirection option in moveToPosition, but it doesn't make the NPC feel like it is following with as much intent.
          this._npcPlayer.rotateTo(deltaVector.normalize(), {rotationTime: 0.1});
        }
      }
      this.goToPosition(targetPos, movementSpeed);
      this._isAbandoned = false;
    }
    // NPC is out of range of player and will give up until player is back in range
    else {
      if (!this._isAbandoned) {
        this._isAbandoned = true;
        this._npc?.conversation.speak("Hey, could you slow down a bit for me?");
      }
    }
  }

  goToPosition(targetPos: Vec3, movementSpeed: number, faceMovementDirection = false) {
    // if NavMesh enabled, get path to nearest point to target
    if (this.props.useNavMesh) {
      // this._npcPlayer!.moveToPosition(targetPos, { movementSpeed: movementSpeed });

      const nearestPoint = this._navMesh?.getNearestPoint(targetPos, 2);
      if (!nearestPoint) {
        return;
      }
      const path = this._navMesh?.getPath(this._npcPosition, nearestPoint);
      if (!path) {
        console.error("NpcFollow: No path to target found");
        return;
      }
      this._npcPlayer!.moveToPositions(path.waypoints,
      { movementSpeed : movementSpeed, faceMovementDirection: faceMovementDirection});
    }
    // if no NavMesh, attempt to move directly to target
    else {
      this._npcPlayer!.moveToPosition(targetPos, { movementSpeed: movementSpeed, faceMovementDirection: faceMovementDirection });
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

  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

}
hz.Component.register(NpcFollow);
