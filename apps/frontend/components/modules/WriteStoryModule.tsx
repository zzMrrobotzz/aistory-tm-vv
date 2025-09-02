import React, { useState, useEffect } from 'react';
import { ApiSettings, WriteStoryModuleState, WriteStoryActiveTab, BatchOutlineItem, UserProfile, WriteStoryQueueItem, HookQueueItem } from '../../types';
import { 
    WRITING_STYLE_OPTIONS, HOOK_LANGUAGE_OPTIONS, HOOK_STYLE_OPTIONS, 
    HOOK_LENGTH_OPTIONS, STORY_LENGTH_OPTIONS, 
    LESSON_LENGTH_OPTIONS, LESSON_WRITING_STYLE_OPTIONS,
    HOOK_STRUCTURE_OPTIONS, TRANSLATE_LANGUAGE_OPTIONS, TRANSLATE_STYLE_OPTIONS // Added
} from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import HistoryPanel from '../HistoryPanel';
import { generateText } from '../../services/textGenerationService';
import { delay, isSubscribed } from '../../utils';
import { HistoryStorage, MODULE_KEYS } from '../../utils/historyStorage';
import { Languages, StopCircle, Clock, Plus, Play, Pause, CheckCircle, Trash2, AlertCircle, Loader2, X } from 'lucide-react';
import UpgradePrompt from '../UpgradePrompt';
import { logApiCall, logStoryGenerated } from '../../services/usageService';
import { checkAndTrackRequest, getRequestStatus, REQUEST_ACTIONS, RequestCheckResult } from '../../services/requestTrackingService';
// Keep local counter as fallback
import { getTimeUntilReset } from '../../services/localRequestCounter';

interface WriteStoryModuleProps {
  apiSettings: ApiSettings;
  moduleState: WriteStoryModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<WriteStoryModuleState>>;
  retrievedViralOutlineFromAnalysis: string | null;
  currentUser: UserProfile | null;
}

const WriteStoryModule: React.FC<WriteStoryModuleProps> = ({ apiSettings, moduleState, setModuleState, retrievedViralOutlineFromAnalysis, currentUser }) => {
  
  // Helper function to check and track request with backend
  const checkAndTrackStoryRequest = async (action: string, itemCount: number = 1): Promise<{ allowed: boolean; stats: any; message?: string }> => {
    try {
      const result: RequestCheckResult = await checkAndTrackRequest(action, itemCount);
      
      if (result.blocked) {
        return {
          allowed: false,
          stats: result.usage,
          message: result.message
        };
      }
      
      return {
        allowed: true,
        stats: result.usage,
        message: result.warning
      };
    } catch (error) {
      console.warn('Backend request check failed, using local fallback');
      // Fallback to local logic if backend fails
      return {
        allowed: true,
        stats: { current: 0, limit: 999999, remaining: 999999, percentage: 0 },
        message: 'Sử dụng chế độ offline'
      };
    }
  };
  const {
    activeWriteTab,
    // Common settings
    targetLength, writingStyle, customWritingStyle, outputLanguage, referenceViralStoryForStyle,
    // Single Story tab
    storyOutline, generatedStory, keyElementsFromSingleStory, hasSingleStoryBeenEditedSuccessfully, storyError, storyProgress, storyLoadingMessage, singleStoryEditProgress,
    // Hook Generator tab
    storyInputForHook, // New field
    hookLanguage, hookStyle, customHookStyle, hookLength, hookCount, ctaChannel, hookStructure, // Added hookStructure
    generatedHooks, hookError, hookLoadingMessage,
    // Lesson Generator tab
    storyInputForLesson, lessonTargetLength, lessonWritingStyle, customLessonWritingStyle, 
    ctaChannelForLesson, // Added
    generatedLesson, lessonError, lessonLoadingMessage,
    // Integrated translation
    storyTranslation,
    // Queue systems
    storyQueue = [], storyQueueSystem = { isEnabled: false, isPaused: false, isProcessing: false, currentItem: null, completedCount: 0, totalCount: 0, averageProcessingTime: 60 },
    hookQueue = [], hookQueueSystem = { isEnabled: false, isPaused: false, isProcessing: false, currentItem: null, completedCount: 0, totalCount: 0, averageProcessingTime: 60 },
    // Batch Story fields removed from destructuring
  } = moduleState;

  const [isSingleOutlineExpanded, setIsSingleOutlineExpanded] = useState(true);
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);
  const hasActiveSubscription = isSubscribed(currentUser);

  // Generate unique ID for queue items
  const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

  // Calculate word statistics for story generation
  const calculateStoryStats = (outline: string, story: string) => {
    const countWords = (text: string) => {
      return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    };

    const outlineWords = countWords(outline);
    const storyWords = countWords(story);
    const expansionRatio = outlineWords > 0 ? Math.round(storyWords / outlineWords) : 0;

    return {
      outlineWords,
      storyWords,
      expansionRatio
    };
  };

  // Translation settings
  const [translateTargetLang, setTranslateTargetLang] = useState<string>('Vietnamese');
  const [translateStyle, setTranslateStyle] = useState<string>('Default');

  // Story Queue Management Functions
  const addToStoryQueue = (outline: string, title?: string) => {
    if (!outline.trim()) return;
    
    setModuleState(prev => {
      const newItem: WriteStoryQueueItem = {
        id: generateId(),
        title: title || `Truyện ${prev.storyQueue.length + 1} - ${outline.substring(0, 30)}...`,
        storyOutline: outline,
        status: 'waiting',
        progress: 0,
        generatedStory: null,
        error: null,
        addedAt: new Date(),
        startedAt: null,
        completedAt: null,
        estimatedTimeRemaining: null,
      };

      return {
        ...prev,
        storyQueue: [...prev.storyQueue, newItem],
        storyQueueSystem: {
          ...prev.storyQueueSystem,
          totalCount: prev.storyQueue.length + 1,
        },
      };
    });
  };

  const removeFromStoryQueue = (id: string) => {
    setModuleState(prev => {
      const updatedQueue = prev.storyQueue.filter(item => item.id !== id);
      return {
        ...prev,
        storyQueue: updatedQueue,
        storyQueueSystem: {
          ...prev.storyQueueSystem,
          totalCount: updatedQueue.length,
        },
      };
    });
  };

  const clearStoryQueue = () => {
    setModuleState(prev => ({
      ...prev,
      storyQueue: [],
      storyQueueSystem: {
        ...prev.storyQueueSystem,
        totalCount: 0,
        completedCount: 0,
        currentItem: null,
        isProcessing: false,
      },
    }));
  };

  const toggleStoryQueueMode = () => {
    setModuleState(prev => ({
      ...prev,
      storyQueueSystem: {
        ...prev.storyQueueSystem,
        isEnabled: !prev.storyQueueSystem.isEnabled,
      },
    }));
  };

  const pauseResumeStoryQueue = () => {
    setModuleState(prev => ({
      ...prev,
      storyQueueSystem: {
        ...prev.storyQueueSystem,
        isPaused: !prev.storyQueueSystem.isPaused,
      },
    }));
  };

  // Process story queue items one by one
  const processStoryQueue = async () => {
    setModuleState(prevState => {
      const waitingItems = prevState.storyQueue.filter(item => item.status === 'waiting');
      
      // If no waiting items or paused, stop processing
      if (waitingItems.length === 0 || prevState.storyQueueSystem.isPaused) {
        return {
          ...prevState,
          storyQueueSystem: {
            ...prevState.storyQueueSystem,
            isProcessing: false,
            currentItem: null,
          },
        };
      }

      // If already processing an item, don't start another
      if (prevState.storyQueueSystem.isProcessing && prevState.storyQueueSystem.currentItem) {
        return prevState;
      }

      const currentItem = waitingItems[0];
      
      // Start processing this item
      setTimeout(async () => {
        const startTime = Date.now();
        
        try {
          // Process the story
          await processStoryQueueItem(currentItem);
          
          const endTime = Date.now();
          const processingTime = (endTime - startTime) / 1000;
          
          // Update completion stats and check for next item
          setModuleState(prev => {
            const updatedState = {
              ...prev,
              storyQueueSystem: {
                ...prev.storyQueueSystem,
                completedCount: prev.storyQueueSystem.completedCount + 1,
                averageProcessingTime: (prev.storyQueueSystem.averageProcessingTime + processingTime) / 2,
              },
              storyQueue: prev.storyQueue.map(item =>
                item.id === currentItem.id
                  ? { ...item, status: 'completed' as const, completedAt: new Date(), progress: 100 }
                  : item
              ),
            };

            // Check if there are more waiting items
            const hasWaitingItems = updatedState.storyQueue.filter(item => item.status === 'waiting').length > 0;
            
            if (!updatedState.storyQueueSystem.isPaused && hasWaitingItems) {
              // Continue with next item after delay
              setTimeout(() => {
                setModuleState(nextState => ({
                  ...nextState,
                  storyQueueSystem: {
                    ...nextState.storyQueueSystem,
                    isProcessing: false,
                    currentItem: null,
                  }
                }));
                setTimeout(() => processStoryQueue(), 100);
              }, 1000);
            } else {
              // No more items - stop processing
              updatedState.storyQueueSystem.isProcessing = false;
              updatedState.storyQueueSystem.currentItem = null;
            }

            return updatedState;
          });

        } catch (error) {
          // Mark current item as error and continue with next
          setModuleState(prev => {
            const updatedState = {
              ...prev,
              storyQueue: prev.storyQueue.map(item =>
                item.id === currentItem.id
                  ? { ...item, status: 'error' as const, error: (error as Error).message }
                  : item
              ),
            };

            // Check if there are more waiting items even after error
            const hasWaitingItems = updatedState.storyQueue.filter(item => item.status === 'waiting').length > 0;
            
            if (!updatedState.storyQueueSystem.isPaused && hasWaitingItems) {
              // Continue with next item after delay
              setTimeout(() => {
                setModuleState(nextState => ({
                  ...nextState,
                  storyQueueSystem: {
                    ...nextState.storyQueueSystem,
                    isProcessing: false,
                    currentItem: null,
                  }
                }));
                setTimeout(() => processStoryQueue(), 100);
              }, 1000);
            } else {
              // No more items - stop processing
              updatedState.storyQueueSystem.isProcessing = false;
              updatedState.storyQueueSystem.currentItem = null;
            }

            return updatedState;
          });
        }
      }, 100);

      // Update current item status immediately
      return {
        ...prevState,
        storyQueueSystem: {
          ...prevState.storyQueueSystem,
          isProcessing: true,
          currentItem: currentItem,
        },
        storyQueue: prevState.storyQueue.map(item =>
          item.id === currentItem.id
            ? { ...item, status: 'processing' as const, startedAt: new Date() }
            : item
        ),
      };
    });
  };

  // Process individual story queue item
  const processStoryQueueItem = async (item: WriteStoryQueueItem) => {
    // Check request limit for queue item
    const requestCheck = await checkAndTrackStoryRequest(REQUEST_ACTIONS.WRITE_STORY);
    if (!requestCheck.allowed) {
      // Mark item as failed due to limit
      setModuleState(prev => ({
        ...prev,
        storyQueue: prev.storyQueue.map(qItem =>
          qItem.id === item.id
            ? { ...qItem, status: 'failed', error: requestCheck.message }
            : qItem
        ),
      }));
      throw new Error(`Request limit reached: ${requestCheck.message}`);
    }
    if (requestCheck.message) {
      console.log('⚠️ Queue story request warning:', requestCheck.message);
    }

    const CHUNK_WORD_COUNT = 1000; // Base chunks on target word count, not character count
    const currentTargetLengthNum = parseInt(targetLength);
    const numChunks = Math.max(1, Math.ceil(currentTargetLengthNum / CHUNK_WORD_COUNT)); // Ensure at least 1 chunk
    let fullGeneratedStory = '';

    for (let i = 0; i < numChunks; i++) {
      // Update progress with more granular steps
      const baseProgress = Math.round((i / numChunks) * 90); // Leave 10% for completion
      setModuleState(prev => ({
        ...prev,
        storyQueue: prev.storyQueue.map(qItem =>
          qItem.id === item.id
            ? { ...qItem, progress: baseProgress }
            : qItem
        ),
      }));

      // Update progress to show we're generating this chunk
      const chunkProgress = Math.round((i / numChunks) * 90) + Math.round((10 / numChunks) * 0.5); // Small increment during generation
      setModuleState(prev => ({
        ...prev,
        storyQueue: prev.storyQueue.map(qItem =>
          qItem.id === item.id
            ? { ...qItem, progress: chunkProgress }
            : qItem
        ),
      }));

      // Build story generation prompt (use full outline, focus on the current section)
      const prompt = `You are an expert storyteller. Generate part ${i + 1} of ${numChunks} of a compelling story based on the provided outline.

**CRITICAL LENGTH REQUIREMENTS:**
- Target length for THIS SECTION: approximately ${CHUNK_WORD_COUNT} words
- Total Target Length for ENTIRE STORY: ${targetLength} words
- WORD COUNT CONTROL IS VERY IMPORTANT. Try to keep this section between ${Math.round(CHUNK_WORD_COUNT * 0.85)} and ${Math.round(CHUNK_WORD_COUNT * 1.15)} words.

**Settings:**
- Writing Style: ${writingStyle === 'custom' ? customWritingStyle : writingStyle}
- Output Language: ${outputLanguage}
- Reference Style: ${referenceViralStoryForStyle || 'N/A'}

**Complete Outline:**
---
${item.storyOutline}
---

**Previous Story Context:**
---
${fullGeneratedStory || "This is the beginning of the story."}
---

**Instructions for Part ${i + 1}/${numChunks}:**
- Continue the story naturally from the previous context
- ${i === 0 ? 'Start with a compelling opening that hooks the reader' : 'Maintain narrative flow and character consistency'}
- ${i === numChunks - 1 ? 'Work towards a satisfying conclusion' : 'Advance the plot while leaving room for continuation'}
- STRICTLY aim for approximately ${CHUNK_WORD_COUNT} words in this section (no more than ${Math.round(CHUNK_WORD_COUNT * 1.15)}, no less than ${Math.round(CHUNK_WORD_COUNT * 0.85)})
- Write in ${outputLanguage} language
- Use vivid descriptions and compelling dialogue

Provide ONLY the story content for this section:`;
      
      await delay(1000); // Doubled from 500ms to prevent 503 errors
      const result = await generateText(prompt, undefined, false, apiSettings, 'write-story');
      fullGeneratedStory += (fullGeneratedStory ? '\n\n' : '') + (result?.text || '').trim();
      
      // Update progress after chunk completion
      const completedProgress = Math.round(((i + 1) / numChunks) * 90);
      setModuleState(prev => ({
        ...prev,
        storyQueue: prev.storyQueue.map(qItem =>
          qItem.id === item.id
            ? { ...qItem, progress: completedProgress }
            : qItem
        ),
      }));
    }

    // Update progress to show editing phase
    setModuleState(prev => ({
      ...prev,
      storyQueue: prev.storyQueue.map(qItem =>
        qItem.id === item.id
          ? { ...qItem, progress: 90 }
          : qItem
      ),
    }));

    // Apply story editing using the same logic as single story mode
    let finalStory = fullGeneratedStory.trim();
    if (finalStory) {
      // Create a temporary abort controller for editing
      const editAbortCtrl = new AbortController();
      
      try {
        // Use handleEditStory but capture the result for queue item
        const originalUpdateState = updateState;
        const originalGeneratedStory = moduleState.generatedStory;
        
        // Temporarily update generated story for editing
        updateState({ generatedStory: finalStory });
        
        // Call the existing edit function
        await handleEditStory(finalStory, item.storyOutline, null, undefined, editAbortCtrl);
        
        // Get the edited story from the state
        finalStory = moduleState.generatedStory || finalStory;
        
        // Restore original generated story
        updateState({ generatedStory: originalGeneratedStory });
        
      } catch (error) {
        console.warn('Queue story editing failed, using original story:', error);
        // Keep original story if editing fails
      }
    }

    // Calculate word statistics for final story
    const wordStats = calculateStoryStats(item.storyOutline, finalStory);
    
    // Update final result with edited story and statistics
    setModuleState(prev => ({
      ...prev,
      storyQueue: prev.storyQueue.map(qItem =>
        qItem.id === item.id
          ? { 
              ...qItem, 
              generatedStory: finalStory,
              wordStats: wordStats,
              progress: 100
            }
          : qItem
      ),
    }));

    // Log usage statistics (editing calls are logged by handleEditStory)
    logApiCall('write-story', numChunks);
    logStoryGenerated('write-story', 1);
  };

  // Hook Queue Management Functions
  const addToHookQueue = (storyInput: string, title?: string) => {
    if (!storyInput.trim()) return;
    
    setModuleState(prev => {
      const newItem: HookQueueItem = {
        id: generateId(),
        title: title || `Hook ${prev.hookQueue.length + 1} - ${storyInput.substring(0, 30)}...`,
        storyInput: storyInput,
        status: 'waiting',
        progress: 0,
        generatedHooks: null,
        error: null,
        addedAt: new Date(),
        startedAt: null,
        completedAt: null,
        estimatedTimeRemaining: null,
        hookSettings: {
          hookLanguage,
          hookStyle,
          hookLength,
          hookCount,
          ctaChannel,
          hookStructure,
        },
      };

      return {
        ...prev,
        hookQueue: [...prev.hookQueue, newItem],
        hookQueueSystem: {
          ...prev.hookQueueSystem,
          totalCount: prev.hookQueue.length + 1,
        },
      };
    });
  };

  const removeFromHookQueue = (id: string) => {
    setModuleState(prev => {
      const updatedQueue = prev.hookQueue.filter(item => item.id !== id);
      return {
        ...prev,
        hookQueue: updatedQueue,
        hookQueueSystem: {
          ...prev.hookQueueSystem,
          totalCount: updatedQueue.length,
        },
      };
    });
  };

  const clearHookQueue = () => {
    setModuleState(prev => ({
      ...prev,
      hookQueue: [],
      hookQueueSystem: {
        ...prev.hookQueueSystem,
        totalCount: 0,
        completedCount: 0,
        currentItem: null,
        isProcessing: false,
      },
    }));
  };

  const toggleHookQueueMode = () => {
    setModuleState(prev => ({
      ...prev,
      hookQueueSystem: {
        ...prev.hookQueueSystem,
        isEnabled: !prev.hookQueueSystem.isEnabled,
      },
    }));
  };

  const pauseResumeHookQueue = () => {
    setModuleState(prev => ({
      ...prev,
      hookQueueSystem: {
        ...prev.hookQueueSystem,
        isPaused: !prev.hookQueueSystem.isPaused,
      },
    }));
  };

  // Process hook queue items one by one
  const processHookQueue = async () => {
    setModuleState(prevState => {
      const waitingItems = prevState.hookQueue.filter(item => item.status === 'waiting');
      
      if (waitingItems.length === 0 || prevState.hookQueueSystem.isPaused) {
        return {
          ...prevState,
          hookQueueSystem: {
            ...prevState.hookQueueSystem,
            isProcessing: false,
            currentItem: null,
          },
        };
      }

      if (prevState.hookQueueSystem.isProcessing && prevState.hookQueueSystem.currentItem) {
        return prevState;
      }

      const currentItem = waitingItems[0];
      
      setTimeout(async () => {
        const startTime = Date.now();
        
        try {
          await processHookQueueItem(currentItem);
          
          const endTime = Date.now();
          const processingTime = (endTime - startTime) / 1000;
          
          setModuleState(prev => {
            const updatedState = {
              ...prev,
              hookQueueSystem: {
                ...prev.hookQueueSystem,
                completedCount: prev.hookQueueSystem.completedCount + 1,
                averageProcessingTime: (prev.hookQueueSystem.averageProcessingTime + processingTime) / 2,
              },
              hookQueue: prev.hookQueue.map(item =>
                item.id === currentItem.id
                  ? { ...item, status: 'completed' as const, completedAt: new Date(), progress: 100 }
                  : item
              ),
            };

            const hasWaitingItems = updatedState.hookQueue.filter(item => item.status === 'waiting').length > 0;
            
            if (!updatedState.hookQueueSystem.isPaused && hasWaitingItems) {
              setTimeout(() => {
                setModuleState(nextState => ({
                  ...nextState,
                  hookQueueSystem: {
                    ...nextState.hookQueueSystem,
                    isProcessing: false,
                    currentItem: null,
                  }
                }));
                setTimeout(() => processHookQueue(), 100);
              }, 1000);
            } else {
              updatedState.hookQueueSystem.isProcessing = false;
              updatedState.hookQueueSystem.currentItem = null;
            }

            return updatedState;
          });

        } catch (error) {
          setModuleState(prev => {
            const updatedState = {
              ...prev,
              hookQueue: prev.hookQueue.map(item =>
                item.id === currentItem.id
                  ? { ...item, status: 'error' as const, error: (error as Error).message }
                  : item
              ),
            };

            const hasWaitingItems = updatedState.hookQueue.filter(item => item.status === 'waiting').length > 0;
            
            if (!updatedState.hookQueueSystem.isPaused && hasWaitingItems) {
              setTimeout(() => {
                setModuleState(nextState => ({
                  ...nextState,
                  hookQueueSystem: {
                    ...nextState.hookQueueSystem,
                    isProcessing: false,
                    currentItem: null,
                  }
                }));
                setTimeout(() => processHookQueue(), 100);
              }, 1000);
            } else {
              updatedState.hookQueueSystem.isProcessing = false;
              updatedState.hookQueueSystem.currentItem = null;
            }

            return updatedState;
          });
        }
      }, 100);

      return {
        ...prevState,
        hookQueueSystem: {
          ...prevState.hookQueueSystem,
          isProcessing: true,
          currentItem: currentItem,
        },
        hookQueue: prevState.hookQueue.map(item =>
          item.id === currentItem.id
            ? { ...item, status: 'processing' as const, startedAt: new Date() }
            : item
        ),
      };
    });
  };

  // Process individual hook queue item
  const processHookQueueItem = async (item: HookQueueItem) => {
    // Check request limit for queue item
    const requestCheck = await checkAndTrackStoryRequest(REQUEST_ACTIONS.WRITE_STORY);
    if (!requestCheck.allowed) {
      // Mark item as failed due to limit
      setModuleState(prev => ({
        ...prev,
        hookQueue: prev.hookQueue.map(qItem =>
          qItem.id === item.id
            ? { ...qItem, status: 'failed', error: requestCheck.message }
            : qItem
        ),
      }));
      throw new Error(`Request limit reached: ${requestCheck.message}`);
    }
    if (requestCheck.message) {
      console.log('⚠️ Queue hook request warning:', requestCheck.message);
    }

    const { hookSettings } = item;
    let fullGeneratedHooks = '';

    // Update progress to show preparation phase
    setModuleState(prev => ({
      ...prev,
      hookQueue: prev.hookQueue.map(qItem =>
        qItem.id === item.id
          ? { ...qItem, progress: 10 }
          : qItem
      ),
    }));

    await delay(600); // Doubled from 300ms to prevent 503 errors

    // Update progress to show generation phase
    setModuleState(prev => ({
      ...prev,
      hookQueue: prev.hookQueue.map(qItem =>
        qItem.id === item.id
          ? { ...qItem, progress: 30 }
          : qItem
      ),
    }));

    // Build hook generation prompt
    const prompt = `You are a viral content expert. Generate ${hookSettings.hookCount} compelling hooks based on the provided story content.

**Settings:**
- Language: ${hookSettings.hookLanguage}
- Style: ${hookSettings.hookStyle}
- Length: ${hookSettings.hookLength}
- CTA Channel: ${hookSettings.ctaChannel}
- Structure: ${hookSettings.hookStructure}

**Story Content:**
---
${item.storyInput}
---

**Instructions:**
- Create ${hookSettings.hookCount} different hooks that capture attention immediately
- Each hook should use the ${hookSettings.hookStyle} style
- Target length: ${hookSettings.hookLength}
- Include appropriate CTA for ${hookSettings.ctaChannel}
- Follow ${hookSettings.hookStructure} structure
- Write in ${hookSettings.hookLanguage} language
- Number each hook (1., 2., 3., etc.)

Provide ONLY the numbered hooks, no additional explanations.`;
    
    // Update progress to show API call in progress
    setModuleState(prev => ({
      ...prev,
      hookQueue: prev.hookQueue.map(qItem =>
        qItem.id === item.id
          ? { ...qItem, progress: 70 }
          : qItem
      ),
    }));

    await delay(1000); // Doubled from 500ms to prevent 503 errors
    const result = await generateText(prompt, undefined, false, apiSettings);
    fullGeneratedHooks = (result?.text || '').trim();

    // Update progress to show post-processing
    setModuleState(prev => ({
      ...prev,
      hookQueue: prev.hookQueue.map(qItem =>
        qItem.id === item.id
          ? { ...qItem, progress: 90 }
          : qItem
      ),
    }));

    await delay(400); // Doubled from 200ms to prevent 503 errors

    // Update progress to 100%
    setModuleState(prev => ({
      ...prev,
      hookQueue: prev.hookQueue.map(qItem =>
        qItem.id === item.id
          ? { 
              ...qItem, 
              generatedHooks: fullGeneratedHooks,
              progress: 100
            }
          : qItem
      ),
    }));

    // Log usage statistics
    logApiCall('write-story', 1);
  };

  const updateState = (updates: Partial<WriteStoryModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };
  
  const updateStoryTranslationState = (updates: Partial<WriteStoryModuleState['storyTranslation']>) => {
    setModuleState(prev => ({
        ...prev,
        storyTranslation: {
            ...prev.storyTranslation,
            ...updates
        }
    }));
  };

  const handleCancelOperation = () => {
    if (currentAbortController) {
      currentAbortController.abort();
      // Update specific loading message based on active tab
      if (activeWriteTab === 'singleStory') {
        updateState({ storyLoadingMessage: "Đang hủy viết truyện..." });
      } else if (activeWriteTab === 'hookGenerator') {
        updateState({ hookLoadingMessage: "Đang hủy tạo hook..." });
      } else if (activeWriteTab === 'lessonGenerator') {
        updateState({ lessonLoadingMessage: "Đang hủy tạo bài học..." });
      }
    }
  };

  const handleUseViralOutline = () => {
    if (retrievedViralOutlineFromAnalysis && retrievedViralOutlineFromAnalysis.trim()) {
        updateState({
            storyOutline: retrievedViralOutlineFromAnalysis,
            generatedStory: '',
            keyElementsFromSingleStory: null,
            hasSingleStoryBeenEditedSuccessfully: false,
            generatedHooks: '',
            storyError: null,
            hookError: null,
            lessonError: null,
            storyLoadingMessage: null,
            singleStoryEditProgress: null,
            hookLoadingMessage: null,
            lessonLoadingMessage: null,
            storyProgress: 0,
            storyTranslation: { translatedText: null, isTranslating: false, error: null }, // Reset translation
            activeWriteTab: 'singleStory' // Switch to single story tab
        });
        setIsSingleOutlineExpanded(true);
    }
  };

  const handleGenerateHooks = async () => {
    let currentHookGenStyle = hookStyle;
    if (hookStyle === 'custom') {
      if (!customHookStyle.trim()) {
        updateState({ hookError: 'Vui lòng nhập phong cách hook tùy chỉnh!' });
        return;
      }
      currentHookGenStyle = customHookStyle.trim();
    }
    if (!storyInputForHook.trim()) { 
      updateState({ hookError: 'Vui lòng nhập Nội dung truyện để tạo hook!' });
      return;
    }

    // Check request limit with backend tracking
    const requestCheck = await checkAndTrackStoryRequest(REQUEST_ACTIONS.WRITE_STORY);
    if (!requestCheck.allowed) {
      const timeLeft = getTimeUntilReset();
      const errorMessage = `${requestCheck.message} Còn ${timeLeft.hours}h ${timeLeft.minutes}m để reset.`;
      updateState({ hookError: errorMessage });
      return;
    }
    if (requestCheck.message) {
      console.log('⚠️ Request warning:', requestCheck.message);
    }
    
    const abortCtrl = new AbortController();
    setCurrentAbortController(abortCtrl);
    updateState({ hookError: null, generatedHooks: '', hookLoadingMessage: 'Đang tạo hooks...' });
    
    let ctaInstructionSegment = ctaChannel.trim() ? `\n- If a Call To Action (CTA) is appropriate for the chosen hook structure (e.g., as part of 'Action' in AIDA, or at the end), incorporate a compelling CTA to like, comment, and subscribe to the channel "${ctaChannel.trim()}".` : "";
    const selectedHookLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === hookLanguage)?.label || hookLanguage;

    let structureInstructionSegment = '';
    let structuralExplanationRequirement = '';
    if (hookStructure !== 'default' && hookStructure) {
        const structureOption = HOOK_STRUCTURE_OPTIONS.find(opt => opt.value === hookStructure);
        const structureName = structureOption ? structureOption.label.split(' (')[0] : hookStructure; // "AIDA", "PAS", etc.

        structureInstructionSegment = `\n- The structure of the hooks MUST follow the ${structureName} model.`;
        structuralExplanationRequirement = `
        \n- For EACH hook generated, append a brief, parenthesized explanation of how it applies the ${structureName} model's components.
        \n  Example for AIDA: "1. [Hook Text including CTA if relevant]. (AIDA: Attention - ...; Interest - ...; Desire - ...; Action - ...)"
        \n  Example for PAS: "2. [Hook Text including CTA if relevant]. (PAS: Problem - ...; Agitate - ...; Solution - ...)"
        \n  Adapt this explanation format for other chosen structures, clearly labeling each part of the structure applied in the hook. The explanation must be concise and in the same language as the hook (${selectedHookLangLabel}).`;
    }
    
    const prompt = `Based on the following story content, generate ${hookCount} compelling opening hooks in ${selectedHookLangLabel}.
    \n**Instructions:**
    \n- The style of the hooks should be: **${currentHookGenStyle}**.
    \n- Each hook should be approximately **${hookLength} words** long.${structureInstructionSegment}${ctaInstructionSegment}${structuralExplanationRequirement}
    \n- Format the output with each hook on a new line, numbered like "1. [Hook Content][ (Structural Explanation if applicable)]".
    \n**Story Content (this may be in a different language than the desired hook language, use its meaning for generation in ${selectedHookLangLabel}):**
    \n---
    \n${storyInputForHook.trim()}
    \n---`;

    try {
      const result = await generateText(prompt, undefined, undefined, apiSettings);
      if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      updateState({ generatedHooks: result.text, hookLoadingMessage: "Tạo hook hoàn tất!" });
      
      // Save hooks to history
      if (result.text.trim()) {
        const hookTitle = storyInputForHook.split('\n')[0]?.trim().substring(0, 50) || 'Hooks không tiêu đề';
        HistoryStorage.saveToHistory(MODULE_KEYS.WRITE_STORY + '_hooks', hookTitle, result.text);
      }
      
      // Log usage statistics for hooks generation
      logApiCall('write-story', 1); // 1 API call for hooks
      logStoryGenerated('write-story', hookCount); // Log number of hooks generated
    } catch (e: any) {
      if (e.name === 'AbortError') {
        updateState({ hookError: 'Tạo hook đã bị hủy.', hookLoadingMessage: 'Đã hủy.' });
      } else {
        updateState({ hookError: `Đã xảy ra lỗi khi tạo hook: ${e.message}`, hookLoadingMessage: "Lỗi tạo hook." });
      }
    } finally {
      setCurrentAbortController(null);
      setTimeout(() => setModuleState(prev => (prev.hookLoadingMessage?.includes("hoàn tất") || prev.hookLoadingMessage?.includes("Lỗi") || prev.hookLoadingMessage?.includes("Đã hủy")) ? {...prev, hookLoadingMessage: null} : prev), 3000);
    }
  };

  const handleWriteStory = async () => {
    if (!storyOutline.trim()) {
      updateState({ storyError: 'Vui lòng nhập dàn ý truyện!' });
      return;
    }

    // Check request limit with backend tracking
    const requestCheck = await checkAndTrackStoryRequest(REQUEST_ACTIONS.WRITE_STORY);
    if (!requestCheck.allowed) {
      const timeLeft = getTimeUntilReset();
      const errorMessage = `${requestCheck.message} Còn ${timeLeft.hours}h ${timeLeft.minutes}m để reset.`;
      updateState({ storyError: errorMessage });
      return;
    }
    if (requestCheck.message) {
      console.log('⚠️ Request warning:', requestCheck.message);
    }

    // Local counter system doesn't need warning checks
    let currentStoryStyle = writingStyle;
    if (writingStyle === 'custom') {
      if (!customWritingStyle.trim()) {
        updateState({ storyError: 'Vui lòng nhập phong cách viết truyện tùy chỉnh!' });
        return;
      }
      currentStoryStyle = customWritingStyle.trim();
    } else {
      currentStoryStyle = WRITING_STYLE_OPTIONS.find(opt => opt.value === writingStyle)?.label || writingStyle;
    }

    const abortCtrl = new AbortController();
    setCurrentAbortController(abortCtrl);

    updateState({ 
        storyError: null, 
        generatedStory: '', 
        storyProgress: 0, 
        storyLoadingMessage: 'Đang chuẩn bị...', 
        keyElementsFromSingleStory: null,
        hasSingleStoryBeenEditedSuccessfully: false, 
        singleStoryEditProgress: null,
        storyTranslation: { translatedText: null, isTranslating: false, error: null }, // Reset translation state
    });
    const CHUNK_WORD_COUNT = 1000; 
    const currentTargetLengthNum = parseInt(targetLength);
    const numChunks = Math.ceil(currentTargetLengthNum / CHUNK_WORD_COUNT);
    let fullStory = '';
    const outputLanguageLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;
    
    let referenceStoryStylePromptSegment = '';
    if (referenceViralStoryForStyle?.trim()) {
        referenceStoryStylePromptSegment = `
        \n**Phân Tích & Học Tập ADN Viral (QUAN TRỌNG NHẤT):**
        \nDưới đây là một bộ sưu tập các kịch bản/truyện đã thành công. Nhiệm vụ của bạn là:
        \n1.  **Phân Tích Sâu:** Đọc và phân tích TẤT CẢ các kịch bản trong bộ sưu tập này.
        \n2.  **Trích Xuất ADN VIRAL:** Xác định các yếu tố chung, lặp lại tạo nên sự hấp dẫn (viral DNA) của chúng. Tập trung vào:
        \n    - **Cấu trúc Mở đầu (Hook):** Cách họ thu hút sự chú ý trong vài giây đầu.
        \n    - **Nhịp độ (Pacing):** Tốc độ kể chuyện, khi nào nhanh, khi nào chậm.
        \n    - **Xung đột & Cao trào:** Cách xây dựng và đẩy xung đột lên đỉnh điểm.
        \n    - **Yếu tố Cảm xúc:** Các "nút thắt" cảm xúc (tò mò, đồng cảm, phẫn nộ, bất ngờ).
        \n    - **Kỹ thuật Giữ chân (Retention Techniques):** Vòng lặp mở (open loops), cliffhangers, câu hỏi bỏ lửng.
        \n    - **Văn phong (Writing Style):** Cách dùng từ, cấu trúc câu, giọng điệu.
        \n3.  **Áp Dụng ADN Viral:** Khi bạn viết câu chuyện MỚI dựa trên "Dàn ý tổng thể" của người dùng, BẠN BẮT BUỘC PHẢI áp dụng các nguyên tắc "ADN Viral" bạn vừa học được để tạo ra một câu chuyện có khả năng giữ chân người xem cao nhất.
        \n4.  **NGHIÊM CẤM Sao Chép Nội Dung:** TUYỆT ĐỐI không sử dụng lại nhân vật, tình huống cụ thể từ các kịch bản tham khảo. Hãy sáng tạo câu chuyện hoàn toàn mới dựa trên "Dàn ý tổng thể" của người dùng.
        
        \n**BỘ SƯU TẬP KỊCH BẢN THAM KHẢO:**
        \n---
        \n${referenceViralStoryForStyle.trim()}
        \n---`;
    }

    let capturedKeyElements: string | null = null;
    try {
      for (let i = 0; i < numChunks; i++) {
        if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        updateState({ storyLoadingMessage: `Đang viết phần ${i + 1}/${numChunks} của truyện (mục tiêu tổng: ~${currentTargetLengthNum} từ) bằng ${outputLanguageLabel}...`, storyProgress: Math.round(((i + 1) / numChunks) * 100) });
        const context = fullStory.length > 2000 ? '...\n' + fullStory.slice(-2000) : fullStory;
        let prompt = `Bạn là một nhà văn đa ngôn ngữ. Viết tiếp câu chuyện BẰNG NGÔN NGỮ ${outputLanguageLabel}, dựa HOÀN TOÀN vào "Dàn ý tổng thể".
        \nƯớc tính độ dài cho PHẦN NÀY: khoảng ${CHUNK_WORD_COUNT} từ. Tổng độ dài mục tiêu của TOÀN BỘ truyện là ${currentTargetLengthNum} từ.
        \nVIỆC KIỂM SOÁT ĐỘ DÀI CỦA TỪNG PHẦN LÀ RẤT QUAN TRỌNG. CỐ GẮNG GIỮ PHẦN NÀY KHÔNG VƯỢT QUÁ ${Math.round(CHUNK_WORD_COUNT * 1.15)} TỪ VÀ KHÔNG NGẮN HƠN ${Math.round(CHUNK_WORD_COUNT * 0.85)} TỪ.
        ${referenceStoryStylePromptSegment}
        \n**Dàn ý tổng thể (NGUỒN DUY NHẤT CHO NỘI DUNG TRUYỆN):**\n${storyOutline}`;
        if (i === 0) {
          prompt += `
        \n**Yêu cầu RẤT QUAN TRỌNG Trước Khi Viết Phần 1:**
        \n1.  **Phân tích Dàn Ý.**
        \n2.  **Xác định Yếu Tố Cốt Lõi:** Tên nhân vật chính/phụ, địa điểm chính.
        \n3.  **Xuất Yếu Tố Cốt Lõi:** Sau khi viết xong phần 1, thêm vào CUỐI CÙNG một dòng ĐẶC BIỆT theo định dạng: [KEY_ELEMENTS]Tên nhân vật 1, Tên nhân vật 2; Địa điểm A, Địa điểm B[/KEY_ELEMENTS]. Chỉ xuất thẻ này 1 LẦN DUY NHẤT trong toàn bộ quá trình viết truyện. Dòng này phải tách biệt và là dòng cuối cùng của phản hồi cho phần 1.`;
        } else if (capturedKeyElements) {
          prompt += `\n**YẾU TỐ CỐT LÕI (NHÂN VẬT & ĐỊA ĐIỂM) - BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT:**\n${capturedKeyElements}\nTUYỆT ĐỐI không thay đổi hoặc giới thiệu tên mới không có trong danh sách này, trừ khi dàn ý yêu cầu rõ ràng.`;
        }
        prompt += `
        \n**Nội dung đã viết (ngữ cảnh${i === 0 ? " - trống cho phần 1" : ""}):**\n${context}
        \n**Yêu cầu hiện tại (Phần ${i + 1}/${numChunks}):**
        \n- Viết phần tiếp theo, liền mạch, TRUNG THÀNH với "Dàn ý tổng thể".
        \n- ${i === 0 ? 'SỬ DỤNG NHẤT QUÁN các tên nhân vật/địa điểm bạn vừa xác định và sẽ xuất ra ở cuối phần 1.' : 'ĐẶC BIỆT CHÚ Ý sử dụng đúng "YẾU TỐ CỐT LÕI" đã được xác định trước đó.'}
        \n- Văn phong: "${currentStoryStyle}" (nhưng ưu tiên văn phong học từ "Phân Tích ADN Viral" nếu có).
        \n- VIẾT TOÀN BỘ BẰNG NGÔN NGỮ ${outputLanguageLabel}. Không dùng ngôn ngữ khác.
        \n- Chỉ viết nội dung phần tiếp theo, không lặp lại, không tiêu đề.
        \nBắt đầu viết phần tiếp theo (bằng ${outputLanguageLabel}):`;

        // Add rate limiting delay before each API call (including first chunk) - doubled to prevent 503 errors
        await delay(i === 0 ? 2000 : 4000, abortCtrl.signal); // Doubled to prevent 503 errors 
        const result = await generateText(prompt, undefined, undefined, apiSettings);
        if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        let currentChunkText = result.text;
        if (i === 0) {
            const keyElementsMatch = currentChunkText.match(/\[KEY_ELEMENTS\]([\s\S]*?)\[\/KEY_ELEMENTS\]/);
            if (keyElementsMatch && keyElementsMatch[1]) {
                capturedKeyElements = keyElementsMatch[1].trim();
                updateState({ keyElementsFromSingleStory: capturedKeyElements });
                currentChunkText = currentChunkText.replace(keyElementsMatch[0], '').trim();
            }
        }
        fullStory += (fullStory ? '\n\n' : '') + currentChunkText;
        updateState({ generatedStory: fullStory });
      }
      updateState({ storyLoadingMessage: 'Hoàn thành viết truyện! Chuẩn bị biên tập độ dài.' });
      
      await delay(4000, abortCtrl.signal); // Doubled from 2000ms to prevent 503 errors 
      if(fullStory.trim()){
          await handleEditStory(fullStory, storyOutline, capturedKeyElements, undefined, abortCtrl); // Pass abortCtrl
      } else {
        updateState({ storyError: "Không thể tạo nội dung truyện.", storyLoadingMessage: null, storyProgress: 0 });
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        updateState({ storyError: `Viết truyện đã bị hủy.`, storyLoadingMessage: 'Đã hủy.', storyProgress: 0 });
      } else {
        updateState({ storyError: `Đã xảy ra lỗi khi viết truyện: ${e.message}`, storyLoadingMessage: null, storyProgress: 0 });
      }
    } finally {
      setCurrentAbortController(null);
      // Let editStory's finally block handle clearing the "Đã hủy" if it's the one that sets it
      if (storyLoadingMessage !== 'Đã hủy biên tập.') {
        setTimeout(() => setModuleState(prev => (prev.storyLoadingMessage === 'Đã hủy.' || prev.storyLoadingMessage === 'Hoàn thành viết truyện! Chuẩn bị biên tập độ dài.' || (prev.storyError && !prev.storyLoadingMessage?.includes("Đã hủy"))) ? {...prev, storyLoadingMessage: null} : prev), 3000);
      }
    }
  };

  const handleEditStory = async (
    storyToEdit: string, 
    originalOutlineParam: string, 
    keyElementsInstruction?: string | null, 
    itemIndex?: number, // Not used for single story edit here
    externalAbortController?: AbortController // Accept controller from calling function
  ) => {
    const abortCtrl = externalAbortController || new AbortController();
    if (!externalAbortController) { // If called directly, manage its own controller
        setCurrentAbortController(abortCtrl);
    }

    if (!storyToEdit.trim()) {
      updateState({ storyError: 'Không có truyện để biên tập.', singleStoryEditProgress: null, storyLoadingMessage: null, hasSingleStoryBeenEditedSuccessfully: false });
      if (!externalAbortController) setCurrentAbortController(null);
      return;
    }

    const currentTargetLengthNum = parseInt(targetLength);
    const minLength = Math.round(currentTargetLengthNum * 0.9);
    const maxLength = Math.round(currentTargetLengthNum * 1.1);
    const estimatedCurrentWordCount = storyToEdit.split(/\s+/).filter(Boolean).length;

    let actionVerb = "";
    let diffDescription = "";
    if (estimatedCurrentWordCount > maxLength) {
        actionVerb = "RÚT NGẮN";
        diffDescription = `khoảng ${estimatedCurrentWordCount - currentTargetLengthNum} từ`;
    } else if (estimatedCurrentWordCount < minLength) {
        actionVerb = "MỞ RỘNG";
        diffDescription = `khoảng ${currentTargetLengthNum - estimatedCurrentWordCount} từ`;
    }

    const editingLoadingMessage = `AI đang biên tập truyện (hiện tại ~${estimatedCurrentWordCount} từ, mục tiêu ${minLength}-${maxLength} từ)...`;
    updateState({ 
        storyLoadingMessage: editingLoadingMessage, 
        singleStoryEditProgress: 30, 
        hasSingleStoryBeenEditedSuccessfully: false,
        storyError: null // Clear previous story errors
    });
    
    const outputLanguageLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;
    
    let prompt = `Bạn là một biên tập viên truyện chuyên nghiệp. Nhiệm vụ của bạn là biên tập lại toàn bộ "Truyện Gốc" dưới đây để đáp ứng các yêu cầu sau:
    \n**YÊU CẦU QUAN TRỌNG NHẤT VÀ ĐẦU TIÊN: ĐỘ DÀI CUỐI CÙNG CỦA TRUYỆN SAU KHI BIÊN TẬP PHẢI nằm trong khoảng từ ${minLength} đến ${maxLength} từ. MỤC TIÊU LÝ TƯỞNG là khoảng ${currentTargetLengthNum} từ.**
    \nTruyện gốc bạn nhận được hiện có khoảng ${estimatedCurrentWordCount} từ.
    \n${actionVerb ? `Yêu cầu Điều chỉnh Rõ ràng: Bạn cần ${actionVerb} ${diffDescription} cho truyện này.` : "Truyện đang trong khoảng độ dài chấp nhận được, hãy tập trung vào chất lượng."}

    \n**CÁCH THỨC ĐIỀU CHỈNH ĐỘ DÀI (Nếu cần):**
    \n- **Nếu truyện quá dài (hiện tại ${estimatedCurrentWordCount} > ${maxLength} từ):** BẠN BẮT BUỘC PHẢI RÚT NGẮN NÓ. TUYỆT ĐỐI KHÔNG LÀM NÓ DÀI THÊM.
        \n  1.  Cô đọng văn phong: Loại bỏ từ ngữ thừa, câu văn rườm rà, diễn đạt súc tích hơn.
        \n  2.  Tóm lược các đoạn mô tả chi tiết không ảnh hưởng LỚN đến cốt truyện hoặc cảm xúc chính.
        \n  3.  Nếu vẫn còn quá dài, xem xét gộp các cảnh phụ ít quan trọng hoặc cắt tỉa tình tiết không thiết yếu.
        \n  4.  **DỪNG LẠI KHI ĐẠT GẦN MỤC TIÊU:** Khi truyện đã được rút ngắn và có độ dài ước tính gần ${maxLength} (nhưng vẫn trên ${minLength}), hãy chuyển sang tinh chỉnh nhẹ nhàng để đạt được khoảng ${currentTargetLengthNum} từ. **TUYỆT ĐỐI KHÔNG CẮT QUÁ TAY** làm truyện ngắn hơn ${minLength} từ.
    \n- **Nếu truyện quá ngắn (hiện tại ${estimatedCurrentWordCount} < ${minLength} từ):** BẠN BẮT BUỘC PHẢI MỞ RỘNG NÓ. TUYỆT ĐỐI KHÔNG LÀM NÓ NGẮN ĐI.
        \n  1.  Thêm chi tiết mô tả (cảm xúc nhân vật, không gian, thời gian, hành động nhỏ).
        \n  2.  Kéo dài các đoạn hội thoại quan trọng, thêm phản ứng, suy nghĩ của nhân vật.
        \n  3.  Mở rộng các cảnh hành động hoặc cao trào bằng cách mô tả kỹ hơn các diễn biến.
        \n  4.  **DỪNG LẠI KHI ĐẠT GẦN MỤC TIÊU:** Khi truyện đã được mở rộng và có độ dài ước tính gần ${minLength} (nhưng vẫn dưới ${maxLength}), hãy chuyển sang tinh chỉnh nhẹ nhàng để đạt được khoảng ${currentTargetLengthNum} từ. **TUYỆT ĐỐI KHÔNG KÉO DÀI QUÁ TAY** làm truyện dài hơn ${maxLength} từ.
    \n- **Nếu truyện đã trong khoảng ${minLength}-${maxLength} từ:** Tập trung vào việc tinh chỉnh văn phong, làm rõ ý, đảm bảo mạch lạc.

    \n**YÊU CẦU VỀ CHẤT LƯỢNG (SAU KHI ĐẢM BẢO ĐỘ DÀI):**
    \n1.  **Tính Nhất Quán:** Kiểm tra và đảm bảo tính logic của cốt truyện, sự nhất quán của nhân vật (tên, tính cách, hành động, mối quan hệ), bối cảnh, và mạch truyện.
    \n    ${keyElementsInstruction ? `**YẾU TỐ CỐT LÕI (NHÂN VẬT & ĐỊA ĐIỂM) - BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT KHI BIÊN TẬP:**\n    ${keyElementsInstruction}\n    Tuyệt đối không thay đổi tên nhân vật/địa điểm đã được xác định này.` : ''}
    \n2.  **Mạch Lạc & Hấp Dẫn:** Đảm bảo câu chuyện trôi chảy, dễ hiểu, và giữ được sự hấp dẫn.
    \n3.  **Bám sát Dàn Ý Gốc:** Việc biên tập không được làm thay đổi các NÚT THẮT, CAO TRÀO QUAN TRỌNG, hoặc Ý NGHĨA CHÍNH của câu chuyện được mô tả trong "Dàn Ý Gốc".
    \n**DÀN Ý GỐC (Để đối chiếu khi biên tập, KHÔNG được viết lại dàn ý):**
    \n---
    \n${originalOutlineParam}
    \n---
    \n**TRUYỆN GỐC CẦN BIÊN TẬP (được cung cấp bằng ${outputLanguageLabel}):**
    \n---
    \n${storyToEdit}
    \n---
    \nHãy trả về TOÀN BỘ câu chuyện đã được biên tập hoàn chỉnh bằng ngôn ngữ ${outputLanguageLabel}.
    ĐẢM BẢO ĐỘ DÀI CUỐI CÙNG nằm trong khoảng ${minLength} đến ${maxLength} từ.
    Không thêm bất kỳ lời bình, giới thiệu, hay tiêu đề nào.`;

    try {
      const result = await generateText(prompt, undefined, undefined, apiSettings, 'write-story');
      if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const editedStory = result.text;
      updateState({ 
        generatedStory: editedStory, 
        storyLoadingMessage: '✅ ĐÃ BIÊN TẬP XONG 100%!', 
        singleStoryEditProgress: 100,
        hasSingleStoryBeenEditedSuccessfully: true
      });
      
      // Save to history when story is completed
      if (editedStory.trim()) {
        const storyTitle = storyOutline.split('\n')[0]?.trim() || 'Truyện không tiêu đề';
        HistoryStorage.saveToHistory(MODULE_KEYS.WRITE_STORY, storyTitle, editedStory);
      }
      
      // Log usage statistics for story generation
      logApiCall('write-story', 2); // Typically uses 2 API calls (generate + edit)
      logStoryGenerated('write-story', 1); // Log 1 story generated
    } catch (e: any) {
      if (e.name === 'AbortError') {
         updateState({ storyError: 'Biên tập truyện đã bị hủy.', storyLoadingMessage: 'Đã hủy biên tập.', singleStoryEditProgress: null, hasSingleStoryBeenEditedSuccessfully: false });
      } else {
        const editErrorMsg = `Lỗi khi biên tập truyện: ${e.message}`;
        updateState({ 
            storyError: editErrorMsg, 
            storyLoadingMessage: 'Lỗi biên tập.', 
            singleStoryEditProgress: null,
            hasSingleStoryBeenEditedSuccessfully: false
        });
      }
    } finally {
        if (!externalAbortController) setCurrentAbortController(null);
        setTimeout(() => setModuleState(prev => (prev.storyLoadingMessage?.includes("ĐÃ BIÊN TẬP XONG") || prev.storyLoadingMessage?.includes("Lỗi biên tập") || prev.storyLoadingMessage?.includes("Đã hủy biên tập")) ? {...prev, storyLoadingMessage: null, singleStoryEditProgress: null} : prev), 3000);
    }
  };

  const handleTranslateStory = async () => {
    if (!generatedStory.trim()) {
        updateStoryTranslationState({ error: "Không có truyện để dịch." });
        return;
    }

    updateStoryTranslationState({ isTranslating: true, error: null, translatedText: 'Đang dịch...' });
    
    try {
        let styleInstruction = '';
        if (translateStyle !== 'Default') {
            const styleLabel = TRANSLATE_STYLE_OPTIONS.find(opt => opt.value === translateStyle)?.label || translateStyle;
            styleInstruction = ` with a ${styleLabel.toLowerCase()} tone`;
        }

        const prompt = `Translate the following text to ${translateTargetLang}${styleInstruction}. Provide only the translated text, without any additional explanations or context.\n\nText to translate:\n"""\n${generatedStory.trim()}\n"""`;
        
        const result = await generateText(prompt, undefined, false, apiSettings);
        updateStoryTranslationState({ translatedText: result.text.trim() });
        
        // Log translation usage
        logApiCall('translate', 1);
    } catch (e) {
        console.error("Story Translation Error:", e);
        updateStoryTranslationState({ error: `Lỗi dịch thuật: ${(e as Error).message}`, translatedText: "Dịch lỗi. Vui lòng thử lại." });
    } finally {
        updateStoryTranslationState({ isTranslating: false });
    }
  };


  const handleGenerateLesson = async () => {
    if (!storyInputForLesson.trim()) {
      updateState({ lessonError: 'Vui lòng nhập Truyện để đúc kết bài học!' });
      return;
    }

    // Check request limit with backend tracking
    const requestCheck = await checkAndTrackStoryRequest(REQUEST_ACTIONS.WRITE_STORY);
    if (!requestCheck.allowed) {
      const timeLeft = getTimeUntilReset();
      const errorMessage = `${requestCheck.message} Còn ${timeLeft.hours}h ${timeLeft.minutes}m để reset.`;
      updateState({ lessonError: errorMessage });
      return;
    }
    if (requestCheck.message) {
      console.log('⚠️ Request warning:', requestCheck.message);
    }
    let currentLessonStyle = lessonWritingStyle;
    if (lessonWritingStyle === 'custom') {
      if (!customLessonWritingStyle.trim()) {
        updateState({ lessonError: 'Vui lòng nhập phong cách viết bài học tùy chỉnh!' });
        return;
      }
      currentLessonStyle = customLessonWritingStyle.trim();
    }

    const abortCtrl = new AbortController();
    setCurrentAbortController(abortCtrl);
    updateState({ lessonError: null, generatedLesson: '', lessonLoadingMessage: 'Đang đúc kết bài học...' });
    const selectedOutputLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;
    
    let ctaLessonSegment = ctaChannelForLesson.trim() ? `\n- If appropriate, naturally weave in a call to action at the end of the lesson, encouraging viewers to engage with the channel "${ctaChannelForLesson.trim()}". For example: "Hãy chia sẻ suy nghĩ của bạn và đừng quên theo dõi kênh ${ctaChannelForLesson.trim()} để khám phá thêm nhiều câu chuyện ý nghĩa nhé!"` : "";

    const prompt = `Based on the following story, extract a meaningful lesson for the audience.
    \n**Story:**
    \n---
    \n${storyInputForLesson.trim()}
    \n---
    \n**Instructions:**
    \n- The lesson should be approximately **${lessonTargetLength} words** long.
    \n- The writing style for the lesson should be: **${currentLessonStyle}**.
    \n- The lesson must be written in **${selectedOutputLangLabel}**. ${ctaLessonSegment}
    \n- Return only the lesson text. No introductions or other text.`;
    try {
      const result = await generateText(prompt, undefined, undefined, apiSettings);
      if (abortCtrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      updateState({ generatedLesson: result.text, lessonLoadingMessage: "Đúc kết bài học hoàn tất!" });
      
      // Save lesson to history  
      if (result.text.trim()) {
        const lessonTitle = storyInputForLesson.split('\n')[0]?.trim().substring(0, 50) || 'Bài học không tiêu đề';
        HistoryStorage.saveToHistory(MODULE_KEYS.WRITE_STORY + '_lessons', lessonTitle, result.text);
      }
      
      // Log usage statistics for lesson generation
      logApiCall('write-story', 1); // 1 API call for lesson
      logStoryGenerated('write-story', 1); // Log 1 lesson generated
    } catch (e: any) {
       if (e.name === 'AbortError') {
        updateState({ lessonError: 'Tạo bài học đã bị hủy.', lessonLoadingMessage: 'Đã hủy.' });
      } else {
        updateState({ lessonError: `Đã xảy ra lỗi khi đúc kết bài học: ${e.message}`, lessonLoadingMessage: "Lỗi đúc kết bài học." });
      }
    } finally {
       setCurrentAbortController(null);
       setTimeout(() => setModuleState(prev => (prev.lessonLoadingMessage?.includes("hoàn tất") || prev.lessonLoadingMessage?.includes("Lỗi") || prev.lessonLoadingMessage?.includes("Đã hủy")) ? {...prev, lessonLoadingMessage: null} : prev), 3000);
    }
  };

  const copyToClipboard = (text: string, buttonId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById(buttonId);
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'Đã sao chép!';
        setTimeout(() => { btn.textContent = originalText; }, 2000);
    }
  };
  
  const TabButton: React.FC<{ tabId: WriteStoryActiveTab; label: string, icon: string }> = ({ tabId, label, icon }) => (
    <button
      onClick={() => {
        if (currentAbortController) currentAbortController.abort(); // Cancel any ongoing operation before switching tabs
        setCurrentAbortController(null);
        updateState({
            activeWriteTab: tabId,
            storyError: tabId === 'singleStory' ? moduleState.storyError : null,
            hookError: tabId === 'hookGenerator' ? moduleState.hookError : null,
            lessonError: tabId === 'lessonGenerator' ? moduleState.lessonError : null,
            storyLoadingMessage: null, 
            hookLoadingMessage: null,
            lessonLoadingMessage: null,
            singleStoryEditProgress: null,
        });
      }}
      className={`px-4 py-3 font-medium rounded-t-lg text-base transition-colors flex items-center space-x-2
                  ${activeWriteTab === tabId 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
      aria-selected={activeWriteTab === tabId}
      role="tab"
      disabled={!!(storyLoadingMessage || hookLoadingMessage || lessonLoadingMessage || singleStoryEditProgress)}
    >
        <span>{icon}</span>
        <span>{label}</span>
    </button>
  );
  
  const anyLoadingOperation = storyLoadingMessage !== null || hookLoadingMessage !== null || lessonLoadingMessage !== null || singleStoryEditProgress !== null; 
  const feedbackContainerMinHeight = "60px"; 
  const spinnerFeedbackContainerHeight = "h-20"; 

  const currentLoadingMessage = activeWriteTab === 'singleStory' ? storyLoadingMessage :
                                activeWriteTab === 'hookGenerator' ? hookLoadingMessage :
                                activeWriteTab === 'lessonGenerator' ? lessonLoadingMessage : null;

  const renderMainButton = () => {
    let buttonText = "";
    let actionHandler: () => void = () => {};
    let disabled = !hasActiveSubscription || anyLoadingOperation;

    if (activeWriteTab === 'singleStory') {
      buttonText = "✍️ Viết & Biên Tập Truyện";
      actionHandler = handleWriteStory;
      disabled = disabled || !storyOutline.trim();
    } else if (activeWriteTab === 'hookGenerator') {
      buttonText = "💡 Tạo Hooks";
      actionHandler = handleGenerateHooks;
      disabled = disabled || !storyInputForHook.trim();
    } else if (activeWriteTab === 'lessonGenerator') {
      buttonText = "🧐 Tạo Bài Học";
      actionHandler = handleGenerateLesson;
      disabled = disabled || !storyInputForLesson.trim();
    }

    if (anyLoadingOperation) {
      return (
        <div className="flex space-x-3">
          <button
            disabled
            className="w-2/3 bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg shadow-md cursor-not-allowed"
          >
            {currentLoadingMessage || "Đang xử lý..."}
          </button>
          <button
            onClick={handleCancelOperation}
            className="w-1/3 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md"
            aria-label="Hủy tác vụ hiện tại"
          >
            <StopCircle className="w-4 h-4 mr-1" />
            Dừng
          </button>
        </div>
      );
    }

    // Show queue button for story and hook tabs when queue is enabled
    const showQueueButton = (activeWriteTab === 'singleStory' && storyQueueSystem.isEnabled) || 
                           (activeWriteTab === 'hookGenerator' && hookQueueSystem.isEnabled);
    
    if (showQueueButton) {
      let queueButtonText = "";
      let queueActionHandler: () => void = () => {};
      let queueDisabled = disabled;
      
      if (activeWriteTab === 'singleStory') {
        queueButtonText = "➕ Thêm vào Hàng Chờ";
        queueActionHandler = () => addToStoryQueue(storyOutline, `Truyện ${storyQueue.length + 1}`);
        queueDisabled = queueDisabled || !storyOutline.trim();
      } else if (activeWriteTab === 'hookGenerator') {
        queueButtonText = "➕ Thêm Hook vào Hàng Chờ";
        queueActionHandler = () => addToHookQueue(storyInputForHook, `Hook ${hookQueue.length + 1}`);
        queueDisabled = queueDisabled || !storyInputForHook.trim();
      }
      
      return (
        <div className="flex space-x-3">
          <button 
            onClick={actionHandler} 
            disabled={disabled}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {buttonText}
          </button>
          <button 
            onClick={queueActionHandler} 
            disabled={queueDisabled}
            className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {queueButtonText}
          </button>
        </div>
      );
    }
    
    return (
      <button 
        onClick={actionHandler} 
        disabled={disabled}
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {buttonText}
      </button>
    );
  };


  return (
    <ModuleContainer title="✍️ Module: Viết Truyện, Hook & Bài Học" badge="PRO">
        {!hasActiveSubscription && <UpgradePrompt />}
        <InfoBox>
            <p><strong>📌 Quy trình Tạo Truyện Hoàn Chỉnh:</strong></p>
            <ol className="list-decimal list-inside space-y-1.5 text-sm mt-2">
                <li>
                    <strong>Cài đặt chung:</strong> Đầu tiên, hãy thiết lập các tùy chọn trong phần "Cài đặt chung" (Độ dài, Phong cách viết, Ngôn ngữ, và đặc biệt là khu vực Phân Tích ADN Viral). Các cài đặt này sẽ áp dụng cho các tab tương ứng.
                </li>
                <li>
                    <strong>Tab "✍️ Viết Truyện Đơn":</strong>
                    <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                        <li><strong>Nhập Dàn Ý:</strong> Cung cấp "Dàn ý truyện". Bạn có thể nhập/dán trực tiếp, hoặc sử dụng nút "Sử dụng Dàn Ý Viral từ Phân Tích" nếu có. Dàn ý từ Module "Xây Dựng Truyện" cũng sẽ tự động chuyển sang đây.</li>
                        <li><strong>(Nâng cao) Phân Tích ADN Viral:</strong> Dán 1 hoặc nhiều kịch bản viral vào ô "Phân Tích & Học Tập Văn Phong Viral". AI sẽ học các yếu tố chung tạo nên sự hấp dẫn của chúng.</li>
                        <li><strong>Tạo Truyện:</strong> Nhấn nút "✍️ Viết & Biên Tập Truyện".</li>
                        <li>
                            <strong>Quá trình Tự động:</strong> AI sẽ:
                            <ul className="list-['-_'] list-inside ml-5 mt-0.5">
                                <li>Viết truyện theo từng phần dựa trên dàn ý và áp dụng "ADN Viral" đã học (nếu có).</li>
                                <li>Tự động Biên Tập & Tối Ưu Độ Dài: Sau khi viết xong, AI sẽ tự động biên tập lại toàn bộ truyện để đảm bảo tính nhất quán, logic và cố gắng đạt mục tiêu độ dài (±10%). Bạn sẽ thấy thông báo "✅ ĐÃ BIÊN TẬP XONG 100%!" khi hoàn tất.</li>
                            </ul>
                        </li>
                        <li><strong>Kết quả:</strong> Truyện hoàn chỉnh, đã được tối ưu, sẵn sàng để bạn sao chép hoặc tinh chỉnh thêm nếu cần.</li>
                    </ul>
                </li>
                <li>
                    <strong>Các Tab Khác:</strong> Sử dụng truyện vừa tạo để làm nội dung đầu vào cho tab "Tạo Hooks" và "Đúc Kết Bài Học".
                </li>
            </ol>
            <p className="mt-2 text-sm text-orange-600">
                <strong>Cập nhật (QUAN TRỌNG):</strong> Khả năng giữ tính nhất quán cho tên nhân vật, địa điểm và kiểm soát độ dài truyện (±10% mục tiêu) đã được cải thiện thông qua quy trình biên tập tự động sau khi viết. Thông báo biên tập 100% sẽ hiển thị rõ ràng.
            </p>
        </InfoBox>

      <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Cài đặt chung (Cho các tab Viết Truyện, Đúc Kết Bài Học)</h3>
        <div className="grid md:grid-cols-3 gap-6">
            <div>
                <label htmlFor="wsTargetLength" className="block text-sm font-medium text-gray-700 mb-1">Độ dài truyện (mục tiêu):</label>
                <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-indigo-600">{parseInt(targetLength).toLocaleString()} từ</span>
                </div>
                <input 
                    type="range" 
                    id="wsTargetLength" 
                    min={STORY_LENGTH_OPTIONS[0].value} 
                    max={STORY_LENGTH_OPTIONS[STORY_LENGTH_OPTIONS.length - 1].value} 
                    step="500" 
                    value={targetLength} 
                    onChange={(e) => updateState({ targetLength: e.target.value })} 
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    disabled={anyLoadingOperation}
                />
                 <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Ngắn</span>
                    <span>Dài</span>
                </div>
                 <p className="text-xs text-gray-500 mt-1">Truyện sẽ được biên tập để đạt ~{parseInt(targetLength).toLocaleString()} từ (±10%).</p>
            </div>
            <div>
                <label htmlFor="wsWritingStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết truyện (chung):</label>
                <select id="wsWritingStyle" value={writingStyle} onChange={(e) => updateState({ writingStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                    {WRITING_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
             {writingStyle === 'custom' && (
                <div>
                    <label htmlFor="wsCustomWritingStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết truyện tùy chỉnh (chung):</label>
                    <input type="text" id="wsCustomWritingStyle" value={customWritingStyle} onChange={(e) => updateState({ customWritingStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Kịch tính, hồi hộp, plot twist" disabled={anyLoadingOperation}/>
                </div>
            )}
            <div>
                <label htmlFor="wsOutputLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ Truyện & Bài học:</label>
                <select id="wsOutputLanguage" value={outputLanguage} onChange={(e) => updateState({ outputLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                    {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
             <div className="md:col-span-3">
                <label htmlFor="wsRefViralStory" className="block text-sm font-medium text-gray-700 mb-1">Phân Tích & Học Tập Văn Phong Viral (Nâng cao):</label>
                <textarea id="wsRefViralStory" value={referenceViralStoryForStyle} onChange={(e) => updateState({ referenceViralStoryForStyle: e.target.value })} rows={6} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Dán 1 hoặc nhiều kịch bản/truyện viral vào đây. Phân tách mỗi truyện bằng dấu '---' trên một dòng riêng. AI sẽ phân tích tất cả để học 'ADN Viral' và áp dụng vào truyện mới của bạn." disabled={anyLoadingOperation}></textarea>
                <p className="text-xs text-gray-500 mt-1">Lưu ý: Văn phong học được từ đây sẽ được ưu tiên hơn "Phong cách viết truyện" đã chọn nếu có mâu thuẫn.</p>
            </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b-2 border-gray-300" role="tablist" aria-label="Chức năng Viết">
        <TabButton tabId="singleStory" label="Viết Truyện Đơn" icon="✍️"/>
        <TabButton tabId="hookGenerator" label="Tạo Hooks" icon="💡"/>
        <TabButton tabId="lessonGenerator" label="Đúc Kết Bài Học" icon="🧐"/>
      </div>

      {activeWriteTab === 'singleStory' && (
         <div role="tabpanel" id="single-story-panel" className="animate-fadeIn space-y-6">
            
            {/* Story Queue System */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                        <Clock className="w-5 h-5 text-green-600 mr-2" />
                        <h3 className="text-lg font-semibold text-green-800">🔄 Hệ Thống Hàng Chờ Viết Truyện</h3>
                    </div>
                    <button
                        onClick={toggleStoryQueueMode}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                            storyQueueSystem.isEnabled
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                        }`}
                    >
                        {storyQueueSystem.isEnabled ? 'Tắt Hàng Chờ' : 'Bật Hàng Chờ'}
                    </button>
                </div>

                {storyQueueSystem.isEnabled && (
                    <div className="space-y-3">
                        {/* Queue Stats */}
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-white p-3 rounded-lg">
                                <div className="text-2xl font-bold text-green-600">{storyQueue.length}</div>
                                <div className="text-sm text-gray-600">Tổng cộng</div>
                            </div>
                            <div className="bg-white p-3 rounded-lg">
                                <div className="text-2xl font-bold text-blue-600">{storyQueueSystem.completedCount}</div>
                                <div className="text-sm text-gray-600">Hoàn thành</div>
                            </div>
                            <div className="bg-white p-3 rounded-lg">
                                <div className="text-2xl font-bold text-orange-600">
                                    {storyQueue.filter(item => item.status === 'waiting').length}
                                </div>
                                <div className="text-sm text-gray-600">Đang chờ</div>
                            </div>
                        </div>

                        {/* Queue Controls */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    if (!storyQueueSystem.isProcessing) {
                                        processStoryQueue();
                                    } else {
                                        pauseResumeStoryQueue();
                                    }
                                }}
                                disabled={storyQueue.filter(item => item.status === 'waiting').length === 0}
                                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {storyQueueSystem.isProcessing ? (
                                    storyQueueSystem.isPaused ? (
                                        <>
                                            <Play className="w-4 h-4 mr-2" />
                                            Tiếp tục
                                        </>
                                    ) : (
                                        <>
                                            <Pause className="w-4 h-4 mr-2" />
                                            Tạm dừng
                                        </>
                                    )
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 mr-2" />
                                        Bắt đầu
                                    </>
                                )}
                            </button>
                            
                            <button
                                onClick={clearStoryQueue}
                                disabled={storyQueue.length === 0}
                                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Xóa tất cả
                            </button>
                        </div>

                        {/* Queue Items List */}
                        {storyQueue.length > 0 && (
                            <div className="mt-4 p-3 border rounded-lg bg-white">
                                <h4 className="text-md font-semibold mb-3">📋 Danh sách hàng chờ ({storyQueue.length} mục)</h4>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {storyQueue.map((item, index) => (
                                        <div key={item.id} className={`p-3 border rounded-lg ${
                                            item.status === 'processing' ? 'bg-yellow-50 border-yellow-300' :
                                            item.status === 'completed' ? 'bg-green-50 border-green-300' :
                                            item.status === 'error' ? 'bg-red-50 border-red-300' :
                                            'bg-gray-50 border-gray-300'
                                        }`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center">
                                                    <span className="text-sm font-medium text-gray-600 mr-2">#{index + 1}</span>
                                                    {item.status === 'processing' && <div className="animate-spin w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full mr-2"></div>}
                                                    {item.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-600 mr-2" />}
                                                    {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-600 mr-2" />}
                                                    {item.status === 'waiting' && <Clock className="w-4 h-4 text-gray-400 mr-2" />}
                                                    <span className="font-semibold truncate max-w-md">{item.title}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {item.status === 'processing' && (
                                                        <span className="text-sm text-gray-600">{item.progress}%</span>
                                                    )}
                                                    {item.status === 'waiting' && (
                                                        <button
                                                            onClick={() => removeFromStoryQueue(item.id)}
                                                            className="text-red-500 hover:text-red-700"
                                                            title="Xóa khỏi hàng chờ"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Progress bar for processing items */}
                                            {item.status === 'processing' && (
                                                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                                    <div
                                                        className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${item.progress}%` }}
                                                    ></div>
                                                </div>
                                            )}
                                            
                                            {/* Show completed story with statistics */}
                                            {item.status === 'completed' && item.generatedStory && (
                                                <div className="text-sm text-gray-600 mb-2">
                                                    <details>
                                                        <summary className="cursor-pointer hover:text-gray-800 text-green-700 font-medium">Kết quả truyện</summary>
                                                        <div className="mt-2 p-2 bg-green-100 rounded text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                                                            {item.generatedStory}
                                                        </div>
                                                        
                                                        {/* Word Statistics */}
                                                        {item.wordStats && (
                                                            <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                                                                <h5 className="text-xs font-semibold text-blue-800 mb-2">📊 Thống kê từ:</h5>
                                                                <div className="grid grid-cols-3 gap-2 text-xs">
                                                                    <div className="text-center">
                                                                        <div className="font-bold text-gray-800">{item.wordStats.outlineWords}</div>
                                                                        <div className="text-gray-600">Từ dàn ý</div>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <div className="font-bold text-green-600">{item.wordStats.storyWords}</div>
                                                                        <div className="text-gray-600">Từ truyện</div>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <div className="font-bold text-purple-600">{item.wordStats.expansionRatio}x</div>
                                                                        <div className="text-gray-600">Tỷ lệ mở rộng</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <button
                                                            onClick={() => copyToClipboard(item.generatedStory || '')}
                                                            className="mt-2 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                                        >
                                                            Sao chép kết quả
                                                        </button>
                                                    </details>
                                                </div>
                                            )}

                                            {/* Show error for failed items */}
                                            {item.status === 'error' && item.error && (
                                                <div className="text-sm text-red-600">
                                                    <span className="font-medium">Lỗi:</span> {item.error}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center">
                <label htmlFor="storyOutline" className="text-lg font-semibold text-gray-700">
                    Dàn ý truyện (Bước 1: Nhập dàn ý):
                </label>
                <button onClick={() => setIsSingleOutlineExpanded(!isSingleOutlineExpanded)} className="text-sm text-indigo-600 hover:text-indigo-800" disabled={anyLoadingOperation}>
                    {isSingleOutlineExpanded ? 'Thu gọn Dàn Ý' : 'Mở rộng Dàn Ý'}
                </button>
            </div>
            <textarea 
                id="storyOutline" 
                value={storyOutline} 
                onChange={(e) => updateState({ 
                    storyOutline: e.target.value,
                    hasSingleStoryBeenEditedSuccessfully: false,
                    generatedStory: '',
                    keyElementsFromSingleStory: null,
                    storyLoadingMessage: null,
                    singleStoryEditProgress: null,
                    storyProgress: 0,
                    storyError: null,
                })} 
                rows={isSingleOutlineExpanded ? 10 : 3} 
                className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Nhập dàn ý của bạn hoặc dàn ý từ Module Xây Dựng Truyện sẽ tự động xuất hiện ở đây..."
                disabled={anyLoadingOperation}
            />
            {retrievedViralOutlineFromAnalysis && (
                <button 
                    onClick={handleUseViralOutline} 
                    className="mt-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                    disabled={anyLoadingOperation}
                >
                    📝 Sử dụng Dàn Ý Viral từ Phân Tích
                </button>
            )}
            {renderMainButton()}
            <div className={`feedback-container flex flex-col justify-center items-center`} style={{ minHeight: feedbackContainerMinHeight }}>
                {storyLoadingMessage && storyProgress > 0 && storyProgress < 100 && !storyLoadingMessage.toLowerCase().includes("biên tập") && !storyLoadingMessage.toLowerCase().includes("hoàn thành") && !storyLoadingMessage.toLowerCase().includes("lỗi") && !storyLoadingMessage.toLowerCase().includes("hủy") && (
                <div className="w-full bg-gray-200 rounded-full h-6">
                    <div className="bg-indigo-600 h-6 rounded-full text-xs font-medium text-blue-100 text-center p-1 leading-none" style={{ width: `${storyProgress}%` }}>
                    {`${storyProgress}% (${storyLoadingMessage})`}
                    </div>
                </div>
                )}
                {storyLoadingMessage && storyLoadingMessage.toLowerCase().includes("biên tập") && singleStoryEditProgress !== null && singleStoryEditProgress >=0 && singleStoryEditProgress < 100 && !storyLoadingMessage.toLowerCase().includes("hủy") && (
                    <div className="w-full bg-gray-200 rounded-full h-6">
                        <div className="bg-purple-600 h-6 rounded-full text-xs font-medium text-purple-100 text-center p-1 leading-none" style={{ width: `${singleStoryEditProgress}%` }}>
                            {`${singleStoryEditProgress}% (${storyLoadingMessage})`}
                        </div>
                    </div>
                )}
                {storyLoadingMessage && (!storyLoadingMessage.toLowerCase().includes("biên tập") && (storyProgress === 0 || storyProgress === 100) || storyLoadingMessage.toLowerCase().includes("hoàn thành") || storyLoadingMessage.toLowerCase().includes("lỗi") || storyLoadingMessage.toLowerCase().includes("hủy")) && !storyLoadingMessage.startsWith("✅ ĐÃ BIÊN TẬP XONG 100%!") && (
                    <p className={`text-center font-medium ${storyLoadingMessage.includes("Lỗi") ? 'text-red-600' : (storyLoadingMessage.includes("hủy") ? 'text-yellow-600' : 'text-indigo-600')}`}>
                        {storyLoadingMessage}
                    </p>
                )}
                {hasSingleStoryBeenEditedSuccessfully && storyLoadingMessage === '✅ ĐÃ BIÊN TẬP XONG 100%!' && (
                    <p className="text-center text-2xl font-bold text-green-600 p-3 bg-green-100 border-2 border-green-500 rounded-lg">
                        {storyLoadingMessage}
                    </p>
                )}
            </div>
            {storyError && <ErrorAlert message={storyError} />}
            {generatedStory && (
                <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                    <h3 className={`text-lg font-semibold mb-2 ${hasSingleStoryBeenEditedSuccessfully ? 'text-green-600' : 'text-gray-700'}`}>
                        {hasSingleStoryBeenEditedSuccessfully ? '✅ Truyện Đã Được Biên Tập & Tối Ưu Độ Dài:' : 'Truyện hoàn chỉnh (chưa biên tập đầy đủ):'}
                         <span className="text-sm font-normal text-gray-500"> (bằng {HOOK_LANGUAGE_OPTIONS.find(l=>l.value === outputLanguage)?.label || outputLanguage})</span>
                    </h3>
                    <textarea value={generatedStory} readOnly rows={15} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button id="copyStoryBtn" onClick={() => copyToClipboard(generatedStory, "copyStoryBtn")} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600" disabled={anyLoadingOperation}>
                        📋 Sao chép Truyện
                        </button>
                        <button 
                            onClick={() => handleEditStory(generatedStory, storyOutline, keyElementsFromSingleStory)} 
                            disabled={!hasActiveSubscription || anyLoadingOperation || !generatedStory.trim()}
                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                        >
                            ✨ Biên Tập Lại (Nếu cần)
                        </button>
                        <button
                            onClick={handleTranslateStory}
                            disabled={!hasActiveSubscription || storyTranslation.isTranslating || !generatedStory.trim()}
                            className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 flex items-center"
                        >
                            <Languages size={16} className="mr-2"/>
                            {storyTranslation.isTranslating ? 'Đang dịch...' : `Dịch sang ${translateTargetLang}`}
                        </button>
                    </div>

                    {/* Translation Settings */}
                    <div className="mt-4 p-4 border rounded-lg bg-teal-50">
                        <h4 className="text-md font-semibold text-teal-700 mb-3">⚙️ Cài đặt dịch thuật</h4>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đích:</label>
                                <select
                                    value={translateTargetLang}
                                    onChange={e => setTranslateTargetLang(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                    disabled={storyTranslation.isTranslating}
                                >
                                    {TRANSLATE_LANGUAGE_OPTIONS.map(opt => 
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phong cách dịch:</label>
                                <select
                                    value={translateStyle}
                                    onChange={e => setTranslateStyle(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                    disabled={storyTranslation.isTranslating}
                                >
                                    {TRANSLATE_STYLE_OPTIONS.map(opt => 
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    )}
                                </select>
                            </div>
                        </div>
                    </div>

                     {/* Translation Result Section */}
                    {storyTranslation.isTranslating && <LoadingSpinner message="Đang dịch truyện..." />}
                    {storyTranslation.error && <ErrorAlert message={storyTranslation.error} />}
                    {storyTranslation.translatedText && !storyTranslation.isTranslating && (
                        <div className="mt-4 p-4 border rounded-lg bg-teal-50">
                            <h4 className="text-md font-semibold text-teal-700 mb-2">Bản dịch {translateTargetLang}:</h4>
                            <textarea
                                value={storyTranslation.translatedText}
                                readOnly
                                rows={10}
                                className="w-full p-3 border-2 border-teal-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"
                                aria-label="Bản dịch Tiếng Việt"
                            />
                        </div>
                    )}
                </div>
            )}
            
            {/* History Panel for Write Story */}
            <div className="mt-6">
                <HistoryPanel 
                    moduleKey={MODULE_KEYS.WRITE_STORY}
                    onSelectHistory={(content) => {
                        updateState({ 
                            generatedStory: content,
                            hasSingleStoryBeenEditedSuccessfully: true 
                        });
                    }}
                />
            </div>
         </div>
      )}

      {activeWriteTab === 'hookGenerator' && (
         <div role="tabpanel" id="hook-generator-panel" className="animate-fadeIn space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">💡 Tạo Hooks Mở Đầu</h3>
             <InfoBox>
                <p>Nhập trực tiếp nội dung truyện của bạn vào ô bên dưới để tạo hooks. Bạn cũng có thể sử dụng truyện đã được tạo ở tab 'Viết Truyện Đơn' bằng cách nhấn nút "Sử dụng Truyện Vừa Viết".</p>
                <p className="mt-1"><strong>Mới:</strong> Chọn "Cấu trúc Hook (Nâng cao)" để AI tạo hook theo các mô hình nổi tiếng và giải thích cách áp dụng.</p>
            </InfoBox>
            <div>
                <label htmlFor="storyInputForHook" className="block text-sm font-medium text-gray-700 mb-1">Nội dung truyện (để tạo hook):</label>
                <textarea 
                    id="storyInputForHook" 
                    value={storyInputForHook} 
                    onChange={(e) => updateState({ storyInputForHook: e.target.value })} 
                    rows={8} 
                    className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
                    placeholder="Dán toàn bộ truyện hoặc tóm tắt truyện vào đây..."
                    disabled={anyLoadingOperation}
                />
                {generatedStory.trim() && (
                    <button 
                        onClick={() => updateState({ storyInputForHook: generatedStory })} 
                        className="mt-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-sm"
                        disabled={anyLoadingOperation}
                    >
                        Sử dụng Truyện Vừa Viết từ tab 'Viết Truyện Đơn'
                    </button>
                )}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                    <label htmlFor="hookLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ Hook:</label>
                    <select id="hookLanguage" value={hookLanguage} onChange={(e) => updateState({ hookLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                        {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="hookStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách Hook (Chung):</label>
                    <select id="hookStyle" value={hookStyle} onChange={(e) => updateState({ hookStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                        {HOOK_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                {hookStyle === 'custom' && (
                    <div>
                        <label htmlFor="customHookStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách Hook tùy chỉnh:</label>
                        <input type="text" id="customHookStyle" value={customHookStyle} onChange={(e) => updateState({ customHookStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Kinh dị kiểu Mỹ" disabled={anyLoadingOperation}/>
                    </div>
                )}
                 <div>
                    <label htmlFor="hookLength" className="block text-sm font-medium text-gray-700 mb-1">Độ dài Hook:</label>
                    <select id="hookLength" value={hookLength} onChange={(e) => updateState({ hookLength: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                        {HOOK_LENGTH_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div className="lg:col-span-2"> {/* Span 2 columns on large screens for hook structure */}
                    <label htmlFor="hookStructure" className="block text-sm font-medium text-gray-700 mb-1">Cấu trúc Hook (Nâng cao):</label>
                    <select id="hookStructure" value={hookStructure} onChange={(e) => updateState({ hookStructure: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                        {HOOK_STRUCTURE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="hookCount" className="block text-sm font-medium text-gray-700 mb-1">Số lượng Hook (1-10):</label>
                    <input type="number" id="hookCount" value={hookCount} onChange={(e) => updateState({ hookCount: parseInt(e.target.value)})} min="1" max="10" className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}/>
                </div>
                <div>
                    <label htmlFor="ctaChannel" className="block text-sm font-medium text-gray-700 mb-1">Kênh CTA (Không bắt buộc):</label>
                    <input type="text" id="ctaChannel" value={ctaChannel} onChange={(e) => updateState({ ctaChannel: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Đức Đại Đẹp Zai" disabled={anyLoadingOperation}/>
                </div>
            </div>
            {renderMainButton()}
            <div className={`feedback-container flex flex-col justify-center items-center ${spinnerFeedbackContainerHeight}`}>
              {hookLoadingMessage && <LoadingSpinner message={hookLoadingMessage} noMargins={true} />}
            </div>
            {hookError && <ErrorAlert message={hookError} />}
            {generatedHooks && (
              <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Hooks Đã Tạo (bằng {HOOK_LANGUAGE_OPTIONS.find(l => l.value === hookLanguage)?.label || hookLanguage}):</h3>
                <textarea value={generatedHooks} readOnly rows={10} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
                <button id="copyHooksBtn" onClick={() => copyToClipboard(generatedHooks, "copyHooksBtn")} className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600" disabled={anyLoadingOperation}>
                    📋 Sao chép Hooks
                </button>
              </div>
            )}

            {/* Hook Queue UI */}
            <div className="mt-6 p-4 border-2 border-orange-200 rounded-lg bg-orange-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-orange-800">🎯 Hàng Chờ Hook Generator</h3>
                <button
                  onClick={() => updateState(prev => ({
                    ...prev,
                    hookQueueSystem: { ...prev.hookQueueSystem, isEnabled: !prev.hookQueueSystem.isEnabled }
                  }))}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    hookQueueSystem.isEnabled 
                      ? 'bg-orange-600 text-white hover:bg-orange-700' 
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  }`}
                >
                  {hookQueueSystem.isEnabled ? '🟢 Bật' : '🔴 Tắt'}
                </button>
              </div>

              {hookQueueSystem.isEnabled && (
                <>
                  {/* Hook Queue Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-3 rounded-lg border border-orange-200">
                      <div className="text-sm text-orange-600 font-medium">Tổng Hook</div>
                      <div className="text-2xl font-bold text-orange-800">{hookQueue.length}</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-orange-200">
                      <div className="text-sm text-orange-600 font-medium">Chờ Xử Lý</div>
                      <div className="text-2xl font-bold text-orange-800">
                        {hookQueue.filter(item => item.status === 'waiting').length}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-orange-200">
                      <div className="text-sm text-orange-600 font-medium">Hoàn Thành</div>
                      <div className="text-2xl font-bold text-green-600">
                        {hookQueue.filter(item => item.status === 'completed').length}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-orange-200">
                      <div className="text-sm text-orange-600 font-medium">Trung Bình</div>
                      <div className="text-2xl font-bold text-orange-800">
                        {hookQueueSystem.averageProcessingTime > 0 
                          ? `${Math.round(hookQueueSystem.averageProcessingTime)}s` 
                          : '-'
                        }
                      </div>
                    </div>
                  </div>

                  {/* Hook Queue Controls */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    <button
                      onClick={processHookQueue}
                      disabled={hookQueue.length === 0 || hookQueueSystem.isProcessing || anyLoadingOperation}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {hookQueueSystem.isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                          Đang Xử Lý...
                        </>
                      ) : (
                        <>▶️ Bắt Đầu Xử Lý ({hookQueue.filter(item => item.status === 'waiting').length})</>
                      )}
                    </button>
                    
                    <button
                      onClick={() => updateState(prev => ({
                        ...prev,
                        hookQueueSystem: { ...prev.hookQueueSystem, isPaused: !prev.hookQueueSystem.isPaused }
                      }))}
                      disabled={!hookQueueSystem.isProcessing}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {hookQueueSystem.isPaused ? '▶️ Tiếp Tục' : '⏸️ Tạm Dừng'}
                    </button>

                    <button
                      onClick={() => updateState(prev => ({ ...prev, hookQueue: [] }))}
                      disabled={hookQueueSystem.isProcessing}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      🗑️ Xóa Tất Cả
                    </button>
                  </div>

                  {/* Hook Queue Items List */}
                  {hookQueue.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-orange-800">Danh Sách Hook Queue:</h4>
                      {hookQueue.map((item, index) => (
                        <div key={item.id} className="bg-white p-4 rounded-lg border border-orange-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <span className="font-medium text-gray-800">#{index + 1} {item.title}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                item.status === 'waiting' ? 'bg-gray-100 text-gray-600' :
                                item.status === 'processing' ? 'bg-blue-100 text-blue-600' :
                                item.status === 'completed' ? 'bg-green-100 text-green-600' :
                                'bg-red-100 text-red-600'
                              }`}>
                                {item.status === 'waiting' ? 'Chờ' :
                                 item.status === 'processing' ? 'Đang Xử Lý' :
                                 item.status === 'completed' ? 'Hoàn Thành' : 'Lỗi'}
                              </span>
                            </div>
                            <button
                              onClick={() => updateState(prev => ({
                                ...prev,
                                hookQueue: prev.hookQueue.filter(q => q.id !== item.id)
                              }))}
                              disabled={hookQueueSystem.isProcessing}
                              className="text-red-500 hover:text-red-700 disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {item.status === 'processing' && (
                            <div className="mb-3">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${item.progress}%` }}
                                ></div>
                              </div>
                              <div className="text-sm text-gray-600 mt-1">{item.progress}% hoàn thành</div>
                            </div>
                          )}
                          
                          <div className="text-sm text-gray-600 mb-2">
                            <strong>Story Input:</strong> {item.storyInput.length > 100 ? item.storyInput.substring(0, 100) + '...' : item.storyInput}
                          </div>

                          <div className="text-xs text-gray-500">
                            Thêm lúc: {item.addedAt.toLocaleString('vi-VN')}
                            {item.estimatedTimeRemaining && item.status === 'processing' && (
                              <span className="ml-4">Còn lại: ~{Math.round(item.estimatedTimeRemaining)}s</span>
                            )}
                          </div>

                          {item.error && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                              <strong>Lỗi:</strong> {item.error}
                            </div>
                          )}

                          {item.generatedHooks && (
                            <div className="mt-3">
                              <div className="text-sm font-medium text-gray-700 mb-1">Hooks Đã Tạo:</div>
                              <textarea 
                                value={item.generatedHooks} 
                                readOnly 
                                rows={6} 
                                className="w-full p-2 text-sm border border-gray-300 rounded-md bg-gray-50"
                              />
                              <button
                                onClick={() => copyToClipboard(item.generatedHooks!, `copyHook${item.id}`)}
                                className="mt-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                              >
                                📋 Sao chép
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
         </div>
      )}

      {activeWriteTab === 'lessonGenerator' && (
         <div role="tabpanel" id="lesson-generator-panel" className="animate-fadeIn space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">🧐 Đúc Kết Bài Học Từ Truyện</h3>
            <div>
                <label htmlFor="storyInputForLesson" className="block text-sm font-medium text-gray-700 mb-1">Nội dung truyện cần đúc kết bài học:</label>
                <textarea id="storyInputForLesson" value={storyInputForLesson} onChange={(e) => updateState({ storyInputForLesson: e.target.value })} rows={8} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Dán toàn bộ truyện vào đây..." disabled={anyLoadingOperation}></textarea>
                {generatedStory.trim() && (
                    <button 
                        onClick={() => updateState({ storyInputForLesson: generatedStory })} 
                        className="mt-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-sm"
                        disabled={anyLoadingOperation}
                    >
                        Sử dụng Truyện Vừa Viết ở Tab 'Viết Truyện Đơn'
                    </button>
                )}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                 <div>
                    <label htmlFor="lessonTargetLength" className="block text-sm font-medium text-gray-700 mb-1">Mục tiêu số từ cho Bài học:</label>
                    <select id="lessonTargetLength" value={lessonTargetLength} onChange={(e) => updateState({ lessonTargetLength: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                        {LESSON_LENGTH_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="lessonWritingStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết Bài học:</label>
                    <select id="lessonWritingStyle" value={lessonWritingStyle} onChange={(e) => updateState({ lessonWritingStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={anyLoadingOperation}>
                        {LESSON_WRITING_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                {lessonWritingStyle === 'custom' && (
                     <div className="md:col-span-2">
                        <label htmlFor="customLessonWritingStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết Bài học tùy chỉnh:</label>
                        <input type="text" id="customLessonWritingStyle" value={customLessonWritingStyle} onChange={(e) => updateState({ customLessonWritingStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Hài hước mà sâu cay" disabled={anyLoadingOperation}/>
                    </div>
                )}
                <div className="md:col-span-2">
                    <label htmlFor="ctaChannelForLesson" className="block text-sm font-medium text-gray-700 mb-1">Kênh CTA (cho Bài học - Không bắt buộc):</label>
                    <input type="text" id="ctaChannelForLesson" value={ctaChannelForLesson} onChange={(e) => updateState({ ctaChannelForLesson: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Ví dụ: Kênh Truyện Ý Nghĩa" disabled={anyLoadingOperation}/>
                </div>
            </div>
             {renderMainButton()}
            <div className={`feedback-container flex flex-col justify-center items-center ${spinnerFeedbackContainerHeight}`}>
              {lessonLoadingMessage && <LoadingSpinner message={lessonLoadingMessage} noMargins={true} />}
            </div>
            {lessonError && <ErrorAlert message={lessonError} />}
            {generatedLesson && (
              <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Bài học Đã Đúc Kết (bằng {HOOK_LANGUAGE_OPTIONS.find(l => l.value === outputLanguage)?.label || outputLanguage}):</h3>
                <textarea value={generatedLesson} readOnly rows={4} className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"></textarea>
                 <button id="copyLessonBtn" onClick={() => copyToClipboard(generatedLesson, "copyLessonBtn")} className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600" disabled={anyLoadingOperation}>
                    📋 Sao chép Bài học
                </button>
              </div>
            )}
         </div>
      )}
      
    </ModuleContainer>
  );
};

export default WriteStoryModule;
