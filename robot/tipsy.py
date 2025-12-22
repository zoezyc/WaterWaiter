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


async def update_status(session, status, extra_data=None):
    """Send robot status to dashboard API"""
    payload = {"status": status}
    if extra_data:
        payload.update(extra_data)
        
    try:
        async with session.post(f"{API_URL}/status", json=payload) as resp:
            print(f"Status update '{status}': {resp.status}")
    except Exception as e:
        print(f"Failed to update status: {e}")


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



try:
    import psutil
except ImportError:
    psutil = None

def get_cpu_temp():
    """Get CPU temperature in Celsius"""
    temp = 0
    try:
        # Try psutil first (cross-platformish)
        if psutil and hasattr(psutil, "sensors_temperatures"):
            temps = psutil.sensors_temperatures()
            if temps:
                # Common names for CPU temp
                for name in ['cpu_thermal', 'coretemp', 'k10temp']:
                    if name in temps:
                        temp = temps[name][0].current
                        break
        
        # Fallback to Raspbian file
        if temp == 0 and os.path.exists("/sys/class/thermal/thermal_zone0/temp"):
             with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                 temp = int(f.read().strip()) / 1000.0
    except Exception:
        pass
    
    return round(temp, 1)

async def person_detect(detector: VisionClient, base: Base):
    global base_state
    
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                print("Looking for people...")
                current_temp = get_cpu_temp()
                await update_status(session, "searching", {
                    "personDetected": False, 
                    "bboxHeight": 0, 
                    "detectionConfidence": 0,
                    "cpuTemp": current_temp
                })
                
                detections = await detector.get_detections_from_camera(camera_name)
                found = False

                for d in detections:
                    if d.confidence > 0.5:
                        print(f"Saw: {d.class_name} ({d.confidence:.2f})")
                    
                    if d.confidence > 0.7 and d.class_name == "Person":
                        found = True
                        # Calculate height in pixels
                        bbox_height = d.y_max - d.y_min
                        
                        extra = {
                            "personDetected": True,
                            "bboxHeight": bbox_height,
                            "detectionConfidence": d.confidence,
                            "cpuTemp": get_cpu_temp()
                        }

                        if bbox_height > 0:
                            # Use bounding box height directly (more reliable than distance calculation)
                            print(f"Person detected - bbox height: {bbox_height} pixels")

                            # If bbox height is over 450px, person is very close - stop
                            if bbox_height < 450:
                                print("Path clear, moving straight.")
                                base_state = "straight"
                                await update_status(session, "moving", extra)
                                await base.set_power(linear={"x": 0, "y": 0.7, "z": 0}, angular={"x": 0, "y": 0, "z": 0})
                                await asyncio.sleep(2)  # Move for 2 seconds
                                await base.stop()
                                base_state = "stopped"
                            else:
                                print(f"Close enough! Waiting for customer... bbox height: {bbox_height}px")
                                base_state = "serving"
                                await base.stop()
                                await update_status(session, "serving", extra)
                                
                                # Wait for customer to interact with dashboard
                                print("Waiting for customer to finish...")
                                heartbeat_counter = 0
                                while True:
                                    cmd = await get_command(session)
                                    if cmd == "proceed":
                                        print("Customer done. Resuming search...")
                                        await update_status(session, "searching", {"personDetected": False})
                                        break
                                    
                                    # Periodic Heartbeat every 3 seconds to keep UI synced
                                    heartbeat_counter += 1
                                    if heartbeat_counter >= 3:
                                         extra["cpuTemp"] = get_cpu_temp()
                                         await update_status(session, "serving", extra)
                                         heartbeat_counter = 0
                                         
                                    await asyncio.sleep(1)
                        else:
                            print("Invalid bounding box height.")

                if not found:
                    print("No person detected. Turning to look...")
                    base_state = "spinning"
                    await update_status(session, "scanning", {
                        "personDetected": False, 
                        "bboxHeight": 0, 
                        "detectionConfidence": 0,
                        "cpuTemp": get_cpu_temp()
                    })
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
