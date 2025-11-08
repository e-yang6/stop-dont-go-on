import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

/**
 * @interface CameraFeedRef
 * @description Defines the methods exposed by the CameraFeed component's ref.
 */
export interface CameraFeedRef {
  /**
   * @method getVideoElement
   * @returns {HTMLVideoElement | null} The underlying HTMLVideoElement or null if not available.
   */
  getVideoElement: () => HTMLVideoElement | null;
}

/**
 * @component CameraFeed
 * @description A React component that displays a live camera feed.
 * It automatically starts the camera on mount and stops it on unmount.
 * @param {object} props - No props are currently accepted.
 * @param {React.Ref<CameraFeedRef>} ref - A ref to access CameraFeedRef methods  
 */
const CameraFeed = forwardRef<CameraFeedRef, {}>((props, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Expose methods via the ref for parent components to interact with the camera.
  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
  }));

  useEffect(() => {
    /**
     * @function startCamera
     * @description Attempts to access the user's camera and display the feed.
     */
    const startCamera = async () => {
      setError(null);
      try {
        // Request video stream from the user's media devices.
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play(); // Start playing the video stream.
          } catch (playErr) {
            if (
              playErr instanceof DOMException &&
              playErr.name === 'AbortError'
            ) {
              // Ignore abort errors triggered by the browser when stopping the media resource.
              console.debug('camera playback aborted by browser request');
            } else {
              console.warn('unable to start camera playback:', playErr);
            }
          }
        }
      } catch (err) {
        console.error('error accessing camera:', err);
        
        // Provide more specific error messages based on the error type
        let errorMessage = '';
        
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            errorMessage = 'permission denied. please allow camera access in browser settings.';
          } else if (err.name === 'NotFoundError') {
            errorMessage = 'no camera found. please connect a camera.';
          } else if (err.name === 'NotReadableError') {
            errorMessage = 'camera is already in use by another application.';
          } else if (err.name === 'NotSecureError' || (typeof err.message === 'string' && err.message.toLowerCase().includes('secure'))) {
            errorMessage = 'access must be via https or localhost. try accessing via http://localhost:3000';
          } else {
            errorMessage = err.message || 'unexpected camera error.';
          }
        } else {
          errorMessage = 'unexpected camera error.';
        }
        
        setError(errorMessage);
      }
    };

    /**
     * @function stopCamera
     * @description Stops the current camera feed and cleans up the stream.
     */
    const stopCamera = () => {
      if (mediaStreamRef.current) {
        // Stop all tracks in the media stream to release camera resources.
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null; // Disconnect the video element from the stream.
      }
    };

    startCamera(); // Automatically start camera on component mount.

    // Cleanup effect: Stop camera when the component unmounts.
    return () => {
      stopCamera();
    };
  }, []); // Empty dependency array ensures this runs once on mount and once on unmount.

  return (
    <div className="w-full max-w-3xl aspect-video relative rounded-xl shadow-2xl overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        playsInline
        muted
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 text-rose-400 p-4 lowercase">
          {error}
        </div>
      )}
    </div>
  );
});

export default CameraFeed;