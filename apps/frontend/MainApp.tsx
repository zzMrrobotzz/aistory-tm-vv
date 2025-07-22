import React, { useState, useEffect, useCallback } from 'react';
import {
  ActiveModule, ApiSettings, ApiProvider,
  SuperAgentModuleState, CreativeLabModuleState, 
  WriteStoryModuleState, RewriteModuleState, AnalysisModuleState, TtsModuleState,
  TranslateModuleState, // Added
  YoutubeSeoModuleState, /* ImageByHookModuleState, */ // Removed
  ContentStrategyModuleState, /* ImageByHookEngine, */ // Removed
  /* BatchImageGeneratorModuleState, */ // Removed
  ImageGenerationSuiteModuleState, ImageGenerationEngine, GeneratedImageItem, // BatchOutlineItem removed from here as it's not directly used by App
  EditStoryModuleState, EditStoryAnalysisReport, BatchStoryWritingModuleState, BatchStoryInputItem,
  BatchRewriteModuleState, BatchRewriteInputItem, EditStoryActiveTab, BatchEditStoryInputItem, // Added BatchRewrite types
  NicheThemeAnalysisResult, // Kept for ContentStrategyModule
  Dream100CompetitorAnalysisModuleState, Dream100ChannelResult, GroundingChunk, // Added for Dream 100
  CharacterStudioModuleState, // Added for Character Studio
  GeminiSubPromptsResponse, // Added for ImageGenerationSuite
  ElevenLabsApiKey, ElevenLabsVoice, // Added for ElevenLabs TTS
  // QuickRewriteState removed as it's merged into RewriteModuleState
  UserProfile, // Add UserProfile
} from './types';
import { 
    DEFAULT_API_PROVIDER, HOOK_LANGUAGE_OPTIONS, 
    WRITING_STYLE_OPTIONS, REWRITE_STYLE_OPTIONS, ASPECT_RATIO_OPTIONS, 
    SUPER_AGENT_WORD_COUNT_OPTIONS, PLOT_STRUCTURE_OPTIONS, 
    OUTLINE_DETAIL_LEVEL_OPTIONS, STABILITY_STYLE_PRESETS, IMAGE_GENERATION_ENGINE_OPTIONS, 
    HOOK_STYLE_OPTIONS, HOOK_LENGTH_OPTIONS, STORY_LENGTH_OPTIONS,
    LESSON_LENGTH_OPTIONS, LESSON_WRITING_STYLE_OPTIONS, PREDEFINED_ART_STYLES,
    HOOK_STRUCTURE_OPTIONS, VARIATION_GOAL_OPTIONS, OPENAI_TTS_MODELS, ELEVENLABS_MODELS,
    TRANSLATE_LANGUAGE_OPTIONS, TRANSLATE_STYLE_OPTIONS // Added
} from './constants';
import Sidebar from './components/Sidebar';
import MainHeader from './components/MainHeader';
import ApiSettingsComponent from './components/ApiSettingsComponent';
import SuperAgentModule from './components/modules/SuperAgentModule';
import CreativeLabModule from './components/modules/CreativeLabModule';
import WriteStoryModule from './components/modules/WriteStoryModule';
import RewriteModule from './components/modules/RewriteModule';
import TranslateModule from './components/modules/TranslateModule'; // Added
import AnalysisModule from './components/modules/AnalysisModule';
import TtsModule from '@/components/modules/TtsModule'; // Assuming TtsModule uses alias from importmap
import YoutubeSeoModule from './components/modules/YoutubeSeoModule';
// import ImageByHookModule from './components/modules/ImageByHookModule'; // Removed
import ContentStrategyModule from './components/modules/ViralTitleGeneratorModule'; // Renamed import for clarity, file is the same
// import BatchImageGeneratorModule from './components/modules/BatchImageGeneratorModule'; // Removed
import ImageGenerationSuiteModule from '@/components/modules/ImageGenerationSuiteModule'; // Updated path
import EditStoryModule from './components/modules/EditStoryModule'; // Added
import BatchStoryWritingModule from './components/modules/BatchStoryWritingModule'; // Added
import BatchRewriteModule from './components/modules/BatchRewriteModule'; // Added
import Dream100CompetitorAnalysisModule from './components/modules/Dream100CompetitorAnalysisModule'; // Added
import CharacterStudioModule from './components/modules/CharacterStudioModule'; // Added
import SupportModule from './components/modules/SupportModule'; // Added
import { getUserProfile, logout } from './services/authService'; // Import getUserProfile and logout
import { useNavigate } from 'react-router-dom'; // Import useNavigate

// NOTE: Renaming the component back to MainApp from App
const MainApp: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeModule, setActiveModule] = useState<ActiveModule>(ActiveModule.SuperAgent);
  const [showApiSettings, setShowApiSettings] = useState(true); // Always show API settings for users.
  // Removed elevenLabsApiKeys state
  const [apiSettings, setApiSettings] = useState<ApiSettings>({
    provider: DEFAULT_API_PROVIDER as ApiProvider,
    apiKey: '',
  });

  const [storyOutlineForWriteModule, setStoryOutlineForWriteModule] = useState<string>('');
  const [outlineForSuperAgent, setOutlineForSuperAgent] = useState<string>('');

  const initialSuperAgentState: SuperAgentModuleState = {
    sourceText: '', wordCount: SUPER_AGENT_WORD_COUNT_OPTIONS[0].value, imageCount: 3, aspectRatio: ASPECT_RATIO_OPTIONS[0].value,
    generatedStory: '', generatedImages: [], error: null,
  };
  const [superAgentState, setSuperAgentState] = useState<SuperAgentModuleState>(initialSuperAgentState);


  const initialCreativeLabState: CreativeLabModuleState = {
    ideaLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    outputLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    plotStructure: PLOT_STRUCTURE_OPTIONS[0].value,
    customPlot: '',
    outlineDetailLevel: OUTLINE_DETAIL_LEVEL_OPTIONS[0].value,
    referenceViralOutline: '', 
    referenceOutlineAnalysisResult: null, // Added
    isAnalyzingReferenceOutline: false, // Added
    errorAnalyzingReferenceOutline: null, // Added
    activeCreativeTab: 'quickOutline',
    quickOutlineTitle: '',
    quickOutlineResult: '',
    quickOutlineError: null,
    quickOutlineLoading: false,
    quickOutlineProgressMessage: null,
    coreIdea: '', 
    secondaryIdea: '',
    emotionalJourney: '', 
    finalOutline: '', 
    singleOutlineError: null,
    singleOutlineLoading: false,
    singleOutlineProgressMessage: null,
    batchCoreIdeas: [''], 
    generatedBatchOutlines: [],
    batchOutlineError: null,
    batchOutlineProgressMessage: null,
    batchOutlineLoading: false,
    batchConcurrencyLimit: 3, // Added
  };
  const [creativeLabState, setCreativeLabState] = useState<CreativeLabModuleState>(initialCreativeLabState);
  
  const initialWriteStoryState: WriteStoryModuleState = {
    activeWriteTab: 'singleStory',
    targetLength: STORY_LENGTH_OPTIONS[1].value, 
    writingStyle: WRITING_STYLE_OPTIONS[0].value, 
    customWritingStyle: '',
    outputLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    referenceViralStoryForStyle: '',
    storyOutline: '', 
    generatedStory: '', 
    keyElementsFromSingleStory: null, 
    hasSingleStoryBeenEditedSuccessfully: false, 
    storyError: null, 
    storyProgress: 0, 
    storyLoadingMessage: null,
    singleStoryEditProgress: null,
    storyInputForHook: '', 
    hookLanguage: HOOK_LANGUAGE_OPTIONS[0].value, 
    hookStyle: HOOK_STYLE_OPTIONS[0].value,
    customHookStyle: '',
    hookLength: HOOK_LENGTH_OPTIONS[1].value, 
    hookCount: 3, 
    ctaChannel: '',
    hookStructure: HOOK_STRUCTURE_OPTIONS[0].value, // Added
    generatedHooks: '', 
    hookError: null,
    hookLoadingMessage: null,
    storyInputForLesson: '',
    lessonTargetLength: LESSON_LENGTH_OPTIONS[1].value,
    lessonWritingStyle: LESSON_WRITING_STYLE_OPTIONS[0].value,
    customLessonWritingStyle: '',
    ctaChannelForLesson: '', // Added
    generatedLesson: '',
    lessonError: null,
    lessonLoadingMessage: null,
    storyTranslation: { translatedText: null, isTranslating: false, error: null }, // Added
    // Batch story fields removed
  };

  const [writeStoryState, setWriteStoryState] = useState<WriteStoryModuleState>(() => {
    const savedState = localStorage.getItem('writeStoryModuleState_v1');
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        // Ensure output fields are reset, effectively not persisted from localStorage
        return {
          ...initialWriteStoryState, // Start with defaults for output fields
          ...parsedState,            // Override with saved settings
          generatedStory: '',        // Explicitly clear output
          generatedHooks: '',
          generatedLesson: '',
          // storyInputForHook, storyInputForLesson, hookStructure, ctaChannelForLesson will be retained from parsedState if present
          // generatedBatchStories removed
        };
      } catch (error) {
        console.error("Error parsing saved WriteStoryModuleState:", error);
        return initialWriteStoryState;
      }
    }
    return initialWriteStoryState;
  });

  const initialRewriteState: RewriteModuleState = {
    rewriteLevel: 50,
    sourceLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    targetLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    rewriteStyle: REWRITE_STYLE_OPTIONS[0].value,
    customRewriteStyle: '',
    adaptContext: false,
    originalText: '',
    rewrittenText: '',
    error: null,
    progress: 0,
    loadingMessage: null,
    isEditing: false,
    editError: null,
    editLoadingMessage: null,
    hasBeenEdited: false,
    translation: { translatedText: null, isTranslating: false, error: null },
  };

  const [rewriteState, setRewriteState] = useState<RewriteModuleState>(() => {
    const savedState = localStorage.getItem('rewriteModuleState_v3');
    const oldSavedState = localStorage.getItem('rewriteModuleQuickState_v2'); // For migration
    const stateToParse = savedState || oldSavedState;

    if (stateToParse) {
        try {
            const parsedState = JSON.parse(stateToParse);
            return {
                ...initialRewriteState, // Start with defaults
                ...parsedState,        // Override with saved settings
                // Reset session-specific state
                originalText: '',
                rewrittenText: '',
                error: null,
                progress: 0,
                loadingMessage: null,
                isEditing: false,
                editError: null,
                editLoadingMessage: null,
                hasBeenEdited: false,
                translation: { translatedText: null, isTranslating: false, error: null },
            };
        } catch (e) {
            console.error("Error parsing saved RewriteModuleState from localStorage", e);
            return initialRewriteState;
        }
    }
    return initialRewriteState;
  });
  
  const initialTranslateState: TranslateModuleState = {
    inputText: '',
    outputText: '',
    targetLanguage: TRANSLATE_LANGUAGE_OPTIONS[0].value,
    translationStyle: TRANSLATE_STYLE_OPTIONS[0].value,
    customStyle: '',
    isLoading: false,
    error: null,
  };

  const [translateState, setTranslateState] = useState<TranslateModuleState>(() => {
      const savedState = localStorage.getItem('translateModuleState_v1');
      if (savedState) {
          try {
              const parsedState = JSON.parse(savedState);
              // Ensure output fields are reset
              return {
                  ...initialTranslateState, // Start with defaults
                  ...parsedState,            // Override with saved settings
                  inputText: '',             // Clear inputs for fresh start
                  outputText: '',            // Clear outputs
                  isLoading: false,
                  error: null,
              };
          } catch (error) {
              console.error("Error parsing saved TranslateModuleState:", error);
              return initialTranslateState;
          }
      }
      return initialTranslateState;
  });

  const [analysisState, setAnalysisState] = useState<AnalysisModuleState>({
    sourceText: '', analysisFactors: [], suggestions: '', improvedStory: '', viralOutlineAnalysisResult: '',
    loadingMessage: null, errorAnalysis: null, errorImprovement: null, errorViralOutline: null,
  });

  const [ttsState, setTtsState] = useState<TtsModuleState>(() => {
    const savedState = localStorage.getItem('ttsModuleState_v4'); // Updated version
    const initialState: TtsModuleState = {
      selectedProvider: 'elevenlabs',
      googleCloudApiKey: '',
      amazonAccessKeyId: '',
      amazonSecretAccessKey: '',
      amazonRegion: 'us-east-1',
      chatGptApiKey: '',
      elevenLabsApiKeys: [], // New state for multiple keys
      modelId: ELEVENLABS_MODELS[0].id, // Default to an ElevenLabs model
      voices: [],
      selectedVoiceId: '',
      subtitleLines: [], // Reset on load
      error: null, // Reset on load
      loadingMessage: null, // Reset on load
      isProcessing: false, // Reset on load
      concurrencyLimit: 3,
      selectedLanguageFilter: 'all',
      // new fields
      mainText: '', // Reset on load
      sentencesPerChunk: 5,
      wpm: 150,
      generateSrt: true,
      outputFilename: 'tts_audio',
    };
     if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            return {
                ...initialState, // Start with defaults to ensure all fields are present
                ...parsed, // Override with saved settings
                // Reset session-specific fields
                voices: [],
                subtitleLines: [],
                error: null,
                loadingMessage: null,
                isProcessing: false,
                mainText: '', // Always clear main text on reload
                selectedLanguageFilter: parsed.selectedLanguageFilter || 'all',
            };
        } catch (e) {
            console.error("Error parsing TTSModuleState from localStorage", e);
            return initialState;
        }
    }
    return initialState;
  });

  const initialYoutubeSeoState: YoutubeSeoModuleState = {
    activeSeoTab: 'description',
    language: HOOK_LANGUAGE_OPTIONS[0].value,
    loadingMessage: null,
    error: null,
    videoTitle: '',
    youtubeOutline: '',
    timelineCount: 5,
    videoDuration: 10,
    videoKeywords: '',
    youtubeDescription: '',
    youtubeTags: '',
    currentResult: '',
    keywordTopic: '',
    suggestedKeywordsOutput: '',
    chapterScript: '',
    chapterVideoDuration: 10,
    desiredChapterCount: 5,
    generatedChapters: '',
    // New fields for Title & Thumbnail Optimizer
    titleForAnalysis: '',
    titleAnalysisScore: null,
    titleAnalysisFeedback: null,
    suggestedTitles: [],
    shortVideoSummaryForThumbnail: '',
    thumbnailTextSuggestions: [],
    loadingTitleOptimizer: false,
    errorTitleOptimizer: null,
  };
  const [youtubeSeoState, setYoutubeSeoState] = useState<YoutubeSeoModuleState>(initialYoutubeSeoState);
  
  const initialContentStrategyState: ContentStrategyModuleState = {
    activeTab: 'analyzeTrend',
    resultText: '',
    outputLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    loadingMessage: null,
    error: null,
    // Creation Studio
    creationSourceType: 'baseTitle',
    creationViralContext: '',
    // -- Old fields reused within Creation Studio
    baseTitle: '',
    fixedPrefix: '',
    numVariations: 5,
    viralKeywords: '',
    variationGoal: VARIATION_GOAL_OPTIONS[0].value,
    newContextTheme: '',
    generateVariationsExplanation: null,
    existingViralTitles: '',
    numNewSeriesTitles: 3,
    scriptContent: '',
    channelViralTitles: '',
    numSuggestions: 5,
    // Analyze Trend
    analyzeInputType: 'urls',
    analyzeUrls: '',
    analyzeTitles: '',
    analyzeChannelTheme: '',
    analysisReport: '',
    viralFormulas: '',
    applicationSuggestions: '',
    analyzeLoadingMessage: null,
    analyzeError: null,
    groundingSourcesAnalysis: [],
    // Niche Explorer
    inputTitlesForNiche: '',
    nicheInputLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    nicheOutputLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    numNichesToSuggest: 3,
    nicheAnalysisResults: [],
    nicheIsLoading: false,
    nicheError: null,
    nicheProgressMessage: null,
  };
  const [contentStrategyState, setContentStrategyState] = useState<ContentStrategyModuleState>(() => {
    const savedState = localStorage.getItem('contentStrategyModuleState_v2'); // Incremented version
    if (savedState) {
        try {
            const parsedState = JSON.parse(savedState);
            return {
                ...initialContentStrategyState,
                ...parsedState,
                // Reset all output fields
                resultText: '',
                analysisReport: '',
                viralFormulas: '',
                applicationSuggestions: '',
                groundingSourcesAnalysis: [],
                generateVariationsExplanation: null,
                nicheAnalysisResults: [],
                // Reset all loading/error messages
                loadingMessage: null,
                error: null,
                analyzeLoadingMessage: null,
                analyzeError: null,
                nicheIsLoading: false,
                nicheError: null,
                nicheProgressMessage: null,
            };
        } catch (e) {
            console.error("Error parsing ContentStrategyModuleState from localStorage", e);
            return initialContentStrategyState;
        }
    }
    return initialContentStrategyState;
  });


  const initialImageGenerationSuiteState: ImageGenerationSuiteModuleState = {
    activeTab: 'hookStory', 
    selectedArtStyle: PREDEFINED_ART_STYLES[0].value,
    aspectRatio: ASPECT_RATIO_OPTIONS[0].value,
    imageEngine: IMAGE_GENERATION_ENGINE_OPTIONS[0].value as ImageGenerationEngine,
    stabilityApiKey: '',
    chatGptApiKey: '',
    deepSeekImageApiKey: '',
    stabilityStyle: STABILITY_STYLE_PRESETS[0].value,
    stabilityNegativePrompt: 'text, watermark, blurry, ugly, deformed',
    hookText: '',
    generatedSingleImages: [],
    singleImageOverallError: null,
    singleImageProgressMessage: null,
    promptsInput: '',
    generatedBatchImages: [],
    batchOverallError: null,
    batchProgressMessage: null,
    hookTextForCtxPrompts: '',
    generatedCtxPrompts: [],
    ctxPromptsError: null,
    ctxPromptsLoadingMessage: null,
    settingsError: null,
    showRefinementModal: false,
    activeRefinementItem: null,
    refinementPrompt: '',
    isRefining: false,
    refinementError: null,
  };
  const [imageGenerationSuiteState, setImageGenerationSuiteState] = useState<ImageGenerationSuiteModuleState>(() => {
      const savedState = localStorage.getItem('imageGenerationSuiteState_v1');
      if (savedState) {
          try {
              const parsedState = JSON.parse(savedState);
              // Ensure activeTab is valid, default if not
              const validTabs: ImageGenerationSuiteModuleState['activeTab'][] = ['hookStory', 'batch', 'intelligentContextImageGenerator', 'intelligentContextPromptGenerator'];
              let currentActiveTab = parsedState.activeTab;
              if (currentActiveTab === 'contextualHookStory') { // Migration for old name
                currentActiveTab = 'intelligentContextImageGenerator';
              }
              if (!validTabs.includes(currentActiveTab)) {
                currentActiveTab = 'hookStory';
              }
              

              return {
                  ...initialImageGenerationSuiteState,
                  ...parsedState,
                  activeTab: currentActiveTab, // Ensure activeTab is valid
                  generatedSingleImages: [], // Clear outputs
                  generatedBatchImages: [],
                  singleImageOverallError: null,
                  singleImageProgressMessage: null,
                  batchOverallError: null,
                  batchProgressMessage: null,
                  generatedCtxPrompts: [], // Clear new output
                  ctxPromptsError: null,
                  ctxPromptsLoadingMessage: null,
                  settingsError: null,
                  showRefinementModal: false,
                  activeRefinementItem: null,
                  refinementPrompt: '',
                  isRefining: false,
                  refinementError: null,
              };
          } catch (e) {
              console.error("Error parsing ImageGenerationSuiteModuleState from localStorage", e);
              return initialImageGenerationSuiteState;
          }
      }
      return initialImageGenerationSuiteState;
  });

  const initialEditStoryState: EditStoryModuleState = {
    activeTab: 'single', // Default to single edit tab
    originalStoryToEdit: '',
    outlineForEditing: '',
    targetLengthForEditing: STORY_LENGTH_OPTIONS[1].value, 
    languageForEditing: HOOK_LANGUAGE_OPTIONS[0].value,
    editedStoryOutput: '',
    isLoadingEditing: false,
    loadingMessageEditing: null,
    errorEditing: null,
    postEditAnalysis: null,
    // New fields for interactive refinement
    refinementInstruction: '',
    isRefiningFurther: false,
    furtherRefinementError: null,
    // Batch edit fields
    batchInputItems: [{ id: Date.now().toString(), originalStory: '', outline: null, specificTargetLength: null, specificLanguage: null }],
    batchResults: [],
    isProcessingBatchEdit: false,
    batchEditProgressMessage: null,
    batchEditError: null,
    batchConcurrencyLimit: 3,
  };
  const [editStoryState, setEditStoryState] = useState<EditStoryModuleState>(() => {
    const savedState = localStorage.getItem('editStoryModuleState_v1');
    if (savedState) {
        try {
            const parsedState = JSON.parse(savedState);
            return {
                ...initialEditStoryState, // Start with defaults for output/processing fields
                ...parsedState,           // Override with saved settings (activeTab, inputs)
                editedStoryOutput: '',    // Clear single edit output
                postEditAnalysis: null,   // Clear single edit analysis
                isLoadingEditing: false,
                loadingMessageEditing: null,
                refinementInstruction: '', // Clear refinement instruction
                isRefiningFurther: false,
                furtherRefinementError: null,
                batchResults: [],         // Clear batch results
                isProcessingBatchEdit: false,
                batchEditProgressMessage: null,
            };
        } catch (error) {
            console.error("Error parsing saved EditStoryModuleState:", error);
            return initialEditStoryState;
        }
    }
    return initialEditStoryState;
  });

  const initialBatchStoryWritingState: BatchStoryWritingModuleState = {
    inputItems: [{ id: Date.now().toString(), outline: '', specificTargetLength: null, specificWritingStyle: null, specificCustomWritingStyle: null }],
    results: [],
    globalTargetLength: STORY_LENGTH_OPTIONS[1].value,
    globalWritingStyle: WRITING_STYLE_OPTIONS[0].value,
    globalCustomWritingStyle: '',
    outputLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    referenceViralStoryForStyle: '',
    isProcessingBatch: false,
    batchProgressMessage: null,
    batchError: null,
    concurrencyLimit: 3,
  };
  const [batchStoryWritingState, setBatchStoryWritingState] = useState<BatchStoryWritingModuleState>(initialBatchStoryWritingState);

  const initialBatchRewriteState: BatchRewriteModuleState = {
    inputItems: [{ id: Date.now().toString(), originalText: '' }],
    results: [],
    globalRewriteLevel: 50,
    globalSourceLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    globalTargetLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    globalRewriteStyle: REWRITE_STYLE_OPTIONS[0].value,
    globalCustomRewriteStyle: '',
    globalAdaptContext: false,
    isProcessingBatch: false,
    batchProgressMessage: null,
    batchError: null,
    concurrencyLimit: 3, // Added
  };
  const [batchRewriteState, setBatchRewriteState] = useState<BatchRewriteModuleState>(initialBatchRewriteState);

  const initialDream100State: Dream100CompetitorAnalysisModuleState = {
    inputChannelUrl: '',
    numberOfSuggestions: 5,
    outputLanguage: HOOK_LANGUAGE_OPTIONS[0].value,
    analysisResults: [],
    isLoading: false,
    error: null,
    progressMessage: null,
    groundingSources: [],
    searchForNewChannels: false,
    newChannelTimeframe: 'any',
    viewProfile: 'any',
  };
  const [dream100State, setDream100State] = useState<Dream100CompetitorAnalysisModuleState>(initialDream100State);

  const initialCharacterStudioState: CharacterStudioModuleState = {
    characterName: '',
    characterAge: '',
    characterGender: '', // Added
    characterCountry: '',
    characterProfession: '',
    characterKeyFeatures: '', // Added

    inputLanguage: HOOK_LANGUAGE_OPTIONS[0].value, 
    outputLanguage: HOOK_LANGUAGE_OPTIONS[1].value, 
    
    generatedBaseCharacterPrompt: '',
    isLoadingBasePrompt: false,
    errorBasePrompt: null,
    progressMessageBasePrompt: null,

    refinementInstructionForBasePrompt: '', // Added
    isLoadingRefinementForBasePrompt: false, // Added
    errorRefinementForBasePrompt: null, // Added
    
    characterAction: '',
    generatedCompleteImagePrompt: '',
    isLoadingCompletePrompt: false,
    errorCompletePrompt: null,
    progressMessageCompletePrompt: null,
  };
  const [characterStudioState, setCharacterStudioState] = useState<CharacterStudioModuleState>(initialCharacterStudioState);


  // The useEffect for loading 'allowUserApiKeys' has been removed to make settings always visible.

  // Removed useEffect for elevenLabsApiKeys

  useEffect(() => {
    const stateToSave: Partial<WriteStoryModuleState> = { ...writeStoryState };
    // Remove output fields before saving to localStorage
    delete stateToSave.generatedStory;
    delete stateToSave.generatedHooks;
    delete stateToSave.generatedLesson;
    // storyInputForHook, storyInputForLesson, hookStructure, ctaChannelForLesson are inputs/settings, so they should persist.
    delete stateToSave.storyLoadingMessage;
    delete stateToSave.storyProgress;
    delete stateToSave.singleStoryEditProgress;
    delete stateToSave.hookLoadingMessage;
    delete stateToSave.lessonLoadingMessage;
    delete stateToSave.storyTranslation; // Added
    // deleted batch story fields

    localStorage.setItem('writeStoryModuleState_v1', JSON.stringify(stateToSave));
  }, [writeStoryState]);

  useEffect(() => {
    const stateToSave: Partial<RewriteModuleState> = { ...rewriteState };
    // Remove output fields and session-specific edit statuses/messages before saving
    delete stateToSave.rewrittenText;
    delete stateToSave.loadingMessage;
    delete stateToSave.progress;
    delete stateToSave.isEditing;
    delete stateToSave.editError;
    delete stateToSave.editLoadingMessage;
    delete stateToSave.hasBeenEdited;
    delete stateToSave.translation;
    delete stateToSave.originalText; // Don't save large text input
    
    localStorage.setItem('rewriteModuleState_v3', JSON.stringify(stateToSave));
  }, [rewriteState]);

  useEffect(() => {
    const stateToSave: Partial<TranslateModuleState> = { ...translateState };
    // Remove output fields and processing state from localStorage
    delete stateToSave.inputText;
    delete stateToSave.outputText;
    delete stateToSave.isLoading;
    delete stateToSave.error;
    localStorage.setItem('translateModuleState_v1', JSON.stringify(stateToSave));
  }, [translateState]);

   useEffect(() => {
    const stateToSave: Partial<BatchStoryWritingModuleState> = { ...batchStoryWritingState };
    delete stateToSave.results;
    delete stateToSave.isProcessingBatch;
    delete stateToSave.batchProgressMessage;
    delete stateToSave.batchError;
    localStorage.setItem('batchStoryWritingModuleState_v1', JSON.stringify(stateToSave));
  }, [batchStoryWritingState]);

  useEffect(() => {
    const stateToSave: Partial<BatchRewriteModuleState> = { ...batchRewriteState };
    delete stateToSave.results;
    delete stateToSave.isProcessingBatch;
    delete stateToSave.batchProgressMessage;
    delete stateToSave.batchError;
    // Input items are settings, so they can be saved
    // delete stateToSave.inputItems; // No, keep input items
    localStorage.setItem('batchRewriteModuleState_v1', JSON.stringify(stateToSave));
  }, [batchRewriteState]);

  useEffect(() => {
    const stateToSave: Partial<EditStoryModuleState> = { ...editStoryState };
    // Persist activeTab, inputs for single and batch, and global settings for single edit
    // Clear outputs and processing states
    delete stateToSave.editedStoryOutput;
    delete stateToSave.postEditAnalysis;
    delete stateToSave.isLoadingEditing;
    delete stateToSave.loadingMessageEditing;
    delete stateToSave.errorEditing;
    // Clear refinement specific states not to be persisted
    delete stateToSave.isRefiningFurther;
    delete stateToSave.furtherRefinementError;
    // refinementInstruction is an input, so it can be persisted if desired, or cleared here.
    // For now, let's clear it for a fresh start each time.
    delete stateToSave.refinementInstruction;
    
    delete stateToSave.batchResults;
    delete stateToSave.isProcessingBatchEdit;
    delete stateToSave.batchEditProgressMessage;
    delete stateToSave.batchEditError;
    localStorage.setItem('editStoryModuleState_v1', JSON.stringify(stateToSave));
  }, [editStoryState]);
  
  useEffect(() => {
    const stateToSave: Partial<CreativeLabModuleState> = { ...creativeLabState };
    // Clear outputs
    delete stateToSave.quickOutlineResult;
    delete stateToSave.finalOutline;
    delete stateToSave.generatedBatchOutlines;
    delete stateToSave.referenceOutlineAnalysisResult;
    // Clear loading/error states
    delete stateToSave.quickOutlineLoading;
    delete stateToSave.singleOutlineLoading;
    delete stateToSave.batchOutlineLoading;
    delete stateToSave.isAnalyzingReferenceOutline;
    delete stateToSave.quickOutlineError;
    delete stateToSave.singleOutlineError;
    delete stateToSave.batchOutlineError;
    delete stateToSave.errorAnalyzingReferenceOutline;
    delete stateToSave.quickOutlineProgressMessage;
    delete stateToSave.singleOutlineProgressMessage;
    delete stateToSave.batchOutlineProgressMessage;
    
    localStorage.setItem('creativeLabModuleState_v1', JSON.stringify(stateToSave));
  }, [creativeLabState]);

  useEffect(() => {
    const stateToSave: Partial<YoutubeSeoModuleState> = { ...youtubeSeoState };
    // Clear output fields for each tab
    delete stateToSave.youtubeDescription;
    delete stateToSave.youtubeTags;
    delete stateToSave.suggestedKeywordsOutput;
    delete stateToSave.generatedChapters;
    delete stateToSave.currentResult; // General output field
    // Clear new title optimizer output fields
    delete stateToSave.titleAnalysisScore;
    delete stateToSave.titleAnalysisFeedback;
    delete stateToSave.suggestedTitles;
    delete stateToSave.thumbnailTextSuggestions;
    // Clear loading/error states
    delete stateToSave.loadingMessage;
    delete stateToSave.error;
    delete stateToSave.loadingTitleOptimizer;
    delete stateToSave.errorTitleOptimizer;
    localStorage.setItem('youtubeSeoModuleState_v1', JSON.stringify(stateToSave));
  }, [youtubeSeoState]);

  useEffect(() => {
    const stateToSave: Partial<Dream100CompetitorAnalysisModuleState> = { ...dream100State };
    delete stateToSave.analysisResults;
    delete stateToSave.isLoading;
    delete stateToSave.error;
    delete stateToSave.progressMessage;
    delete stateToSave.groundingSources;
    // Settings fields like inputChannelUrl, numberOfSuggestions, outputLanguage,
    // and the new filter preferences (searchForNewChannels, newChannelTimeframe, viewProfile)
    // should be persisted if that's the desired behavior.
    // If they should reset on reload, add them to delete list here.
    // For now, assuming they are settings and should be saved.
    localStorage.setItem('dream100CompetitorAnalysisModuleState_v1', JSON.stringify(stateToSave));
  }, [dream100State]);

  useEffect(() => {
    const stateToSave: Partial<CharacterStudioModuleState> = { ...characterStudioState };
    // Clear all output and processing-related fields
    delete stateToSave.generatedBaseCharacterPrompt;
    delete stateToSave.isLoadingBasePrompt;
    delete stateToSave.errorBasePrompt;
    delete stateToSave.progressMessageBasePrompt;
    
    delete stateToSave.isLoadingRefinementForBasePrompt; // Added
    delete stateToSave.errorRefinementForBasePrompt; // Added
    // refinementInstructionForBasePrompt is an input, so it can persist

    delete stateToSave.generatedCompleteImagePrompt;
    delete stateToSave.isLoadingCompletePrompt;
    delete stateToSave.errorCompletePrompt;
    delete stateToSave.progressMessageCompletePrompt;
    
    localStorage.setItem('characterStudioModuleState_v1', JSON.stringify(stateToSave));
  }, [characterStudioState]);

  useEffect(() => {
    const stateToSave: Partial<ImageGenerationSuiteModuleState> = {...imageGenerationSuiteState};
    delete stateToSave.generatedSingleImages;
    delete stateToSave.singleImageOverallError;
    delete stateToSave.singleImageProgressMessage;
    delete stateToSave.generatedBatchImages;
    delete stateToSave.batchOverallError;
    delete stateToSave.batchProgressMessage;
    delete stateToSave.generatedCtxPrompts;
    delete stateToSave.ctxPromptsError;
    delete stateToSave.ctxPromptsLoadingMessage;
    delete stateToSave.settingsError;
    delete stateToSave.showRefinementModal;
    delete stateToSave.activeRefinementItem;
    delete stateToSave.refinementPrompt;
    delete stateToSave.isRefining;
    delete stateToSave.refinementError;
    localStorage.setItem('imageGenerationSuiteState_v1', JSON.stringify(stateToSave));
  }, [imageGenerationSuiteState]);

  useEffect(() => {
    const stateToSave: Partial<ContentStrategyModuleState> = {...contentStrategyState};
    // Reset output fields from all tabs
    delete stateToSave.resultText;
    delete stateToSave.generateVariationsExplanation;
    delete stateToSave.analysisReport;
    delete stateToSave.viralFormulas;
    delete stateToSave.applicationSuggestions;
    delete stateToSave.groundingSourcesAnalysis;
    delete stateToSave.nicheAnalysisResults;
    // Reset all loading/error messages from all tabs
    delete stateToSave.loadingMessage;
    delete stateToSave.error;
    delete stateToSave.analyzeLoadingMessage;
    delete stateToSave.analyzeError;
    delete stateToSave.nicheIsLoading;
    delete stateToSave.nicheError;
    delete stateToSave.nicheProgressMessage;
    localStorage.setItem('contentStrategyModuleState_v2', JSON.stringify(stateToSave)); // Incremented version
  }, [contentStrategyState]);

  useEffect(() => {
    const stateToSave: Partial<TtsModuleState> = { ...ttsState };
    // Persist settings, clear session data
    delete stateToSave.voices;
    delete stateToSave.subtitleLines;
    delete stateToSave.error;
    delete stateToSave.loadingMessage;
    delete stateToSave.isProcessing;
    delete stateToSave.mainText;
    localStorage.setItem('ttsModuleState_v4', JSON.stringify(stateToSave));
  }, [ttsState]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const userProfile = await getUserProfile();
        if (userProfile) {
          setCurrentUser(userProfile);
        } else {
          // This case might happen if the token is valid but user is not found
          logout();
          navigate('/login');
        }
      } catch (error: any) {
        console.error("Could not fetch user profile:", error);
        // If API returns 401 Unauthorized or other auth errors, log out the user
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          console.log("Authentication error, logging out.");
          logout();
          navigate('/login');
        }
      }
    };

    fetchUserProfile();
  }, [navigate]);


  useEffect(() => {
     if(outlineForSuperAgent){
        setSuperAgentState(prev => ({...prev, sourceText: outlineForSuperAgent}));
        // Optional: clear it after transferring if it's a one-time transfer
        // setOutlineForSuperAgent(''); 
     }
  }, [outlineForSuperAgent]);

  useEffect(() => {
    if(storyOutlineForWriteModule) {
      setWriteStoryState(prev => ({
        ...prev, 
        storyOutline: storyOutlineForWriteModule, 
        activeWriteTab: 'singleStory', 
        generatedStory: '', 
        keyElementsFromSingleStory: null, 
        hasSingleStoryBeenEditedSuccessfully: false, 
        storyError: null, 
        storyLoadingMessage: null,
        singleStoryEditProgress: null, 
        generatedHooks: '', 
        hookError: null,
        hookLoadingMessage: null,
        // storyInputForHook: '', // Do not clear storyInputForHook here, let user manage it
      }));
      // Also update EditStoryModule if it's the active one and its single edit outline is empty
       if (activeModule === ActiveModule.EditStory && !editStoryState.originalStoryToEdit) { // Check if story is empty before filling outline
            setEditStoryState(prevEdit => ({
                ...prevEdit,
                outlineForEditing: storyOutlineForWriteModule,
                activeTab: 'single' // Default to single tab when outline is passed
            }));
        }
    }
  }, [storyOutlineForWriteModule, activeModule, editStoryState.originalStoryToEdit]);


  const renderActiveModule = () => {
    switch (activeModule) {
      case ActiveModule.SuperAgent:
        return <SuperAgentModule 
                  apiSettings={apiSettings} 
                  moduleState={superAgentState}
                  setModuleState={setSuperAgentState}
                  currentUser={currentUser} // Pass user profile
                />;
      case ActiveModule.CreativeLab:
        return <CreativeLabModule 
                  apiSettings={apiSettings} 
                  setActiveModule={setActiveModule}
                  setStoryOutlineForWriteModule={setStoryOutlineForWriteModule} 
                  // onSendBatchOutlinesToStoryModule removed
                  setOutlineForSuperAgent={setOutlineForSuperAgent}
                  moduleState={creativeLabState}
                  setModuleState={setCreativeLabState}
                  currentUser={currentUser} // Pass user profile
                />;
      case ActiveModule.WriteStory:
        return <WriteStoryModule 
                  apiSettings={apiSettings}
                  moduleState={writeStoryState}
                  setModuleState={setWriteStoryState}
                  retrievedViralOutlineFromAnalysis={analysisState.viralOutlineAnalysisResult}
                  currentUser={currentUser} // Pass user profile
                />;
      case ActiveModule.BatchStoryWriting: // Added
        return <BatchStoryWritingModule 
                  apiSettings={apiSettings}
                  moduleState={batchStoryWritingState}
                  setModuleState={setBatchStoryWritingState}
                  currentUser={currentUser} // Pass user profile
                />;
      case ActiveModule.Rewrite:
        return <RewriteModule 
                  apiSettings={apiSettings} 
                  moduleState={rewriteState}
                  setModuleState={setRewriteState}
                  currentUser={currentUser} // Pass user profile
                />;
      case ActiveModule.Translate: // Added
        return <TranslateModule 
                  apiSettings={apiSettings} 
                  moduleState={translateState}
                  setModuleState={setTranslateState}
                  currentUser={currentUser} // Pass user profile
                />;
      case ActiveModule.BatchRewrite: // Added
        return <BatchRewriteModule 
                  apiSettings={apiSettings} 
                  moduleState={batchRewriteState}
                  setModuleState={setBatchRewriteState}
                  currentUser={currentUser} // Pass user profile
                />;
      case ActiveModule.Analysis:
        return <AnalysisModule 
                  apiSettings={apiSettings}
                  moduleState={analysisState}
                  setModuleState={setAnalysisState}
                  currentUser={currentUser} // Pass user profile
                />;
       case ActiveModule.Dream100CompetitorAnalysis: // Added
        return <Dream100CompetitorAnalysisModule
                  apiSettings={apiSettings}
                  moduleState={dream100State}
                  setModuleState={setDream100State}
                  currentUser={currentUser} // Pass user profile
                />;
      case ActiveModule.TTS:
        return <TtsModule 
                  apiSettings={apiSettings}
                  moduleState={ttsState}
                  setModuleState={setTtsState}
                  currentUser={currentUser} // Pass user profile
                />;
      case ActiveModule.YouTubeSEO:
        return <YoutubeSeoModule 
                  apiSettings={apiSettings}
                  moduleState={youtubeSeoState}
                  setModuleState={setYoutubeSeoState}
                  currentUser={currentUser} // Pass user profile
                />;
      case ActiveModule.ViralTitleGenerator:
        return <ContentStrategyModule 
                  apiSettings={apiSettings}
                  moduleState={contentStrategyState}
                  setModuleState={setContentStrategyState}
                  currentUser={currentUser} // Pass user profile
                />;
      case ActiveModule.ImageGenerationSuite:
        return <ImageGenerationSuiteModule
                  apiSettings={apiSettings}
                  moduleState={imageGenerationSuiteState}
                  setModuleState={setImageGenerationSuiteState}
                  currentUser={currentUser} // Pass user profile
                />;
      case ActiveModule.EditStory:
        return <EditStoryModule
                  apiSettings={apiSettings}
                  moduleState={editStoryState}
                  setModuleState={setEditStoryState}
                  currentUser={currentUser} // Pass user profile
                />;
      case ActiveModule.CharacterStudio:
        return <CharacterStudioModule
                  apiSettings={apiSettings}
                  moduleState={characterStudioState}
                  setModuleState={setCharacterStudioState}
                  currentUser={currentUser} // Pass user profile
                />;
      case ActiveModule.Support:
        return <SupportModule 
                  currentUser={currentUser} // Pass user profile
                />;
      default:
        return <SuperAgentModule 
                  apiSettings={apiSettings} 
                  moduleState={superAgentState}
                  setModuleState={setSuperAgentState}
                  currentUser={currentUser} // Pass user profile
                />;
    }
  };

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [navigate]);

  return (
    <div className="flex bg-gray-100">
      <Sidebar 
        activeModule={activeModule} 
        setActiveModule={setActiveModule} 
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <div className="flex-1 ml-64">
        <MainHeader />
        <main className="p-8">
          {showApiSettings && (
            <ApiSettingsComponent
              apiSettings={apiSettings}
              setApiSettings={setApiSettings}
            />
          )}
          {renderActiveModule()}
        </main>
      </div>
    </div>
  );
};

// The component that was previously App.tsx is now MainApp.tsx
export default MainApp;