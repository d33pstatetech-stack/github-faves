/**
 * Taxonomy — 25 categories + tag facets.
 *
 * Designed from the actual contents of the 218-repo starred set (see
 * README "Taxonomy"). Categories are broad buckets; tags are the refined,
 * specific labels layered on top (model names, effects, hardware, infra).
 *
 * `kw` entries are matched against, in order of weight:
 *   topics (3x) > repo name (2x) > description (2x) > summary/readme (1x)
 *
 * Any keyword may be a plain string or { w: 'phrase with spaces' } to require
 * an exact phrase. Keep this file plain-data and readable: it is the main
 * tuning surface for classification quality.
 */

export const CATEGORIES = [
  {
    slug: 'voice-tts-stt', label: 'Voice / TTS / STT', color: '#f472b6',
    description: 'Text-to-speech, speech-to-text, voice cloning, voice agents',
    kw: ['tts', 'stt', 'asr', 'text-to-speech', 'text to speech', 'speech-to-text',
      'speech to text', 'speech recognition', 'voice cloning', 'voice-cloning',
      'voice synthesis', 'whisper', 'piper', 'kittentts', 'kitten-tts', 'vocal',
      'phoneme', 'vocoder', 'singing voice', 'realtime voice', 'voice assistant',
      'voice agent', 'emotive', 'lip-sync', 'lipsync', 'deepgram', 'miso tts', 'voice', 'voiceos', 'openvoiceos', 'vocal synthesis'],
  },
  {
    slug: 'ai-agents', label: 'AI Agents & Frameworks', color: '#818cf8',
    description: 'Agent runtimes, orchestration, multi-agent systems, agent memory',
    kw: ['ai agent', 'ai-agent', 'aiagent', 'agentic', 'agent framework', 'agent runtime',
      'agent-infrastructure', 'agent orchestration', 'multi-agent', 'multiagent',
      'agent memory', 'ai-memory', 'ai memory', 'autonomous agent', 'agent swarm',
      'openclaw', 'clawdbot', 'hermes-agent', 'hermes agent', 'hermes', 'a2ui',
      'agent', 'agents', 'agentic-ai', 'chatbot', 'ai assistant', 'ai-assistant',
      'subagent', 'tool calling', 'function calling', 'agent loop', 'agent-loops'],
  },
  {
    slug: 'ai-video-gen', label: 'AI Video Generation', color: '#fb7185',
    description: 'Text/image-to-video models and AI filmmaking pipelines',
    kw: ['video generation', 'video-generation', 'text-to-video', 'text to video',
      'ai video', 'ai-video', 'video gen', 'ai filmmaking', 'filmmaking', 'storyboard',
      'previs', 'animation', 'ai-filmmaker', 'motion generation', 'diffusion transformer',
      'video diffusion', 'temporally consistent', 'frame generation'],
  },
  {
    slug: 'embedded-iot', label: 'Embedded & IoT', color: '#34d399',
    description: 'Microcontrollers, firmware, IoT platforms, maker hardware',
    kw: ['esp32', 'esp8266', 'arduino', 'microcontroller', 'microcontrollers', 'iot',
      'firmware', 'tasmota', 'rp2040', 'teensy', 'raspberry pi', 'raspberry-pi', 'rpi',
      'gpio', 'i2c', 'spi', 'uart', 'can-bus', 'embedded', 'maker', 'board', 'sensor',
      'tasmota', 'home-assistant', 'homeassistant', 'zephyr', 'rtos', 'u-boot', 'uboot'],
  },
  {
    slug: 'self-hosted', label: 'Self-Hosted & Homelab', color: '#a78bfa',
    description: 'Self-hosted services, homelab infrastructure, media servers, NAS',
    kw: ['self-hosted', 'selfhosted', 'self hosted', 'homelab', 'home lab', 'media server',
      'media-server', 'nas', 'jellyfin', 'plex', 'proxmox', 'proxmoxve', 'reverse proxy',
      'file server', 'file-server', 'self-evolving', 'offline-server', 'seedbox', 'streaming server', 'photo library', 'password manager'],
  },
  {
    slug: 'llm-resources', label: 'LLM Learning & Free Resources', color: '#facc15',
    description: 'Awesome lists, courses, tutorials, free-tier API directories',
    kw: ['awesome', 'awesome-list', 'awesome-lists', 'curated list', 'roadmap',
      'course', 'tutorial', 'tutorials', 'learning', 'beginners', 'cheat sheet',
      'cheatsheet', 'free tier', 'free-for-developers', 'free llm', 'freellm',
      'roadmap', 'study', 'reference', 'handbook', 'guide', 'learning resource', 'fmhy', 'curated', 'directory', 'collection of', 'resources for'],
  },
  {
    slug: 'ai-coding-agents', label: 'AI Coding Agents & Harnesses', color: '#60a5fa',
    description: 'Coding agents, agent harnesses, skills tooling, loop engineering',
    kw: ['claude code', 'claude-code', 'codex', 'cursor', 'opencode', 'copilot cli',
      'coding agent', 'coding-agent', 'agentic coding', 'agentic-coding', 'dev tools',
      'developer-tools', 'loop engineering', 'coding cli', 'vscode', 'jetbrains',
      'autoskills', 'skills stack', 'agent skills', 'agent-skills', 'claude skills',
      'skill pack', 'skillset', 'agent harness', 'harness', 'ide assistant', 'pair programming'],
  },
  {
    slug: 'ai-image-gen', label: 'AI Image Gen & LoRA', color: '#f472b6',
    description: 'Text-to-image models, diffusion, LoRA training and fine-tuning',
    kw: ['text-to-image', 'text to image', 'image generation', 'image-generation',
      'ai image', 'ai-image', 'stable diffusion', 'stability ai', 'lora', 'dreambooth',
      'diffusers', 'sdxl', 'comfyui', 'checkpoint', 'fine-tuning', 'finetuning',
      'image model', 'diffusion model', 'aigc', 'sd-scripts', 'musubi', 'tuner', 'kohya', 'textual inversion', 'vae', 'latent', 'img2img'],
  },
  {
    slug: 'ai-media-editing', label: 'AI Media Editing', color: '#c084fc',
    description: 'Video editors, upscaling, face swap, image editing, enhancement',
    kw: ['video editor', 'video-editor', 'video editing', 'image editor', 'image-editing',
      'image editing', 'photo editor', 'upscale', 'upscaling', 'super resolution',
      'super-resolution', 'frame interpolation', 'face swap', 'face-swap', 'faceswap',
      'deepfake', 'deep-fake', 'motion transfer', 'video-to-video', 'image restoration',
      'background removal', 'background-removal', 'color grading', 'denoise', 'enhance',
      'editor', 'ffmpeg', 'timeline', 'montage', 'reencode', 'opencut', 'capcut', 'premiere', 'davinci', 'nle', 'storyboard', 'shot list', 'call sheet', 'editing suite'],
  },
  {
    slug: 'ai-prompting', label: 'AI Prompting & Prompt Craft', color: '#fbbf24',
    description: 'Prompt engineering, prompt libraries, prompt-as-code, skills for prompting',
    kw: ['prompt', 'prompts', 'prompt engineering', 'prompt-engineering', 'prompt as code',
      'prompt-as-code', 'prompt composer', 'prompt-composer', 'prompting', 'negative prompt',
      'prompt library', 'prompting guide'],
  },
  {
    slug: 'llm-inference', label: 'LLM Inference & Serving', color: '#22d3ee',
    description: 'Local inference, serving engines, quantization, hardware-fit selection',
    kw: ['inference', 'inference engine', 'serving', 'llm serving', 'vllm', 'sglang',
      'gguf', 'llama.cpp', 'llamacpp', 'ollama', 'localai', 'lm studio', 'lmstudio',
      'quantization', 'quantized', 'awq', 'gptq', 'exl2', 'mlx', 'onnx', 'tensorrt',
      'kv cache', 'kv-cache', 'moe', 'mixture of experts', 'webgpu', 'openvino',
      'local model', 'self-hosted llm', 'model compression', 'model serving'],
  },
  {
    slug: 'web-dev', label: 'Web Development', color: '#38bdf8',
    description: 'Web frameworks, libraries, full-stack apps, front-end',
    kw: ['web framework', 'frontend', 'front-end', 'fullstack', 'full-stack', 'react',
      'vue', 'svelte', 'angular', 'nextjs', 'next.js', 'nuxt', 'tailwind', 'web app',
      'web application', 'dashboard', 'browser extension', 'chrome-extension',
      'webassembly', 'wasm', 'javascript', 'typescript', 'web dev', 'web development',
      'low-code', 'no-code', 'webgl', 'threejs', 'three.js'],
  },
  {
    slug: 'terminal-cli', label: 'Terminal & CLI Tools', color: '#94a3b8',
    description: 'Shells, terminals, command-line utilities, TUI',
    kw: ['cli', 'command line', 'command-line', 'terminal', 'console', 'shell', 'tui',
      'tmux', 'bash', 'zsh', 'prompt tool', 'keyboard', 'pty', 'repl'],
  },
  {
    slug: 'cybersecurity-osint', label: 'Cybersecurity & OSINT', color: '#f43f5e',
    description: 'Security research, OSINT, threat intel, penetration testing, hacking',
    kw: ['osint', 'infosec', 'infosecurity', 'security', 'threat intel', 'threatintel',
      'intelligence gathering', 'footprinting', 'reconnaissance', 'pentest', 'penetration',
      'hacking', 'hacker', 'exploit', 'vulnerability', 'cve', 'antidetect', 'bot detection',
      'attack surface', 'red team', 'red-team', 'phishing', 'malware', 'c2', 'beaconing',
      'uncensored', 'jailbreak', 'penetration testing', 'cyber'],
  },
  {
    slug: 'rag-retrieval', label: 'RAG & Retrieval', color: '#2dd4bf',
    description: 'Retrieval-augmented generation, vector search, embeddings, memory',
    kw: ['rag', 'retrieval-augmented', 'retrieval augmented', 'vector database', 'vector db',
      'vector search', 'vector index', 'embeddings', 'embedding', 'semantic search',
      'chunking', 'chunker', 'document processing', 'knowledge base', 'knowledge-base',
      'pgvector', 'faiss', 'nearest neighbor', 'memory', 'long-term memory', 'indexing', 'ocr', 'image2text', 'document extraction', 'pdf', 'parser', 'data ingestion'],
  },
  {
    slug: 'browser-automation', label: 'Browser Automation & Scraping', color: '#fb923c',
    description: 'Headless browsers, crawlers, web scraping, extraction',
    kw: ['headless', 'browser automation', 'browser-automation', 'web scraping', 'scraper',
      'scraping', 'crawler', 'crawling', 'cdp', 'puppeteer', 'playwright', 'selenium',
      'anti-detect', 'antidetect', 'stealth browser', 'web extraction', 'html-to-markdown',
      'bookmark import', 'browser history', 'stealth', 'fingerprint', 'proxy rotation', 'captcha'],
  },
  {
    slug: 'robotics-electronics', label: 'Robotics & Electronics', color: '#facc15',
    description: 'Robots, drones, CAD for electronics, physical computing, sensors',
    kw: ['robot', 'robotics', 'robotic', 'drone', 'quadruped', 'humanoid', 'actuator',
      'servo', 'motion capture', 'mocap', 'computer vision', 'opencv', 'object detection',
      'pose estimation', 'circuit board', 'circuit design', 'pcb', 'eda', 'kicad', 'cad',
      'electronics', 'fpga', 'wifi sensing', 'slam', 'autonomous robot'],
  },
  {
    slug: 'cv-3d', label: 'Computer Vision & 3D', color: '#818cf8',
    description: '3D reconstruction/generation, vision models, image-to-3D',
    kw: ['3d', '3d generation', '3d-reconstruction', 'reconstruction', 'image-to-3d',
      'image to 3d', 'mesh', 'point cloud', 'neural radiance', 'gaussian splatting',
      'nerf', '3d engine', '3d model', 'point cloud', 'depth estimation', 'segmentation',
      'vision model', 'lidar', 'gaussian splatting', 'total capture', 'photogrammetry', 'surface reconstruction', 'point tracking', 'image-to-world', 'scene reconstruction'],
  },
  {
    slug: 'devops', label: 'DevOps & Cloud', color: '#38bdf8',
    description: 'Cloud platforms, deployment, CI/CD, containers, observability',
    kw: ['devops', 'infrastructure as code', 'ci/cd', 'cicd', 'continuous integration',
      'continuous deployment', 'deployment', 'deploy', 'kubernetes', 'k8s', 'helm',
      'terraform', 'ansible', 'pulumi', 'cloudformation', 'aws', 'gcp', 'azure',
      'cloud', 'serverless', 'faas', 'paas', 'iaas', 'load balancer', 'reverse proxy',
      'observability', 'monitoring', 'logging', 'prometheus', 'grafana', 'datadog',
      'localstack', 'emulator', 'container', 'containers', 'dockerfile', 'docker compose',
      'docker-compose', 'devops-automation', 'github actions', 'actions', 'workflow automation',
      'provisioning', 'scaling', 'microservices', 'message queue', 'cron'],
  },
  {
    slug: 'system-utilities', label: 'System & OS Utilities', color: '#a3a3a3',
    description: 'OS tweaks, Windows tools, networking utilities, file transfer',
    kw: ['windows', 'powershell', 'batch', 'msdos', 'activator', 'optimizer', 'tweak',
      'privacy tool', 'antivirus', 'socks', 'proxy', 'vpn', 'tunnel', 'file transfer',
      'file sharing', 'webdav', 'ftp', 'sftp', 'port', 'dns', 'network monitor',
      'system monitor', 'bash script', 'home server', 'tui app', 'desktop app',
      'serial', 'terminal emulator', 'boot', 'firmware update', 'driver'],
  },
  {
    slug: 'ai-gateway-routing', label: 'AI Gateway & Model Routing', color: '#e879f9',
    description: 'AI gateways, multi-provider proxies, LLM routers, free-tier aggregators',
    kw: ['ai gateway', 'llm gateway', 'gateway', 'router', 'routing', 'llm router',
      'proxy for ai', 'multi-provider', 'provider', 'openai-compatible', 'openai compatible',
      'api key management', 'model router', 'free providers', 'llm api', 'api aggregator'],
  },
  {
    slug: 'bookmarks-pkm', label: 'Bookmarks & Personal Knowledge', color: '#4ade80',
    description: 'Bookmark managers, note-taking, personal knowledge management, archiving',
    kw: ['bookmark', 'bookmarks', 'read later', 'pocket', 'pinboard', 'note-taking',
      'note taking', 'notes app', 'pkm', 'obsidian', 'markdown notes', 'knowledge map',
      'web archiving', 'archive', 'mindmap', 'mind map', 'zettelkasten'],
  },
  {
    slug: 'mobile-android', label: 'Mobile & Android', color: '#4ade80',
    description: 'Android/iOS apps, mobile dev, phone-based tools',
    kw: ['android', 'ios', 'mobile app', 'mobile', 'jetpack', 'kotlin', 'swift',
      'smartphone', 'phone', 'termux', 'react native', 'flutter', 'play store'],
  },
  {
    slug: 'data-finance', label: 'Data, Datasets & Finance', color: '#f97316',
    description: 'Datasets, financial ML, data pipelines, analytics',
    kw: ['dataset', 'datasets', 'financial', 'finance', 'trading', 'stocks', 'market',
      'marketplace', 'prediction market', 'analytics', 'data pipeline', 'jupyter',
      'notebook', 'colab', 'data science', 'machine learning', 'deep learning',
      'training data', 'benchmark', 'stock', 'price prediction', 'timeseries', 'time series', 'regression', 'pandas', 'numpy'],
  },
];

/**
 * Tag dictionary. `facet` groups the sidebar tag list so it stays navigable.
 * Model tags are deliberately specific — this is the "refined version of the
 * category" layer (e.g. Video Editing -> minimax-h3, wan2.2, upscaling).
 */
export const TAG_DICTS = [
  {
    facet: 'model',
    tags: [
      ['wan2.2', 'wan2.2'], ['wan2.1', 'wan2.1'], ['wan3.0', 'wan3.0'],
      ['seedance-2', 'seedance'], ['seedance-2.5', 'seedance 2.5'], ['seedance-2-mini', 'seedance 2 mini'],
      ['minimax-h3', 'minimax h3'], ['minimax-h3-motion', 'h3 motion'],
      ['qwen-image', 'qwen-image'], ['qwen', 'qwen'], ['gpt-image-2', 'gpt-image'],
      ['ltx-2', 'ltx-2'], ['ltx', 'ltx'], ['flux', 'flux'], ['flux.1', 'flux.1'],
      ['sdxl', 'sdxl'], ['stable-diffusion', 'stable diffusion'], ['veo', 'veo'],
      ['kling', 'kling'], ['hunyuan', 'hunyuan'], ['cogvideo', 'cogvideo'],
      ['mochi', 'mochi'], ['pixart', 'pixart'], ['glm', 'glm'], ['minimax', 'minimax'],
      ['kittentts', 'kittentts'], ['whisper', 'whisper'], ['deepseek', 'deepseek'],
      ['llama', 'llama'], ['qwen3', 'qwen3'], ['llm', 'llm'], ['ml', 'machine learning'],
    ],
  },
  {
    facet: 'effect',
    tags: [
      ['upscale', 'upscal'], ['frame-interpolation', 'frame interpolation'],
      ['faceswap', 'face swap'], ['deepfake', 'deepfake'], ['lipsync', 'lip sync'],
      ['motion-transfer', 'motion transfer'], ['v2v', 'video-to-video'],
      ['t2v', 'text-to-video'], ['i2v', 'image-to-video'], ['t2i', 'text-to-image'],
      ['i2i', 'image-to-image'], ['background-removal', 'background removal'],
      ['color-grade', 'color grading'], ['inpaint', 'inpaint'], ['redraw', 'redraw'],
      ['enhance', 'enhance'], ['local', 'local'], ['gpu', 'gpu'], ['cpu', 'cpu'],
      ['realtime', 'realtime'], ['offline', 'offline'], ['free', 'free'],
    ],
  },
  {
    facet: 'hardware',
    tags: [
      ['esp32', 'esp32'], ['esp8266', 'esp8266'], ['arduino', 'arduino'],
      ['raspberry-pi', 'raspberry pi'], ['jetson', 'jetson'], ['teensy', 'teensy'],
      ['fpga', 'fpga'], ['rp2040', 'rp2040'], ['android-device', 'android phone'],
    ],
  },
  {
    facet: 'infra',
    tags: [
      ['docker', 'docker'], ['kubernetes', 'kubernetes'], ['proxmox', 'proxmox'],
      ['homelab', 'homelab'], ['self-hosted', 'self-hosted'], ['ssh', 'ssh'],
      ['tailscale', 'tailscale'], ['cloudflare', 'cloudflare'], ['nginx', 'nginx'],
      ['serverless', 'serverless'], ['aws', 'aws'], ['cuda', 'cuda'], ['webgpu', 'webgpu'],
      ['wasm', 'wasm'], ['tui', 'tui'], ['cli', 'cli'],
    ],
  },
  {
    facet: 'topic',
    tags: [
      ['comfyui', 'comfyui'], ['mcp', 'mcp'], ['a2a', 'a2a'], ['rag', 'rag'],
      ['agent-memory', 'ai memory'], ['rag-anything', 'rag-anything'],
      ['chromium', 'chromium'], ['playwright', 'playwright'], ['puppeteer', 'puppeteer'],
      ['ffmpeg', 'ffmpeg'], ['ollama', 'ollama'], ['vllm', 'vllm'], ['lora', 'lora'],
      ['openclaw', 'openclaw'], ['hermes-agent', 'hermes agent'],
      ['headless', 'headless'], ['antidetect', 'antidetect'], ['ocr', 'ocr'],
      ['vector-db', 'vector database'], ['javascript', 'javascript'], ['typescript', 'typescript'],
      ['python', 'python'], ['rust', 'rust'], ['go', 'golang'], ['vue', 'vue'],
      ['react', 'react'], ['nextjs', 'next.js'], ['tauri', 'tauri'],
    ],
  },
];

/** Flat slug -> {label, facet} map built from TAG_DICTS. */
export const TAG_INDEX = (() => {
  const m = new Map();
  for (const { facet, tags } of TAG_DICTS) {
    for (const [slug, label] of tags) {
      if (!m.has(slug)) m.set(slug, { slug, label, facet });
    }
  }
  return m;
})();

export const CATEGORY_INDEX = new Map(CATEGORIES.map((c) => [c.slug, c]));
