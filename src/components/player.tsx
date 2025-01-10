'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Pause, Play, Volume, Volume1, Volume2, MoreHorizontal, ArrowLeft, SkipBack, SkipForward } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import LineBreaker from '@/components/linebreak';

interface LyricLine {
  time: number;
  text: string;
}

interface PlayerProps {
  lyricsData: LyricLine[];
  audioUrl: string;
  trackName: string;
  albumName: string;
  artistName: string;
  onBack: () => void;
}

interface Settings {
  showplayercontrol: boolean;
  fullplayer: boolean;
  fontSize: 'small' | 'medium' | 'large';
  lyricposition: 'left' | 'center' | 'right';
  backgroundblur: 'none' | 'small' | 'medium' | 'large';
  theme: 'system' | 'dark' | 'light';
  playerposition: 'left' | 'center' | 'right';
  volume: number;
}

const DEFAULT_SETTINGS: Settings = {
  showplayercontrol: true,
  fullplayer: false,
  fontSize: 'medium',
  lyricposition: 'left', 
  backgroundblur: 'medium',
  theme: 'system',
  playerposition: 'right',
  volume: 50
};

const Player: React.FC<PlayerProps> = ({
  lyricsData,
  audioUrl,
  trackName,
  albumName,
  artistName,
  onBack
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const youtubeRef = useRef<YouTube['internalPlayer'] | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(50);
  const [isLyricsHovered, setIsLyricsHovered] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const SCROLL_DURATION = 1000;
  const { setTheme, resolvedTheme } = useTheme();
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [wasFullPlayerManuallySet, setWasFullPlayerManuallySet] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => {
    const savedSettings = localStorage.getItem('playerSettings');
    return savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;
  });

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prevSettings) => {
      const updatedSettings = { ...prevSettings, ...newSettings };
      localStorage.setItem('playerSettings', JSON.stringify(updatedSettings));
      return updatedSettings;
    });
  };  

  useEffect(() => {
    setVolume(settings.volume);
  }, [settings.volume]);  

  useEffect(() => {
    const handleResize = () => {
      const isCurrentlyMobile = window.innerWidth <= 768;
      setIsMobile(isCurrentlyMobile);

      if (!wasFullPlayerManuallySet) {
        if (isCurrentlyMobile) {
          updateSettings({ fullplayer: true });
        } else {
          updateSettings({ fullplayer: false });
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [wasFullPlayerManuallySet]);
  
  const handleSettingChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (key === 'theme') {
      if (value === 'dark' || value === 'light' || value === 'system') {
        setTheme(value);
      } else {
        console.error("Invalid theme value");
      }
    }
  
    if (key === 'fullplayer') {
      setWasFullPlayerManuallySet(true);
    }
  
    updateSettings({ [key]: value });
  };  

  const cubicBezier = useCallback(
    (p1x: number, p1y: number, p2x: number, p2y: number) => {
      const NEWTON_ITERATIONS = 4;
      const NEWTON_MIN_SLOPE = 0.001;
      const SUBDIVISION_PRECISION = 0.0000001;
      const SUBDIVISION_MAX_ITERATIONS = 10;

      const ax = 3.0 * p1x - 3.0 * p2x + 1.0;
      const bx = 3.0 * p2x - 6.0 * p1x;
      const cx = 3.0 * p1x;

      const ay = 3.0 * p1y - 3.0 * p2y + 1.0;
      const by = 3.0 * p2y - 6.0 * p1y;
      const cy = 3.0 * p1y;

      const sampleCurveX = (t: number) => ((ax * t + bx) * t + cx) * t;
      const sampleCurveY = (t: number) => ((ay * t + by) * t + cy) * t;
      const sampleCurveDerivativeX = (t: number) =>
        (3.0 * ax * t + 2.0 * bx) * t + cx;

      const solveCurveX = (x: number) => {
        let t2 = x;
        for (let i = 0; i < NEWTON_ITERATIONS; i++) {
          const x2 = sampleCurveX(t2) - x;
          const d2 = sampleCurveDerivativeX(t2);
          if (Math.abs(x2) < SUBDIVISION_PRECISION) {
            return t2;
          }
          if (Math.abs(d2) < NEWTON_MIN_SLOPE) {
            break;
          }
          t2 -= x2 / d2;
        }

        let t0 = 0.0;
        let t1 = 1.0;
        t2 = x;

        for (let i = 0; i < SUBDIVISION_MAX_ITERATIONS; i++) {
          const x2 = sampleCurveX(t2) - x;
          if (Math.abs(x2) < SUBDIVISION_PRECISION) {
            return t2;
          }
          if (x2 > 0.0) {
            t1 = t2;
          } else {
            t0 = t2;
          }
          t2 = (t1 + t0) / 2.0;
        }
        return t2;
      };

      return (t: number) => sampleCurveY(solveCurveX(t));
    },
    []
  );

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    youtubeRef.current = event.target;
    setDuration(event.target.getDuration());
    event.target.setVolume(settings.volume);
  };
  
  const updateTime = () => {
    if (youtubeRef.current) {
      const time = youtubeRef.current.getCurrentTime();
      setCurrentTime(time);
      let index = -1;
      for (let i = 0; i < lyricsData.length; i++) {
        if (lyricsData[i].time <= time) {
          index = i;
        } else {
          break;
        }
      }
      setCurrentLineIndex(index);
    }
  };

  const onStateChange: YouTubeProps['onStateChange'] = (event) => {
    if (event.data === 1) {
      const interval = setInterval(() => {
        updateTime();
      }, 100);
      const stopUpdating = () => {
        clearInterval(interval);
      };
      youtubeRef.current?.addEventListener("onStateChange", stopUpdating);
    }
  };

  const smoothScrollTo = useCallback(
    (element: HTMLElement, to: number, duration: number) => {
      const start = element.scrollTop;
      const change = to - start;
      const startTime = performance.now();

      const bezier = cubicBezier(0.22, 1, 0.36, 1);

      const animateScroll = (currentT: number) => {
        const elapsed = currentT - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = bezier(progress);
        element.scrollTop = start + change * ease;
        if (elapsed < duration) {
          requestAnimationFrame(animateScroll);
        }
      };
      requestAnimationFrame(animateScroll);
    },
    [cubicBezier]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      let index = -1;
      for (let i = 0; i < lyricsData.length; i++) {
        if (lyricsData[i].time <= audio.currentTime) {
          index = i;
        } else {
          break;
        }
      }
      setCurrentLineIndex(index);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [lyricsData]);

  useEffect(() => {
    if (!lyricsContainerRef.current) return;
    const container = lyricsContainerRef.current;
    const activeLyric = document.getElementById(`lyric-${currentLineIndex}`);
    if (activeLyric) {
      const containerHeight = container.clientHeight;
      const contentHeight = container.scrollHeight;
      const lyricOffsetTop = activeLyric.offsetTop;
      const lyricHeight = activeLyric.clientHeight;
      let targetScrollTop;
      if (isMobile) {
        const displayHeight = window.innerHeight;
        const offsetFromTop = displayHeight * 0.3;
        targetScrollTop = lyricOffsetTop - offsetFromTop + lyricHeight / 2;
      } else {
        targetScrollTop = lyricOffsetTop - containerHeight / 2 + lyricHeight / 2;
      }
      targetScrollTop = Math.max(
        0,
        Math.min(targetScrollTop, contentHeight - containerHeight)
      );
      smoothScrollTo(container, targetScrollTop, SCROLL_DURATION);
    }
  }, [currentLineIndex, lyricsData, smoothScrollTo, isMobile]);  

  const togglePlayPause = () => {
    const audio = youtubeRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pauseVideo();
    } else {
      audio.playVideo();
    }
  };

  const handleSkipBack = () => {
    const audio = youtubeRef.current;
    if (!audio) return;
    const Time = 0;
    setCurrentTime(Time);
    audio.seekTo(Time);
    if (lyricsContainerRef.current) {
      smoothScrollTo(lyricsContainerRef.current, 0, SCROLL_DURATION);
    }
  };
  
  const handleSkipForward = () => {
    const audio = youtubeRef.current;
    if (!audio) return;
    const newTime = duration;
    setCurrentTime(newTime);
    audio.seekTo(newTime);
    if (lyricsContainerRef.current) {
      smoothScrollTo(lyricsContainerRef.current, newTime, SCROLL_DURATION);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = youtubeRef.current;
    if (!audio) return;
    const newVolume = value[0];
    setVolume(newVolume);
    audio.setVolume(newVolume);
    updateSettings({ volume: newVolume });
  };  

  const handleProgressChange = (value: number[]) => {
    const audio = youtubeRef.current;
    if (!audio) return;
    const newTime = value[0];
    setCurrentTime(newTime);
    audio.seekTo(newTime);
  };

  const handleLyricClick = (time: number) => {
    const audio = youtubeRef.current;
    if (!audio) return;
    audio.seekTo(time);
    setCurrentTime(time);
    if (!isPlaying) {
      audio.playVideo();
    }
  };

  const handleLyricsMouseEnter = () => {
    setIsLyricsHovered(true);
  };

  const handleLyricsMouseLeave = () => {
    setIsLyricsHovered(false);
  };

  const formatTime = (time: number): string => {
    const m = Math.floor(time / 60).toString().padStart(2, '0');
    const s = Math.floor(time % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  useEffect(() => {
    const audio = youtubeRef.current;
    if (audio) {
      audio.setVolume(settings.volume);
      setVolume(settings.volume);
    }
  }, [settings.volume]);  

  const getInterludeDotsColor = (): string => {
    return resolvedTheme === 'dark' ? 'rgba(255,255,255,' : 'rgba(0,0,0,';
  };

  const renderInterludeDots = (startTime: number, endTime: number) => {
    const total = endTime - startTime;
    if (total <= 0) return null;

    const dt = currentTime - startTime;

    if (dt < 0) return null;
    if (dt >= total) return null;

    const appearEnd = 2;
    const exitStart = total - 1;

    let parentScale = 1.0;
    let opacity = 1.0;
    let transformTransition = '4s cubic-bezier(0.19, 1, 0.22, 1)'; 
    let opacityTransition = '0.5s cubic-bezier(0.19, 1, 0.22, 1)';
    let dotFills: [number, number, number] = [0, 0, 0];

    if (dt < appearEnd) {
      const ratio = dt / appearEnd;
      opacity = ratio;
      dotFills = [0, 0, 0];
    }
    else if (dt < exitStart) {
      const dtMid = dt - appearEnd; 
      const midDuration = Math.max(0, total - (appearEnd + 1));

      let ratio = 0;
      if (midDuration > 0) {
        ratio = dtMid / midDuration;
        if (ratio > 1) ratio = 1;
      }
      const leftFill = Math.min(1, ratio * 3);
      const centerFill = ratio < 1 / 3 ? 0 : Math.min(1, (ratio - 1 / 3) * 3);
      const rightFill = ratio < 2 / 3 ? 0 : Math.min(1, (ratio - 2 / 3) * 3);
      dotFills = [leftFill, centerFill, rightFill];

      const modT = dtMid % 4;
      if (modT < 2) {
        parentScale = 1.1;
      } else {
        parentScale = 1.0;
      }

      opacity = 1;
    }
    else {
      const dtExit = dt - exitStart;

      if (dtExit < 0.5) {
        transformTransition = '1s cubic-bezier(0.19, 1, 0.22, 1)';
        parentScale = 1.3;
        opacity = 1;
      }
      else if (dtExit < 1.5) {
        transformTransition = '1s cubic-bezier(0.19, 1, 0.22, 1)';
        opacityTransition = '0.5s cubic-bezier(0.19, 1, 0.22, 1)';
        parentScale = 0.8;
        opacity = 0;
      }

      dotFills = [1, 1, 1];
    }

    const fontSizeScale = settings.fontSize === 'small' ? -0.1 : settings.fontSize === 'large' ? 0.2 : 0;
    const parentStyle: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      opacity: opacity,
      transition: `transform ${transformTransition}, opacity ${opacityTransition}`,
      position: 'absolute',
      left: settings.lyricposition === 'center' ? '50%' : settings.lyricposition === 'right' ? 'auto' : settings.fontSize === 'small' ? '5px' : settings.fontSize === 'medium' ? '10px' : '15px',
      right: settings.lyricposition === 'right' ? (settings.fontSize === 'small' ? '5px' : settings.fontSize === 'medium' ? '10px' : '15px') : 'auto',
      transform: settings.lyricposition === 'center' ? `translateX(-50%) scale(${parentScale + fontSizeScale})` : `scale(${parentScale + fontSizeScale})`,
    };

    const dotStyle = (fill: number) => {
      const alpha = 0.2 + 0.8 * fill;
      return {
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        backgroundColor: `${getInterludeDotsColor()}${alpha})`,
        margin: '0 6px',
        transition: `background-color ${transformTransition}`,
      } as React.CSSProperties;
    };

    return (
      <div style={parentStyle}>
        <span style={dotStyle(dotFills[0])} />
        <span style={dotStyle(dotFills[1])} />
        <span style={dotStyle(dotFills[2])} />
      </div>
    );
  };

  return (
    <>
      <div
        className={`fixed inset-0 flex flex-col justify-center z-50 
          ${settings.lyricposition === 'center' ? 'items-center text-center' : 
            settings.lyricposition === 'right' ? `items-end ${isMobile ? 'right-0' : 'right-20'}` : 
            `items-start ${isMobile ? 'left-0' : 'left-20'}`}
          text-gray-900 dark:text-white
        `}
      >
        <div
          className={`overflow-y-auto w-5/6 hidden-scrollbar
            ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}
            ${settings.fullplayer ? 'h-[92vh]' : 'h-full'}
            ${settings.fullplayer && settings.showplayercontrol ? 'mb-20' : ''}
            ${isMobile ? 'p-5' : ''}
            mask-image: linear-gradient(0deg, rgba(0,0,0,0) 0%, #000 30%, #000 70%, rgba(0,0,0,0) 100%);
            -webkit-mask-image: linear-gradient(0deg, rgba(0,0,0,0) 0%, #000 30%, #000 70%, rgba(0,0,0,0) 100%);
          `}
          style={{
            maskImage: isMobile || isLyricsHovered
              ? 'linear-gradient(0deg, rgba(0,0,0,0) 0%, #000 30%, #000 70%, rgba(0,0,0,0) 100%)'
              : 'linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 30%, #000 70%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: isMobile || isLyricsHovered
              ? 'linear-gradient(0deg, rgba(0,0,0,0) 0%, #000 30%, #000 70%, rgba(0,0,0,0) 100%)'
              : 'linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 30%, #000 70%, rgba(0,0,0,0) 100%)',
            marginBottom: settings.fullplayer ? (settings.showplayercontrol ? '92px' : '0') : '0',
            padding: isMobile ? '20px' : ''
          }}
          ref={lyricsContainerRef}
          onMouseEnter={handleLyricsMouseEnter}
          onMouseLeave={handleLyricsMouseLeave}
        >
          <div className="relative">
            <div style={{ height: '500px' }}></div>

            {lyricsData.map((line, index) => {
              const isActive = index === currentLineIndex;
              const isPast = index < currentLineIndex;
              const isInterlude = line.text.trim() === '';
              const isCurrentLineInterlude = lyricsData[currentLineIndex]?.text.trim() === '';

              let nextTime = duration;
              if (index + 1 < lyricsData.length) {
                nextTime = lyricsData[index + 1].time;
              }
              let EndTime = nextTime - 0.5;
              if (EndTime < line.time) {
                EndTime = line.time;
              }

              const opacity = isLyricsHovered
                ? 1
                : isActive
                ? 1
                : isPast
                ? 0
                : 1;

              return (
                <p
                  key={index}
                  id={`lyric-${index}`}
                  className={`transition-all duration-700 px-2 rounded-lg 
                    ${isInterlude
                      ? 'm-0 p-0'
                      : `my-8 
                          ${isActive 
                            ? 'text-black dark:text-white font-bold' 
                            : 'text-black text-opacity-50 dark:text-white dark:text-opacity-40 hover:text-gray-900 dark:hover:text-gray-300 cursor-pointer'
                          }`
                    }`}
                  style={{
                    opacity,
                    fontSize: {
                      small: '2.0rem',
                      medium: '3.0rem',
                      large: '4.0rem'
                    }[settings.fontSize],
                    fontWeight: 'bold',
                    textAlign: settings.lyricposition,
                    transform:
                      isCurrentLineInterlude && index > currentLineIndex
                        ? 'translateY(55px)'
                        : 'translateY(0)',
                    transition:
                      'transform 1s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.7s, margin 1s, padding 1s, color 0.5s',
                    wordWrap: 'break-word',
                    wordBreak: 'break-word',
                  }}
                  onClick={() => handleLyricClick(line.time)}
                >
                  {isInterlude && isActive
                    ? renderInterludeDots(line.time, EndTime)
                    : isInterlude
                    ? null
                    : <LineBreaker text={line.text} />}
                </p>
              );
            })}
            <div style={{ height: '500px' }}></div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{
          width: settings.fullplayer || isMobile ? "100%" : "",
          margin: settings.fullplayer || isMobile ? "0" : "20px",
          bottom: !settings.showplayercontrol
            ? isMobile
              ? "-300px"
              : "-150px"
            : "0",
        }}
        animate={{
          width: settings.fullplayer || isMobile ? "100%" : "",
          margin: settings.fullplayer || isMobile ? "0" : "20px",
          bottom: !settings.showplayercontrol
            ? isMobile
              ? "-300px"
              : "-150px"
            : "0",
        }}
        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
        className={`fixed z-50 
          ${settings.playerposition === "left"
            ? "left-0"
            : settings.playerposition === "right"
            ? "right-0"
            : "left-1/2 transform -translate-x-1/2"
          } 
          ${isMobile ? "rounded-t-lg" : settings.fullplayer ? "rounded-t-lg" : "rounded-lg"} 
          bg-white dark:bg-gray-800 
          shadow-2xl`}        
      >
        <div className="h-full flex flex-col justify-between p-4">
          {isMobile ? (
            <>
              <div className="text-gray-900 dark:text-white mb-3">
                <p className="font-medium text-sm overflow-hidden text-nowrap text-ellipsis">
                  {trackName.length > 40 ? `${trackName.slice(0, 40)}...` : trackName}
                </p>
                <p className="text-xs overflow-hidden text-nowrap text-ellipsis text-gray-600 dark:text-gray-400">
                  {artistName.length > 40 ? `${artistName.slice(0, 40)}...` : artistName} - 
                  {albumName.length > 40 ? `${albumName.slice(0, 40)}...` : albumName}
                </p>
              </div>
              <div className="flex items-center justify-between my-3">
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {formatTime(currentTime)}
                </span>
                <Slider
                  value={[currentTime]}
                  max={duration}
                  step={0.1}
                  className="flex-1 mx-2"
                  onValueChange={handleProgressChange}
                />
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {formatTime(duration)}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-10 my-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSkipBack}
                      className="text-gray-900 dark:text-white"
                    >
                      <SkipBack 
                        size={20}
                        style={{
                          width: '50px',
                          height: '50px',
                          fill: 'currentColor',
                        }}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={togglePlayPause}
                      className="text-gray-900 dark:text-white"
                    >
                      {isPlaying ? (
                        <Pause
                          size={20}
                          style={{
                            width: '50px',
                            height: '50px',
                            fill: 'currentColor',
                            stroke: 'none',
                          }}
                        />
                      ) : (
                        <Play
                          size={20}
                          style={{
                            width: '50px',
                            height: '50px',
                            fill: 'currentColor',
                            stroke: 'none',
                          }}
                        />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSkipForward}
                      className="text-gray-900 dark:text-white"
                    >
                      <SkipForward 
                        size={20}
                        style={{
                          width: '50px',
                          height: '50px',
                          fill: 'currentColor',
                        }}
                      />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 my-3">
                  <Volume className="h-4 w-4 text-gray-900 dark:text-white" style={{ width: '20px', height: '20px', fill: 'currentColor' }} />
                  <Slider
                    value={[volume]}
                    max={100}
                    className="flex-1 mx-2"
                    onValueChange={handleVolumeChange}
                  />
                  <Volume2 className="h-4 w-4 text-gray-900 dark:text-white" style={{ width: '20px', height: '20px', fill: 'currentColor' }} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatTime(currentTime)}
                </span>
                <Slider
                  value={[currentTime]}
                  max={duration}
                  step={0.1}
                  className="flex-1"
                  onValueChange={handleProgressChange}
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatTime(duration)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSkipBack}
                      className="text-gray-900 dark:text-white"
                    >
                      <SkipBack size={24} style={{ fill: 'currentColor' }} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={togglePlayPause}
                      className="text-gray-900 dark:text-white"
                    >
                      {isPlaying ? <Pause size={24} style={{ fill: 'currentColor' }} /> : <Play size={24} style={{ fill: 'currentColor' }} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSkipForward}
                      className="text-gray-900 dark:text-white"
                    >
                      <SkipForward size={24} style={{ fill: 'currentColor' }} />
                    </Button>
                  </div>
                  <div className="flex items-center gap-4">
                    {volume === 0 && (
                      <Volume className="h-4 w-4 text-gray-900 dark:text-white" style={{ fill: 'currentColor' }} />
                    )}
                    {volume > 0 && volume <= 50 && (
                      <Volume1 className="h-4 w-4 text-gray-900 dark:text-white" style={{ fill: 'currentColor' }} />
                    )}
                    {volume > 50 && (
                      <Volume2 className="h-4 w-4 text-gray-900 dark:text-white" style={{ fill: 'currentColor' }} />
                    )}
                    <Slider
                      value={[volume]}
                      max={100}
                      className="w-28"
                      onValueChange={handleVolumeChange}
                    />
                  </div>
                </div>
                <div className={`text-right ml-5 text-gray-900 dark:text-white`}>
                  <p className="font-medium text-sm overflow-hidden text-nowrap text-ellipsis">
                    {trackName.length > (settings.fullplayer ? 60 : 40)
                      ? `${trackName.slice(0, settings.fullplayer ? 60 : 40)}...`
                      : trackName}
                  </p>
                  <p className="text-xs overflow-hidden text-nowrap text-ellipsis text-gray-600 dark:text-gray-400">
                    {artistName.length > (settings.fullplayer ? 50 : 30)
                      ? `${artistName.slice(0, settings.fullplayer ? 50 : 30)}...`
                      : artistName}{" "}
                    -{" "}
                    {albumName.length > (settings.fullplayer ? 40 : 20)
                      ? `${albumName.slice(0, settings.fullplayer ? 40 : 20)}...`
                      : albumName}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>;

      <div className='fixed z-0 w-full h-full'>
        <div className={`w-full h-full fixed top-0 left-0 
          ${resolvedTheme === 'dark'
            ? 'bg-black bg-opacity-70'
            : 'bg-white bg-opacity-30'
          } 
          ${settings.backgroundblur === 'small'
            ? 'backdrop-blur-sm'
            : settings.backgroundblur === 'medium'
            ? 'backdrop-blur-md'
            : settings.backgroundblur === 'large'
            ? 'backdrop-blur-lg'
            : ''
          }`}>
        </div>
        <YouTube
          videoId={audioUrl}
          onReady={onPlayerReady}
          onPlay={() => {setIsPlaying(true)}}
          onPause={() => {setIsPlaying(false)}}
          onStateChange={onStateChange}
          style={{ width: "100%", height: "100%" }}
          iframeClassName="w-full h-full"
        />
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-white dark:bg-gray-800 border-0 overflow-scroll" style={{ maxHeight: '80vh' }}>
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-gray-900 dark:text-white">Show Player Controls</span>
              <Switch
                checked={settings.showplayercontrol}
                onCheckedChange={(checked) => handleSettingChange('showplayercontrol', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-900 dark:text-white">Full Player</span>
              <Switch
                checked={isMobile ? true : settings.fullplayer}
                onCheckedChange={(checked) => !isMobile && handleSettingChange('fullplayer', checked)}
                disabled={isMobile}
              />
            </div>

            <div className="space-y-2">
              <p className="text-gray-900 dark:text-white">Font Size</p>
              <div className="flex gap-2">
                {[
                  { value: 'small', label: 'Small' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'large', label: 'Large' }
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={settings.fontSize === option.value ? 'default' : 'secondary'}
                    onClick={() => handleSettingChange('fontSize', option.value as 'small' | 'medium' | 'large')}
                    className="flex-1"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-gray-900 dark:text-white">Lyric Position</p>
              <div className="flex gap-2">
                {[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' }
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={settings.lyricposition === option.value ? 'default' : 'secondary'}
                    onClick={() => handleSettingChange('lyricposition', option.value as 'left' | 'center' | 'right')}
                    className="flex-1"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-gray-900 dark:text-white">Background Blur</p>
              <div className="flex gap-2">
                {[
                  { value: 'none', label: 'None' },
                  { value: 'small', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'large', label: 'High' }
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={settings.backgroundblur === option.value ? 'default' : 'secondary'}
                    onClick={() => handleSettingChange('backgroundblur', option.value as 'none' | 'small' | 'medium' | 'large')}
                    className="flex-1"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-gray-900 dark:text-white">Theme</p>
              <div className="flex gap-2">
                {[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' },
                  { value: 'system', label: 'System' }
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={settings.theme === option.value ? 'default' : 'secondary'}
                    onClick={() => handleSettingChange('theme', option.value as 'dark' | 'light' | 'system')}
                    className="flex-1"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-gray-900 dark:text-white">Player Position</p>
              <div className="flex gap-2">
                {[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' }
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={settings.playerposition === option.value ? 'default' : 'secondary'}
                    onClick={() => !settings.fullplayer && handleSettingChange('playerposition', option.value as 'left' | 'center' | 'right')}
                    className="flex-1"
                    disabled={settings.fullplayer}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="fixed top-4 left-4 z-50 text-gray-900 dark:text-white"
      >
        <ArrowLeft size={30} style={{ width: '25px', height: '25px' }} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowSettings(true)}
        className="fixed top-4 right-4 z-50 text-gray-900 dark:text-white"
      >
        <MoreHorizontal size={30} style={{ width: '30px', height: '30px' }} />
      </Button>
    </>
  );
};

export default Player;