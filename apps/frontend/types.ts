

export enum ActiveModule {
  Dashboard = "dashboard", // Added for user dashboard
  SuperAgent = "super-agent",
  CreativeLab = "creative-lab",
  // HookGenerator = "hook-generator", // Removed
  WriteStory = "write",
  Rewrite = "rewrite",
  Translate = "translate", // Added
  Analysis = "analysis",
  TTS = "tts",
  YouTubeSEO = "youtube-seo",
  // ImageByHook = "image-by-hook", // Removed
  ViralTitleGenerator = "viral-title-generator",
  // BatchImageGenerator = "batch-image-generator", // Removed
  ImageGenerationSuite = "image-generation-suite", // Added
  EditStory = "edit-story", // Added for the new module
  BatchStoryWriting = "batch-story-writing", // Added for new Batch Story Writing module
  BatchRewrite = "batch-rewrite", // Added for new Batch Rewrite module
  // NicheThemeExplorer = "niche-theme-explorer", // Removed and merged into ViralTitleGenerator
  Dream100CompetitorAnalysis = "dream-100-competitor-analysis", // Added
  CharacterStudio = "character-studio", // Added for Character Locking Prompts
  ContentSummarizer = "content-summarizer", // Added for Content Summarization
  Support = "support", // Added
  Settings = "settings", // Added for API key management
  Tutorials = "tutorials", // Added for tutorial videos
  Pricing = "pricing",
}

// Interface for ElevenLabs API key management
export interface ElevenLabsApiKey {
  key: string; // The API key itself
  status: 'unchecked' | 'checking' | 'valid' | 'invalid';
  credits?: number; // Character count
  creditLimit?: number; // Character limit
  error?: string; // Error message if invalid
}

// Interface for ElevenLabs voices
export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  // Add other properties like 'category', 'labels' if needed
}


export type ApiProvider = "gemini" | "openai" | "grok" | "deepseek" | "minimax";

export interface ApiSettings {
  provider: ApiProvider;
  apiKey: string;
}

export interface GeminiGenerateTextResponse {
  text: string;
}

export interface GeminiGenerateImageResponse {
  base64Image: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface AnalysisFactor {
  title: string;
  percentage: string;
  analysis: string;
}

export const MODEL_TEXT = "gemini-2.5-flash";
export const MODEL_IMAGE = "imagen-3.0-generate-002";

// --- TTS Specific Types ---
export type TtsProvider = 'google' | 'amazon' | 'browser' | 'openai' | 'elevenlabs';

export interface GoogleCloudVoice {
  name: string;
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL' | 'SSML_VOICE_GENDER_UNSPECIFIED';
  languageCodes: string[];
}

export interface AmazonPollyVoice {
  Id: string;
  Name: string;
  LanguageName: string;
  LanguageCode: string;
  Gender: 'Female' | 'Male' | 'Neutral';
  SupportedEngines: ('standard' | 'neural')[];
}

export interface BrowserSpeechVoice {
    name: string;
    lang: string;
    localService: boolean;
    voiceURI: string;
    default: boolean;
}

// Added for OpenAI TTS
export interface OpenAiTtsVoice {
  id: string; // e.g., 'alloy', 'echo'
  name: string; // e.g., 'Alloy', 'Echo'
}


// --- Module State Interfaces ---

export interface SuperAgentModuleState {
  sourceText: string;
  wordCount: string;
  imageCount: number;
  aspectRatio: string;
  generatedStory: string;
  generatedImages: string[]; // base64 image strings
  error: string | null; 
  // loadingMessage is already part of SuperAgentModule via its own state management if needed or can be added similarly
}

export type CreativeLabActiveTab = 'quickOutline' | 'singleOutline' | 'batchOutline'; // Added 'quickOutline'
export interface GeneratedBatchOutlineItem {
  coreIdea: string;
  outline: string;
  error?: string | null;
}
export interface CreativeLabModuleState {
  // Common settings
  ideaLanguage: string;
  outputLanguage: string;
  plotStructure: string;
  customPlot: string;
  outlineDetailLevel: string;
  referenceViralOutline: string; 
  referenceOutlineAnalysisResult: string | null; // Added for viral outline analysis
  isAnalyzingReferenceOutline: boolean; // Added for viral outline analysis loading
  errorAnalyzingReferenceOutline: string | null; // Added for viral outline analysis error


  // Tab control
  activeCreativeTab: CreativeLabActiveTab;

  // Quick Outline Tab specific
  quickOutlineTitle: string;
  quickOutlineResult: string;
  quickOutlineError: string | null;
  quickOutlineLoading: boolean;
  quickOutlineProgressMessage: string | null;

  // Single Outline (In-depth) Tab specific
  coreIdea: string; 
  secondaryIdea: string; 
  emotionalJourney: string; 
  finalOutline: string; 
  singleOutlineError: string | null; // Renamed from 'error'
  singleOutlineLoading: boolean; // Added
  singleOutlineProgressMessage: string | null; // Added

  // Batch Outline Tab specific
  batchCoreIdeas: string[];
  generatedBatchOutlines: GeneratedBatchOutlineItem[];
  batchOutlineError: string | null;
  batchOutlineProgressMessage: string | null;
  batchOutlineLoading: boolean;
  batchConcurrencyLimit: number; // Added for concurrent processing
}

// BatchOutlineItem is still used by CreativeLabModule to define its input structure if it generates batch outlines,
// even if it no longer sends them to WriteStoryModule.
// If CreativeLabModule's "Tạo Dàn Ý Hàng Loạt" no longer uses this specific structure for its input fields, it could be removed.
// For now, assuming CreativeLab might still use it for its own UI representation.
export interface BatchOutlineItem {
  id: string; // For React key and stable updates
  outlineText: string;
  specificWritingStyle: string; // 'global' or a value from WRITING_STYLE_OPTIONS
  specificCustomWritingStyle: string; // Used if specificWritingStyle is 'custom'
}

// GeneratedBatchStoryItem is removed as it was specific to the batch story writing feature in WriteStoryModule.

export type WriteStoryActiveTab = 'singleStory' | 'hookGenerator' | 'lessonGenerator'; // Removed 'batchStory'

export interface WriteStoryModuleState {
  activeWriteTab: WriteStoryActiveTab;

  // --- Common Settings (for singleStory, lessonGenerator output language) ---
  targetLength: string; 
  writingStyle: string; // Global writing style
  customWritingStyle: string; // Global custom writingStyle
  outputLanguage: string; 
  referenceViralStoryForStyle: string; 

  // --- Single Story Tab (singleStory) ---
  storyOutline: string; // Used by singleStory
  generatedStory: string; // Output of singleStory, input for lessonGenerator & hookGenerator (via button)
  keyElementsFromSingleStory: string | null; 
  hasSingleStoryBeenEditedSuccessfully: boolean; 
  storyError: string | null; 
  storyProgress: number; 
  storyLoadingMessage: string | null; 
  singleStoryEditProgress: number | null; // Added for editing progress

  // --- Hook Generator Tab (hookGenerator) ---
  storyInputForHook: string; // New field for hook generator story input
  hookLanguage: string; 
  hookStyle: string;
  customHookStyle: string;
  hookLength: string;
  hookCount: number;
  ctaChannel: string;
  hookStructure: string; // New field for advanced hook structure
  generatedHooks: string; 
  hookError: string | null;
  hookLoadingMessage: string | null; 

  // --- Lesson Generator Tab (lessonGenerator) ---
  storyInputForLesson: string; 
  lessonTargetLength: string;
  lessonWritingStyle: string;
  customLessonWritingStyle: string;
  ctaChannelForLesson: string; // Added
  generatedLesson: string;
  lessonError: string | null;
  lessonLoadingMessage: string | null;
  
  // --- Integrated Translation for Story ---
  storyTranslation: {
      translatedText: string | null;
      isTranslating: boolean;
      error: string | null;
  };
  
  // --- Queue Systems ---
  storyQueue: WriteStoryQueueItem[];
  storyQueueSystem: QueueSystemState;
  hookQueue: HookQueueItem[];
  hookQueueSystem: QueueSystemState;

  // --- Batch Story Writing fields REMOVED ---
  // batchOutlineItems: BatchOutlineItem[]; 
  // generatedBatchStories: GeneratedBatchStoryItem[];
  // batchStoryError: string | null;
  // batchStoryProgressMessage: string |null;
  // batchStoryLoading: boolean;
}

// Rewrite Module - SIMPLIFIED STRUCTURE
// Queue Item for Rewrite Module
export interface RewriteQueueItem {
    id: string;
    title: string; // User-provided title or auto-generated from content
    originalText: string;
    status: 'waiting' | 'processing' | 'completed' | 'error';
    progress: number; // 0-100
    rewrittenText: string | null;
    error: string | null;
    addedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    estimatedTimeRemaining: number | null; // seconds
    wordStats?: {
        originalWords: number;
        rewrittenWords: number;
        wordsChanged: number;
        changePercentage: number;
    };
    storyQualityStats?: {
        consistencyScore: number; // 0-100%
        completenessScore: number; // 0-100%
        overallQualityScore: number; // 0-100%
        analysis: {
            characterConsistency: string;
            plotCoherence: string;
            timelineConsistency: string;
            settingConsistency: string;
            overallAssessment: string;
        };
    };
}

// WriteStory Queue Item
export interface WriteStoryQueueItem {
    id: string;
    title: string;
    storyOutline: string; // Input outline
    status: 'waiting' | 'processing' | 'completed' | 'error';
    progress: number; // 0-100
    generatedStory: string | null;
    error: string | null;
    addedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    estimatedTimeRemaining: number | null; // seconds
    wordStats?: {
        outlineWords: number;
        storyWords: number;
        expansionRatio: number; // how much story expanded from outline
    };
}

// Hook Generator Queue Item  
export interface HookQueueItem {
    id: string;
    title: string;
    storyInput: string; // Input story for hook generation
    status: 'waiting' | 'processing' | 'completed' | 'error';
    progress: number; // 0-100
    generatedHooks: string | null;
    error: string | null;
    addedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    estimatedTimeRemaining: number | null; // seconds
    hookSettings: {
        hookLanguage: string;
        hookStyle: string;
        hookLength: string;
        hookCount: number;
        ctaChannel: string;
        hookStructure: string;
    };
}

// Generic Queue System State
export interface QueueSystemState {
    isEnabled: boolean;
    isPaused: boolean;
    isProcessing: boolean;
    currentItem: any | null; // Can be RewriteQueueItem, WriteStoryQueueItem, etc.
    completedCount: number;
    totalCount: number;
    averageProcessingTime: number; // seconds per item
}

export interface RewriteModuleState {
    rewriteLevel: number;
    sourceLanguage: string;
    targetLanguage: string;
    rewriteStyle: string;
    customRewriteStyle: string;
    adaptContext: boolean;
    originalText: string;
    rewrittenText: string;
    error: string | null;
    progress: number;
    loadingMessage: string | null;
    isEditing: boolean;
    editError: string | null;
    editLoadingMessage: string | null;
    hasBeenEdited: boolean;
    storyQualityAnalysis?: {
        consistencyScore: number;
        completenessScore: number;
        overallQualityScore: number;
        analysis: {
            characterConsistency: string;
            plotCoherence: string;
            timelineConsistency: string;
            settingConsistency: string;
            overallAssessment: string;
        };
    };
    translation: {
        translatedText: string | null;
        isTranslating: boolean;
        error: string | null;
    };
    // Queue System
    queue: RewriteQueueItem[];
    queueSystem: QueueSystemState;
}


// New Translate Module State
export interface TranslateModuleState {
    inputText: string;
    outputText: string;
    targetLanguage: string;
    translationStyle: string;
    customStyle: string;
    isLoading: boolean;
    error: string | null;
}


export interface AnalysisModuleState {
  sourceText: string;
  analysisFactors: AnalysisFactor[];
  suggestions: string;
  improvedStory: string;
  viralOutlineAnalysisResult: string;
  loadingMessage: string | null; // Added
  errorAnalysis: string | null; 
  errorImprovement: string | null; 
  errorViralOutline: string | null; 
}

export interface SubtitleLine {
  id: string; // unique id for react key
  text: string;
  status: 'pending' | 'processing' | 'done' | 'error' | 'canceled';
  outputUrl?: string; // URL.createObjectURL
  outputBlob?: Blob; // The actual blob for merging
  error?: string;
  voiceUsed?: string; // which API key or voice was used
}

export interface TtsModuleState {
  selectedProvider: TtsProvider;
  googleCloudApiKey: string;
  amazonAccessKeyId: string;
  amazonSecretAccessKey: string;
  amazonRegion: string;
  chatGptApiKey: string; 
  elevenLabsApiKeys: ElevenLabsApiKey[]; // New for multi-key support
  modelId: string; 
  voices: (GoogleCloudVoice | AmazonPollyVoice | BrowserSpeechVoice | OpenAiTtsVoice | ElevenLabsVoice)[];
  selectedVoiceId: string;
  subtitleLines: SubtitleLine[];
  error: string | null;
  loadingMessage: string | null;
  isProcessing: boolean;
  concurrencyLimit: number;
  selectedLanguageFilter: string;
  // New fields from Pro tool
  mainText: string;
  sentencesPerChunk: number;
  wpm: number;
  generateSrt: boolean;
  outputFilename: string;
}

export type ActiveSeoTabType = 'description' | 'keywords' | 'chapters' | 'titleThumbnailOptimizer'; // Added 'titleThumbnailOptimizer'
export interface YoutubeSeoModuleState {
  activeSeoTab: ActiveSeoTabType;
  // Common for description, chapters, and now title optimizer
  language: string;
  loadingMessage: string | null;
  error: string | null; // General error for the module
  
  // Tab: Description & Timeline
  videoTitle: string; // Also used by title optimizer as initial input if user wants
  youtubeOutline: string;
  timelineCount: number;
  videoDuration: number;
  videoKeywords: string; // Used for context in description and title optimizer
  youtubeDescription: string;
  youtubeTags: string;
  currentResult: string; // General result display, might need to be more specific or removed if each tab has its own output

  // Tab: Keywords
  keywordTopic: string;
  suggestedKeywordsOutput: string;
  
  // Tab: Chapters
  chapterScript: string;
  chapterVideoDuration: number;
  desiredChapterCount: number;
  generatedChapters: string;

  // Tab: Title & Thumbnail Optimizer (New)
  titleForAnalysis: string;
  titleAnalysisScore: number | null;
  titleAnalysisFeedback: string | null;
  suggestedTitles: string[];
  shortVideoSummaryForThumbnail: string;
  thumbnailTextSuggestions: string[];
  loadingTitleOptimizer: boolean; // Specific loading for this tab
  errorTitleOptimizer: string | null; // Specific error for this tab
}


export type ImageGenerationEngine = "google" | "stability" | "chatgpt" | "deepseek";

export type ContentStrategyActiveTabType = 'analyzeTrend' | 'nicheExplorer' | 'creationStudio';
export type CreationSourceType = 'baseTitle' | 'seriesList' | 'script';


// New interface for Niche Theme Explorer results, kept separate for clarity
export interface NicheThemeAnalysisResult {
  nicheName: string;
  nicheDescription: string;
  reasoning: string;
  contentSuggestions?: string[];
  relatedKeywords?: string[];
}

// Consolidated module state, was ViralTitleGeneratorModuleState
export interface ContentStrategyModuleState {
  activeTab: ContentStrategyActiveTabType;
  // General fields (mainly for title generation tabs)
  resultText: string;
  outputLanguage: string; // Used by generate, series, script
  loadingMessage: string | null; 
  error: string | null;

  // --- NEW: Creation Studio Tab ---
  creationSourceType: CreationSourceType; // To select the input mode in the new unified tab
  creationViralContext: string; // The new context/style learning input

  // Fields for the old tabs are kept but now used within the Creation Studio context
  // Context: baseTitle
  baseTitle: string;
  fixedPrefix: string;
  numVariations: number;
  viralKeywords: string;
  variationGoal: string;
  newContextTheme: string;
  generateVariationsExplanation: string | null;

  // Context: seriesList
  existingViralTitles: string;
  numNewSeriesTitles: number;
  
  // Context: script
  scriptContent: string;
  channelViralTitles: string;
  numSuggestions: number;

  // --- End of Creation Studio fields ---


  // Tab: Analyze Trend
  analyzeInputType: 'urls' | 'titles';
  analyzeUrls: string;
  analyzeTitles: string;
  analyzeChannelTheme: string;
  analysisReport: string;
  viralFormulas: string; 
  applicationSuggestions: string;
  analyzeLoadingMessage: string | null;
  analyzeError: string | null;
  groundingSourcesAnalysis: GroundingChunk[];

  // Tab: Niche Explorer (fields from the old NicheThemeExplorerModuleState)
  inputTitlesForNiche: string;
  nicheInputLanguage: string;
  nicheOutputLanguage: string;
  numNichesToSuggest: number;
  nicheAnalysisResults: NicheThemeAnalysisResult[];
  nicheIsLoading: boolean;
  nicheError: string | null;
  nicheProgressMessage: string | null;
}


export interface GeneratedImageItem {
  promptUsed: string; // Prompt final sent to the engine
  imageUrl: string | null; // base64 string or URL.createObjectURL
  error: string | null;
  engine: ImageGenerationEngine; 
  dalleRevisedPrompt?: string | null;
  // Store original image data if this is a refined version (for potential undo or comparison)
  originalImageDataUrl?: string | null; // if this item is a result of refinement
  originalPrompt?: string | null; // if this item is a result of refinement
}

// New Unified Image Generation Suite State
export type ImageGenerationSuiteActiveTab = 'hookStory' | 'batch' | 'intelligentContextImageGenerator' | 'intelligentContextPromptGenerator';
export interface ImageGenerationSuiteModuleState {
  activeTab: ImageGenerationSuiteActiveTab;

  // Common settings
  selectedArtStyle: string; 
  aspectRatio: string;
  imageEngine: ImageGenerationEngine;
  imageCount: number; // Number of images to generate
  
  // Engine-specific API Keys (managed within the module)
  stabilityApiKey: string;
  chatGptApiKey: string; 
  deepSeekImageApiKey: string; 

  // Stability AI specific settings
  stabilityStyle: string;
  stabilityNegativePrompt: string;

  // Single Image (from Hook/Story) specific - 'hookStory' and 'intelligentContextImageGenerator' tabs
  hookText: string;
  generatedSingleImages: GeneratedImageItem[];
  singleImageOverallError: string | null;
  singleImageProgressMessage: string | null;

  // Batch Image specific - 'batch' tab
  promptsInput: string; 
  generatedBatchImages: GeneratedImageItem[];
  batchOverallError: string | null;
  batchProgressMessage: string | null;
  
  // Intelligent Context Prompt Generator specific - 'intelligentContextPromptGenerator' tab
  hookTextForCtxPrompts: string;
  generatedCtxPrompts: string[];
  ctxPromptsError: string | null;
  ctxPromptsLoadingMessage: string | null;
  
  // General error for settings or unhandled cases
  settingsError?: string | null; 

  // State for Image Refinement Modal
  showRefinementModal: boolean;
  activeRefinementItem: {
    originalItem: GeneratedImageItem; // The image item being refined
    itemIndex: number; // Index in its respective array (generatedSingleImages or generatedBatchImages)
    isBatchItem: boolean; // True if the item is from generatedBatchImages
    originalImageDataUrl: string; // The imageUrl of the item being refined
  } | null;
  refinementPrompt: string;
  isRefining: boolean;
  refinementError: string | null;
}

// --- Edit Story Module ---
export type EditStoryActiveTab = 'single' | 'batch'; // Added for tabbing

export interface EditStoryAnalysisReport {
  consistencyScore: string; // e.g., "85%"
  scoreExplanation: string;
  keyImprovements: string[]; // Array of strings describing improvements
  remainingIssues: string[]; // Array of strings for potential minor issues
}

export interface EditStoryModuleState {
  activeTab: EditStoryActiveTab; // Added for tabbing

  // Single Edit Tab specific
  originalStoryToEdit: string;
  outlineForEditing: string; 
  targetLengthForEditing: string; // Also serves as global default for batch
  languageForEditing: string; // Also serves as global default for batch
  editedStoryOutput: string;
  isLoadingEditing: boolean; // For single edit processing
  loadingMessageEditing: string | null; // For single edit processing
  errorEditing: string | null; // For single edit processing
  postEditAnalysis: EditStoryAnalysisReport | null; // For single edit
  // New fields for interactive refinement
  refinementInstruction: string;
  isRefiningFurther: boolean;
  furtherRefinementError: string | null;

  // Batch Edit Tab specific
  batchInputItems: BatchEditStoryInputItem[];
  batchResults: GeneratedBatchEditStoryOutputItem[];
  isProcessingBatchEdit: boolean; // For batch edit processing
  batchEditProgressMessage: string | null; // Overall batch progress message
  batchEditError: string | null; // For errors not specific to an item in batch
  batchConcurrencyLimit: number; // Added for concurrent batch editing
}

export interface BatchEditStoryInputItem {
  id: string; // unique identifier for React keys
  originalStory: string;
  outline?: string | null; // Optional per-item outline
  specificTargetLength?: string | null; // Optional, overrides global if set
  specificLanguage?: string | null; // Optional, overrides global if set
}

export interface GeneratedBatchEditStoryOutputItem {
  id: string; // corresponds to BatchEditStoryInputItem.id
  originalStory: string; // Keep original for reference
  editedStory: string | null;
  postEditAnalysis: EditStoryAnalysisReport | null;
  status: 'pending' | 'editing' | 'analyzing' | 'completed' | 'error';
  progressMessage: string | null;
  error: string | null;
}


// --- Batch Story Writing Module ---
export interface BatchStoryInputItem {
  id: string; // unique identifier for React keys
  outline: string; // the full story outline
  specificTargetLength: string | null; // optional, overrides global if set, e.g., "2000"
  specificWritingStyle: string | null; // optional, overrides global, e.g., 'descriptive', 'custom'
  specificCustomWritingStyle: string | null; // optional, used if specificWritingStyle is 'custom'
}

export interface GeneratedBatchStoryOutputItem {
  id: string; // corresponds to BatchStoryInputItem.id
  originalOutline: string;
  generatedStory: string | null; // the final, edited story
  postEditAnalysis: EditStoryAnalysisReport | null; // analysis after editing
  status: 'pending' | 'writing' | 'editing' | 'analyzing' | 'completed' | 'error';
  progressMessage: string | null; // e.g., "Writing chunk 1/3...", "Editing story...", "Analyzing final output..."
  error: string | null;
}

export interface BatchStoryWritingModuleState {
  inputItems: BatchStoryInputItem[]; // list of outlines and their specific settings
  results: GeneratedBatchStoryOutputItem[]; // list of generated stories and their statuses
  globalTargetLength: string; // e.g., STORY_LENGTH_OPTIONS[1].value
  globalWritingStyle: string; // e.g., WRITING_STYLE_OPTIONS[0].value
  globalCustomWritingStyle: string;
  outputLanguage: string; // e.g., HOOK_LANGUAGE_OPTIONS[0].value
  referenceViralStoryForStyle: string; // for learning writing style
  isProcessingBatch: boolean; // true if the overall batch process is running
  batchProgressMessage: string | null; // overall progress, e.g., "Processing story 2 of 5..."
  batchError: string | null; // for errors not specific to an item, e.g., setup errors
  concurrencyLimit: number; // Added for concurrent processing
}

// --- Batch Rewrite Module ---
export interface BatchRewriteInputItem {
  id: string; // unique identifier for React keys
  originalText: string; // the original text to rewrite
  // Optional overrides for global settings
  specificRewriteLevel?: number | null;
  specificSourceLanguage?: string | null;
  specificTargetLanguage?: string | null;
  specificRewriteStyle?: string | null;
  specificCustomRewriteStyle?: string | null;
  specificAdaptContext?: boolean | null;
}

export interface GeneratedBatchRewriteOutputItem {
  id: string; // corresponds to BatchRewriteInputItem.id
  originalText: string;
  rewrittenText: string | null;
  status: 'pending' | 'rewriting' | 'editing' | 'completed' | 'error';
  progressMessage: string | null; // e.g., "Rewriting chunk 1/3...", "Editing text..."
  error: string | null;
  characterMap?: string | null; // Character map from initial rewrite if level >= 75%
  hasBeenEdited?: boolean; // Flag to indicate if post-rewrite edit was successful for this item
}

export interface BatchRewriteModuleState {
  inputItems: BatchRewriteInputItem[];
  results: GeneratedBatchRewriteOutputItem[];
  // Global settings
  globalRewriteLevel: number;
  globalSourceLanguage: string;
  globalTargetLanguage: string;
  globalRewriteStyle: string;
  globalCustomRewriteStyle: string;
  globalAdaptContext: boolean;
  // Batch processing state
  isProcessingBatch: boolean;
  batchProgressMessage: string | null; // Overall progress, e.g., "Processing item 2 of 5..."
  batchError: string | null; // For errors not specific to an item
  concurrencyLimit: number; // Added for concurrent processing
}

// --- Niche Theme Explorer Module State is REMOVED ---

// --- Dream 100 Competitor Analysis Module (New) ---
export interface Dream100ChannelResult {
  channelName: string;
  channelUrl: string; // Can be a direct URL or a search query string
  description: string;
  estimatedSubscribers: string; // e.g., "100K+", "Unknown"
  contentThemes: string[]; // Array of main content themes
  similarityReasoning: string; // Why AI thinks this channel is similar
}

export interface Dream100CompetitorAnalysisModuleState {
  inputChannelUrl: string;
  numberOfSuggestions: number; // e.g., 5-10
  outputLanguage: string; // For AI's descriptions and reasoning
  analysisResults: Dream100ChannelResult[];
  isLoading: boolean;
  error: string | null;
  progressMessage: string | null;
  groundingSources: GroundingChunk[]; // To store URLs AI referenced
  // New fields for filtering
  searchForNewChannels: boolean;
  newChannelTimeframe: 'last_year' | 'last_6_months' | 'any';
  viewProfile: 'high_views' | 'moderate_views' | 'any';
}

// --- Character Studio Module (Updated for iterative refinement) ---
export interface CharacterStudioModuleState {
  // Inputs for step 1 (Base Character Prompt)
  characterName: string;
  characterAge: string; 
  characterGender: string; // Added
  characterCountry: string;
  characterProfession: string;
  characterKeyFeatures: string; // Added

  inputLanguage: string; 
  outputLanguage: string; 

  // Output of step 1 and input for refinement
  generatedBaseCharacterPrompt: string; 
  isLoadingBasePrompt: boolean;
  errorBasePrompt: string | null;
  progressMessageBasePrompt: string | null;

  // Input for refining step 1
  refinementInstructionForBasePrompt: string; // Added
  isLoadingRefinementForBasePrompt: boolean; // Added
  errorRefinementForBasePrompt: string | null; // Added
  // No separate progress message for refinement, can reuse isLoadingRefinement

  // Input for step 2 (Complete Image Prompt)
  characterAction: string; 

  // Output of step 2
  generatedCompleteImagePrompt: string;
  isLoadingCompletePrompt: boolean;
  errorCompletePrompt: string | null;
  progressMessageCompletePrompt: string | null;
}


// Support Module - does not need a complex state for now
export interface SupportModuleState {
    // Potentially add fields if support module becomes more complex
    contactEmail?: string; // Example, not used currently
}
// For YoutubeSeoModule's Title & Thumbnail Optimizer
export interface TitleAnalysisResponse {
    score: number;
    feedback: string;
    suggested_titles: string[];
}

export interface ThumbnailTextResponse {
    thumbnail_texts: string[];
}
// For ImageGenerationSuiteModule, to parse AI response for sub-prompts
export interface GeminiSubPromptsResponse {
  image_prompts: string[];
}

export interface AdminApiKey {
    id: string;
    key: string;
    provider: string;
    createdAt: string;
    status: 'active' | 'inactive' | 'limited';
    usage: number;
    limit: number;
}

// Auth types for Frontend
export interface RegisterData {
    username?: string;
    email?: string;
    password?: string;
}
  
export interface LoginData {
    email?: string;
    password?: string;
}

export interface UserProfile {
    _id: string;
    username: string;
    email: string;
    subscriptionType: 'free' | 'monthly' | 'quarterly' | 'lifetime';
    subscriptionExpiresAt: string; // ISO date string
    createdAt: string; // ISO date string
}

// --- Content Summarizer Module ---
export type AiAssistantInputType = 'youtubeLink' | 'text';

export interface ChatMessage {
    role: 'user' | 'model';
    message: string;
}

export interface AiAssistantModuleState {
    activeInputTab: AiAssistantInputType;
    youtubeLinkInput: string;
    textInput: string;
    processedSourceText: string | null;
    summary: string | null;
    chatHistory: ChatMessage[];
    groundingSources: GroundingChunk[];
    currentQuestion: string;
    isLoading: boolean;
    isChatting: boolean;
    error: string | null;
}
