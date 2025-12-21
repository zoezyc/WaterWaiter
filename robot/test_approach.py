import asyncio
import os
from viam.robot.client import RobotClient
from viam.components.base import Base
from viam.services.vision import VisionClient

# Configuration
robot_api_key = os.getenv('ROBOT_API_KEY') or 'yd72j9kz3xa14myw6fs82twioqxorg8e'
robot_api_key_id = os.getenv('ROBOT_API_KEY_ID') or '5520951f-42f1-443e-bb0e-cd06b4f72b60'
robot_address = os.getenv("ROBOT_ADDRESS") or "tipsy-main.4cku3fgpss.viam.cloud"
base_name = os.getenv("ROBOT_BASE") or "tipsy-base"
camera_name = os.getenv("ROBOT_CAMERA") or "cam"
detector_name = os.getenv("ROBOT_DETECTOR") or "myPeopleDetector"

# Use reasonable defaults if env vars are crazy high
# Velocity is likely degrees/sec or mm/sec
pause_interval = os.getenv("PAUSE_INTERVAL") or 3
move_velocity = int(os.getenv("ROBOT_MOVE_VELOCITY") or 400) 
spin_velocity = int(os.getenv("ROBOT_SPIN_VELOCITY") or 100) # 100 deg/s is a reasonable turn speed

if isinstance(pause_interval, str):
    pause_interval = int(pause_interval)

async def connect():
    opts = RobotClient.Options.with_api_key(
      api_key=robot_api_key,
      api_key_id=robot_api_key_id
    )
    return await RobotClient.at_address(robot_address, opts)

async def person_detect(detector: VisionClient, base: Base):
    print("Starting autonomous approach test loop...")
    print(f"Parameters: Move Vel={move_velocity}, Spin Vel={spin_velocity}, Pause={pause_interval}")
    
    while True:
        try:
            print("Looking for people...")
            detections = await detector.get_detections_from_camera(camera_name)
            found = False

            for d in detections:
                if d.confidence > 0.5:
                    print(f"Saw: {d.class_name} ({d.confidence:.2f})")
                
                if d.confidence > 0.7 and d.class_name == "Person":
                    found = True
                    bbox_height = d.y_max - d.y_min
                    
                    if bbox_height > 0:
                        distance = 400 / bbox_height
                        print(f"Person detected at approx {distance:.2f} meters")

                        if distance > 1.0:
                            print(f"Path clear, moving straight (Vel: {move_velocity}).")
                            await base.move_straight(distance=800, velocity=move_velocity)
                        else:
                            print(f"Target reached! ({distance:.2f} m). Stopping.")
                            await base.stop()
                            print("Waiting 5 seconds before resuming search...")
                            await asyncio.sleep(5)
                    else:
                        print("Invalid bounding box height.")

            if not found:
                print(f"No person detected. Spinning 90 degrees (Vel: {spin_velocity})...")
                await base.spin(angle=90, velocity=spin_velocity)

        except Exception as e:
            print(f"Error in loop: {e}")

        await asyncio.sleep(pause_interval)

async def main():
    robot = await connect()
    base = Base.from_robot(robot, base_name)
    detector = VisionClient.from_robot(robot, name=detector_name)

    await person_detect(detector, base)

    await robot.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
