'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react';

interface CourtroomEvent {
  id: string;
  emoji: string;
  bot: string;
  action: string;
  token: string;
  chain: string;
  status: 'running' | 'complete' | 'verdict';
  score?: number;
  timestamp: number;
}

const BOTS = [
  { name: 'SecurityBot', emoji: '🔒' },
  { name: 'SocialBot', emoji: '🐦' },
  { name: 'TechnicalBot', emoji: '📊' },
  { name: 'TokenomicsBot', emoji: '💰' },
  { name: 'MacroBot', emoji: '🌍' },
  { name: 'DevilsAdvocate', emoji: '😈' },
  { name: 'VisionBot', emoji: '👁️' },
];

const TOKENS = ['PEPE', 'SHIB', 'DOGE', 'WIF', 'BONK', 'FLOKI', 'BRETT', 'MOG', 'TURBO', 'MEME'];
const CHAINS = ['Base', 'Ethereum', 'Arbitrum', 'Solana', 'Polygon'];
const ACTIONS_RUNNING = ['analyzing', 'scanning', 'reviewing', 'debating'];
const ACTIONS_COMPLETE = ['completed scan on', 'finished analysis of', 'verified'];

function generateEvent(): CourtroomEvent {
  const isVerdict = Math.random() < 0.15;
  const isComplete = !isVerdict && Math.random() < 0.5;
  const bot = BOTS[Math.floor(Math.random() * BOTS.length)];
  const token = TOKENS[Math.floor(Math.random() * TOKENS.length)];
  const chain = CHAINS[Math.floor(Math.random() * CHAINS.length)];
  
  if (isVerdict) {
    const score = (Math.random() * 4 + 5).toFixed(1);
    return {
      id: Math.random().toString(36).slice(2),
      emoji: '⚖️',
      bot: 'Verdict',
      action: `reached for`,
      token,
      chain,
      status: 'verdict',
      score: parseFloat(score), // Hidden unless premium
      timestamp: Date.now(),
    };
  }
  
  if (isComplete) {
    return {
      id: Math.random().toString(36).slice(2),
      emoji: '✅',
      bot: bot.name,
      action: ACTIONS_COMPLETE[Math.floor(Math.random() * ACTIONS_COMPLETE.length)],
      token,
      chain,
      status: 'complete',
      timestamp: Date.now(),
    };
  }
  
  return {
    id: Math.random().toString(36).slice(2),
    emoji: '🔄',
    bot: bot.name,
    action: ACTIONS_RUNNING[Math.floor(Math.random() * ACTIONS_RUNNING.length)],
    token,
    chain,
    status: 'running',
    timestamp: Date.now(),
  };
}

interface LiveCourtroomFeedProps {
  showScores?: boolean; // Only true for highest tier (Consensus)
}

export default function LiveCourtroomFeed({ showScores = false }: LiveCourtroomFeedProps) {
  const [events, setEvents] = useState<CourtroomEvent[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Generate initial events
    const initial = Array.from({ length: 5 }, () => generateEvent());
    setEvents(initial);

    // Add new events periodically
    const interval = setInterval(() => {
      setEvents((prev) => {
        const newEvent = generateEvent();
        return [newEvent, ...prev].slice(0, 8);
      });
    }, 2000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, []);

  // Render a deterministic placeholder until mounted to avoid hydration mismatches.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="rounded-2xl bg-vs-surface/50 border border-vs-border p-4">
        <h3 className="text-sm font-semibold text-vs-muted mb-3 flex items-center gap-2">
          ⚖️ LIVE COURTROOM ACTIVITY
        </h3>
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-8 bg-vs-surface/30 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-vs-surface/50 border border-vs-border p-4">
      <h3 className="text-sm font-semibold text-vs-muted mb-3 flex items-center gap-2">
        <span className="animate-pulse">⚖️</span> LIVE COURTROOM ACTIVITY
      </h3>
      <ul className="space-y-2">
        {events.map((event, i) => (
          <li
            key={event.id}
            className="text-sm flex items-center gap-2 transition-opacity duration-500"
            style={{ opacity: 1 - i * 0.1 }}
          >
            <span className={event.status === 'running' ? 'animate-spin' : ''}>
              {event.emoji}
            </span>
            <span className="text-vs-cyan">{event.bot}</span>
            <span className="text-vs-muted">{event.action}</span>
            <span className="text-white font-medium">{event.token}</span>
            {event.status === 'verdict' && (
              showScores ? (
                <span className="text-green-400 font-bold">{event.score}/10</span>
              ) : (
                <span className="text-vs-muted text-xs bg-vs-surface px-2 py-0.5 rounded">
                  🔒 Score hidden
                </span>
              )
            )}
          </li>
        ))}
      </ul>
      {!showScores && (
        <p className="text-xs text-vs-muted mt-3 pt-3 border-t border-vs-border">
          💎 Upgrade to <span className="text-vs-purple">Consensus tier</span> to see live scores
        </p>
      )}
    </div>
  );
}
