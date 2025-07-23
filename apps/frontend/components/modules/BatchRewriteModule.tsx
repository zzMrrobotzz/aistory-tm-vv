





import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StopCircle } from 'lucide-react';
import { 
    ApiSettings, 
    BatchRewriteModuleState, 
    BatchRewriteInputItem, 
    GeneratedBatchRewriteOutputItem,
    UserProfile
} from '../../types';
import { HOOK_LANGUAGE_OPTIONS, REWRITE_STYLE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import HistoryPanel from '../HistoryPanel';
import { generateText as generateGeminiText } from '../../services/geminiService';
import { generateText as generateDeepSeekText } from '../../services/deepseekService';
import { delay, isSubscribed } from '../../utils';
import { HistoryStorage, MODULE_KEYS } from '../../utils/historyStorage';
import UpgradePrompt from '../UpgradePrompt';

interface BatchRewriteModuleProps {
  apiSettings: ApiSettings;
  moduleState: BatchRewriteModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<BatchRewriteModuleState>>;
  currentUser: UserProfile | null;
}

const BatchRewriteModule: React.FC<BatchRewriteModuleProps> = ({ apiSettings, moduleState, setModuleState, currentUser }) => {
  const hasActiveSubscription = isSubscribed(currentUser);
  const abortControllerRef = useRef<AbortController | null>(null);
  const {
    inputItems, results, globalRewriteLevel, globalSourceLanguage, globalTargetLanguage,
    globalRewriteStyle, globalCustomRewriteStyle, globalAdaptContext,
    isProcessingBatch, batchProgressMessage, batchError, concurrencyLimit
  } = moduleState;

  const updateState = (updates: Partial<BatchRewriteModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };
  
  const geminiApiKeyForService = apiSettings.provider === 'gemini' ? apiSettings.apiKey : undefined;
  const deepseekApiKeyForService = apiSettings.provider === 'deepseek' ? apiSettings.apiKey : undefined;


  // Sync globalAdaptContext based on global languages
  useEffect(() => {
    if (globalTargetLanguage !== globalSourceLanguage) {
      updateState({ globalAdaptContext: true });
    } else {
      updateState({ globalAdaptContext: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalTargetLanguage, globalSourceLanguage]);


  const handleAddItem = () => {
    const newItem: BatchRewriteInputItem = {
      id: Date.now().toString(),
      originalText: '',
    };
    updateState({ inputItems: [...inputItems, newItem] });
  };

  const handleRemoveItem = (id: string) => {
    updateState({ 
        inputItems: inputItems.filter(item => item.id !== id),
        results: results.filter(result => result.id !== id) // Also remove corresponding result
    });
  };

  const handleInputChange = (id: string, field: keyof BatchRewriteInputItem, value: string | number | boolean | null) => {
    updateState({
      inputItems: inputItems.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };
  
  const handleClearResults = () => {
      updateState({results: []});
  }

  // Core rewrite logic for a single text item (adapted from RewriteModule)
  const performSingleItemRewrite = async (
    textToRewrite: string,
    currentRewriteLevel: number,
    currentSourceLanguage: string,
    currentTargetLanguage: string,
    currentRewriteStyleSettingValue: string, // 'custom' or the descriptive label of a predefined style
    userProvidedCustomInstructions: string, // Actual custom instructions text, or empty if not 'custom'
    currentAdaptContext: boolean,
    itemId: string, // For progress updates
    onProgress: (itemId: string, status: GeneratedBatchRewriteOutputItem['status'], message: string | null, charMap?: string) => void,
    textGenerator: (prompt: string, systemInstruction?: string) => Promise<string>
  ): Promise<{ rewrittenText: string, characterMapUsed: string | null }> => {
    const CHUNK_REWRITE_CHAR_COUNT = 4000; 
    const numChunks = Math.ceil(textToRewrite.length / CHUNK_REWRITE_CHAR_COUNT);
    let fullRewrittenStory = '';
    let characterMapForItem: string | null = null; 

    const selectedSourceLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === currentSourceLanguage)?.label || currentSourceLanguage;
    const selectedTargetLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === currentTargetLanguage)?.label || currentTargetLanguage;
    
    const systemInstructionForRewrite = "You are an expert multilingual text rewriting AI. Your primary function is to transform input text according to precise instructions, ensuring that when a rewrite is requested (degree of change > 0%), the output is a modified version of the input, not the original input itself.";

    for (let i = 0; i < numChunks; i++) {
      onProgress(itemId, 'rewriting', `Đang viết lại phần ${i + 1}/${numChunks}...`);
      const chunkStart = i * CHUNK_REWRITE_CHAR_COUNT;
      const chunkEnd = chunkStart + CHUNK_REWRITE_CHAR_COUNT;
      const textChunk = textToRewrite.substring(chunkStart, chunkEnd);

       const levelDescriptions: {[key: number]: string} = {
          0: 'only fix spelling and grammar. Keep the original story 100%. The output MUST be the full text of the chunk after applying these fixes (if any).',
          25: 'make some changes to words and sentence structures to refresh the text, while strictly preserving the original meaning, characters, settings, and plot. The goal is a light refreshment. You are required to produce a rewritten version of this chunk. The output MUST ALWAYS be the full text of the chunk *after you have applied these revisions*. Do not return the original text if changes, however minor, are instructed.',
          50: 'moderately rewrite the wording and style. You can change sentence structures, vocabulary, and some minor descriptive details (e.g., character\'s age, specific objects, minor traits of secondary characters). However, you MUST keep the main character names, core plot points, main occupations, and primary settings of the original text. You are required to produce a rewritten version of this chunk. The output MUST ALWAYS be the full text of the chunk *after you have applied these revisions*, even if the revisions seem moderate rather than extensive. Do not return the original text.',
          75: 'creatively reimagine the story. You can change character names, occupations, and settings. The plot may have new developments, but it MUST retain the spirit, message, and most appealing points of the original script. You are required to produce a rewritten version of this chunk. The output MUST ALWAYS be the full text of the chunk *after you have applied these creative revisions*. Do not return the original text.',
          100: 'completely rewrite into a new script. Only retain the "soul" (core idea, main theme) of the original story. Everything else, such as character names, settings, professions, and even some subplots, must be completely new. You are required to produce a rewritten version of this chunk. The output MUST ALWAYS be the full text of the chunk *after you have applied this complete rewrite*. Do not return the original text.'
      };
      const descriptionKey = Math.round(currentRewriteLevel / 25) * 25;
      const levelDescription = levelDescriptions[descriptionKey];
      
      let localizationRequest = '';
      if (currentTargetLanguage !== currentSourceLanguage && currentAdaptContext) {
          localizationRequest = `\n- **Cultural Localization Required:** Do not just translate. Deeply adapt the cultural context, social norms, proper names, and other details to make the story feel natural and appropriate for a ${selectedTargetLangLabel}-speaking audience.`;
      }

      let rewriteStyleInstructionPromptSegment = '';
      if (currentRewriteStyleSettingValue === 'custom') {
        rewriteStyleInstructionPromptSegment = `Apply the following custom rewrite instructions. These instructions are PARAMOUNT and OVERRIDE the general rules of the 'Degree of Change Required' when there is a direct conflict.
 - For example, if the 'Degree of Change' for 50% says 'keep main character names', but your custom instruction says 'change the main character's name to Dra. Carmen Valdés', you MUST change the name to 'Dra. Carmen Valdés'.
 - Similarly, if the text mentions '20 years of experience' and your custom instruction is to maintain persona details, you MUST keep '20 years of experience' unless explicitly told to change it.
Your Custom Instructions: "${userProvidedCustomInstructions}"`;
      } else {
        rewriteStyleInstructionPromptSegment = `The desired rewrite style is: ${currentRewriteStyleSettingValue}.`;
      }
      
      const lengthFidelityInstruction = `\n- **GUIDANCE ON OUTPUT LENGTH:** Your primary task is to REWRITE according to the 'Degree of Change Required'. The rewritten chunk should generally reflect the narrative scope and detail of the original.
    \n  - For Degree of Change 0-25%: Aim for the output length to be reasonably close (e.g., +/-15%) to the original chunk's character count. However, making the required textual changes (even if minimal) as per the degree's description is MORE IMPORTANT than strictly adhering to this length if a conflict arises. DO NOT return original text if 'Degree of Change Required' is greater than 0.
    \n  - For Degree of Change 50%: Aim for a length within +/-25% of the original. Focus on meaningful rewriting as per the degree.
    \n  - For Degree of Change 75-100%: Length can vary significantly based on the creative changes, but the output must be a developed narrative segment. A 100% rewrite may be shorter if it's a thematic reinterpretation.
    \n  In all cases where 'Degree of Change Required' is greater than 0%, prioritize executing the rewrite as instructed over returning an unchanged text due to length concerns. Avoid drastic, unexplained shortening unless it's a 100% rewrite or explicitly instructed by custom rewrite instructions.`;


      let characterConsistencyInstructions = `
          \n  - **ABSOLUTE CHARACTER NAME CONSISTENCY (FOR ALL CHARACTERS):**
              \n    - **General Rule:** Once a name is established for ANY character (main, secondary, minor, recurring) in the \`${selectedTargetLangLabel}\` output of THIS SPECIFIC REWRITE SESSION, that name MUST be used with 100% consistency for that character throughout ALL subsequent parts of this same story. DO NOT change it later.
              \n    - **If Target Language Differs from Source Language AND Rewrite Level < 75%:** For each character, you MUST choose ONE consistent form in \`${selectedTargetLangLabel}\` (either a standard direct translation or the original name if more appropriate phonetically) upon their first appearance in the rewritten text, AND THEN USE THAT CHOSEN FORM WITH ABSOLUTE CONSISTENCY. No random variations.
              \n    - **(Specific rules for Character Map at Level >= 75% are detailed below).**`;

      let prompt = `**Primary Objective:** Your main goal is to actively REWRITE the input text chunk. The extent and nature of the rewrite are determined by the 'Degree of Change Required' and the 'Rewrite Style Application' instructions below. You MUST produce a rewritten version. Only if the 'Degree of Change Required' is 0% AND the text has absolutely no errors to fix, should you return the original text verbatim. For any other degree of change, a rewritten output is mandatory.

      \n**CRITICAL NARRATIVE INTEGRITY (SINGLE TRUTH MANDATE):** You are rewriting ONE SINGLE STORY. All details regarding characters (names, roles, relationships, established traits), plot points, events, locations, and timelines MUST remain ABSOLUTELY CONSISTENT with what has been established in previously rewritten chunks of THIS SAME STORY (provided as \`fullRewrittenStory\` context, which is THE CANON for this session) and the initial setup of the current chunk. DO NOT introduce conflicting information or alter established facts. Maintain ONE UNIFIED AND LOGICAL NARRATIVE THREAD.

      \n**Your Task:** Rewrite the provided text chunk.
      \n**Critical Output Requirement:** Your response for this task MUST BE ONLY the rewritten text itself, in the specified Target Language. NO other text, introductions, explanations, or meta-comments are allowed.
      \n**Rewrite Instructions:**
      \n- **Source Language (of the input text):** ${selectedSourceLangLabel}
      \n- **Target Language (for the output text):** ${selectedTargetLangLabel}
      \n- **Degree of Change Required:** ${currentRewriteLevel}%. This means you should ${levelDescription}. Ensure your changes strictly adhere to the permissions of this level (e.g., if the level states 'main character names...MUST be kept', then they MUST NOT be changed).
      ${lengthFidelityInstruction}
      \n- **Rewrite Style Application:** ${rewriteStyleInstructionPromptSegment}
      \n- **Timestamp Handling:** Timestamps (e.g., (11:42), 06:59, HH:MM:SS) in the original text are metadata and MUST NOT be included in the rewritten output.
      ${localizationRequest}
      \n- **Overall Story Coherence (CRITICAL - Builds on Narrative Integrity):**
          \n  - **Persona Consistency:** Pay close attention to key details that define a character's persona, such as their stated years of experience, specific titles (Dr., Prof.), or recurring personal details. These details MUST be maintained with 100% consistency throughout the entire rewritten text, unless a custom instruction explicitly directs you to change them.
          \n  - **Logical Flow:** The rewritten chunk MUST maintain logical consistency internally and with \`fullRewrittenStory\`.
          \n  - **Character Consistency (General Behavior & Names):** ${characterConsistencyInstructions}
          \n  - **Event, Setting & Situation Coherence:** Ensure events, locations, and plot-relevant objects are plausible and consistent with established facts (from \`fullRewrittenStory\` and the original chunk's premise), respecting the "Degree of Change". Once a setting or event detail is established in the rewrite, stick to it.
      \n- **Context from Previous Chunks (THE CANON - must be in ${selectedTargetLangLabel}):**
          \n  \`${fullRewrittenStory || "This is the first chunk. No previous context."}\`
      `;
      
      if (i === 0 && currentRewriteLevel >= 75) {
          prompt += ` \n\n**Character Mapping (MANDATORY for First Chunk if Level >= 75%):**
          \nYour primary goal for character names is consistency in the ${selectedTargetLangLabel} output.
          \nIdentify ALL character names (main, secondary, recurring) that YOU, the AI, are PURPOSEFULLY and CREATIVELY altering from their form in the ${selectedSourceLangLabel} text to a new, distinct form in your ${selectedTargetLangLabel} rewritten text for THIS CHUNK. This includes significant re-spellings, translations that are creative choices rather than direct equivalents, or entirely new names. For each such change, record it.
          \nAt the VERY END of your entire response for THIS CHUNK, append these changes in the format:
          \n"[CHARACTER_MAP]Tên Gốc (trong ${selectedSourceLangLabel}): Original Name 1 -> Tên Mới (trong ${selectedTargetLangLabel}): New Name 1; Tên Gốc (trong ${selectedSourceLangLabel}): Original Name 2 -> Tên Mới (trong ${selectedTargetLangLabel}): New Name 2[/CHARACTER_MAP]"
          \nIf you make NO such purposeful creative changes to ANY character names (i.e., they are kept original, or receive only direct, standard translations that will be applied consistently per the general character consistency rule), you MUST append:
          \n"[CHARACTER_MAP]Không có thay đổi tên nhân vật chính nào được map[/CHARACTER_MAP]"
          \nThis map (or the 'no change' signal) is VITAL for consistency in subsequent chunks. This instruction and its output are ONLY for this first chunk and MUST be outside the main rewritten story text.`;
      } else if (characterMapForItem && currentRewriteLevel >= 75) { // Use characterMapForItem here
          prompt += `\n- **ABSOLUTE CHARACTER CONSISTENCY MANDATE (Based on Character Map for Level >= 75%):**
          \n  You are provided with a Character Map: \`${characterMapForItem}\`. You MUST adhere to this with 100% accuracy.
          \n  - If the map provides \`Tên Gốc (trong ${selectedSourceLangLabel}): [Tên A] -> Tên Mới (trong ${selectedTargetLangLabel}): [Tên B]\` pairs: Use the 'New Name' \`[Tên B]\` EXACTLY AS SPECIFIED for every instance (explicit or implied) of the 'Original Name' \`[Tên A]\`.
          \n  - If the map states \`Không có thay đổi tên nhân vật chính nào được map\`: You MUST continue using the exact naming convention for ALL characters as established in the first rewritten chunk.
          \n  - **FOR ALL CHARACTERS (mapped or not): Once a name is used for a character in the \`${selectedTargetLangLabel}\` output for this story, IT MUST NOT CHANGE for that character in subsequent parts of this same story.** DO NOT re-translate, vary, or introduce alternative names for any character already named.
          \n  - **Handling Unmapped Names (if map exists and is not "no change"):** For ANY character name encountered in the original text that is NOT explicitly listed in the Character Map (and the map is not 'Không có thay đổi...'), you MUST: 1. Check if this character has already appeared in previously rewritten chunks (\`fullRewrittenStory\`). If yes, use the EXACT SAME name (in \`${selectedTargetLangLabel}\`) as used before. 2. If it's a new character not in the map and not seen before, apply a consistent, direct translation to \`${selectedTargetLangLabel}\` or maintain the original name if phonetically suitable, and then USE THIS CHOSEN FORM CONSISTENTLY for all future appearances of this character.`;
      }

      prompt += `\n**Original Text Chunk to Rewrite (this chunk is in ${selectedSourceLangLabel}):**
      \n---
      \n${textChunk}
      \n---
      \n**IMPORTANT FINAL INSTRUCTION FOR THIS CHUNK:**
      \nRegardless of the complexity or perceived difficulty of the rewrite task based on the 'Degree of Change Required' and other constraints, if 'Degree of Change Required' is greater than 0%, your output for THIS CHUNK ABSOLUTELY MUST BE A REWRITTEN VERSION. It CANNOT be an identical copy of the 'Original Text Chunk to Rewrite' provided above. Make your best effort to apply the changes as instructed. If the 'Degree of Change Required' is 0%, only fix basic spelling/grammar and return the full text; otherwise, you must rewrite.
      \n**Perform the rewrite for THIS CHUNK ONLY in ${selectedTargetLangLabel}. Adhere strictly to all instructions. Remember, ONLY the rewritten story text.**`;

      if (i > 0) await delay(750);
      const result = await textGenerator(prompt, systemInstructionForRewrite);
      let partResultText = result || "";

      if (i === 0 && currentRewriteLevel >= 75) {
          const mapMatch = partResultText.match(/\[CHARACTER_MAP\]([\s\S]*?)\[\/CHARACTER_MAP\]/);
          if (mapMatch && mapMatch[1]) {
              if (mapMatch[1].trim().toLowerCase() !== 'no change' && mapMatch[1].trim().toLowerCase() !== 'no main character name changes mapped' && mapMatch[1].trim().toLowerCase() !== 'không có thay đổi tên nhân vật chính nào được map') {
                   characterMapForItem = mapMatch[1].trim();
              } else {
                  characterMapForItem = "Không có thay đổi tên nhân vật chính nào được map";
              }
              onProgress(itemId, 'rewriting', `Đang viết lại phần ${i + 1}/${numChunks}...`, characterMapForItem); // Pass char map in progress
              partResultText = partResultText.replace(mapMatch[0], '');
          }
      }
      partResultText = partResultText.trim(); 

      if (fullRewrittenStory && partResultText) {
          fullRewrittenStory += "\n\n" + partResultText;
      } else if (partResultText) {
          fullRewrittenStory = partResultText;
      }
    }
    return { rewrittenText: fullRewrittenStory.trim(), characterMapUsed: characterMapForItem };
  };
  
  // Core post-rewrite editing logic (adapted from RewriteModule)
  const performSingleItemPostEdit = async (
    textToEdit: string,
    originalSourceTextToCompare: string, // The item's original text
    currentRewriteLevel: number,
    currentSourceLanguage: string,
    currentTargetLanguage: string,
    currentRewriteStyle: string, // The actual style string (e.g., label or custom text)
    currentAdaptContext: boolean,
    itemId: string, // For progress updates
    onProgress: (itemId: string, status: GeneratedBatchRewriteOutputItem['status'], message: string | null) => void,
    textGenerator: (prompt: string, systemInstruction?: string) => Promise<string>
  ): Promise<string> => {
    onProgress(itemId, 'editing', 'Đang tinh chỉnh logic...');
    
    const selectedSourceLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === currentSourceLanguage)?.label || currentSourceLanguage;
    const selectedTargetLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === currentTargetLanguage)?.label || currentTargetLanguage;

    const editPrompt = `Bạn là một biên tập viên truyện chuyên nghiệp, cực kỳ tỉ mỉ và có khả năng tinh chỉnh văn phong xuất sắc. Nhiệm vụ của bạn là đọc kỹ "Văn Bản Đã Viết Lại" dưới đây. Mục tiêu chính của bạn là BIÊN TẬP và TINH CHỈNH văn bản này để nó trở nên mạch lạc, logic, nhất quán, và ĐẶC BIỆT là loại bỏ mọi sự trùng lặp, thừa thãi, đồng thời cải thiện văn phong cho súc tích và hấp dẫn hơn. Bạn sẽ SO SÁNH, ĐỐI CHIẾU "Văn Bản Đã Viết Lại" với "Văn Bản Gốc Ban Đầu" CHỦ YẾU để đảm bảo các yếu tố cốt lõi (nhân vật, tình tiết chính) được giữ lại một cách hợp lý theo "Mức Độ Thay Đổi Yêu Cầu" của lần viết lại trước, chứ KHÔNG phải để đưa văn bản trở lại y hệt bản gốc.

    **QUAN TRỌNG: Văn bản "Đã Viết Lại" có thể đã được thay đổi ở một mức độ nhất định so với "Văn Bản Gốc" (dựa trên Mức Độ Thay Đổi Yêu Cầu). Việc biên tập của bạn KHÔNG PHẢI là đưa nó trở lại giống hệt bản gốc, mà là đảm bảo BÊN TRONG chính "Văn Bản Đã Viết Lại" đó phải nhất quán và logic, đồng thời vẫn tôn trọng những thay đổi có chủ đích đã được thực hiện (nếu có) so với bản gốc trong phạm vi cho phép của mức độ viết lại.**

    **THÔNG TIN CHO BỐI CẢNH BIÊN TẬP:**
    - Ngôn ngữ Văn Bản Gốc: ${selectedSourceLangLabel}
    - Ngôn ngữ Văn Bản Đã Viết Lại (và ngôn ngữ đầu ra của bạn): ${selectedTargetLangLabel}
    - Mức Độ Thay Đổi Yêu Cầu (của lần viết lại trước): ${currentRewriteLevel}%
    - Phong Cách Viết Lại Yêu Cầu (của lần viết lại trước): ${currentRewriteStyle}
    - Có yêu cầu bản địa hóa khi viết lại: ${currentAdaptContext ? 'Có' : 'Không'}

    **VĂN BẢN GỐC BAN ĐẦU (để đối chiếu logic và các yếu tố gốc):**
    ---
    ${originalSourceTextToCompare}
    ---

    **VĂN BẢN ĐÃ VIẾT LẠI (Cần bạn biên tập và tinh chỉnh):**
    ---
    ${textToEdit}
    ---

    **HƯỚNG DẪN BIÊN TẬP CHI TIẾT:**
    1.  **Tính nhất quán (Consistency):**
        *   **Tên Nhân Vật (QUAN TRỌNG NHẤT):** Rà soát kỹ TOÀN BỘ "Văn Bản Đã Viết Lại". Đảm bảo MỖI nhân vật (dù chính hay phụ, dù được giới thiệu ở đâu) chỉ sử dụng MỘT TÊN DUY NHẤT và nhất quán trong toàn bộ văn bản bằng ngôn ngữ ${selectedTargetLangLabel}. Nếu có sự nhầm lẫn, thay đổi tên giữa chừng (ví dụ: nhân vật A lúc đầu tên là X, sau lại là Y), hãy sửa lại cho đúng một tên duy nhất đã được thiết lập (ưu tiên tên xuất hiện nhiều hơn hoặc hợp lý hơn).
        *   **Đặc Điểm/Vai Trò Nhân Vật:** Đặc điểm ngoại hình, tính cách, vai trò, mối quan hệ của nhân vật có được duy trì nhất quán từ đầu đến cuối không? Có hành động nào của nhân vật mâu thuẫn với những gì đã được thiết lập về họ trong "Văn Bản Đã Viết Lại" không?
        *   **Logic Cốt Truyện và Sự Kiện:** Các sự kiện có diễn ra hợp lý, tuần tự và logic không? Có tình tiết nào trong "Văn Bản Đã Viết Lại" bị vô lý, mâu thuẫn với các sự kiện trước đó trong chính nó, hoặc tạo ra "plot hole" không? Dòng thời gian có nhất quán không?
        *   **Tính nhất quán Địa Điểm và Chi Tiết:** Địa điểm và các chi tiết bối cảnh quan trọng khác có được mô tả và duy trì nhất quán không?
    2.  **NÂNG CAO CHẤT LƯỢNG VĂN PHONG VÀ LOẠI BỎ TRÙNG LẶP (RẤT QUAN TRỌNG):**
        *   **Loại bỏ Trùng Lặp và Từ Ngữ Thừa:** Rà soát kỹ lưỡng để loại bỏ mọi sự lặp lại không cần thiết về ý tưởng, thông tin, cụm từ, hoặc mô tả. Nếu một chi tiết, sự kiện, hoặc suy nghĩ của nhân vật đã được nêu rõ, tránh diễn đạt lại theo cách tương tự hoặc mô tả lại các chi tiết không cần thiết ở những đoạn văn/câu sau, trừ khi có mục đích nhấn mạnh nghệ thuật đặc biệt và hiệu quả. Tìm cách cô đọng các đoạn văn dài dòng, loại bỏ từ ngữ thừa, câu văn rườm rà để nội dung súc tích và mạch lạc hơn.
        *   **Cải thiện Luồng Chảy và Mạch Lạc (Flow and Cohesion):** Đảm bảo các đoạn văn và câu chuyện chuyển tiếp mượt mà, tự nhiên. Sử dụng từ nối, cụm từ chuyển tiếp một cách hợp lý và đa dạng nếu cần. Sắp xếp lại câu hoặc đoạn văn nếu điều đó cải thiện tính mạch lạc và dễ đọc tổng thể.
        *   **Đa dạng hóa Cấu trúc Câu:** Tránh việc lặp đi lặp lại cùng một kiểu cấu trúc câu đơn điệu (ví dụ: liên tục các câu bắt đầu bằng chủ ngữ - động từ). Hãy thay đổi độ dài câu (ngắn, dài, trung bình) và các kiểu câu (đơn, ghép, phức) để tạo nhịp điệu và làm cho văn bản hấp dẫn, dễ theo dõi hơn.
        *   **Tinh chỉnh Lựa chọn Từ ngữ (Word Choice):** Ưu tiên sử dụng từ ngữ chính xác, giàu hình ảnh, và có sức biểu cảm cao. Tránh các từ ngữ chung chung, sáo rỗng hoặc yếu nghĩa.
        *   **Duy trì Giọng điệu và Phong cách Gốc (của bản viết lại):** Trong quá trình tinh chỉnh, cố gắng duy trì giọng điệu (ví dụ: căng thẳng, hài hước, trang trọng) và phong cách văn chương chung đã được thiết lập trong "Văn Bản Đã Viết Lại". Các chỉnh sửa về văn phong nên nhằm mục đích làm cho nó tốt hơn, không phải thay đổi hoàn toàn bản chất của nó.
    3.  **Mạch Lạc và Dễ Hiểu Chung (Overall Clarity):** Sau các bước trên, đọc lại toàn bộ để đảm bảo văn bản cuối cùng mạch lạc, dễ hiểu, các ý được diễn đạt rõ ràng.
    4.  **Độ Dài:** Cố gắng duy trì độ dài TƯƠNG TỰ như "Văn Bản Đã Viết Lại" được cung cấp. Việc chỉnh sửa chủ yếu tập trung vào logic, nhất quán và chất lượng văn phong, không phải thay đổi độ dài đáng kể, trừ khi thực sự cần thiết để sửa lỗi logic nghiêm trọng hoặc do việc loại bỏ trùng lặp/thừa thãi một cách tự nhiên dẫn đến thay đổi.

    **ĐẦU RA:**
    - Chỉ trả về TOÀN BỘ nội dung văn bản đã được biên tập và tinh chỉnh hoàn chỉnh, bằng ngôn ngữ ${selectedTargetLangLabel}.
    - Không thêm bất kỳ lời bình luận, giải thích hay tiêu đề nào.`;

    const systemInstructionForEdit = "You are a meticulous story editor. Your task is to refine and polish a given text, ensuring consistency, logical flow, and improved style, while respecting previous rewrite intentions.";
    
    await delay(1000);
    const result = await textGenerator(editPrompt, systemInstructionForEdit);
    return result.trim();
  };

  const processSingleBatchItem = async (
      item: BatchRewriteInputItem, 
      index: number, 
      totalItems: number,
      updateResultCallback: (id: string, updates: Partial<GeneratedBatchRewriteOutputItem>) => void,
      textGenerator: (prompt: string, systemInstruction?: string) => Promise<string>
    ) => {
    
    // Determine effective settings for the item
    const effectiveRewriteLevel = item.specificRewriteLevel ?? globalRewriteLevel;
    const effectiveSourceLanguage = item.specificSourceLanguage ?? globalSourceLanguage;
    const effectiveTargetLanguage = item.specificTargetLanguage ?? globalTargetLanguage;
    const effectiveRewriteStyleValue = item.specificRewriteStyle ?? globalRewriteStyle;
    const effectiveCustomRewriteStyle = item.specificCustomRewriteStyle ?? globalCustomRewriteStyle;
    
    let effectiveAdaptContext;
    if (item.specificAdaptContext !== null && item.specificAdaptContext !== undefined) {
        effectiveAdaptContext = item.specificAdaptContext;
    } else {
        effectiveAdaptContext = (effectiveTargetLanguage !== effectiveSourceLanguage) ? true : globalAdaptContext;
    }

    let effectiveRewriteStyleForPrompt = '';
    let customInstructionsForPrompt = '';

    if (effectiveRewriteStyleValue === 'custom') {
        if (!effectiveCustomRewriteStyle.trim()) {
            throw new Error('Phong cách viết lại tùy chỉnh không được để trống khi được chọn.');
        }
        effectiveRewriteStyleForPrompt = 'custom';
        customInstructionsForPrompt = effectiveCustomRewriteStyle.trim();
    } else {
        const selectedStyleOption = REWRITE_STYLE_OPTIONS.find(opt => opt.value === effectiveRewriteStyleValue);
        effectiveRewriteStyleForPrompt = selectedStyleOption ? selectedStyleOption.label : effectiveRewriteStyleValue;
    }

    try {
      const { rewrittenText: initiallyRewrittenText, characterMapUsed } = await performSingleItemRewrite(
        item.originalText,
        effectiveRewriteLevel,
        effectiveSourceLanguage,
        effectiveTargetLanguage,
        effectiveRewriteStyleForPrompt,
        customInstructionsForPrompt,
        effectiveAdaptContext,
        item.id,
        (itemId, status, message, charMap) => { // Updated progress callback
             updateResultCallback(itemId, { 
                status: status, 
                progressMessage: message, 
                ...(charMap && { characterMap: charMap }) // Store character map if provided
            });
        },
        textGenerator
      );
      
      updateResultCallback(item.id, { rewrittenText: initiallyRewrittenText, progressMessage: 'Hoàn thành viết lại. Chuẩn bị tinh chỉnh...', characterMap: characterMapUsed });

      if (!initiallyRewrittenText.trim()) {
        throw new Error("Văn bản viết lại ban đầu trống.");
      }
      
      const finalRewrittenText = await performSingleItemPostEdit(
        initiallyRewrittenText,
        item.originalText,
        effectiveRewriteLevel,
        effectiveSourceLanguage,
        effectiveTargetLanguage,
        effectiveRewriteStyleForPrompt, // Use the same style context for editing
        effectiveAdaptContext,
        item.id,
        (itemId, status, message) => updateResultCallback(itemId, { status: status, progressMessage: message }),
        textGenerator
      );

      updateResultCallback(item.id, { 
        rewrittenText: finalRewrittenText, 
        status: 'completed', 
        progressMessage: 'Hoàn thành!', 
        error: null,
        hasBeenEdited: true
      });

    } catch (e) {
      updateResultCallback(item.id, { 
        status: 'error', 
        error: (e as Error).message, 
        progressMessage: 'Lỗi xử lý mục này.' 
      });
    }
  };


  const handleStartBatchRewrite = async () => {
    const validItems = inputItems.filter(item => item.originalText.trim() !== '');
    if (validItems.length === 0) {
      updateState({ batchError: 'Vui lòng thêm ít nhất một mục văn bản hợp lệ.' });
      return;
    }

    // Create new AbortController for this batch operation
    abortControllerRef.current = new AbortController();
    const CONCURRENCY_LIMIT = Math.max(1, Math.min(10, concurrencyLimit));
    
    const textGenerator = apiSettings.provider === 'deepseek'
        ? (prompt: string, systemInstruction?: string) => generateDeepSeekText(prompt, systemInstruction, deepseekApiKeyForService)
        : (prompt: string, systemInstruction?: string) => generateGeminiText(prompt, systemInstruction, undefined, geminiApiKeyForService).then(res => res.text);


    updateState({
      isProcessingBatch: true,
      batchProgressMessage: `Chuẩn bị xử lý ${validItems.length} mục với ${CONCURRENCY_LIMIT} luồng...`,
      batchError: null,
      results: validItems.map(item => ({
        id: item.id,
        originalText: item.originalText,
        rewrittenText: null,
        status: 'pending',
        progressMessage: 'Đang chờ trong hàng đợi',
        error: null,
        characterMap: null,
        hasBeenEdited: false
      })),
    });

    const updateResultCallback = (id: string, updates: Partial<GeneratedBatchRewriteOutputItem>) => {
      setModuleState(prev => {
        const newResults = prev.results.map(r => (r.id === id ? { ...r, ...updates } : r));
        const completedCount = newResults.filter(r => r.status === 'completed' || r.status === 'error').length;
        
        return {
            ...prev,
            results: newResults,
            batchProgressMessage: prev.isProcessingBatch ? `Đang xử lý... Hoàn thành ${completedCount}/${validItems.length}` : prev.batchProgressMessage
        };
      });
    };

    const taskQueue = [...validItems.map((item, index) => ({ item, index }))];

    const worker = async () => {
        while (taskQueue.length > 0 && !abortControllerRef.current?.signal.aborted) {
            const task = taskQueue.shift();
            if (!task) continue;

            const { item, index } = task;
            
            // Check if operation was aborted before processing each item
            if (abortControllerRef.current?.signal.aborted) {
                updateResultCallback(item.id, { 
                    status: 'error', 
                    progressMessage: 'Đã dừng', 
                    error: 'Thao tác đã bị dừng' 
                });
                break;
            }
            
            await processSingleBatchItem(item, index, validItems.length, updateResultCallback, textGenerator);
        }
    };
    
    const workers = Array(CONCURRENCY_LIMIT).fill(null).map(worker);
    await Promise.all(workers);


    setModuleState(prev => {
        const completedResults = prev.results.filter(r => r.status === 'completed' && r.rewrittenText);
        
        // Save completed results to history
        completedResults.forEach((result, index) => {
            if (result.rewrittenText) {
                const title = `Viết lại hàng loạt #${index + 1} - ${new Date().toLocaleString('vi-VN')}`;
                HistoryStorage.saveToHistory(MODULE_KEYS.BATCH_REWRITE, title, result.rewrittenText);
            }
        });
        
        const wasAborted = abortControllerRef.current?.signal.aborted;
        const message = wasAborted 
            ? `Đã dừng. Hoàn thành ${completedResults.length}/${validItems.length} mục.`
            : `Hoàn thành xử lý toàn bộ ${validItems.length} mục.`;
            
        return { 
            ...prev,
            isProcessingBatch: false, 
            batchProgressMessage: message
        };
    });
    
    abortControllerRef.current = null;
    setTimeout(() => updateState({ batchProgressMessage: null }), 5000);
  };

  const handleCancelBatch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      updateState({ batchProgressMessage: 'Đang dừng xử lý hàng loạt...' });
    }
  };
  
  const handleRefineSingleResult = async (resultId: string) => {
    const resultItem = results.find(r => r.id === resultId);
    const originalInputItem = inputItems.find(i => i.id === resultId);

    if (!resultItem || !originalInputItem || !resultItem.rewrittenText) {
        // Update specific item's error if needed, or global error
        setModuleState(prev => ({
            ...prev,
            results: prev.results.map(r => r.id === resultId ? {...r, error: "Không tìm thấy dữ liệu để tinh chỉnh."} : r)
        }));
        return;
    }
    
    setModuleState(prev => ({
        ...prev,
        isProcessingBatch: true, // Optional: might want a different flag for single item refinement within batch
        results: prev.results.map(r => r.id === resultId ? {...r, status: 'editing', progressMessage: "Đang tinh chỉnh lại..."} : r)
    }));
    
    const textGenerator = apiSettings.provider === 'deepseek'
        ? (prompt: string, systemInstruction?: string) => generateDeepSeekText(prompt, systemInstruction, deepseekApiKeyForService)
        : (prompt: string, systemInstruction?: string) => generateGeminiText(prompt, systemInstruction, undefined, geminiApiKeyForService).then(res => res.text);


    // Determine effective settings for the item
    const effectiveRewriteLevel = originalInputItem.specificRewriteLevel ?? globalRewriteLevel;
    const effectiveSourceLanguage = originalInputItem.specificSourceLanguage ?? globalSourceLanguage;
    const effectiveTargetLanguage = originalInputItem.specificTargetLanguage ?? globalTargetLanguage;
    const effectiveRewriteStyleValue = originalInputItem.specificRewriteStyle ?? globalRewriteStyle;
    const effectiveCustomRewriteStyle = originalInputItem.specificCustomRewriteStyle ?? globalCustomRewriteStyle;
    
    let effectiveAdaptContext;
    if (originalInputItem.specificAdaptContext !== null && originalInputItem.specificAdaptContext !== undefined) {
        effectiveAdaptContext = originalInputItem.specificAdaptContext;
    } else {
        effectiveAdaptContext = (effectiveTargetLanguage !== effectiveSourceLanguage) ? true : globalAdaptContext;
    }
    
    let effectiveRewriteStyleForPrompt = '';
    if (effectiveRewriteStyleValue === 'custom') {
        if (!effectiveCustomRewriteStyle.trim()) {
             setModuleState(prev => ({
                ...prev,
                isProcessingBatch: false,
                results: prev.results.map(r => r.id === resultId ? {...r, status: 'error', error: "Lỗi: Phong cách tùy chỉnh trống.", progressMessage: "Lỗi"} : r)
            }));
            return;
        }
        effectiveRewriteStyleForPrompt = effectiveCustomRewriteStyle.trim(); // The custom text itself is the style
    } else {
        const selectedStyleOption = REWRITE_STYLE_OPTIONS.find(opt => opt.value === effectiveRewriteStyleValue);
        effectiveRewriteStyleForPrompt = selectedStyleOption ? selectedStyleOption.label : effectiveRewriteStyleValue;
    }

    try {
        const refinedText = await performSingleItemPostEdit(
            resultItem.rewrittenText,
            originalInputItem.originalText,
            effectiveRewriteLevel,
            effectiveSourceLanguage,
            effectiveTargetLanguage,
            effectiveRewriteStyleForPrompt,
            effectiveAdaptContext,
            resultId,
            (itemId, status, message) => {
                 setModuleState(prev => ({
                    ...prev,
                    results: prev.results.map(r => r.id === itemId ? {...r, status: status, progressMessage: message} : r)
                }));
            },
            textGenerator
        );
        setModuleState(prev => ({
            ...prev,
            isProcessingBatch: false,
            results: prev.results.map(r => r.id === resultId ? {...r, rewrittenText: refinedText, status: 'completed', progressMessage: "Tinh chỉnh lại hoàn tất!", hasBeenEdited: true, error: null} : r)
        }));

    } catch (e) {
        setModuleState(prev => ({
            ...prev,
            isProcessingBatch: false,
            results: prev.results.map(r => r.id === resultId ? {...r, status: 'error', error: `Lỗi tinh chỉnh lại: ${(e as Error).message}`, progressMessage: "Lỗi"} : r)
        }));
    }
  };


  const copyToClipboard = (text: string | null, buttonId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById(buttonId);
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'Đã sao chép!';
        setTimeout(() => { btn.textContent = originalText; }, 2000);
    }
  };

  const handleSelectHistory = (content: string) => {
    // Add new item with the selected content
    const newItem: BatchRewriteInputItem = {
      id: Date.now().toString(),
      originalText: content,
    };
    updateState({ inputItems: [...inputItems, newItem] });
  };

  const userLevelDescriptions: { [key: number]: string } = {
    0: "Chỉ sửa lỗi chính tả và ngữ pháp cơ bản. Giữ nguyên 100% nội dung và văn phong gốc.",
    25: "Làm mới văn bản bằng cách thay đổi một số từ ngữ và cấu trúc câu. Giữ nguyên ý nghĩa, nhân vật, bối cảnh và cốt truyện chính. Thay đổi nhẹ nhàng.",
    50: "Viết lại vừa phải từ ngữ và văn phong. Có thể thay đổi cấu trúc câu, từ vựng, một số chi tiết mô tả nhỏ. Tên nhân vật chính, các điểm cốt truyện chính, và bối cảnh chính PHẢI được giữ nguyên.",
    75: "Sáng tạo lại câu chuyện một cách đáng kể. Có thể thay đổi tên nhân vật, nghề nghiệp, bối cảnh. Cốt truyện có thể có những phát triển mới nhưng PHẢI giữ được tinh thần và những điểm hấp dẫn nhất của kịch bản gốc.",
    100: "Viết lại hoàn toàn thành một kịch bản mới. Chỉ giữ lại 'linh hồn' (ý tưởng cốt lõi, chủ đề chính) của câu chuyện gốc. Mọi thứ khác như tên nhân vật, bối cảnh, và thậm chí một số tình tiết phụ đều PHẢI hoàn toàn mới."
  };

  const getCurrentGlobalLevelDescription = () => {
    const key = Math.round(globalRewriteLevel / 25) * 25;
    return userLevelDescriptions[key] || "Di chuyển thanh trượt để xem mô tả.";
  }

  return (
    <ModuleContainer title="🔀 Viết Lại Hàng Loạt">
      {!hasActiveSubscription && <UpgradePrompt />}
      <InfoBox>
        <p><strong>💡 Hướng dẫn:</strong></p>
        <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-sm">
          <li>Thiết lập các tùy chọn viết lại chung (mức độ, ngôn ngữ, phong cách).</li>
          <li>Thêm từng đoạn văn bản bạn muốn viết lại. Bạn có thể tùy chỉnh các thiết lập riêng cho từng mục nếu muốn ghi đè cài đặt chung.</li>
          <li>Nhấn "Bắt Đầu Viết Lại Hàng Loạt". AI sẽ xử lý từng mục, bao gồm cả bước viết lại ban đầu và bước tinh chỉnh logic/nhất quán sau đó.</li>
          <li>Sau khi hoàn tất, bạn có thể xem lại, sao chép từng kết quả. Mỗi mục cũng sẽ có nút "Tinh Chỉnh Lại" riêng nếu bạn muốn AI xử lý lại bước tinh chỉnh cho mục đó.</li>
        </ul>
      </InfoBox>

      {/* Global Settings */}
      <div className="space-y-6 p-6 border-2 border-gray-200 rounded-lg bg-gray-50 shadow mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Cài đặt Chung cho Viết Lại Hàng Loạt</h3>
        <div>
            <div className="flex justify-between items-center mb-1">
                <label htmlFor="brwGlobalRewriteLevel" className="text-sm font-medium text-gray-700">Mức độ thay đổi (chung):</label>
                <span className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">{globalRewriteLevel}%</span>
            </div>
            <input type="range" id="brwGlobalRewriteLevel" min="0" max="100" step="25" value={globalRewriteLevel} onChange={(e) => updateState({ globalRewriteLevel: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" disabled={isProcessingBatch}/>
            <div className="flex justify-between text-xs text-gray-500 mt-1"><span>Chỉnh sửa nhẹ</span><span>Sáng tạo lại</span></div>
             <div className="mt-2 text-sm text-gray-600 bg-indigo-50 p-3 rounded-md border border-indigo-200"><strong>Giải thích mức {globalRewriteLevel}%:</strong> {getCurrentGlobalLevelDescription()}</div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label htmlFor="brwGlobalSourceLang" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ gốc (chung):</label>
            <select id="brwGlobalSourceLang" value={globalSourceLanguage} onChange={(e) => updateState({ globalSourceLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isProcessingBatch}>
              {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="brwGlobalTargetLang" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đầu ra (chung):</label>
            <select id="brwGlobalTargetLang" value={globalTargetLanguage} onChange={(e) => updateState({ globalTargetLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isProcessingBatch}>
              {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="brwGlobalRewriteStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách viết lại (chung):</label>
            <select id="brwGlobalRewriteStyle" value={globalRewriteStyle} onChange={(e) => updateState({ globalRewriteStyle: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isProcessingBatch}>
              {REWRITE_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="brwConcurrencyLimit" className="block text-sm font-medium text-gray-700 mb-1">Số luồng xử lý đồng thời (1-10):</label>
            <input 
                type="number" 
                id="brwConcurrencyLimit" 
                value={concurrencyLimit} 
                onChange={(e) => updateState({ concurrencyLimit: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
                min="1" max="10"
                className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm"
                disabled={isProcessingBatch}
            />
            <p className="text-xs text-orange-600 mt-1">
                <strong>Cảnh báo:</strong> Đặt số luồng quá cao (trên 3-5) có thể gây lỗi do giới hạn của API. Mức đề xuất: 3.
            </p>
          </div>
        </div>
        {globalRewriteStyle === 'custom' && (
          <div>
            <label htmlFor="brwGlobalCustomStyle" className="block text-sm font-medium text-gray-700 mb-1">Phong cách tùy chỉnh (chung):</label>
            <textarea id="brwGlobalCustomStyle" value={globalCustomRewriteStyle} onChange={(e) => updateState({ globalCustomRewriteStyle: e.target.value })} rows={2} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" placeholder="Mô tả phong cách tùy chỉnh..." disabled={isProcessingBatch}></textarea>
          </div>
        )}
        {globalTargetLanguage !== globalSourceLanguage && (
            <div className="flex items-center">
                <input type="checkbox" id="brwGlobalAdaptContext" checked={globalAdaptContext} onChange={(e) => updateState({ globalAdaptContext: e.target.checked })} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" disabled={isProcessingBatch}/>
                <label htmlFor="brwGlobalAdaptContext" className="ml-2 block text-sm text-gray-700">Bản địa hóa (chung)</label>
            </div>
        )}
      </div>

      {/* Input Items */}
      <div className="space-y-4 mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Danh sách Văn Bản Cần Viết Lại</h3>
        {inputItems.map((item, index) => (
          <div key={item.id} className="p-4 border-2 border-gray-200 rounded-lg bg-white shadow-sm space-y-3">
            <div className="flex justify-between items-center">
                <h4 className="text-md font-semibold text-gray-700">Mục #{index + 1}</h4>
                <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700 font-medium text-sm p-2 rounded-md hover:bg-red-50" disabled={isProcessingBatch} aria-label={`Xóa mục ${index + 1}`}>
                    🗑️ Xóa
                </button>
            </div>
            <div>
              <label htmlFor={`originalText-${item.id}`} className="block text-sm font-medium text-gray-700 mb-1">Văn bản gốc (*):</label>
              <textarea id={`originalText-${item.id}`} value={item.originalText} onChange={(e) => handleInputChange(item.id, 'originalText', e.target.value)} rows={5} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Dán văn bản gốc vào đây..." disabled={isProcessingBatch}></textarea>
            </div>
            <details className="text-sm">
                <summary className="cursor-pointer text-indigo-600 hover:text-indigo-800 font-medium">Tùy chỉnh riêng cho mục này (không bắt buộc)</summary>
                <div className="mt-2 grid md:grid-cols-2 gap-x-4 gap-y-3 p-3 bg-gray-50 rounded-md border">
                    <div>
                        <label htmlFor={`specificLevel-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Mức độ thay đổi riêng:</label>
                        <input type="number" id={`specificLevel-${item.id}`} value={item.specificRewriteLevel ?? ''} onChange={(e) => handleInputChange(item.id, 'specificRewriteLevel', e.target.value ? parseInt(e.target.value) : null)} min="0" max="100" step="25" className="w-full p-2 border border-gray-300 rounded-md text-xs" placeholder={`Mặc định: ${globalRewriteLevel}%`} disabled={isProcessingBatch}/>
                    </div>
                    <div>
                        <label htmlFor={`specificSrcLang-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Ngôn ngữ gốc riêng:</label>
                        <select id={`specificSrcLang-${item.id}`} value={item.specificSourceLanguage || ""} onChange={(e) => handleInputChange(item.id, 'specificSourceLanguage', e.target.value || null)} className="w-full p-2 border border-gray-300 rounded-md text-xs" disabled={isProcessingBatch}>
                            <option value="">-- Dùng cài đặt chung --</option>
                            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor={`specificTgtLang-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Ngôn ngữ đầu ra riêng:</label>
                        <select id={`specificTgtLang-${item.id}`} value={item.specificTargetLanguage || ""} onChange={(e) => handleInputChange(item.id, 'specificTargetLanguage', e.target.value || null)} className="w-full p-2 border border-gray-300 rounded-md text-xs" disabled={isProcessingBatch}>
                            <option value="">-- Dùng cài đặt chung --</option>
                            {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor={`specificStyle-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Phong cách viết lại riêng:</label>
                        <select id={`specificStyle-${item.id}`} value={item.specificRewriteStyle || ""} onChange={(e) => handleInputChange(item.id, 'specificRewriteStyle', e.target.value || null)} className="w-full p-2 border border-gray-300 rounded-md text-xs" disabled={isProcessingBatch}>
                            <option value="">-- Dùng cài đặt chung --</option>
                            {REWRITE_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                     {(item.specificRewriteStyle ?? globalRewriteStyle) === 'custom' && (
                        <div className="md:col-span-2">
                            <label htmlFor={`specificCustomStyle-${item.id}`} className="block text-xs font-medium text-gray-600 mb-0.5">Phong cách tùy chỉnh riêng:</label>
                            <textarea id={`specificCustomStyle-${item.id}`} value={item.specificCustomRewriteStyle || ""} onChange={(e) => handleInputChange(item.id, 'specificCustomRewriteStyle', e.target.value)} rows={2} className="w-full p-2 border border-gray-300 rounded-md text-xs" placeholder="Mô tả phong cách tùy chỉnh riêng..." disabled={isProcessingBatch}></textarea>
                        </div>
                    )}
                    {(item.specificTargetLanguage ?? globalTargetLanguage) !== (item.specificSourceLanguage ?? globalSourceLanguage) && (
                        <div className="flex items-center md:col-span-2">
                            <input type="checkbox" id={`specificAdaptCtx-${item.id}`} checked={item.specificAdaptContext ?? ((item.specificTargetLanguage ?? globalTargetLanguage) !== (item.specificSourceLanguage ?? globalSourceLanguage) ? true : globalAdaptContext)} onChange={(e) => handleInputChange(item.id, 'specificAdaptContext', e.target.checked)} className="h-3 w-3 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" disabled={isProcessingBatch}/>
                            <label htmlFor={`specificAdaptCtx-${item.id}`} className="ml-2 block text-xs text-gray-700">Bản địa hóa riêng</label>
                        </div>
                    )}
                </div>
            </details>
          </div>
        ))}
        <button onClick={handleAddItem} className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 shadow disabled:opacity-50" disabled={isProcessingBatch}>
          ➕ Thêm Mục
        </button>
      </div>

      {/* Action Button & Progress */}
      <div className="flex gap-3">
        <button 
          onClick={handleStartBatchRewrite} 
          disabled={!hasActiveSubscription || isProcessingBatch || inputItems.length === 0 || inputItems.every(it => !it.originalText.trim())} 
          className="flex-1 bg-gradient-to-r from-indigo-700 to-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-xl hover:opacity-90 transition-opacity disabled:opacity-60 text-lg"
        >
          🚀 Bắt Đầu Viết Lại Hàng Loạt ({inputItems.filter(it => it.originalText.trim()).length} mục)
        </button>
        {isProcessingBatch && (
          <button
            onClick={handleCancelBatch}
            className="bg-red-500 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-red-600 transition-colors flex items-center"
            title="Dừng xử lý hàng loạt"
          >
            <StopCircle className="w-5 h-5" />
          </button>
        )}
      </div>

      {isProcessingBatch && batchProgressMessage && <LoadingSpinner message={batchProgressMessage} />}
      {!isProcessingBatch && batchProgressMessage && <p className={`text-center font-semibold my-3 ${batchProgressMessage.includes("Hoàn thành") ? 'text-green-600' : 'text-indigo-600'}`}>{batchProgressMessage}</p>}
      {batchError && <ErrorAlert message={batchError} />}

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-8 space-y-6">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-2xl font-semibold text-gray-800">Kết Quả Viết Lại Hàng Loạt</h3>
            <button onClick={handleClearResults} className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50" disabled={isProcessingBatch}>
                Xóa Tất Cả Kết Quả
            </button>
          </div>
          {results.map((result, index) => (
            <details key={result.id} className={`p-4 border-l-4 rounded-lg shadow-md bg-white 
                ${result.status === 'completed' ? (result.hasBeenEdited ? 'border-green-500' : 'border-yellow-400') : 
                  result.status === 'error' ? 'border-red-500' : 
                  (result.status === 'pending' ? 'border-gray-300' : 'border-blue-500')
                }`} open={results.length === 1 || result.status !== 'pending'}>
              <summary className="font-semibold text-lg text-gray-700 cursor-pointer flex justify-between items-center">
                <span>Mục #{inputItems.findIndex(i => i.id === result.id) + 1}: {result.originalText.substring(0, 60)}...</span>
                <span className={`text-sm px-2 py-0.5 rounded-full
                    ${result.status === 'completed' ? (result.hasBeenEdited ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700') : 
                      result.status === 'error' ? 'bg-red-100 text-red-700' :
                      (result.status === 'pending' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700 animate-pulse')
                    }`}>
                    {result.status === 'pending' ? 'Sẵn sàng' : 
                     result.status === 'rewriting' ? 'Đang viết lại...' :
                     result.status === 'editing' ? 'Đang tinh chỉnh...' :
                     result.status === 'completed' ? (result.hasBeenEdited ? '✅ Hoàn thành & Đã tinh chỉnh' : '📝 Hoàn thành (Chưa tinh chỉnh)') : '⚠️ Lỗi'}
                </span>
              </summary>
              <div className="mt-4 space-y-4">
                {(result.status !== 'pending' && result.progressMessage && result.status !== 'completed' && result.status !== 'error') && <LoadingSpinner message={result.progressMessage} noMargins={true}/>}
                {result.error && <ErrorAlert message={result.error} />}
                
                {result.rewrittenText && (
                    <div>
                        <h5 className="text-md font-semibold text-gray-600 mb-1">Văn bản đã viết lại:</h5>
                        <textarea value={result.rewrittenText} readOnly rows={8} className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 whitespace-pre-wrap leading-relaxed"></textarea>
                        <div className="mt-2 space-x-2">
                            <button id={`copyBatchRewrite-${result.id}`} onClick={() => copyToClipboard(result.rewrittenText!, `copyBatchRewrite-${result.id}`)} className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">
                                📋 Sao chép
                            </button>
                            <button 
                                onClick={() => handleRefineSingleResult(result.id)} 
                                disabled={!hasActiveSubscription || isProcessingBatch || !result.rewrittenText} 
                                className="px-3 py-1 bg-purple-500 text-white text-xs rounded-lg hover:bg-purple-600 disabled:opacity-50"
                            >
                                ✨ Tinh Chỉnh Lại Mục Này
                            </button>
                        </div>
                    </div>
                )}
                <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Xem văn bản gốc</summary>
                    <textarea value={result.originalText} readOnly rows={3} className="mt-1 w-full p-1 border border-gray-200 rounded-md bg-gray-100 whitespace-pre-wrap" disabled></textarea>
                </details>
              </div>
            </details>
          ))}
        </div>
      )}

      {/* History Panel */}
      <HistoryPanel 
        moduleKey={MODULE_KEYS.BATCH_REWRITE}
        onSelectHistory={handleSelectHistory}
      />
    </ModuleContainer>
  );
};

export default BatchRewriteModule;
