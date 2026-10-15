/** Graph topology is application logic; these names are not provider settings. */
export const AGENT_NODE = {
  LOAD_CONTEXT: 'load_context',
  INTERPRET: 'interpret',
  RESOLVE_INFORMATION: 'resolve_information',
  RESOLVE_ASSETS: 'resolve_assets',
  FINISH_INTENT: 'finish_intent',
  GENERATE_PATCH: 'generate_patch',
  VALIDATE: 'validate',
  CORRECT: 'correct',
} as const;
export const AGENT_LIMITS = {
  GRAPH_RECURSION: 12,
  DAILY_REQUESTS: 50,
} as const;
