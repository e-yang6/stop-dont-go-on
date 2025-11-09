/*
 * Nose Centering Arduino Code with Dual Servo Support
 * Receives nose X coordinates from Python script and centers your nose in the webcam
 * Spin sequence runs on a separate servo (pin 10) triggered from Python software
 *
 * Hardware setup:
 * - Servo 1 (pin 9): Controls webcam rotation for nose centering
 * - Servo 2 (pin 10): Performs spin sequence when triggered
 * - Webcam mounted on servo 1
 * - Optional LED on pin 13 for status indication
 */

#include <Servo.h>

Servo webcamServo;  // Servo for webcam centering (pin 9)
Servo spinServo;    // Servo for spin sequence (pin 10)
const int webcamServoPin = 9;
const int spinServoPin = 10;
const int ledPin = 13;

// Webcam dimensions (adjust to match your camera resolution)
const int WEBCAM_WIDTH = 640;
const int WEBCAM_HEIGHT = 480;
const int WEBCAM_CENTER_X = WEBCAM_WIDTH / 2;

// Servo parameters
const int SERVO_MIN = 0;      // Minimum servo angle
const int SERVO_MAX = 180;    // Maximum servo angle
const int SERVO_CENTER = 90;  // Center position

// Control parameters
float currentAngle = SERVO_CENTER;  // Current servo position
const float SMOOTHING_FACTOR = 0.8; // Smoothing factor (0-1, higher = more smoothing)
const int DEAD_ZONE = 5;           // Dead zone around center (pixels) - small for precise centering

// Communication variables
String inputString = "";
boolean stringComplete = false;

void setup() {
  Serial.begin(9600);

  // Initialize webcam servo (for face centering)
  webcamServo.attach(webcamServoPin);
  webcamServo.write(SERVO_CENTER);

  // Initialize spin servo (for spin sequence) - detached by default
  // We'll attach it only when needed to save power

  // Initialize LED
  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, HIGH); // LED on to indicate ready

  Serial.println("Dual Servo Nose Centering System Ready!");
  Serial.println("- Servo 1 (pin 9): Nose centering");
  Serial.println("- Servo 2 (pin 10): Spin sequence");
  Serial.println("Waiting for nose coordinates...");
  Serial.println("Spin sequence controlled from Python software!");

  delay(1000); // Give servo time to move to center
  digitalWrite(ledPin, LOW);
}

void loop() {
  // Check for incoming serial data
  if (stringComplete) {
    processCoordinates(inputString);

    // Clear the string for next input
    inputString = "";
    stringComplete = false;
  }

  delay(10); // Small delay for stability
}

void processCoordinates(String data) {
  // Trim any whitespace
  data.trim();

  // Check if it's a special command
  if (data.equals("SPIN")) {
    Serial.println("Spin command received from Python!");
    performSpinSequence();
    return;
  }

  // Parse X coordinate from string format "X"
  int x = data.toInt();

  if (x >= 0 && x <= WEBCAM_WIDTH) {  // Valid coordinate received (0-640)
    // Blink LED to show we received data
    digitalWrite(ledPin, HIGH);

    // Calculate desired servo angle based on X coordinate
    float targetAngle = calculateServoAngle(x);

    // Apply smoothing to reduce jitter
    currentAngle = (SMOOTHING_FACTOR * currentAngle) + ((1 - SMOOTHING_FACTOR) * targetAngle);

    // Constrain angle to servo limits
    currentAngle = constrain(currentAngle, SERVO_MIN, SERVO_MAX);

    // Move servo to center face
    webcamServo.write((int)currentAngle);

    // Debug output
    Serial.print("Nose X:");
    Serial.print(x);
    Serial.print(" -> Centering Angle:");
    Serial.println((int)currentAngle);

    digitalWrite(ledPin, LOW);
  }
}

float calculateServoAngle(int x) {
  // Calculate how far nose is from webcam center
  int offsetFromCenter = x - WEBCAM_CENTER_X;

  // Apply dead zone - don't move if nose is already centered
  if (abs(offsetFromCenter) < DEAD_ZONE) {
    return currentAngle; // Don't change angle if within dead zone
  }

  // Map X coordinate to servo angle for CENTERING
  // If nose is left of center (x < center), servo moves right to center nose (lower angle)
  // If nose is right of center (x > center), servo moves left to center nose (higher angle)
  // This creates a centering behavior rather than pointing behavior

  float angle = map(x, 0, WEBCAM_WIDTH, SERVO_MIN, SERVO_MAX);

  return angle;
}

void performSpinSequence() {
  Serial.println("🌀 Starting spin sequence on secondary servo (pin 10)!");

  // Attach the spin servo
  spinServo.attach(spinServoPin);
  delay(100); // Give it time to attach

  // Blink LED during spin sequence
  digitalWrite(ledPin, HIGH);

  // Perform custom spin sequence: move between 0 and 300 degrees, repeat twice
  for (int i = 0; i < 2; i++) {        // repeat 2 times
    Serial.print("Spin cycle ");
    Serial.print(i + 1);
    Serial.println(" of 2");

    // Move to 0 degrees
    spinServo.write(0);
    delay(1000);                       // wait 1 second

    // Move to 300 degrees (Note: most servos max at 180, so we'll use 180)
    // If you have a 360-degree servo, change this to 300
    spinServo.write(180);              // or 300 for 360-degree servos
    delay(1000);                       // wait 1 second
  }

  // Detach the spin servo to save power and avoid interference
  spinServo.detach();

  Serial.println("✅ Spin sequence complete! Spin servo detached.");
  Serial.println("   Nose centering continues on main servo (pin 9)...");
  digitalWrite(ledPin, LOW);
}

// Serial event handler
void serialEvent() {
  while (Serial.available()) {
    char inChar = (char)Serial.read();

    if (inChar == '\r' || inChar == '\n') {
      stringComplete = true;
    } else {
      inputString += inChar;
    }
  }
}

// Alternative manual control function (call this in loop for testing)
void manualTest() {
  // Sweep servo back and forth for testing
  static unsigned long lastMove = 0;
  static int direction = 1;
  static float testAngle = SERVO_CENTER;

  if (millis() - lastMove > 50) {
    testAngle += direction * 2;

    if (testAngle >= SERVO_MAX || testAngle <= SERVO_MIN) {
      direction *= -1;
    }

    webcamServo.write((int)testAngle);
    lastMove = millis();

    Serial.print("Test angle: ");
    Serial.println((int)testAngle);
  }
}
