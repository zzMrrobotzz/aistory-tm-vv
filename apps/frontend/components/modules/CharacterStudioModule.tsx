
import React from 'react';
import { 
    ApiSettings, 
    CharacterStudioModuleState
} from '../../types';
import { HOOK_LANGUAGE_OPTIONS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { generateText } from '../../services/geminiService';
import { UserProfile } from '../../types';
import featureUsageTracker, { FEATURE_IDS } from '../../services/featureUsageTracker';

interface CharacterStudioModuleProps {
  apiSettings: ApiSettings;
  moduleState: CharacterStudioModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<CharacterStudioModuleState>>;
  currentUser: UserProfile | null;
}

const CharacterStudioModule: React.FC<CharacterStudioModuleProps> = ({ 
    apiSettings, moduleState, setModuleState, currentUser 
}) => {
  const {
    characterName,
    characterAge,
    characterGender, // New
    characterCountry,
    characterProfession,
    characterKeyFeatures, // New

    inputLanguage,
    outputLanguage,

    generatedBaseCharacterPrompt,
    isLoadingBasePrompt,
    errorBasePrompt,
    progressMessageBasePrompt,

    refinementInstructionForBasePrompt, // New
    isLoadingRefinementForBasePrompt, // New
    errorRefinementForBasePrompt, // New
    
    characterAction,
    generatedCompleteImagePrompt,
    isLoadingCompletePrompt,
    errorCompletePrompt,
    progressMessageCompletePrompt
  } = moduleState;

  const updateState = (updates: Partial<CharacterStudioModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  const geminiApiKeyForService = apiSettings.provider === 'gemini' ? apiSettings.apiKey : undefined;

  const handleGenerateOrRefineBaseCharacterPrompt = async (isRefinement: boolean) => {
    if (!isRefinement && !characterName.trim() && !characterAge.trim() && !characterGender.trim() && !characterCountry.trim() && !characterProfession.trim() && !characterKeyFeatures.trim()) {
      updateState({ errorBasePrompt: 'Vui lòng nhập ít nhất một thông tin cơ bản của nhân vật.' });
      return;
    }
    if (isRefinement && !refinementInstructionForBasePrompt.trim()) {
        updateState({ errorRefinementForBasePrompt: 'Vui lòng nhập yêu cầu tinh chỉnh cho Mô tả Cốt lõi.' });
        return;
    }
    if (isRefinement && !generatedBaseCharacterPrompt.trim()){
        updateState({ errorRefinementForBasePrompt: 'Chưa có Mô tả Nhân vật Cốt lõi để tinh chỉnh. Hãy tạo mô tả trước.' });
        return;
    }

    if (isRefinement) {
        updateState({ 
            isLoadingRefinementForBasePrompt: true, 
            errorRefinementForBasePrompt: null, 
            // Keep progressMessageBasePrompt null or set a specific one if desired
        });
    } else {
        updateState({ 
            isLoadingBasePrompt: true, 
            errorBasePrompt: null, 
            progressMessageBasePrompt: 'Đang phân tích thông tin và tạo Mô tả Nhân vật Cốt lõi...', 
            generatedBaseCharacterPrompt: '', // Clear previous if generating new
            generatedCompleteImagePrompt: '', // Also clear complete prompt
            refinementInstructionForBasePrompt: '', // Clear refinement instruction if generating new
            errorRefinementForBasePrompt: null, 
        });
    }

    const selectedInputLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === inputLanguage)?.label || inputLanguage;
    const selectedOutputLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage;

    const systemInstruction = `You are an AI expert specializing in creating vivid and detailed character visual descriptions for AI image generation. Your goal is to generate a "Base Character Prompt" that, when used repeatedly, helps an image AI maintain the character's core visual identity, especially facial features, across different scenes and actions.`;
    
    let userPrompt = "";

    if (isRefinement) {
        userPrompt = `
        You are refining an existing "Base Character Prompt".
        Original Character Profile (provided in ${selectedInputLangLabel}):
        - Name: ${characterName.trim() || "Không rõ"}
        - Age: ${characterAge.trim() || "Không rõ"}
        - Gender: ${characterGender.trim() || "Không rõ"}
        - Country/Origin: ${characterCountry.trim() || "Không rõ"}
        - Profession: ${characterProfession.trim() || "Không rõ"}
        - Key Visual Features/Specific Requests: ${characterKeyFeatures.trim() || "Không có"}

        Current "Base Character Prompt" (in ${selectedOutputLangLabel}):
        ---
        ${generatedBaseCharacterPrompt.trim()}
        ---

        User's Refinement Instruction (this might be in any language, AI should understand context):
        ---
        ${refinementInstructionForBasePrompt.trim()}
        ---

        Generate an UPDATED "Base Character Prompt" in ${selectedOutputLangLabel}.
        This updated description MUST incorporate the "User's Refinement Instruction" while respecting the "Original Character Profile" and the essence of the "Current Base Character Prompt".
        The output should still be a coherent paragraph focused on visual details for consistent character generation.
        It should still include a phrase like "Maintain these core visual features for character consistency."
        Output ONLY this updated detailed character description in ${selectedOutputLangLabel}.
        `;
    } else {
        userPrompt = `
        Based on the following character profile (provided in ${selectedInputLangLabel}):
        - Name: ${characterName.trim() || "Không rõ"}
        - Age: ${characterAge.trim() || "Không rõ"}
        - Gender: ${characterGender.trim() || "Không rõ"}
        - Country/Origin: ${characterCountry.trim() || "Không rõ"}
        - Profession: ${characterProfession.trim() || "Không rõ"}
        - Key Visual Features/Specific Requests: ${characterKeyFeatures.trim() || "Không có"}

        Generate ONE detailed visual "Base Character Prompt" in ${selectedOutputLangLabel}. This description should primarily focus on:
        1.  **Facial Features:** Face shape, eye color/shape, nose, lips, eyebrows, unique facial markings (scars, moles if plausible for the profile and key features).
        2.  **Hair:** Color, style, texture, length, considering age, gender, profession, and potential country styles.
        3.  **Build & Stature:** General body type (e.g., slender, muscular, average), influenced by profession and gender.
        4.  **Typical Attire (hints from profession/country/key features):** Suggest typical clothing styles or elements. Prioritize iconic elements from "Key Visual Features".
        5.  **Overall Demeanor/Impression:** (e.g., looks serious, friendly, mysterious, if inferable or stated in key features).

        The description should be a coherent paragraph. Emphasize visual details from "Key Visual Features" first, then infer from other profile info.
        Include a phrase like "Maintain these core visual features for character consistency." at the end.
        Output ONLY this detailed character description in ${selectedOutputLangLabel}.
        `;
    }
    
    try {
      const result = await generateText(userPrompt, systemInstruction, undefined, geminiApiKeyForService);
      if (isRefinement) {
          updateState({ 
              generatedBaseCharacterPrompt: result.text.trim(), 
              isLoadingRefinementForBasePrompt: false, 
              errorRefinementForBasePrompt: null,
              refinementInstructionForBasePrompt: '', // Clear instruction after successful refinement
          });
          
          // Track feature usage for refinement
          try {
            await featureUsageTracker.trackUsage(FEATURE_IDS.CHARACTER_STUDIO, 'Xưởng Nhân Vật');
          } catch (trackingError) {
            console.warn('Failed to track usage:', trackingError);
          }
      } else {
          updateState({ 
              generatedBaseCharacterPrompt: result.text.trim(), 
              isLoadingBasePrompt: false, 
              progressMessageBasePrompt: `Hoàn thành! Đã tạo Mô tả Nhân vật Cốt lõi.`, 
              errorBasePrompt: null 
          });
          
          // Track feature usage for base character creation
          try {
            await featureUsageTracker.trackUsage(FEATURE_IDS.CHARACTER_STUDIO, 'Xưởng Nhân Vật');
          } catch (trackingError) {
            console.warn('Failed to track usage:', trackingError);
          }
      }
    } catch (e) {
      if (isRefinement) {
          updateState({ 
              errorRefinementForBasePrompt: `Lỗi khi tinh chỉnh Mô tả Cốt lõi: ${(e as Error).message}`, 
              isLoadingRefinementForBasePrompt: false, 
          });
      } else {
          updateState({ 
              errorBasePrompt: `Lỗi khi tạo Mô tả Nhân vật Cốt lõi: ${(e as Error).message}`, 
              isLoadingBasePrompt: false, 
              progressMessageBasePrompt: 'Đã xảy ra lỗi.' 
          });
      }
    } finally {
        if (!isRefinement) {
            setTimeout(() => {
                setModuleState(prev => 
                    (prev.progressMessageBasePrompt?.includes("Hoàn thành") || prev.progressMessageBasePrompt?.includes("lỗi")) 
                    ? {...prev, progressMessageBasePrompt: null} 
                    : prev
                )
            }, 5000);
        }
    }
  };

  const handleGenerateCompleteImagePrompt = async () => {
    if (!generatedBaseCharacterPrompt.trim()) {
      updateState({ errorCompletePrompt: 'Vui lòng tạo hoặc tinh chỉnh "Mô tả Nhân vật Cốt lõi" trước (Bước 1).' });
      return;
    }
    if (!characterAction.trim()) {
      updateState({ errorCompletePrompt: 'Vui lòng nhập "Mô tả Hành động" của nhân vật.' });
      return;
    }
    updateState({ 
        isLoadingCompletePrompt: true, 
        errorCompletePrompt: null, 
        progressMessageCompletePrompt: 'Đang kết hợp mô tả nhân vật với hành động...', 
        generatedCompleteImagePrompt: '' 
    });

    const selectedActionInputLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === inputLanguage)?.label || inputLanguage; // Language of characterAction
    const selectedFinalOutputLangLabel = HOOK_LANGUAGE_OPTIONS.find(opt => opt.value === outputLanguage)?.label || outputLanguage; // Language of generatedBaseCharacterPrompt AND final prompt

    const systemInstruction = `You are an AI assistant that combines a base character description with a specific action/scene to create a complete and effective image generation prompt.`;
    
    const userPrompt = `
Base Character Description (already in ${selectedFinalOutputLangLabel}):
---
${generatedBaseCharacterPrompt.trim()}
---
Desired Action/Scene (this might be in ${selectedActionInputLangLabel} or other, AI should understand context and translate if necessary to ensure final prompt is in ${selectedFinalOutputLangLabel}):
---
${characterAction.trim()}
---

Combine the 'Base Character Description' with the 'Desired Action/Scene' to create a single, coherent, and detailed image generation prompt in ${selectedFinalOutputLangLabel}.
The final prompt should seamlessly integrate the character's appearance with the action they are performing and the environment they are in. Ensure the character's core visual traits from the base description are central.
If the action description implies a specific setting, mood, or artistic style, incorporate that into the final prompt in ${selectedFinalOutputLangLabel}.
You can add a few extra descriptive details to make the scene more vivid if appropriate, but the character's base description MUST BE RESPECTED.
Output ONLY the complete image prompt in ${selectedFinalOutputLangLabel}. Do not add any other text, introduction, or explanation.
`;

    try {
      const result = await generateText(userPrompt, systemInstruction, undefined, geminiApiKeyForService);
      updateState({ 
          generatedCompleteImagePrompt: result.text.trim(), 
          isLoadingCompletePrompt: false, 
          progressMessageCompletePrompt: `Hoàn thành! Prompt tạo ảnh hoàn chỉnh đã sẵn sàng.`, 
          errorCompletePrompt: null 
      });
      
      // Track feature usage for complete image prompt
      try {
        await featureUsageTracker.trackUsage(FEATURE_IDS.CHARACTER_STUDIO, 'Xưởng Nhân Vật');
      } catch (trackingError) {
        console.warn('Failed to track usage:', trackingError);
      }
    } catch (e) {
      updateState({ 
          errorCompletePrompt: `Lỗi khi tạo Prompt Ảnh Hoàn Chỉnh: ${(e as Error).message}`, 
          isLoadingCompletePrompt: false, 
          progressMessageCompletePrompt: 'Đã xảy ra lỗi.' 
      });
    } finally {
        setTimeout(() => {
            setModuleState(prev => 
                (prev.progressMessageCompletePrompt?.includes("Hoàn thành") || prev.progressMessageCompletePrompt?.includes("lỗi")) 
                ? {...prev, progressMessageCompletePrompt: null} 
                : prev
            )
        }, 5000);
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


  return (
    <ModuleContainer title="👤 Xưởng Nhân Vật AI (Tạo Prompt Đồng nhất)" badge="FREE">
      <InfoBox>
        <p className="font-semibold text-lg mb-2">🎯 Mục tiêu: Tạo Prompt Ảnh Đồng nhất Nhân vật</p>
        <p className="mb-1">Module này giúp bạn tạo ra một prompt ảnh hoàn chỉnh, kết hợp mô tả nhân vật chi tiết với hành động cụ thể, nhằm giữ sự nhất quán cho nhân vật khi tạo ảnh AI.</p>
        <p className="mb-1"><strong>Quy trình làm việc:</strong></p>
        <ol className="list-decimal list-inside ml-4 space-y-1 text-sm">
            <li><strong>Bước 1: Định nghĩa Nhân vật Cốt lõi.</strong>
                <ul className="list-disc list-inside ml-5 my-1">
                    <li>Nhập các thông tin cơ bản của nhân vật (Tên, Tuổi, Giới tính, Quốc gia, Nghề nghiệp).</li>
                    <li>Đặc biệt quan trọng: Mô tả "Đặc điểm Ngoại hình Nổi bật / Yêu cầu Cụ thể" để AI tập trung vào các chi tiết bạn muốn.</li>
                    <li>Nhấn "Tạo/Cập nhật Mô tả Nhân vật Cốt lõi".</li>
                    <li>Xem lại "Mô tả Nhân vật Cốt lõi" được tạo. Nếu chưa ưng ý, nhập "Yêu cầu Tinh Chỉnh Thêm..." và nhấn "Tinh Chỉnh Lại Mô tả Cốt lõi". Lặp lại đến khi hài lòng.</li>
                </ul>
            </li>
            <li><strong>Bước 2: Tạo Prompt Ảnh Hoàn Chỉnh.</strong>
                 <ul className="list-disc list-inside ml-5 my-1">
                    <li>Nhập "Mô tả Hành động / Bối cảnh / Phong cách Ảnh" bạn muốn nhân vật thực hiện.</li>
                    <li>AI sẽ tự động sử dụng "Mô tả Nhân vật Cốt lõi" mới nhất và ghép với hành động này.</li>
                    <li>Nhấn "Tạo Prompt Ảnh Hoàn Chỉnh".</li>
                </ul>
            </li>
        </ol>
        <p className="mt-2"><strong>Cách sử dụng:</strong> Sao chép "Prompt Ảnh Hoàn Chỉnh" và dán vào Xưởng Tạo Ảnh AI hoặc các công cụ tạo ảnh khác.</p>
         <p className="mt-1"><strong>Ngôn ngữ:</strong> Nên chọn "Ngôn ngữ Prompt Đầu ra" là Tiếng Anh cho cả hai bước để có kết quả tạo ảnh tốt nhất với các model AI hình ảnh.</p>
      </InfoBox>

      <div className="space-y-6 mt-6">
        {/* --- Inputs for Step 1 --- */}
        <fieldset className="p-4 border-2 border-blue-300 rounded-lg bg-blue-50 shadow-sm">
            <legend className="text-lg font-semibold text-blue-700 px-2">Bước 1: Định Nghĩa Nhân Vật Cốt Lõi</legend>
            <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 mt-2">
                <div>
                    <label htmlFor="csCharacterName" className="block text-sm font-medium text-gray-700 mb-1">Tên Nhân vật (Tùy chọn):</label>
                    <input type="text" id="csCharacterName" value={characterName} onChange={(e) => updateState({ characterName: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ví dụ: An, Kenji, Elena" disabled={isLoadingBasePrompt || isLoadingRefinementForBasePrompt || isLoadingCompletePrompt}/>
                </div>
                <div>
                    <label htmlFor="csCharacterAge" className="block text-sm font-medium text-gray-700 mb-1">Tuổi (Tùy chọn):</label>
                    <input type="text" id="csCharacterAge" value={characterAge} onChange={(e) => updateState({ characterAge: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ví dụ: 25, thiếu niên, trung niên" disabled={isLoadingBasePrompt || isLoadingRefinementForBasePrompt || isLoadingCompletePrompt}/>
                </div>
                 <div>
                    <label htmlFor="csCharacterGender" className="block text-sm font-medium text-gray-700 mb-1">Giới tính (Tùy chọn):</label>
                    <input type="text" id="csCharacterGender" value={characterGender} onChange={(e) => updateState({ characterGender: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ví dụ: Nam, Nữ, Phi giới tính" disabled={isLoadingBasePrompt || isLoadingRefinementForBasePrompt || isLoadingCompletePrompt}/>
                </div>
                <div>
                    <label htmlFor="csCharacterCountry" className="block text-sm font-medium text-gray-700 mb-1">Quốc gia / Nguồn gốc / Chủng tộc (Tùy chọn):</label>
                    <input type="text" id="csCharacterCountry" value={characterCountry} onChange={(e) => updateState({ characterCountry: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ví dụ: Việt Nam, Nhật Bản, Người Elf" disabled={isLoadingBasePrompt || isLoadingRefinementForBasePrompt || isLoadingCompletePrompt}/>
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="csCharacterProfession" className="block text-sm font-medium text-gray-700 mb-1">Nghề nghiệp / Vai trò (Tùy chọn):</label>
                    <input type="text" id="csCharacterProfession" value={characterProfession} onChange={(e) => updateState({ characterProfession: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ví dụ: Thám tử, Họa sĩ, Công chúa" disabled={isLoadingBasePrompt || isLoadingRefinementForBasePrompt || isLoadingCompletePrompt}/>
                </div>
                 <div className="md:col-span-2">
                    <label htmlFor="csCharacterKeyFeatures" className="block text-sm font-medium text-gray-700 mb-1">Đặc điểm Ngoại hình Nổi bật / Yêu cầu Cụ thể (QUAN TRỌNG):</label>
                    <textarea id="csCharacterKeyFeatures" value={characterKeyFeatures} onChange={(e) => updateState({ characterKeyFeatures: e.target.value })} rows={3} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ví dụ: Mắt màu xanh dương, tóc dài màu nâu hạt dẻ, có vết sẹo trên lông mày trái, luôn mặc áo khoác da màu đen..." disabled={isLoadingBasePrompt || isLoadingRefinementForBasePrompt || isLoadingCompletePrompt}></textarea>
                </div>
            </div>
             <div className="grid md:grid-cols-2 gap-6 mt-4">
                <div>
                    <label htmlFor="csInputLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ Mô tả Đầu vào:</label>
                    <select id="csInputLanguage" value={inputLanguage} onChange={(e) => updateState({ inputLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isLoadingBasePrompt || isLoadingRefinementForBasePrompt || isLoadingCompletePrompt}>
                    {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="csOutputLanguage" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ Prompt Đầu ra:</label>
                    <select id="csOutputLanguage" value={outputLanguage} onChange={(e) => updateState({ outputLanguage: e.target.value })} className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm" disabled={isLoadingBasePrompt || isLoadingRefinementForBasePrompt || isLoadingCompletePrompt}>
                    {HOOK_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Ưu tiên Tiếng Anh cho kết quả tạo ảnh tốt nhất.</p>
                </div>
            </div>
            <button
                onClick={() => handleGenerateOrRefineBaseCharacterPrompt(false)}
                disabled={isLoadingBasePrompt || isLoadingRefinementForBasePrompt || isLoadingCompletePrompt}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md transition-colors duration-150 disabled:opacity-50"
            >
                Tạo/Cập nhật Mô tả Nhân vật Cốt lõi
            </button>
            {isLoadingBasePrompt && progressMessageBasePrompt && <LoadingSpinner message={progressMessageBasePrompt} />}
            {!isLoadingBasePrompt && progressMessageBasePrompt && <p className={`text-center font-medium my-2 ${progressMessageBasePrompt.includes("Lỗi") ? 'text-red-600' : 'text-blue-600'}`}>{progressMessageBasePrompt}</p>}
            {errorBasePrompt && <ErrorAlert message={errorBasePrompt} />}
        </fieldset>

        {generatedBaseCharacterPrompt && !isLoadingBasePrompt && (
          <div className="mt-6 p-4 border-2 border-green-300 rounded-lg bg-green-50 shadow-sm">
            <h3 className="text-md font-semibold text-green-700 mb-1">
              Mô tả Nhân vật Cốt lõi Hiện tại (bằng {HOOK_LANGUAGE_OPTIONS.find(l => l.value === outputLanguage)?.label || outputLanguage}):
            </h3>
            <textarea
              value={generatedBaseCharacterPrompt}
              readOnly
              rows={6}
              className="w-full p-2 border border-gray-300 rounded-md bg-white whitespace-pre-wrap leading-relaxed"
              aria-label="Generated base character prompt"
            />
            <button 
                id="copyBasePromptBtn"
                onClick={() => copyToClipboard(generatedBaseCharacterPrompt, "copyBasePromptBtn")}
                className="mt-2 px-3 py-1 bg-teal-500 text-white text-xs rounded-lg hover:bg-teal-600"
                disabled={isLoadingRefinementForBasePrompt || isLoadingCompletePrompt}
            >
                📋 Sao chép Mô tả Cốt lõi
            </button>

            {/* Refinement section for Base Prompt */}
            <div className="mt-4 pt-3 border-t border-dashed border-green-400">
                <label htmlFor="csRefinementInstructionBase" className="block text-sm font-medium text-gray-700 mb-1">Yêu cầu Tinh Chỉnh Thêm cho Mô tả Cốt lõi:</label>
                <textarea 
                    id="csRefinementInstructionBase" 
                    value={refinementInstructionForBasePrompt} 
                    onChange={(e) => updateState({ refinementInstructionForBasePrompt: e.target.value, errorRefinementForBasePrompt: null })} 
                    rows={2} 
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm" 
                    placeholder="Ví dụ: Làm cho tóc xoăn hơn. Đổi màu mắt thành màu hổ phách."
                    disabled={isLoadingRefinementForBasePrompt || isLoadingCompletePrompt || isLoadingBasePrompt}
                />
                <button
                    onClick={() => handleGenerateOrRefineBaseCharacterPrompt(true)}
                    disabled={isLoadingRefinementForBasePrompt || isLoadingCompletePrompt || isLoadingBasePrompt || !refinementInstructionForBasePrompt.trim()}
                    className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 rounded-lg shadow-md transition-colors duration-150 disabled:opacity-50 text-sm"
                >
                    Tinh Chỉnh Lại Mô tả Cốt lõi
                </button>
                {isLoadingRefinementForBasePrompt && <LoadingSpinner message="Đang tinh chỉnh mô tả cốt lõi..." />}
                {errorRefinementForBasePrompt && <ErrorAlert message={errorRefinementForBasePrompt} />}
            </div>
          </div>
        )}

        {/* --- Inputs for Step 2 --- */}
        <fieldset className="mt-8 p-4 border-2 border-purple-300 rounded-lg bg-purple-50 shadow-sm" disabled={!generatedBaseCharacterPrompt.trim() || isLoadingBasePrompt || isLoadingRefinementForBasePrompt}>
            <legend className="text-lg font-semibold text-purple-700 px-2">Bước 2: Thêm Hành Động & Hoàn Tất Prompt Ảnh</legend>
            <div className="mt-2">
                {generatedBaseCharacterPrompt && (
                    <div className="mb-3 p-2 border border-purple-200 rounded-md bg-purple-100">
                        <p className="text-xs text-purple-700"><strong>Sử dụng Mô tả Cốt lõi (đã tinh chỉnh nếu có):</strong> "{generatedBaseCharacterPrompt.substring(0, 100)}..."</p>
                    </div>
                )}
                <label htmlFor="csCharacterAction" className="block text-sm font-medium text-gray-700 mb-1">
                    Mô tả Hành động / Bối cảnh / Phong cách Ảnh (*):
                </label>
                <textarea
                    id="csCharacterAction"
                    value={characterAction}
                    onChange={(e) => updateState({ characterAction: e.target.value })}
                    rows={4}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                    placeholder="Ví dụ: đang đi dạo trong một khu rừng ma thuật vào ban đêm, phong cách digital art, ánh sáng huyền ảo. Hoặc: ảnh chân dung cận mặt, biểu cảm nghiêm nghị, phông nền tối giản."
                    disabled={!generatedBaseCharacterPrompt.trim() || isLoadingCompletePrompt || isLoadingBasePrompt || isLoadingRefinementForBasePrompt}
                />
            </div>
            <button
                onClick={handleGenerateCompleteImagePrompt}
                disabled={!generatedBaseCharacterPrompt.trim() || !characterAction.trim() || isLoadingCompletePrompt || isLoadingBasePrompt || isLoadingRefinementForBasePrompt}
                className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md transition-colors duration-150 disabled:opacity-50"
            >
                Tạo Prompt Ảnh Hoàn Chỉnh
            </button>
            {isLoadingCompletePrompt && progressMessageCompletePrompt && <LoadingSpinner message={progressMessageCompletePrompt} />}
            {!isLoadingCompletePrompt && progressMessageCompletePrompt && <p className={`text-center font-medium my-2 ${progressMessageCompletePrompt.includes("Lỗi") ? 'text-red-600' : 'text-purple-600'}`}>{progressMessageCompletePrompt}</p>}
            {errorCompletePrompt && <ErrorAlert message={errorCompletePrompt} />}
        </fieldset>

        {generatedCompleteImagePrompt && !isLoadingCompletePrompt && (
          <div className="mt-8 p-6 border-2 border-teal-500 rounded-xl bg-teal-50 shadow-lg">
            <h3 className="text-xl font-bold text-teal-700 mb-4">
              🚀 Prompt Ảnh Hoàn Chỉnh (bằng {HOOK_LANGUAGE_OPTIONS.find(l => l.value === outputLanguage)?.label || outputLanguage}):
            </h3>
            <textarea
              value={generatedCompleteImagePrompt}
              readOnly
              rows={Math.min(15, generatedCompleteImagePrompt.split('\n').length + 3)}
              className="w-full p-3 border-2 border-gray-200 rounded-md bg-white whitespace-pre-wrap leading-relaxed"
              aria-label="Generated complete image prompt"
            />
             <button 
                id="copyCompletePromptBtn"
                onClick={() => copyToClipboard(generatedCompleteImagePrompt, "copyCompletePromptBtn")}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-150"
            >
                📋 Sao chép Prompt Hoàn Chỉnh
            </button>
          </div>
        )}
      </div>
    </ModuleContainer>
  );
};

export default CharacterStudioModule;
