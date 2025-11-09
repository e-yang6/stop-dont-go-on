import React, { useRef, useEffect } from 'react';

interface AlertAudioProps {
  isPlaying: boolean;
}

const AlertAudio: React.FC<AlertAudioProps> = ({ isPlaying }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.loop = true;
        audioRef.current.play().catch(error => {
          console.error('Failed to play alert audio:', error);
        });
      } else {
        audioRef.current.pause();
        audioRef.current.currentTime = 0; // Reset to beginning
      }
    }
  }, [isPlaying]);

  return (
    <audio
      ref={audioRef}
      preload="auto"
      style={{ display: 'none' }}
    >
      <source src="/alert-audio.mp3" type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  );
};

export default AlertAudio;
