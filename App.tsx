import React, { useState, useRef, useEffect } from 'react';
import emailjs from '@emailjs/browser';
import CameraFeed, { CameraFeedRef } from './components/CameraFeed'; // Import CameraFeedRef
import Button from './components/Button';

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
const MAX_SCREENSHOT_WIDTH = 640;
const MAX_SCREENSHOT_HEIGHT = 480;

const compressCanvasToBase64 = async (canvas: HTMLCanvasElement) => {
  const mimeType = 'image/jpeg';
  let quality = 0.8;

  while (quality >= 0.2) {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
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

    const base64 = await blobToBase64(blob);
    const approxBytes = Math.ceil((base64.length * 3) / 4); // Rough conversion from base64 length to bytes

    if (approxBytes <= MAX_EMAILJS_VARIABLE_SIZE_BYTES) {
      return { base64, mimeType };
    }

    quality -= 0.15; // Reduce quality and try again
  }

  throw new Error('screenshot is too large to send via email. try reducing the camera resolution.');
};

function App() {
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState<string>('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showEmailSentNotification, setShowEmailSentNotification] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const sendEmailTimer = useRef<number | null>(null);
  const cameraRef = useRef<CameraFeedRef>(null); // Ref for CameraFeed component
  const lastEmailSendTime = useRef<number>(0);
  const emailCooldownMs = 10000; // 10 seconds cooldown for sending emails

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

  const sendEmailsWithScreenshot = async (recipients: string[], base64Image: string, mimeType: string) => {
    const base64ImageWithPrefix = `data:${mimeType};base64,${base64Image}`;

    await Promise.all(
      recipients.map((recipient) =>
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          to_email: recipient,
          screenshot: base64ImageWithPrefix,
        })
      )
    );
  };

  const sendScreenshotEmail = async () => {
    const now = Date.now();
    if (now - lastEmailSendTime.current < emailCooldownMs) {
      setEmailError(`please wait ${Math.ceil((emailCooldownMs - (now - lastEmailSendTime.current)) / 1000)} seconds before sending another email.`);
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
    }
  };

  useEffect(() => {
    return () => {
      if (sendEmailTimer.current) {
        clearTimeout(sendEmailTimer.current);
      }
    };
  }, []);

  const isSendButtonDisabled =
    isSending || emails.length === 0 || (Date.now() - lastEmailSendTime.current < emailCooldownMs);

  return (
    <div className="max-w-6xl w-full mx-auto py-10 px-8 flex flex-col items-center gap-10">
      <h1 className="text-5xl font-extrabold text-zinc-50 drop-shadow-lg lowercase">stop! don't go on</h1>

      <CameraFeed ref={cameraRef} />

      <Button onClick={sendScreenshotEmail} disabled={isSendButtonDisabled}>
        {isSending ? 'sending...' : 'send screenshot email'}
      </Button>

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
          screenshot email sent!
        </div>
      )}
    </div>
  );
}

export default App;