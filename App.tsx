import React, { useState, useRef, useEffect, useCallback } from 'react';
import emailjs from '@emailjs/browser';
import CameraFeed, { CameraFeedRef } from './components/CameraFeed'; // Import CameraFeedRef
import Button from './components/Button';
import AlertAudio from './components/AlertAudio';

/**
 * @function blobToBase64
 * @description Helper function to convert a Blob object to a Base64 encoded string.
 * @param {Blob} blob - The Blob object to convert.
 * @returns {Promise<string>} A promise that resolves with the Base64 string (without the data URL prefix).
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the "data:image/png;base64," prefix to get just the base64 data.
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const EMAILJS_SERVICE_ID = 'service_22syqfk';
const EMAILJS_TEMPLATE_ID = 'template_gexv4pn';
const EMAILJS_PUBLIC_KEY = 'nxGhSxIbgPLd4Rh9M';
const MAX_EMAILJS_VARIABLE_SIZE_BYTES = 50 * 1024; // 50KB limit imposed by EmailJS
const MAX_SCREENSHOT_WIDTH = 560;
const MAX_SCREENSHOT_HEIGHT = 420;

type Splatter = {
  id: number;
  x: number;
  y: number;
  size: number;
  fallSpeed: number;
  opacity: number;
  rotation: number;
  holdUntil: number;
  isSliding: boolean;
  circles: Array<{
    offsetX: number;
    offsetY: number;
    radius: number;
    alpha: number;
  }>;
};

const compressCanvasToBase64 = async (canvas: HTMLCanvasElement) => {
  const mimeType = 'image/jpeg';
  const minQuality = 0.35;
  const qualityStep = 0.12;
  const sizeSafetyMarginBytes = 5 * 1024; // leave a little room below the hard limit

  const createBlob = (sourceCanvas: HTMLCanvasElement, quality: number) =>
    new Promise<Blob>((resolve, reject) => {
      sourceCanvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error('failed to capture screenshot.'));
          }
        },
        mimeType,
        quality
      );
    });

  const cloneCanvas = (source: HTMLCanvasElement, width: number, height: number) => {
    const cloned = document.createElement('canvas');
    cloned.width = width;
    cloned.height = height;
    const ctx = cloned.getContext('2d');
    if (!ctx) {
      throw new Error('could not resize screenshot.');
    }
    ctx.drawImage(source, 0, 0, width, height);
    return cloned;
  };

  let workingCanvas = cloneCanvas(canvas, canvas.width, canvas.height);
  let quality = 0.82;

  while (true) {
    let currentQuality = quality;
    while (currentQuality >= minQuality) {
      const blob = await createBlob(workingCanvas, currentQuality);
      const base64 = await blobToBase64(blob);
      const approxBytes = Math.ceil((base64.length * 3) / 4);

      if (approxBytes <= MAX_EMAILJS_VARIABLE_SIZE_BYTES - sizeSafetyMarginBytes) {
        return { base64, mimeType };
      }

      currentQuality = parseFloat((currentQuality - qualityStep).toFixed(2));
    }

    const nextWidth = Math.floor(workingCanvas.width * 0.85);
    const nextHeight = Math.floor(workingCanvas.height * 0.85);

    if (nextWidth < 240 || nextHeight < 180) {
      break;
    }

    workingCanvas = cloneCanvas(workingCanvas, nextWidth, nextHeight);
    quality = 0.78;
  }

  throw new Error('screenshot is too large to send via email. try reducing the camera resolution.');
};

function App() {
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState<string>('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showEmailSentNotification, setShowEmailSentNotification] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [clapStatus, setClapStatus] = useState<'initializing' | 'listening' | 'detected' | 'countdown' | 'alerted' | 'error'>('initializing');
  const [clapError, setClapError] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashPhase, setFlashPhase] = useState(false);
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [alertActive, setAlertActive] = useState(false);
  const [splatters, setSplatters] = useState<Splatter[]>([]);
  const [mathChallenge, setMathChallenge] = useState<{ question: string; answer: number } | null>(null);
  const [mathAnswerInput, setMathAnswerInput] = useState('');
  const [mathError, setMathError] = useState<string | null>(null);
  const sendEmailTimer = useRef<number | null>(null);
  const cameraRef = useRef<CameraFeedRef>(null); // Ref for CameraFeed component
  const lastEmailSendTime = useRef<number>(0);
  const emailCooldownMs = 10000; // 10 seconds cooldown for sending emails
  const flashTimeoutRef = useRef<number | null>(null);
  const flashIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const splatterSpawnIntervalRef = useRef<number | null>(null);
  const splatterAnimationRef = useRef<number | null>(null);
  const lastDetectionTimeRef = useRef<number>(0);

  // Face centering system state
  const [faceCenteringConnected, setFaceCenteringConnected] = useState(false);
  const [faceCenteringTracking, setFaceCenteringTracking] = useState(false);
  const faceCenteringCheckInterval = useRef<number | null>(null);

  // Additional refs needed for app functionality
  const countdownActiveRef = useRef<boolean>(false);
  const mathRequiredRef = useRef<boolean>(false);
  const mathSolvedRef = useRef<boolean>(false);
  const emailInProgressRef = useRef<boolean>(false);
  const alertTimeoutRef = useRef<number | null>(null);

  const handleAddEmail = () => {
    if (newEmail.trim() === '') {
      setEmailError('email cannot be empty.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailError('please enter a valid email address.');
      return;
    }
    if (emails.includes(newEmail.toLowerCase())) {
      setEmailError('this email is already on the list.');
      return;
    }
    const normalized = newEmail.toLowerCase();
    setEmails(prev => {
      return [...prev, normalized];
    });
    setNewEmail('');
    setEmailError(null);
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setEmails(prev => {
      return prev.filter(email => email !== emailToRemove);
    });
  };

  useEffect(() => {
    emailjs.init({
      publicKey: EMAILJS_PUBLIC_KEY,
    });
  }, []);

  const clearCountdownTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const clearSplatterTimers = useCallback(() => {
    if (splatterSpawnIntervalRef.current) {
      clearInterval(splatterSpawnIntervalRef.current);
      splatterSpawnIntervalRef.current = null;
    }
    if (splatterAnimationRef.current) {
      cancelAnimationFrame(splatterAnimationRef.current);
      splatterAnimationRef.current = null;
    }
  }, []);

  const cancelCountdown = useCallback(() => {
    if (!countdownActiveRef.current) {
      return;
    }
    if (mathRequiredRef.current && !mathSolvedRef.current) {
      return;
    }
    clearCountdownTimers();
    countdownActiveRef.current = false;
    setCountdownActive(false);
    setCountdownSeconds(0);
    setClapStatus(prev => (alertActive ? prev : 'listening'));
    setIsFlashing(prev => (alertActive ? prev : false));
    mathRequiredRef.current = false;
    mathSolvedRef.current = false;
    setMathChallenge(null);
    setMathAnswerInput('');
    setMathError(null);
  }, [alertActive, clearCountdownTimers]);

  const activateMathChallenge = useCallback(() => {
    if (mathRequiredRef.current) {
      return;
    }
    const operations = [
      {
        symbol: '+',
        compute: (a: number, b: number) => a + b,
      },
      {
        symbol: '-',
        compute: (a: number, b: number) => a - b,
      },
      {
        symbol: '*',
        compute: (a: number, b: number) => a * b,
      },
    ] as const;

    const op = operations[Math.floor(Math.random() * operations.length)];
    let first = Math.floor(6 + Math.random() * 14);
    let second = Math.floor(3 + Math.random() * 12);

    if (op.symbol === '-' && second > first) {
      [first, second] = [second, first];
    }

    const answer = op.compute(first, second);

    setMathChallenge({
      question: `${first} ${op.symbol} ${second}`,
      answer,
    });
    setMathAnswerInput('');
    setMathError(null);
    mathRequiredRef.current = true;
    mathSolvedRef.current = false;
  }, []);

  const handleMathSubmit = useCallback(() => {
    if (!mathChallenge) {
      return;
    }
    const trimmed = mathAnswerInput.trim();
    if (trimmed === '') {
      setMathError('please enter an answer.');
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setMathError('answer must be a number.');
      return;
    }
    if (parsed === mathChallenge.answer) {
      mathSolvedRef.current = true;
      setMathError(null);
      cancelCountdown();
    } else {
      setMathError('incorrect answer. try again.');
    }
  }, [cancelCountdown, mathAnswerInput, mathChallenge]);

  useEffect(() => {
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }

    if (!isFlashing && !alertActive) {
      setFlashPhase(false);
      return () => {};
    }

    flashIntervalRef.current = window.setInterval(() => {
      setFlashPhase(prev => !prev);
    }, alertActive ? 140 : 200);

    return () => {
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
        flashIntervalRef.current = null;
      }
      if (!alertActive) {
        setFlashPhase(false);
      }
    };
  }, [alertActive, isFlashing]);


  const sendEmailsWithScreenshot = useCallback(
    async (recipients: string[], base64Image: string, mimeType: string) => {
      const base64ImageWithPrefix = `data:${mimeType};base64,${base64Image}`;

      await Promise.all(
        recipients.map((recipient) =>
          emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_email: recipient,
            screenshot: base64ImageWithPrefix,
          })
        )
      );
    },
    []
  );

  const sendAlertEmail = useCallback(async (options: { suppressCooldownWarning?: boolean } = {}) => {
    if (emailInProgressRef.current) {
      return;
    }
    const { suppressCooldownWarning = false } = options;
    const now = Date.now();
    if (now - lastEmailSendTime.current < emailCooldownMs) {
      if (!suppressCooldownWarning) {
        setEmailError(`please wait ${Math.ceil((emailCooldownMs - (now - lastEmailSendTime.current)) / 1000)} seconds before sending another email.`);
      }
      return;
    }
    setEmailError(null); // Clear previous errors

    const recipients = [...emails];

    const videoElement = cameraRef.current?.getVideoElement();
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      setEmailError('camera is not active or video feed is not ready.');
      return;
    }

    if (recipients.length === 0) {
      setEmailError('no email recipients added.');
      return;
    }

    const canvas = document.createElement('canvas');
    const { videoWidth, videoHeight } = videoElement;

    const widthRatio = MAX_SCREENSHOT_WIDTH / videoWidth;
    const heightRatio = MAX_SCREENSHOT_HEIGHT / videoHeight;
    const scale = Math.min(1, widthRatio, heightRatio);

    const targetWidth = Math.round(videoWidth * scale);
    const targetHeight = Math.round(videoHeight * scale);

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setEmailError('could not get canvas context for image capture.');
      return;
    }

    ctx.drawImage(videoElement, 0, 0, targetWidth, targetHeight);

    try {
      setIsSending(true);
      emailInProgressRef.current = true;
      const { base64, mimeType } = await compressCanvasToBase64(canvas);
      await sendEmailsWithScreenshot(recipients, base64, mimeType);

      setShowEmailSentNotification(true);
      lastEmailSendTime.current = now; // Update last send time

      if (sendEmailTimer.current) {
        clearTimeout(sendEmailTimer.current);
      }
      sendEmailTimer.current = window.setTimeout(() => {
        setShowEmailSentNotification(false);
        sendEmailTimer.current = null;
      }, 3000); // Notification disappears after 3 seconds
    } catch (err) {
      console.error('error sending email via emailjs:', err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'failed to send email via emailjs.';
      setEmailError(message);
    } finally {
      setIsSending(false);
      emailInProgressRef.current = false;
    }
  }, [emails, emailCooldownMs, sendEmailsWithScreenshot]);

  const handleCountdownFinish = useCallback(async () => {
    if (!countdownActiveRef.current) {
      return;
    }
    const mathFailed = mathRequiredRef.current && !mathSolvedRef.current;
    clearCountdownTimers();
    countdownActiveRef.current = false;
    setCountdownActive(false);
    setCountdownSeconds(0);
    mathRequiredRef.current = false;
    mathSolvedRef.current = false;
    setMathChallenge(null);
    setMathAnswerInput('');
    setMathError(null);

    const now = Date.now();
    const stillClapping = now - lastDetectionTimeRef.current <= 1500;

    if (stillClapping || mathFailed) {
      setClapStatus('alerted');
      setAlertActive(true);
      setIsFlashing(true);
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
      await sendAlertEmail({ suppressCooldownWarning: true });
      alertTimeoutRef.current = window.setTimeout(() => {
        setAlertActive(false);
        setIsFlashing(false);
        setClapStatus('listening');
        alertTimeoutRef.current = null;
      }, 6000);
    } else {
      setClapStatus('listening');
      setIsFlashing(false);
    }
  }, [clearCountdownTimers, sendAlertEmail]);

  const spawnSplatter = useCallback(() => {
    setSplatters(prev => {
      if (prev.length >= 28) {
        return prev;
      }
      const now = performance.now();
      const size = 72 + Math.random() * 140;
      const holdDuration = 1800 + Math.random() * 1700;
      const circleCount = 4 + Math.floor(Math.random() * 4);
      const circles = Array.from({ length: circleCount }).map((_, index) => {
        if (index === 0) {
          return {
            offsetX: (Math.random() - 0.5) * 0.2,
            offsetY: (Math.random() - 0.5) * 0.2,
            radius: 0.5 + Math.random() * 0.15,
            alpha: 0.85 + Math.random() * 0.1,
          };
        }
        return {
          offsetX: (Math.random() - 0.5) * 0.9,
          offsetY: (Math.random() - 0.5) * 0.9,
          radius: 0.18 + Math.random() * 0.32,
          alpha: 0.35 + Math.random() * 0.45,
        };
      });

      const newSplat: Splatter = {
        id: now + Math.random(),
        x: Math.random() * 100,
        y: Math.random() * 80,
        size,
        fallSpeed: 0.12 + Math.random() * 0.2,
        opacity: 0.75 + Math.random() * 0.25,
        rotation: Math.random() * 360,
        holdUntil: now + holdDuration,
        isSliding: false,
        circles,
      };
      return [...prev, newSplat];
    });
  }, []);

  const stepSplatters = useCallback(() => {
    const now = performance.now();
    setSplatters(prev =>
      prev
        .map(splat => {
          const shouldSlide = splat.isSliding || now >= splat.holdUntil;
          const fallSpeed = shouldSlide ? splat.fallSpeed : 0;
          const nextY = splat.y + fallSpeed;
          const nextOpacity = splat.opacity - (shouldSlide ? 0.0025 * splat.fallSpeed : 0);
          return {
            ...splat,
            isSliding: shouldSlide,
            y: nextY,
            opacity: Math.max(0, nextOpacity),
          };
        })
        .filter(splat => splat.y < 110 && splat.opacity > 0.08)
    );
    splatterAnimationRef.current = requestAnimationFrame(stepSplatters);
  }, []);

  useEffect(() => {
    if (isFlashing || alertActive) {
      spawnSplatter();
      if (!splatterSpawnIntervalRef.current) {
        splatterSpawnIntervalRef.current = window.setInterval(() => {
          spawnSplatter();
        }, alertActive ? 300 : 520);
      }
      if (!splatterAnimationRef.current) {
        splatterAnimationRef.current = requestAnimationFrame(stepSplatters);
      }
    } else {
      clearSplatterTimers();
      setSplatters([]);
    }

    return () => {
      clearSplatterTimers();
    };
  }, [alertActive, clearSplatterTimers, isFlashing, spawnSplatter, stepSplatters]);

  const startCountdown = useCallback(() => {
    if (countdownActiveRef.current || alertActive) {
      return;
    }
    countdownActiveRef.current = true;
    setCountdownActive(true);
    setCountdownSeconds(10);
    setClapStatus('countdown');
    mathRequiredRef.current = false;
    mathSolvedRef.current = false;
    setMathChallenge(null);
    setMathAnswerInput('');
    setMathError(null);
    clearCountdownTimers();
    countdownIntervalRef.current = window.setInterval(() => {
      if (!countdownActiveRef.current) {
        return;
      }
      setCountdownSeconds(prevSeconds => {
        if (!countdownActiveRef.current) {
          return prevSeconds;
        }
        if (prevSeconds <= 1) {
          clearCountdownTimers();
          void handleCountdownFinish();
          return 0;
        }
        if (prevSeconds === 8) {
          activateMathChallenge();
        }
        return prevSeconds - 1;
      });
    }, 1000);
  }, [activateMathChallenge, alertActive, clearCountdownTimers, handleCountdownFinish]);

  const handleClapDetection = useCallback(() => {
    const now = Date.now();
    lastDetectionTimeRef.current = now;

    if (alertActive) {
      return;
    }

    setIsFlashing(true);
    if (countdownActiveRef.current) {
      setClapStatus('countdown');
    } else {
      setClapStatus('detected');
      startCountdown();
    }

    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }
    flashTimeoutRef.current = window.setTimeout(() => {
      const timeSinceLastDetection = Date.now() - lastDetectionTimeRef.current;
      if (timeSinceLastDetection > 1500) {
        if (countdownActiveRef.current) {
          cancelCountdown();
        } else {
          setIsFlashing(false);
          setClapStatus('listening');
        }
      }
    }, 1800);
  }, [alertActive, cancelCountdown, startCountdown]);

  useEffect(() => {
    let animationFrameId: number | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;

    const clapTimes: number[] = [];
    let lastPeakTime = 0;
    let movingAverage = 0;
    let recentAmplitude = 0;

    const cleanup = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (analyser) {
        analyser.disconnect();
        analyser = null;
      }
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
    };

    const detectRhythmicClapping = (data: Float32Array) => {
      let sumSquares = 0;
      let peak = 0;
      for (let i = 0; i < data.length; i += 1) {
        const sample = Math.abs(data[i]);
        sumSquares += sample * sample;
        if (sample > peak) {
          peak = sample;
        }
        movingAverage = 0.9 * movingAverage + 0.1 * sample;
      }

      const rms = Math.sqrt(sumSquares / data.length);
      recentAmplitude = 0.85 * recentAmplitude + 0.15 * peak;
      const dynamicThreshold = Math.max(
        0.22,
        movingAverage + 0.16,
        movingAverage * 1.75,
        recentAmplitude * 0.9
      );
      const amplitude = peak;
      const now = performance.now();

      const ratio =
        movingAverage > 0.0001 ? amplitude / Math.max(movingAverage, 0.0001) : amplitude / 0.0001;

      if (amplitude > dynamicThreshold * 1.15 && ratio >= 2.1 && now - lastPeakTime > 190) {
        clapTimes.push(now);
        lastPeakTime = now;

        while (clapTimes.length > 8) {
          clapTimes.shift();
        }

        const recent = clapTimes.filter(time => now - time <= 1400);
        if (recent.length >= 4) {
          const intervals: number[] = [];
          for (let i = 1; i < recent.length; i += 1) {
            intervals.push(recent[i] - recent[i - 1]);
          }
          const lastIntervals = intervals.slice(-4);
          if (lastIntervals.length >= 3) {
            const average =
              lastIntervals.reduce((acc, cur) => acc + cur, 0) / lastIntervals.length;
            const variance =
              lastIntervals.reduce((acc, cur) => acc + Math.pow(cur - average, 2), 0) /
              lastIntervals.length;
            const stdDev = Math.sqrt(variance);
            if (average >= 260 && average <= 520 && stdDev <= 55) {
              handleClapDetection();
            }
          }
        }
      }
    };

    const setupAudio = async () => {
      try {
        setClapStatus('initializing');
        setClapError(null);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        audioContext = new AudioContext({ latencyHint: 'interactive' });
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        const bufferLength = analyser.fftSize;
        const timeDomainData = new Float32Array(bufferLength);

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        setClapStatus('listening');

        const loop = () => {
          if (!analyser) {
            return;
          }
          analyser.getFloatTimeDomainData(timeDomainData);
          detectRhythmicClapping(timeDomainData);
          animationFrameId = requestAnimationFrame(loop);
        };

        loop();
      } catch (err) {
        console.error('error accessing microphone:', err);
        setClapStatus('error');
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            setClapError('microphone permission denied.');
          } else if (err.name === 'NotFoundError') {
            setClapError('no microphone found.');
          } else {
            setClapError(err.message);
          }
        } else {
          setClapError('unexpected microphone error.');
        }
        cleanup();
      }
    };

    setupAudio();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [handleClapDetection]);

  // Face centering API functions
  const checkFaceCenteringConnection = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5007/api/status');
      const data = await response.json();
      setFaceCenteringConnected(true);
      setFaceCenteringTracking(data.tracking_active);
    } catch (error) {
      setFaceCenteringConnected(false);
      setFaceCenteringTracking(false);
    }
  }, []);

  const startFaceCentering = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5007/api/start_tracking', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        setFaceCenteringTracking(true);
        console.log('Face centering started');
      }
    } catch (error) {
      console.error('Failed to start face centering:', error);
    }
  }, []);

  const triggerAlertMode = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5007/api/start_alert', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        console.log('Alert mode started - servo 10 looping');
      }
    } catch (error) {
      console.error('Failed to start alert mode:', error);
    }
  }, []);

  const stopAlertMode = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5007/api/stop_alert', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        console.log('Alert mode stopped - resuming face tracking');
      }
    } catch (error) {
      console.error('Failed to stop alert mode:', error);
    }
  }, []);

  // Face centering system initialization and monitoring
  useEffect(() => {
    // Check face centering connection on mount
    checkFaceCenteringConnection();

    // Set up periodic connection checks
    faceCenteringCheckInterval.current = window.setInterval(() => {
      checkFaceCenteringConnection();
    }, 5000); // Check every 5 seconds

    // Auto-start face tracking if available
    const initFaceTracking = async () => {
      // Wait a moment for connection check
      setTimeout(async () => {
        if (faceCenteringConnected && !faceCenteringTracking) {
          await startFaceCentering();
        }
      }, 1000);
    };

    initFaceTracking();

    return () => {
      if (faceCenteringCheckInterval.current) {
        clearInterval(faceCenteringCheckInterval.current);
      }
    };
  }, [checkFaceCenteringConnection, startFaceCentering, faceCenteringConnected, faceCenteringTracking]);

  // Handle math challenge alert integration with servo control
  useEffect(() => {
    if (mathChallenge && faceCenteringConnected) {
      // Math challenge appeared - start alert mode (servo looping)
      console.log('Math challenge active - triggering servo loop');
      triggerAlertMode();
    } else if (!mathChallenge && faceCenteringConnected) {
      // Math challenge resolved - stop alert mode (resume tracking)
      console.log('Math challenge resolved - stopping servo loop');
      stopAlertMode();
    }
  }, [mathChallenge, faceCenteringConnected, triggerAlertMode, stopAlertMode]);

  useEffect(() => {
    return () => {
      if (sendEmailTimer.current) {
        clearTimeout(sendEmailTimer.current);
      }
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
      clearCountdownTimers();
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
        flashIntervalRef.current = null;
      }
      clearSplatterTimers();
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
        alertTimeoutRef.current = null;
      }
      setSplatters([]);
    };
  }, [clearCountdownTimers, clearSplatterTimers]);

  return (
    <div className="max-w-6xl w-full mx-auto py-10 px-8 flex flex-col items-center gap-10">
      <AlertAudio isPlaying={mathChallenge !== null} />
      {isFlashing && (
        <div
          className="fixed inset-0 z-40 transition-colors duration-150"
          style={{
            pointerEvents: mathChallenge ? 'auto' : 'none',
            backgroundColor: alertActive
              ? flashPhase
                ? 'rgba(185, 28, 28, 0.95)'
                : 'rgba(127, 29, 29, 0.7)'
              : flashPhase
              ? 'rgba(220, 38, 38, 0.75)'
              : 'rgba(220, 38, 38, 0.2)',
            backdropFilter: alertActive ? 'blur(2px)' : undefined,
          }}
        >
          {splatters.map(splatter => (
            <div
              key={splatter.id}
              className="absolute pointer-events-none mix-blend-screen"
              style={{
                left: `${splatter.x}%`,
                top: `${splatter.y}%`,
                width: `${splatter.size}px`,
                height: `${splatter.size}px`,
                opacity: splatter.opacity,
                transform: `translate(-50%, -50%) rotate(${splatter.rotation}deg)`,
                filter: 'drop-shadow(0 0 14px rgba(255,255,255,0.35))',
                transition: 'opacity 180ms ease-out, transform 220ms ease-out',
                position: 'absolute',
              }}
            >
              <div className="relative w-full h-full">
                {splatter.circles.map((circle, index) => (
                  <span
                    key={`${splatter.id}-${index}`}
                    className="absolute rounded-full"
                    style={{
                      left: `${50 + circle.offsetX * 100}%`,
                      top: `${50 + circle.offsetY * 100}%`,
                      width: `${circle.radius * 100}%`,
                      height: `${circle.radius * 100}%`,
                      background: 'rgba(255, 255, 255, 0.95)',
                      opacity: circle.alpha,
                      transform: 'translate(-50%, -50%)',
                      filter: 'blur(0.4px)',
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          {countdownActive ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <span className="text-6xl font-extrabold text-white drop-shadow-lg lowercase">
                {countdownSeconds}
              </span>
              {mathChallenge ? (
                <>
                  <span className="text-lg font-semibold text-white/90 lowercase">
                    solve the problem to stop the timer
                  </span>
                  <span className="text-3xl font-bold text-white drop-shadow lowercase">
                    {mathChallenge.question} = ?
                  </span>
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={mathAnswerInput}
                      onChange={(e) => setMathAnswerInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleMathSubmit();
                        }
                      }}
                      className="w-full rounded-full px-4 py-2 bg-white/95 text-zinc-900 font-semibold text-center focus:outline-none focus:ring-2 focus:ring-rose-500"
                      placeholder="your answer"
                    />
                    <Button onClick={handleMathSubmit} className="w-full sm:w-auto px-6">
                      submit
                    </Button>
                  </div>
                  {mathError && (
                    <span className="text-sm font-medium text-rose-200 lowercase">
                      {mathError}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-lg font-medium text-white/90 lowercase">
                  stop gooning now to cancel before the Challenge begins
                </span>
              )}
            </div>
          ) : alertActive ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 text-center">
              <span className="text-7xl font-black tracking-wide text-white drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] uppercase">
                ALERT SENT
              </span>
              <span className="text-2xl font-semibold text-white/90 drop-shadow-lg uppercase">
                This was triggered by gooning.
              </span>
            </div>
          ) : null}
        </div>
      )}

      <h1 className="text-5xl font-extrabold text-zinc-50 drop-shadow-lg lowercase">stop! don't go on</h1>

      <CameraFeed ref={cameraRef} />

      <div className="w-full flex flex-col items-center gap-4">
        <h2 className="text-3xl font-bold text-zinc-100 lowercase">email recipients</h2>
        <div className="flex w-full max-w-lg">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleAddEmail();
            }}
            placeholder="add new email"
            className="flex-grow p-3 bg-zinc-800 border border-zinc-600 rounded-l-full focus:outline-none focus:ring-2 focus:ring-zinc-500 text-zinc-100 placeholder-zinc-400 lowercase"
          />
          <Button onClick={handleAddEmail} className="rounded-l-none">
            add email
          </Button>
        </div>
        {emailError && (
          <p className="text-rose-500 lowercase text-center">{emailError}</p>
        )}
        <div className="w-full max-w-lg mt-4 max-h-48 overflow-y-auto">
          {emails.length === 0 ? (
            <p className="text-center text-zinc-300 lowercase">no emails added yet.</p>
          ) : (
            <ul className="space-y-2">
              {emails.map((email, index) => (
                <li key={index} className="flex items-center justify-between p-3 bg-zinc-800 rounded-full shadow-inner text-zinc-100 lowercase">
                  <span>{email}</span>
                  <Button
                    onClick={() => handleRemoveEmail(email)}
                    variant="danger"
                    className="px-4 py-2 text-sm"
                  >
                    remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showEmailSentNotification && (
        <div className="fixed bottom-8 right-8 bg-zinc-700 text-white py-3 px-6 rounded-full shadow-lg lowercase">
          alert email sent!
        </div>
      )}
    </div>
  );
}

export default App;