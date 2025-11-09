# Stop! Don’t Go On

This project is a “gooning accountability” web app. When it senses you gooning, it flashes the screen, starts a countdown, and throws a quick math problem at you. If you keep going instead of solving the challenge, it snaps a photo from your webcam mid goon and emails it to the people you added as watchers. There’s optional hardware support too: an Arduino setup can keep the camera pointed at you and, during an alert, trigger a servo-powered water sprayer aimed at the user.

---

## In Plain Terms

- **You start gooning**
- **It starts a big red countdown** and makes you solve a simple math question.  
- **Solve it in time** → everything calms down.  
- **Miss it or keep gooning** → a webcam screenshot is taken and emailed to your chosen contacts.  
- **Add the Arduino extras** if you want a physical reminder that someone could be watching—complete with a servo that sprays water in your direction when the alert fires.

---

## What You Need

- A computer with a webcam, microphone, and a modern browser.  
- Node.js (for the React frontend) and Python (for the optional backend).  
- An EmailJS account if you want the automatic emails to go out.  
- Optional: an Arduino with two servos to physically track and “alert” during the countdown (the alert servo pulls the trigger on a small water sprayer).

---

## How To Try It

1. **Install everything once**
   ```bash
   ./setup.sh     # or run npm install + pip install manually
   ```
2. **Start the backend** (needed for the hardware version or just leave it running for fun)
   ```bash
   ./start_backend.sh    # full setup with cameras + Arduino
   # or ./start_simple_backend.sh for a fake backend that just logs activity
   ```
3. **Start the web app**
   ```bash
   npm run dev
   ```
4. Visit `http://localhost:3000`, allow camera + mic access, add a few email addresses, and give it a try.

---

## Optional Hardware Setup

Upload `arduino_code.ino` to your Arduino and plug in:

- Servo on pin 9 to tilt the webcam toward your face.  
- Servo on pin 10 to fire the water sprayer whenever an alert is active.  
- Share power and ground with both servos.

Even without the Arduino, the app runs fully in “screen only” mode – you’ll just see the flashing overlay and email alerts.

---

## Extra

- `start_backend.sh` and `start_simple_backend.sh` keep you from juggling virtual environments manually.  
- `release_camera.py` can free up a webcam that’s stuck “in use” on macOS or Linux.  
- `INTEGRATION_README.md` explains the hardware side if you want more detail later.


