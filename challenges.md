Context:
I want to build a physics-based simulation game/environment (using Unity 3D or Unreal Engine) to test different tracked vehicle architectures against various terrain challenges.
Please act as an Expert Game Developer and Physics Programmer. I am using a Component-Based Architecture (like assembling LEGO Technic parts) where vehicles are built from modular prefabs. Based on the detailed descriptions below, design the architecture, write the core component scripts, outline the physics joints/colliders, and provide procedural rules for the obstacles.

PHASE 1: COMPONENT-BASED ARCHITECTURE (THE MODULES)
Please design C# classes/structs (or C++ equivalents) for the following fundamental modules. Each module must handle its own physical properties (Mass, Friction, Center of Mass, Torque).

1. Brain & Weight Module (Battery Box / Receiver)

Role: The heaviest part of the vehicle. Dictates the overall Center of Mass (CoM).

Physics: High Mass. Needs a script to allow developers to manually offset the CoM (e.g., shifting it forward for hill climbing).

Inputs: Receives player input (W, A, S, D) and distributes signals to the Motor Modules.

2. Motor Module

Role: Applies rotational force (Torque) to the tracks.

Properties: MaxMotorTorque, MaxRPM, AccelerationCurve.

Logic: Takes input from the Brain Module (value from -1 to 1) and applies angular velocity to the connected Drive Sprocket. Supports differential steering (skid steering).

3. Structural Frame Module (Chassis Beams)

Role: The rigid skeleton.

Properties: Configurable size/shape (Short, Medium, Long, Rhomboid).

Physics: Acts as the parent Rigidbody to which all wheels and joints are attached.

4. Wheel Modules (3 Types)

Type A - Drive Sprocket: Attached directly to the Motor Module. Drives the track.

Type B - Idler Wheel: Placed at the opposite end of the chassis. Needs built-in Track Tensioner logic (a spring joint pushing outwards).

Type C - Road Wheels (Bogies): Small, free-spinning wheels placed in a row at the bottom to distribute weight.

Physics: All wheels need a SuspensionDistance and SpringForce to simulate structural bending and distribute weight evenly.

5. Track System Module

Role: The continuous treads (tank tracks).

Implementation Request: Do not simulate individual physical track links (bad for performance). Instead, use a Spline-based Track System or Scrolling UV Skinned Mesh combined with a sequence of Box/Sphere Colliders or a Raycast/WheelCollider setup along the bottom edge.

Properties: TrackFriction (High static friction, moderate dynamic friction for turning).

6. Mechanical Joint Modules

Hinge Joint: Connects two frames with 1 Degree of Freedom (Pitch). Has adjustable angular limits.

Articulated Joint: Connects two frames with 2 Degrees of Freedom (Pitch and Yaw).

PHASE 2: THE 5 VEHICLE ASSEMBLIES
Using the modules from Phase 1, the system must assemble the following 5 vehicles:

Basic Tracked Vehicle

Assembly: 1 Standard Structural Frame. 1 Brain Module (centered). 2 Motors.

Tracks: 2 parallel tracks. Each side has 1 Drive Sprocket, 1 Idler, and 6 Road Wheels inline.

Characteristics: Average length, low center of gravity.

Long Track Vehicle

Assembly: 1 Extra-Long Structural Frame. 1 Brain Module. 2 Motors.

Tracks: 2 extreme-length parallel tracks covering the sides, with a high number of Road Wheels to support the long span.

Characteristics: Excellent gap-crossing ability but high turning friction.

Articulated Vehicle

Assembly: 2 Medium Structural Frames (Front and Rear) connected centrally by an Articulated Joint Module.

Tracks: 4 total track modules (2 on the Front Chassis, 2 on the Rear). Motors applied to all 4 tracks (AWD). Brain Module placed on the Front Frame.

Characteristics: Highly flexible on uneven terrain.

Dual-Pivot Vehicle

Assembly: 1 Long Central Frame acting as a bridge. At the front and rear, attach a transverse axle using Hinge Joint Modules (allowing pitch).

Tracks: 4 independent track pods (bogie style). Two attached to the front pivoting axle, two to the rear pivoting axle.

Characteristics: Track pods tilt independently to adapt to steep angles or stairs.

Mark V (Rhomboid) Vehicle

Assembly: 1 Tall, Diamond/Rhomboid-shaped Frame.

Tracks: 2 continuous tracks that wrap around the entire perimeter of the rhomboid chassis (over the top and down to the ground).

Characteristics: High profile, excellent approach/departure angles.

PHASE 3: OBSTACLES & CHALLENGES GENERATION
Create procedural generation rules or describe the collider setups to spawn the following 6 physics obstacles. Provide proper physics materials for rubber-on-plastic/wood friction.

The Gap: Two flat platforms separated by an empty void (distance slightly shorter than the "Long Track" vehicle).

Step Up: A lower platform meeting a sudden 90-degree vertical wall, leading to a higher platform. Tests vertical climbing grip.

Narrow U-Turn: A single, narrow elevated platform surrounded by a void. Vehicles must drive on, 180-degree turn in place, and drive back.

Spike Field: A sequence of tall, thin vertical poles securely planted in the ground, spaced unevenly. Vehicles drive over the top of them. Tests minimal surface grip and ground clearance.

V-Trench: A downward ramp immediately meeting an upward ramp, forming a sharp 'V'. Tests Approach/Departure angles (prevents nose/tail collisions).

High Centering Peak: A flat path with a solid pyramid block dead in the center, tall enough to hit the belly of the chassis, suspending the tracks in the air.

PHASE 4: TASKS & DELIVERABLES FOR THE AI AGENT
Please provide the following scripts and technical breakdowns:

VehicleAssembler.cs: A script/manager that takes a configuration (like JSON or predefined classes) of the modules in Phase 1 and automatically builds the Rigidbody/Joint hierarchy at runtime for the 5 vehicles in Phase 2.

MotorModule.cs & VehicleController.cs: The logic to apply torque to the Drive Sprockets based on WASD input (handling Differential/Skid Steering).

Track Physics Setup Guide: Write the architecture plan for the Track System Module. Explain specifically how to set up the colliders/friction (WheelColliders vs. Raycasts) so the vehicles don't glitch through sharp corners like the Step Up and can balance on the Spike Field.

Joint Configuration: Explain exactly how to configure the physics joints (e.g., Unity's ConfigurableJoint) to create the Dual-Pivot and Articulated mechanisms without causing physics jitter/explosions.