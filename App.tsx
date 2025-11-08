import React, { useState, useRef, useEffect } from 'react';
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

function App() {
  const [emails, setEmails] = useState<string[]>([]); // Removed example email
  const [newEmail, setNewEmail] = useState<string>('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showEmailSentNotification, setShowEmailSentNotification] = useState(false);
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
    setEmails([...emails, newEmail.toLowerCase()]);
    setNewEmail('');
    setEmailError(null);
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setEmails(emails.filter(email => email !== emailToRemove));
  };

  const simulateEmailSend = (subject: string, body: string, attachment?: string) => {
    if (emails.length === 0) {
      alert('no email recipients added to send to.');
      return;
    }
    console.log('--- simulated email sent ---');
    console.log(`to: ${emails.join(', ')}`);
    console.log(`subject: ${subject}`);
    console.log(`body: ${body}`);
    if (attachment) {
      console.log('attachment: [base64 image data]');
      // In a real app, you'd integrate with an email API here.
      // For demonstration, we'll log a snippet of the base64 data.
      console.log(`data:image/png;base64,${attachment.substring(0, 50)}...`);
    }
    console.log('---------------------------');
    setShowEmailSentNotification(true);

    if (sendEmailTimer.current) {
      clearTimeout(sendEmailTimer.current);
    }
    sendEmailTimer.current = window.setTimeout(() => {
      setShowEmailSentNotification(false);
      sendEmailTimer.current = null;
    }, 3000); // Notification disappears after 3 seconds
  };

  const sendScreenshotEmail = async () => {
    const now = Date.now();
    if (now - lastEmailSendTime.current < emailCooldownMs) {
      setEmailError(`please wait ${Math.ceil((emailCooldownMs - (now - lastEmailSendTime.current)) / 1000)} seconds before sending another email.`);
      return;
    }
    setEmailError(null); // Clear previous errors

    const videoElement = cameraRef.current?.getVideoElement();
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      setEmailError('camera is not active or video feed is not ready.');
      return;
    }

    if (emails.length === 0) {
      setEmailError('no email recipients added.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setEmailError('could not get canvas context for image capture.');
      return;
    }

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setEmailError('failed to capture screenshot.');
        return;
      }
      const base64Image = await blobToBase64(blob);
      simulateEmailSend('screenshot from webcam', 'here is a screenshot from the webcam.', base64Image);
      lastEmailSendTime.current = now; // Update last send time
    }, 'image/png', 1); // Capture as PNG with full quality
  };

  useEffect(() => {
    return () => {
      if (sendEmailTimer.current) {
        clearTimeout(sendEmailTimer.current);
      }
    };
  }, []);

  const isSendButtonDisabled = emails.length === 0 || (Date.now() - lastEmailSendTime.current < emailCooldownMs);

  return (
    <div className="max-w-6xl w-full mx-auto py-10 px-8 flex flex-col items-center gap-10">
      <h1 className="text-5xl font-extrabold text-zinc-50 drop-shadow-lg lowercase">stop! don't go on</h1>

      <CameraFeed ref={cameraRef} />

      <Button onClick={sendScreenshotEmail} disabled={isSendButtonDisabled}>
        send screenshot email
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