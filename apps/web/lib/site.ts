export interface StylePreset {
  id: string;
  label: string;
  icon: string;
  description: string;
  pro?: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export const siteConfig = {
  name: "Blynta",
  title: "Blynta — Turn Long Videos into Viral Shorts in 60 Seconds",
  description:
    "Paste any YouTube or Vimeo video. Blynta's AI autonomously extracts viral hooks, reframes horizontal footage to 9:16 portrait with speaker tracking, and adds animated captions.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://blynta.com",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ogImage: "/og-image.png",
  links: {
    twitter: "https://twitter.com/blynta",
    github: "https://github.com/blynta",
    youtube: "https://youtube.com/@blynta",
    linkedin: "https://linkedin.com/company/blynta",
  },
  nav: [
    { label: "Product", href: "#showcase" },
    { label: "Features", href: "#features" },
    { label: "Calculator", href: "#calculator" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ],
  samples: [
    {
      label: "Lex Fridman Podcast",
      url: "https://youtube.com/watch?v=v0L1x_lexfridman",
    },
    {
      label: "Huberman Lab",
      url: "https://youtube.com/watch?v=gXwXk_huberman",
    },
    {
      label: "Y Combinator Founder Story",
      url: "https://youtube.com/watch?v=yc_founders",
    },
  ],
  stylePresets: [
    {
      id: "high-energy",
      label: "⚡ High Energy",
      icon: "Zap",
      description:
        "Fast-paced hooks, loud dynamic captions, and instant punchlines.",
      pro: false,
    },
    {
      id: "podcast-insight",
      label: "🧠 Deep Insight",
      icon: "Brain",
      description:
        "Focuses on revelations, philosophical takeaways, and educational hooks.",
      pro: false,
    },
    {
      id: "meme-humor",
      label: "😂 Meme & Comedy",
      icon: "Smile",
      description:
        "Highlights laughs, reactions, banter, and witty one-liners.",
      pro: true,
    },
    {
      id: "storytelling",
      label: "📖 Narrative Arc",
      icon: "BookOpen",
      description:
        "Extracts continuous personal anecdotes with emotional builds.",
      pro: true,
    },
  ],
  features: [
    {
      id: "face-tracking",
      title: "Active Speaker Face-Tracking",
      tagline: "Autonomous Camera Director",
      description:
        "Computer-vision neural models track who is speaking and frame them in 9:16 portrait. When multiple speakers engage, it dynamically switches or creates split-screen layouts.",
      metric: "99.8% Tracking Accuracy",
    },
    {
      id: "virality-engine",
      title: "AI Hook & Retention Scorer",
      tagline: "Predictive Audience AI",
      description:
        "Trained on millions of top-performing TikToks and Shorts. Blynta scores every sentence for curiosity gaps, sentiment velocity, and engagement likelihood.",
      metric: "0-100 Virality Heatmap",
    },
    {
      id: "captions",
      title: "Karaoke Dynamic Subtitles",
      tagline: "Word-by-Word Animation",
      description:
        "Generate viral animated captions styled like top creators (Alex Hormozi, Ali Abdaal). Includes auto-emojis, auto-highlighting, and 50+ languages.",
      metric: "50+ Languages Supported",
    },
    {
      id: "b-roll",
      title: "Contextual B-Roll & SFX",
      tagline: "Retention Maximizer",
      description:
        "The AI recognizes abstract points and automatically inserts copyright-free illustrative B-roll, zooms, and punchy sound effects right on cue.",
      metric: "Zero Copyright Strikes",
    },
    {
      id: "studio-editor",
      title: "Natural Language AI Studio",
      tagline: "Chat to Edit",
      description:
        "Need a tweak? Don't fiddle with complex timelines. Simply tell the AI: 'Cut the first 3 seconds, zoom in when he laughs, and make text neon green.'",
      metric: "Zero Learning Curve",
    },
    {
      id: "export-pipeline",
      title: "Ultra 4K 60FPS Cloud Render",
      tagline: "Enterprise Rendering Farm",
      description:
        "Cloud-based GPU rendering processes an entire 60-minute video into 10 shorts in under 90 seconds, without taxing your local machine.",
      metric: "10x Real-time Velocity",
    },
  ],
  comparison: [
    {
      feature: "Turnaround Time",
      traditional: "2 to 4 days per batch",
      blynta: "Under 90 seconds",
    },
    {
      feature: "Cost Per Month",
      traditional: "$1,500 – $4,000 (Freelancer/Agency)",
      blynta: "$29 / month",
    },
    {
      feature: "Aspect Ratio Reframing",
      traditional: "Tedious manual keyframing & cropping",
      blynta: "AI face-tracking & split-screen camera",
    },
    {
      feature: "Caption Timing",
      traditional: "Manual subtitle typing & styling",
      blynta: "Automated animated karaoke captions",
    },
    {
      feature: "Highlight Selection",
      traditional: "Rewatching entire hours of raw audio",
      blynta: "Semantic sentiment & retention scoring",
    },
  ],
  testimonials: [
    {
      stars: 5,
      quote:
        "Blynta completely transformed our podcast pipeline. We went from releasing 2 clips a week to publishing 4 shorts every day across YouTube, TikTok, and Instagram. Our channel views increased by 480% in 30 days.",
      name: "Sarah Jenkins",
      role: "Host of 'The Growth Paradigm' (340K Subs)",
      initials: "SJ",
      views: "+4.2M views generated",
    },
    {
      stars: 5,
      quote:
        "The face tracking is uncanny. It switches between me and my guest just like a live television director. I stopped paying $3,000/mo to my clipping agency because Blynta does it faster and better.",
      name: "Marcus Vance",
      role: "Founder & Tech Streamer (620K Followers)",
      initials: "MV",
      views: "14 hours saved weekly",
    },
    {
      stars: 5,
      quote:
        "Our digital media network produces 100+ shorts every month now. The animated caption styles and viral score metrics ensure our editors only publish clips that actually convert.",
      name: "Elena Rostova",
      role: "Head of Content, Apex Creative",
      initials: "ER",
      views: "+850K new followers",
    },
  ],
  pricing: [
    {
      id: "starter",
      name: "Starter",
      badge: null,
      priceMonthly: 0,
      priceYearly: 0,
      description: "Test the engine on your videos with zero commitment.",
      cta: "Start Free Now",
      href: "/signup",
      popular: false,
      features: [
        "60 starter video credits",
        "720p HD exports with watermark",
        "AI hook detection & transcription",
        "Smart 9:16 single-speaker reframe",
        "Standard dynamic subtitles",
      ],
    },
    {
      id: "pro",
      name: "Creator Pro",
      badge: "⚡ Most Popular",
      priceMonthly: 29,
      priceYearly: 24,
      description: "For creators, podcasters, and channels scaling fast.",
      cta: "Start 7-Day Free Trial",
      href: "/signup?plan=pro",
      popular: true,
      features: [
        "300 monthly credits (with rollover)",
        "Ultra 4K & 1080p 60FPS exports",
        "Zero watermarks & custom brand intro",
        "Multi-speaker camera auto-switching",
        "All 4 AI style archetypes unlocked",
        "Custom fonts, brand colors, and emojis",
        "Priority GPU cloud rendering queue",
      ],
    },
    {
      id: "agency",
      name: "Studio Scale",
      badge: "Team & Agency",
      priceMonthly: 79,
      priceYearly: 64,
      description: "For agencies, podcast networks, and high-volume brands.",
      cta: "Get Studio Scale",
      href: "/signup?plan=business",
      popular: false,
      features: [
        "1,200 monthly credits pool",
        "Multi-seat team workspace (5 seats)",
        "Custom brand kits & template presets",
        "Bulk URL batch processing",
        "Dedicated Slack channel & 1-hr SLA",
        "Custom API access & webhook exports",
      ],
    },
  ],
  faqs: [
    {
      question: "How does Blynta know which parts of my video will go viral?",
      answer:
        "Our neural models analyze multi-modal signals: vocal tone shifts, sentiment spikes, listener retention patterns, and narrative tension. We compare every segment against our benchmark dataset of millions of viral shorts to score its virality potential from 0 to 100.",
    },
    {
      question: "Does Blynta support horizontal to vertical reframing?",
      answer:
        "Yes! Blynta uses computer-vision face and body tracking to detect active speakers in 16:9 widescreen footage and automatically re-centers them in vertical 9:16 format. If two people are speaking or reacting, it dynamically splits the frame.",
    },
    {
      question: "Can I edit the clips after the AI generates them?",
      answer:
        "Absolutely. Blynta includes AI Studio, where you can adjust start/end boundaries, modify generated captions, change font colors, or use natural language prompts to request edits.",
    },
    {
      question: "Are there watermarks on exported videos?",
      answer:
        "The free tier includes a subtle Blynta badge. All paid tiers (Creator Pro and Studio Scale) provide 100% clean, watermark-free exports ready for monetization and commercial use.",
    },
    {
      question: "Which video platforms and formats can I paste?",
      answer:
        "You can paste direct links from YouTube (including unlisted videos and livestreams), Vimeo, Google Drive, Loom, or upload MP4/MOV files directly from your computer.",
    },
    {
      question: "What happens if I don't use all my credits in a month?",
      answer:
        "On all paid plans, unused credits automatically roll over to the next billing cycle as long as your subscription remains active.",
    },
  ],
};
