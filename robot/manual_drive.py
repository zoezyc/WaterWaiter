import asyncio
import sys
import json
import os
import threading
from viam.robot.client import RobotClient
from viam.components.base import Base
from viam.proto.common import Vector3

# Env vars are inherited from parent Node process

async def connect():
    api_key = os.getenv('ROBOT_API_KEY') or 'yd72j9kz3xa14myw6fs82twioqxorg8e'
    api_key_id = os.getenv('ROBOT_API_KEY_ID') or '5520951f-42f1-443e-bb0e-cd06b4f72b60'
    address = os.getenv('ROBOT_ADDRESS') or 'tipsy-main.4cku3fgpss.viam.cloud'
    
    opts = RobotClient.Options.with_api_key(api_key=api_key, api_key_id=api_key_id)
    return await RobotClient.at_address(address, opts)

async def control_loop(queue, base):
    print("Manual Drive Loop Started", flush=True)
    while True:
        try:
            # Wait for command from queue
            command = await queue.get()
            if command is None:
                break
            
            linear = command.get('linear', {})
            angular = command.get('angular', {})
            
            lin_vec = Vector3(x=float(linear.get('x', 0)), y=float(linear.get('y', 0)), z=float(linear.get('z', 0)))
            ang_vec = Vector3(x=float(angular.get('x', 0)), y=float(angular.get('y', 0)), z=float(angular.get('z', 0)))
            
            await base.set_power(lin_vec, ang_vec)
            # print("CMD_EXECUTED", flush=True) # Reduce spam
            queue.task_done()
        except Exception as e:
            print(f"Error executing command: {e}", file=sys.stderr, flush=True)

def stdin_reader(loop, queue):
    """Reads stdin in a separate thread and puts items into the async queue."""
    for line in sys.stdin:
        try:
            data = json.loads(line)
            asyncio.run_coroutine_threadsafe(queue.put(data), loop)
        except json.JSONDecodeError:
            pass
    # Signal exit
    asyncio.run_coroutine_threadsafe(queue.put(None), loop)

async def main():
    robot = None
    try:
        print("Connecting to Viam...", flush=True)
        robot = await connect()
        base_name = os.getenv('ROBOT_BASE') or 'tipsy-base'
        base = Base.from_robot(robot, base_name)
        print("Manual Drive Connected", flush=True)

        queue = asyncio.Queue()
        
        # Start stdin reader thread
        loop = asyncio.get_running_loop()
        threading.Thread(target=stdin_reader, args=(loop, queue), daemon=True).start()

        # Run control loop
        await control_loop(queue, base)

    except Exception as e:
        print(f"Critical Error: {e}", file=sys.stderr, flush=True)
    finally:
        if robot:
            await robot.close()
            print("Robot Connection Closed", flush=True)

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
