#!/usr/bin/env python3
"""
Camera Release Utility
Forces release of camera resources that may be stuck
"""

import subprocess
import sys
import time

def release_camera_processes():
    """Kill processes that might be holding onto camera"""
    processes_to_kill = [
        'VDCAssistant',
        'AppleCameraAssistant',
        'UVCAssistant',
        'python',  # Our own python processes
    ]

    print("🔧 Releasing camera processes...")

    for process in processes_to_kill:
        try:
            result = subprocess.run(['pkill', '-f', process], capture_output=True)
            if result.returncode == 0:
                print(f"✅ Stopped {process} processes")
            else:
                print(f"ℹ️  No {process} processes found")
        except Exception as e:
            print(f"⚠️  Could not kill {process}: {e}")

    print("⏳ Waiting for camera to be available...")
    time.sleep(2)

    # Test camera availability
    import cv2
    for cam_id in [0, 1, 2]:
        print(f"🎥 Testing camera {cam_id}...")
        cap = cv2.VideoCapture(cam_id)
        if cap.isOpened():
            ret, frame = cap.read()
            if ret and frame is not None:
                print(f"✅ Camera {cam_id} is available!")
                cap.release()
                return True
            else:
                print(f"⚠️  Camera {cam_id} opened but can't read frames")
        cap.release()

    print("❌ No cameras available after cleanup")
    return False

if __name__ == '__main__':
    print("🚀 Camera Release Utility")
    print("=" * 30)

    success = release_camera_processes()

    if success:
        print("✅ Camera is now available!")
        print("🚀 You can now start the face centering server")
    else:
        print("❌ Camera still not available")
        print("💡 Try:")
        print("   • Restart your computer")
        print("   • Check System Preferences > Security & Privacy > Camera")
        print("   • Make sure no other apps are using the camera")

    sys.exit(0 if success else 1)
