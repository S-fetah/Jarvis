// Agent
export {
  AgentOrchestrator,
  wrapUntrusted,
  type AgentOrchestratorConfig,
  type AgentRunOptions,
  type AgentRunResult
} from './agent/agent-orchestrator'

// Gateway & Providers
export { CredentialVault, PROVIDER_METADATA } from './gateway/credential-vault'
export { LocalGatewayServer } from './gateway/local-gateway-server'
export { ModelBalancer } from './gateway/model-balancer'
export {
  ModelGatewayAdapter,
  type ModelGatewayConfig,
  type TaskModelRouting
} from './gateway/model-adapter'
export { PromptEngine, type PromptOptions } from './gateway/prompt-engine'
export * from './gateway/providers/index'

// Memory
export { LearningEngine, type LearningProposal } from './memory/learning-engine'
export {
  ensureUserMemoryFile,
  formatUserMemoryPrompt,
  getUserMemoryFilePath,
  loadUserMemory,
  saveUserMemory,
  type UserPreferences
} from './memory/user-memory'

// Policy & Process
export { PolicyEngine, type ActionPayload, type PolicyEvaluationResult } from './policy/policy-engine'
export { ProcessManager, type ProcessUpdateListener } from './process/process-manager'

// Skills
export { SkillManager, type SkillMetadata } from './skills/skill-manager'

// Storage
export { JarvisDatabase } from './storage/database'
export {
  SQLITE_FILENAME,
  STORAGE_CONFIG_FILENAME,
  readStorageLocationConfig,
  relocateSqliteStorage,
  resolveInitialDataDirectories,
  writeStorageLocationConfig,
  type RelocateStorageResult,
  type ResolvedDataDirectories,
  type StorageLocationConfig
} from './storage/storage-config'

// Tools
export { PdfGenerator, type PdfDocumentOptions } from './tools/pdf-generator'
export {
  ToolExecutor,
  type ApprovalRequestHandler,
  type ToolExecutionResult
} from './tools/tool-executor'
export * from './tools/tool-registry'

// Utilities
export * from './utils/browser'
export * from './utils/cdp'
export * from './utils/chrome-profiles'
export * from './utils/keyboard'
export * from './utils/smtp'
