# Chasing-AI-Enemy-NPC
This is a repository to help developers in the MHCP setup an AI enemy that follows/chases the player as well as deal damage. This game mechanic was created by using the "Following Alien (NPC Sample)" along with Meta's generative AI and Visual Code Studio's Copilot

// Setting up the Health, Damage, and Respawn System //

1. Place a CustomUI gizmo in your world. Then attach the HealthBarUI.ts script to the gizmo. *Rename the CustomUI gizmo for better organization

2. Add an Empty Object to your world and name it something like “HealthManager”

3. Attach the PlayerHealth.ts file to your HealthManager (empty object). In the properties panel, set up your health and spawn settings.

Your “target” will be your HealthBarUI. Explanation: you want this data to display on your CustomUI gizmo. “StartingHealth” is self explanatory. In most games, players have a max health of 100. We’ll be using 100 for our starting health in this tutorial. *If you want to make things more difficult for the player, you can set this to be a lower value. 

The “simulateIntervalMS” is for debugging purposes. This property decreases the player's health by a certain amount over a set interval. We’ll leave this at 0.
The “spawn point” property is where the player will respawn. This will ALWAYS be a SpawnPoint gizmo! You can use the default spawn point (that appears when you first create a new world) or any others that you may add to your world.

The “respawn delay ms” is a property that sets the amount of time it takes for the player to respawn after their health is depleted. Leave this at 0 to prevent any gameplay or script errors later in game development.

The last property, “respawn health” decides what the player’s health will be after they respawn. For this tutorial, we’ll just set this to the starting health value: 100.
Now that we’re done setting up the PlayerHealth.ts properties, we can finish up with the HealthManager. Add the HealthEvents.ts to your world. Once added, click the three vertical dots next to the script and then click “Spawn new gizmo”. Add this script as a child to the HealthManager.

We’ve now set up the basics of the health, damage, and respawn system! Now we go into MORE detail.The player will need something to replenish their health. For this tutorial, we’ll use a simple first aid kit asset. 

4. Attach the HealthPackItem.ts script to your consumable (first aid kit). This script will create properties for you to edit in the properties panel.

Set the “target” to HealthManager. “Delta” is the amount of health that wil be added or subtracted from the player’s health. Since this is a first aid kit, we’ll just input the number 10. *If you wanted an item to take health from the player, you would set this to be a negative number*

The “gulp sound” property is more geared towards a game I was working on. But this property allows you to set a sound that plays when the player uses or consumes the item (first aid kit). If you plan to use this property, make sure you add the sound to your world. Organizing all your sounds under an empty object (name it sounds) will save you many headaches.

Lastly, set the “item entity” property to whatever asset you’re using. In this case, itll be the first aid kit. This completes the basic setup for the health mechanic. Before moving on, it is HIGHLY recommended to change a few properties of your asset. The asset needs to be an actual consumable, so mark it as “interactive”. Turning this setting on shows more properties for you to set up.

You can either make the object “grabbable” or “grabbable with physics”. Physics will enable gravity on the object so that it falls to ground when “dropped” instead of floats in place.
-->Disable physics while grabbed
-->Enable gravity
-->Use VR Grab Anchor
-->Use Per Hand Grab Anchor
**Play with these settings to get the player to pick up the item a certain way. If the posing doesn't really matter, you don't have to edit any of these values (x,y,z positioning and rotations)**

-->Set your Avatar Pose to CarryLight or default (based on your preferences)
-->Set your primary and secondary icons. For this tutorial, the primary icon should be “use” or “consume” and the secondary should be “drop”.
-->Lastly, enable throwing (for web and mobile)



// Setting up the NPC Gizmo as an Enemy //

1. Drag and drop an NPC gizmo into your world and name it (for organizational reasons). **It is advised not to fully customize your NPC until you're done setting up this game mechanic. Sometimes the gizmo is finicky and will reset your NPC**

2. Change your NPC’s conversation property to AI to avoid errors firing in the console. Running from an NPC that you can actually talk to is fun, but this is completely optional. *This error will not break the system, but it can be agitating to those that like to keep a clean a console*

3. Now add the EnemyNpc.ts script to your world and attach it to your NPC gizmo. This script will create properties that we’ll edit in a second.

4. Drag and drop a trigger volume gizmo onto your NPC. Make sure the trigger is covering your NPC from head to toe. Once you’ve scaled the trigger, duplicate it twice (ctrl + d). You should now have three triggers that sit over the NPC. Select all three triggers (in the hierarchy) and make them children of your NPC.

5. Now we need to name the triggers. Not just for organization, but in order to correctly configure the properties that our scripts create. They should be named: FollowTrigger, SpeakTrigger, and DamageTrigger. These triggers will move with your NPC allowing the player to interact with them while they’re being chased/followed.

Now we can edit the properties of our EnermyNpc.ts script (attached to the NPC). The properties of the script ask for the follow trigger, speak trigger, and damage trigger. Set these up correctly.

6. Now, create an empty object and name it “FollowScript”. Then add it as a child of the NPC. This empty object will hold the NpcFollow.ts script for us.

Now let's set up the properties! For the “npc” property, add the NPC that you’re using. Since this is meant to be an enemy that chases the player, set the “follow distance” to 1 and “abandon distance” to a high number like 20. This ensures that the NPC doesn’t linger behind the player in a friendly manner, but “chases” the player relentlessly. 
A lot of the properties here don't need to be changed for this specific setup, so we’ll skip to “rotate to target” and enable it. Right beneath it is the “rotate in place threshold”. Set this to 30.

Now, enable “use dynamic speed” to make the NPC behave more “human-like”. Set the “min speed” to 1 and the “max speed” to at least 5. *The player’s default speed (found in the SpawnPoint gizmo’s properties) is 4.50* For this tutorial, im gonna set the max speed to 8…just cause

Leave the “dynamic speed smooth factor” at 0.1 and then set the “default speed” to 3 (for this tutorial). Lastly, enable “look at target” so that the NPC looks at the player.

7. Now, click on your DamageTrigger in the hierarchy. This is where the script that deals damage will be attached. Attach the HealthPackNpc.ts script to the trigger and set up the properties.

-->Set the “target” to HealthManager and the “delta” to a negative number. Remember that “delta” is the amount that is added to or subtracted from the player’s health. For this tutorial, ill be using -10.
   
-->You have the option to add a sound that plays when the player takes damage. You can leave this blank, search through the public assets, generate sound with Meta’s gen ai or visit a third party site
I recommend using MyInstants.com or SoundTrap.com



// Completion //

That completes the setup/tutorial! Playtest and make any tweaks needed to get your game working the way YOU want. There are a few scripts in this repository that are virtually the same. These were duplicated and renamed to avoid future script issues/errors later in game development (this system can be built upon). Using NavMeshes will significantly improve the AI’s pathfinding abilities. Check out Meta’s NavMesh documentation for more info…because that's hard and I'm STILL learning how to properly set up pathfinding myself. 
