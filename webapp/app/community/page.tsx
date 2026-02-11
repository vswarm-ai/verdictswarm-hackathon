import Card from "@/components/ui/Card";
import Link from "next/link";

/* ─── Helpers ─── */

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-4 text-center">
      <div className="font-orbitron text-2xl font-bold md:text-3xl" style={{ color }}>{value}</div>
      <div className="text-xs text-white/40 mt-1">{label}</div>
    </div>
  );
}

function Phase({ number, title, description, items, status, accent }: {
  number: string; title: string; description: string; items: string[]; status: string; accent: string;
}) {
  return (
    <div className="rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold" style={{ background: `${accent}20`, color: accent }}>
            {number}
          </span>
          <h3 className="font-bold text-white">{title}</h3>
        </div>
        <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ color: accent, background: `${accent}15`, border: `1px solid ${accent}30` }}>
          {status}
        </span>
      </div>
      <p className="text-sm text-white/50">{description}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-white/60">
            <span className="mt-1 shrink-0" style={{ color: accent }}>✦</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Page ─── */

export default function CommunityPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 space-y-12">

      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="text-6xl">🐝</div>
        <h1 className="font-orbitron text-3xl font-bold md:text-5xl">
          Join <span className="text-[#6B46C1]">The Swarm</span>
        </h1>
        <p className="text-lg text-white/50 max-w-2xl mx-auto">
          VerdictSwarm isn&apos;t just a tool — it&apos;s a movement. A collective of smart money, 
          AI models, and believers who refuse to ape blind. The earlier you join, the more you shape what this becomes.
        </p>
      </div>

      {/* Identity Section */}
      <Card className="p-6 border-[#6B46C1]/30 bg-gradient-to-br from-[#6B46C1]/10 to-[#00D4AA]/5">
        <h2 className="font-orbitron text-xl font-bold mb-4">You&apos;re Not Buying a Token. You&apos;re Joining Intelligence.</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 text-sm text-white/60 leading-relaxed">
            <p>
              Every token project says &ldquo;community.&rdquo; Most mean a Telegram full of moon emojis. 
              We mean something different.
            </p>
            <p>
              <strong className="text-white/80">The Swarm is collective intelligence.</strong> Multiple AI models — 
              Gemini, Grok, Claude — debating every token you scan. They disagree. They challenge each other. 
              Then they reach consensus. That&apos;s not hype. That&apos;s how better decisions get made.
            </p>
            <p>
              And <strong className="text-white/80">you&apos;re part of it.</strong> Every scan feeds the swarm. 
              Every holder makes the ecosystem stronger. Every community member who helps us graduate 
              unlocks the next level of intelligence for everyone.
            </p>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-[#6B46C1]/20 bg-[#6B46C1]/5 p-4">
              <div className="text-xs font-bold text-[#6B46C1] uppercase tracking-wider mb-2">The Swarm Identity</div>
              <div className="space-y-2 text-sm text-white/60">
                <div className="flex items-center gap-2">
                  <span>🐝</span>
                  <span>Members: <strong className="text-white/80">The Swarm</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span>⚡</span>
                  <span>Action: <strong className="text-white/80">&ldquo;Swarming&rdquo;</strong> (analyzing tokens)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🛡️</span>
                  <span>Mission: <strong className="text-white/80">Multi-agent DD vs insider games</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span>⚖️</span>
                  <span>Mantra: <strong className="text-white/80">&ldquo;Trust the Swarm&rdquo;</strong></span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/5 p-4">
              <div className="text-xs font-bold text-[#FFD700] uppercase tracking-wider mb-2">Why Hold $VSWARM</div>
              <div className="space-y-1.5 text-sm text-white/60">
                <div>✦ Selling = losing access to premium agents</div>
                <div>✦ Burns reduce supply — your share grows over time</div>
                <div>✦ Early members shape the protocol&apos;s future</div>
                <div>✦ Governance rights coming post-graduation</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Graduation Mission */}
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFD700]">The Mission</p>
          <h2 className="font-orbitron mt-2 text-2xl font-bold md:text-3xl">Help Us Graduate</h2>
          <p className="text-sm text-white/50 mt-2 max-w-xl mx-auto">
            $VSWARM launches on Solana. When the community 
            sufficient liquidity on Raydium, we <strong className="text-white/70">unlock full trading</strong> — 
            unlocking DEX trading, locked liquidity, and the full ecosystem.
          </p>
        </div>

        <Card className="p-6 border-[#FFD700]/20">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center space-y-2 p-3">
              <div className="text-3xl">🎯</div>
              <h3 className="text-sm font-bold text-[#FFD700]">The Goal</h3>
              <p className="text-xs text-white/50">Community-driven liquidity growth on Solana to unlock full DEX trading on Raydium</p>
            </div>
            <div className="text-center space-y-2 p-3">
              <div className="text-3xl">💎</div>
              <h3 className="text-sm font-bold text-[#00D4AA]">Early Advantage</h3>
              <p className="text-xs text-white/50">Bonding curve = earlier buyers get better prices. Once graduated, open market pricing begins</p>
            </div>
            <div className="text-center space-y-2 p-3">
              <div className="text-3xl">🔒</div>
              <h3 className="text-sm font-bold text-[#6B46C1]">Locked Liquidity</h3>
              <p className="text-xs text-white/50">At graduation, LP tokens are locked for 10 years. Permanent, non-extractable liquidity for the community</p>
            </div>
          </div>
        </Card>

        {/* Airdrop Teaser */}
        <Card className="p-6 border-[#00D4AA]/30 bg-gradient-to-r from-[#00D4AA]/5 to-[#6B46C1]/5">
          <div className="flex items-start gap-4">
            <span className="text-4xl shrink-0">🎁</span>
            <div className="space-y-2">
              <h3 className="font-orbitron text-lg font-bold text-[#00D4AA]">Early Swarm Rewards</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Community members who help us reach graduation will be recognized and rewarded. 
                We&apos;re designing incentives for early believers — because the people who build the foundation 
                deserve to benefit from what gets built on top of it.
              </p>
              <p className="text-sm text-white/40 italic">
                Details coming soon. Follow <a href="https://x.com/VswarmAi" target="_blank" rel="noopener noreferrer" className="text-[#00D4AA] hover:underline">@VswarmAi</a> for announcements.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Why Now */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-orbitron text-2xl font-bold md:text-3xl">Why Get In Now</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              icon: "📈",
              title: "Bonding Curve Advantage",
              desc: "Pre-graduation buyers get the best prices. The curve rewards early conviction.",
            },
            {
              icon: "🔥",
              title: "Deflationary from Day 1",
              desc: "Every scan burns tokens. Your percentage of supply grows even if you don't buy more.",
            },
            {
              icon: "🤖",
              title: "AI Gets Smarter",
              desc: "We continuously upgrade to the latest AI models. Today's swarm is the dumbest it'll ever be.",
            },
            {
              icon: "🌐",
              title: "Ecosystem Play",
              desc: "VerdictSwarm is just the beginning. auditswarm.io, launchswarm.io, watchswarm.io — the Swarm ecosystem is growing.",
            },
            {
              icon: "🏗️",
              title: "Shape the Protocol",
              desc: "Early holders will have governance input on burns, features, and treasury decisions.",
            },
            {
              icon: "🐝",
              title: "Founding Member Status",
              desc: "Pre-graduation community members are the foundation. That matters when the swarm scales.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-[#2D2D3A] bg-[#0A0B0F] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span>{item.icon}</span>
                <h3 className="text-sm font-bold text-white/80">{item.title}</h3>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* The Flywheel */}
      <Card className="p-6">
        <h2 className="font-orbitron text-xl font-bold mb-4 text-center">The Swarm Flywheel</h2>
        <div className="flex flex-col items-center gap-2 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
            {[
              { step: "1", text: "Free scans attract users", color: "#00D4AA" },
              { step: "2", text: "Users want more agents → buy $VSWARM", color: "#6B46C1" },
              { step: "3", text: "Scans burn tokens → supply shrinks", color: "#FF8C00" },
              { step: "4", text: "Scarcity + utility → appreciation", color: "#FFD700" },
            ].map((s) => (
              <div key={s.step} className="rounded-lg border border-[#2D2D3A] p-3 text-center">
                <div className="font-orbitron text-lg font-bold" style={{ color: s.color }}>{s.step}</div>
                <div className="text-xs text-white/50 mt-1">{s.text}</div>
              </div>
            ))}
          </div>
          <div className="text-white/30 text-xs mt-2">↻ Repeat — each cycle makes the swarm stronger</div>
        </div>
      </Card>

      {/* Community Stats */}
      <div className="space-y-4">
        <h2 className="font-orbitron text-xl font-bold text-center">The Swarm Today</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat value="100M" label="Total Supply (Fixed)" color="#FFFFFF" />
          <Stat value="Up to 7+" label="AI Agents" color="#00D4AA" />
          <Stat value="3+" label="AI Models" color="#6B46C1" />
          <Stat value="3/Day" label="Free Scans" color="#FFD700" />
        </div>
      </div>

      {/* How the Community Grows */}
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6B46C1]">Growth Trajectory</p>
          <h2 className="font-orbitron mt-2 text-2xl font-bold">How the Swarm Grows</h2>
        </div>
        <div className="space-y-4">
          <Phase
            number="1"
            title="The Foundation"
            description="Build the core product. Prove the AI works. Show the world what multi-model consensus looks like."
            items={[
              "Free tier live — anyone can scan any token",
              "2 AI agents analyzing every contract",
              "Evidence Locker showing real findings",
              "Share verdict cards on 𝕏",
            ]}
            status="NOW"
            accent="#00D4AA"
          />
          <Phase
            number="2"
            title="Graduation"
            description="Community rallies around $VSWARM on Solana. Token goes live on Raydium. Full ecosystem unlocks."
            items={[
              "Reach liquidity milestone on Raydium",
              "DEX liquidity locked for 10 years",
              "Tier 1 unlocked — 6 agents + Devil's Advocate, 3 AI models, debates",
              "Early Swarm Rewards distributed to community",
            ]}
            status="NEXT"
            accent="#FFD700"
          />
          <Phase
            number="3"
            title="The Ecosystem"
            description="Expand from one scanner to a network of specialized AI swarms. The swarm.io empire."
            items={[
              "Tier 2 — Prosecutor tier — adversarial multi-pass analysis",
              "auditswarm.io — deep smart contract auditing",
              "launchswarm.io — token launch analysis & scoring",
              "watchswarm.io — portfolio monitoring & alerts",
              "Governance: holders vote on burns, features, treasury",
            ]}
            status="LATER"
            accent="#6B46C1"
          />
        </div>
      </div>

      {/* Always Evolving */}
      <Card className="p-6 border-[#00D4AA]/20 bg-[#00D4AA]/5">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5">🔄</span>
          <div>
            <h3 className="font-bold text-[#00D4AA]">Always Evolving</h3>
            <p className="text-sm text-white/50 mt-1 leading-relaxed">
              AI doesn&apos;t stand still, and neither do we. When Google ships a new Gemini, when xAI upgrades Grok, 
              when Anthropic releases a new Claude — we integrate it. Our architecture is model-agnostic: 
              the swarm continuously evolves with the most capable AI available. 
              <strong className="text-white/70"> Your scans automatically get smarter over time.</strong>
            </p>
          </div>
        </div>
      </Card>

      {/* Connect */}
      <div className="space-y-4">
        <h2 className="font-orbitron text-xl font-bold text-center">Connect With The Swarm</h2>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://x.com/VswarmAi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1A1A28] border border-[#2D2D3A] px-6 py-3 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            <span className="text-lg">𝕏</span>
            Follow @VswarmAi
          </a>
          <Link
            href="/buy"
            className="inline-flex items-center gap-2 rounded-xl bg-[#6B46C1] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#7C3AED]"
          >
            ⚡ Get $VSWARM
          </Link>
          <Link
            href="/dapp"
            className="inline-flex items-center gap-2 rounded-xl bg-[#00D4AA] px-6 py-3 text-sm font-bold text-black transition hover:bg-[#00E4BA]"
          >
            🔍 Try a Free Scan
          </Link>
        </div>
      </div>

      {/* Quote */}
      <div className="text-center space-y-2 py-4">
        <p className="text-white/40 italic text-sm">&ldquo;Hindsight for everyone else. Foresight for the Swarm.&rdquo;</p>
        <p className="text-xs text-white/20">— The VerdictSwarm Manifesto</p>
      </div>
    </main>
  );
}
