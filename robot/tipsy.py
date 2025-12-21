import asyncio
import os
import aiohttp

from viam.robot.client import RobotClient
from viam.rpc.dial import Credentials, DialOptions
from viam.components.base import Base
from viam.services.vision import VisionClient

robot_api_key = os.getenv('ROBOT_API_KEY') or 'yd72j9kz3xa14myw6fs82twioqxorg8e'
robot_api_key_id = os.getenv('ROBOT_API_KEY_ID') or '5520951f-42f1-443e-bb0e-cd06b4f72b60'
robot_address = os.getenv("ROBOT_ADDRESS") or "tipsy-main.4cku3fgpss.viam.cloud"
# change this if you named your base differently in your robot configuration
base_name = os.getenv("ROBOT_BASE") or "tipsy-base"
# change this if you named your camera differently in your robot configuration
camera_name = os.getenv("ROBOT_CAMERA") or "cam"
# change this if you named your detector differently in your robot configuration
detector_name = os.getenv("ROBOT_DETECTOR") or "myPeopleDetector"
pause_interval = os.getenv("PAUSE_INTERVAL") or 3

if isinstance(pause_interval, str):
    pause_interval = int(pause_interval)

base_state = "stopped"
API_URL = "http://localhost:3000/api/v1/robot"


async def connect():
    opts = RobotClient.Options.with_api_key(
      api_key=robot_api_key,
      api_key_id=robot_api_key_id
    )
    return await RobotClient.at_address(robot_address, opts)


async def update_status(session, status):
    """Send robot status to dashboard API"""
    try:
        async with session.post(f"{API_URL}/status", json={"status": status}) as resp:
            print(f"Status update '{status}': {resp.status}")
    except Exception:
        pass  # Silently fail if API is down


async def get_command(session):
    """Get command from dashboard (e.g., 'proceed')"""
    try:
        async with session.get(f"{API_URL}/command") as resp:
            if resp.status == 200:
                data = await resp.json()
                return data.get("command")
    except Exception:
        pass
    return "none"


async def person_detect(detector: VisionClient, base: Base):
    global base_state
    
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                print("Looking for people...")
                await update_status(session, "searching")
                
                detections = await detector.get_detections_from_camera(camera_name)
                found = False

                for d in detections:
                    if d.confidence > 0.5:
                        print(f"Saw: {d.class_name} ({d.confidence:.2f})")
                    
                    if d.confidence > 0.7 and d.class_name == "Person":
                        found = True
                        # Calculate height in pixels
                        bbox_height = d.y_max - d.y_min
                        
                        if bbox_height > 0:
                            # Use bounding box height directly (more reliable than distance calculation)
                            print(f"Person detected - bbox height: {bbox_height} pixels")

                            # If bbox height is over 450px, person is very close - stop
                            if bbox_height < 450:
                                print("Path clear, moving straight.")
                                base_state = "straight"
                                await update_status(session, "moving")
                                await base.set_power(linear={"x": 0, "y": 0.7, "z": 0}, angular={"x": 0, "y": 0, "z": 0})
                                await asyncio.sleep(2)  # Move for 2 seconds
                                await base.stop()
                                base_state = "stopped"
                            else:
                                print(f"Close enough! Serving... bbox height: {bbox_height}px")
                                base_state = "serving"
                                await base.stop()
                                await update_status(session, "serving")
                                
                                # Simulate serving task - wait 3 seconds then resume
                                await asyncio.sleep(3)
                                print("Serving complete. Resuming search...")
                                await update_status(session, "searching")
                        else:
                            print("Invalid bounding box height.")

                if not found:
                    print("No person detected. Turning to look...")
                    base_state = "spinning"
                    await update_status(session, "scanning")
                    await base.set_power(linear={"x": 0, "y": 0, "z": 0}, angular={"x": 0, "y": 0, "z": 0.5})
                    await asyncio.sleep(1)  # Spin for 1 second
                    await base.stop()
                    base_state = "stopped"

            except Exception as e:
                print(f"Error in person_detect: {e}")

            await asyncio.sleep(pause_interval)


async def main():
    robot = await connect()
    base = Base.from_robot(robot, base_name)
    detector = VisionClient.from_robot(robot, name=detector_name)

    # Person tracking with dashboard integration
    person_task = asyncio.create_task(person_detect(detector, base))
    
    await asyncio.gather(person_task, return_exceptions=True)

    await robot.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
