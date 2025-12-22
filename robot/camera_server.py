"""
Camera streaming server for Tipsy robot.
Captures frames from the Viam robot camera and serves them via HTTP.
"""
import asyncio
import os
import base64
from aiohttp import web
from viam.robot.client import RobotClient
from viam.rpc.dial import Credentials, DialOptions
from viam.components.camera import Camera

# Robot configuration
robot_api_key = os.getenv('ROBOT_API_KEY') or 'yd72j9kz3xa14myw6fs82twioqxorg8e'
robot_api_key_id = os.getenv('ROBOT_API_KEY_ID') or '5520951f-42f1-443e-bb0e-cd06b4f72b60'
robot_address = os.getenv("ROBOT_ADDRESS") or "tipsy-main.4cku3fgpss.viam.cloud"
camera_name = os.getenv("ROBOT_CAMERA") or "cam"

# Global robot connection
robot = None
camera = None


async def connect():
    """Connect to the Viam robot."""
    opts = RobotClient.Options.with_api_key(
        api_key=robot_api_key,
        api_key_id=robot_api_key_id
    )
    return await RobotClient.at_address(robot_address, opts)


async def get_frame(request):
    """HTTP endpoint to get a camera frame as base64."""
    global robot, camera
    
    try:
        if robot is None:
            robot = await connect()
            camera = Camera.from_robot(robot, camera_name)
            print(f"Connected to robot, camera: {camera_name}")
        
        # Get image from camera - returns ViamImage
        viam_image = await camera.get_image()
        
        # ViamImage has .data property with raw bytes
        # Check mime type and convert to JPEG if needed
        img_bytes = viam_image.data
        mime_type = str(viam_image.mime_type) if hasattr(viam_image, 'mime_type') else 'image/jpeg'
        
        # If it's a PIL-compatible format, we can convert it
        if 'jpeg' in mime_type.lower() or 'jpg' in mime_type.lower():
            base64_img = base64.b64encode(img_bytes).decode('utf-8')
        else:
            # Try to convert using PIL
            import io
            from PIL import Image
            img = Image.open(io.BytesIO(img_bytes))
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=70)
            base64_img = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return web.json_response({
            'frame': f'data:image/jpeg;base64,{base64_img}'
        }, headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*'
        })
    except Exception as e:
        print(f"Error getting frame: {e}")
        import traceback
        traceback.print_exc()
        return web.json_response({'error': str(e)}, status=503, headers={
            'Access-Control-Allow-Origin': '*'
        })


async def health(request):
    """Health check endpoint."""
    return web.json_response({'status': 'ok', 'camera': camera_name}, headers={
        'Access-Control-Allow-Origin': '*'
    })


async def options_handler(request):
    """Handle CORS preflight requests."""
    return web.Response(headers={
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*'
    })


async def on_shutdown(app):
    """Cleanup on shutdown."""
    global robot
    if robot:
        await robot.close()
        print("Robot connection closed")


def main():
    app = web.Application()
    app.router.add_get('/frame', get_frame)
    app.router.add_get('/health', health)
    app.router.add_route('OPTIONS', '/frame', options_handler)
    app.on_shutdown.append(on_shutdown)
    
    port = int(os.getenv('CAMERA_PORT', 3001))
    print(f"Starting camera server on port {port}")
    print(f"Camera endpoint: http://localhost:{port}/frame")
    
    web.run_app(app, host='0.0.0.0', port=port)


if __name__ == "__main__":
    main()
