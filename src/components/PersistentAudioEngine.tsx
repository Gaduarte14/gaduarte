import React, { useEffect, useRef } from 'react';
import type { MusicTrack } from '../types/vtt.ts';

interface PersistentAudioEngineProps {
  tracks: MusicTrack[];
}

/**
 * Hidden Background Multi-Track YouTube & WebAudio Engine (`background.html` / `engine.js` architecture).
 * Stays mounted at the root of `<App />` outside any tab or drawer so that:
 * 1. The YouTube video is NEVER displayed in the UI (`w-0 h-0 opacity-0 pointer-events-none`).
 * 2. Music and ambient layers continue playing seamlessly when the user switches tabs or closes the sidebar.
 * 3. Volume changes are sent dynamically to each YouTube player via `postMessage` (`setVolume`).
 */
export const PersistentAudioEngine: React.FC<PersistentAudioEngineProps> = ({ tracks }) => {
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const activeTracks = tracks.filter((t) => t.tocando && t.youtubeId);

  // Sync volume via YouTube IFrame Player API postMessage whenever track.volume changes
  useEffect(() => {
    for (const track of activeTracks) {
      const iframe = iframeRefs.current[track.id];
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func: 'setVolume',
            args: [track.volume],
          }),
          '*'
        );
      }
    }
  }, [activeTracks]);

  return (
    <div
      aria-hidden="true"
      data-testid="persistent-audio-engine"
      className="fixed -bottom-10 -left-10 w-px h-px overflow-hidden opacity-0 pointer-events-none"
    >
      {activeTracks.map((track) => (
        <iframe
          key={track.id}
          ref={(el) => {
            iframeRefs.current[track.id] = el;
          }}
          title={`Background Audio Engine - ${track.titulo}`}
          src={`https://www.youtube.com/embed/${track.youtubeId}?autoplay=1&controls=0&enablejsapi=1&loop=${
            track.loop ? 1 : 0
          }&playlist=${track.youtubeId}`}
          allow="autoplay; encrypted-media"
          onLoad={(e) => {
            const win = e.currentTarget.contentWindow;
            if (win) {
              win.postMessage(
                JSON.stringify({
                  event: 'command',
                  func: 'setVolume',
                  args: [track.volume],
                }),
                '*'
              );
            }
          }}
        />
      ))}
    </div>
  );
};
