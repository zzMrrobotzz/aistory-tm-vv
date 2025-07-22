import React, { useState, useCallback } from 'react';
import { ApiSettings, TranslateModuleState, UserProfile } from '../../types';
import { TRANSLATE_LANGUAGE_OPTIONS, TRANSLATE_STYLE_OPTIONS } from '../../constants';
import { generateText } from '../../services/textGenerationService';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { Clipboard, ClipboardCheck, Languages, ArrowRightLeft } from 'lucide-react';
import UpgradePrompt from '../UpgradePrompt';
import { isSubscribed } from '../../utils';

interface TranslateModuleProps {
  apiSettings: ApiSettings;
  moduleState: TranslateModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<TranslateModuleState>>;
  currentUser: UserProfile | null;
}

const TranslateModule: React.FC<TranslateModuleProps> = ({ 
    apiSettings, moduleState, setModuleState, currentUser 
}) => {
    const hasActiveSubscription = isSubscribed(currentUser);
    const {
        inputText, outputText, targetLanguage, translationStyle,
        customStyle, isLoading, error
    } = moduleState;

    const [isCopied, setIsCopied] = useState(false);

    const updateState = (updates: Partial<TranslateModuleState>) => {
        setModuleState(prev => ({ ...prev, ...updates }));
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            updateState({ inputText: text });
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
            updateState({ error: 'Không thể dán từ clipboard. Vui lòng cấp quyền cho trang web.' });
        }
    };

    const handleCopy = () => {
        if (!outputText) return;
        navigator.clipboard.writeText(outputText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleTranslation = async () => {
        if (!inputText.trim()) {
            updateState({ error: 'Vui lòng nhập văn bản cần dịch.' });
            return;
        }

        updateState({ isLoading: true, error: null, outputText: 'Đang dịch...' });

        try {
            let styleInstruction = '';
            if (customStyle.trim()) {
                styleInstruction = ` in the style of "${customStyle.trim()}"`;
            } else if (translationStyle !== 'Default') {
                const styleLabel = TRANSLATE_STYLE_OPTIONS.find(opt => opt.value === translationStyle)?.label || translationStyle;
                styleInstruction = ` with a ${styleLabel.toLowerCase()} tone`;
            }

            const prompt = `Translate the following text to ${targetLanguage}${styleInstruction}. Provide only the translated text, without any additional explanations or context.\n\nText to translate:\n"""\n${inputText.trim()}\n"""`;

            const result = await generateText(prompt, undefined, false, apiSettings);
            updateState({ outputText: result.text.trim() });
        } catch (e) {
            console.error("Translation Error:", e);
            updateState({ error: `Đã xảy ra lỗi: ${(e as Error).message}`, outputText: 'Dịch lỗi. Vui lòng thử lại.' });
        } finally {
            updateState({ isLoading: false });
        }
    };

    return (
        <ModuleContainer title="🌐 Dịch Thuật AI">
            {!hasActiveSubscription && <UpgradePrompt />}
            <InfoBox>
                Dịch thuật nhanh chóng và chính xác với sức mạnh từ AI. Chỉ cần nhập văn bản, chọn ngôn ngữ đích, phong cách dịch và để AI làm phần còn lại.
            </InfoBox>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* Input Column */}
                <div className="flex flex-col">
                    <label htmlFor="inputText" className="mb-2 font-semibold text-gray-700">Văn bản gốc</label>
                    <div className="relative flex-grow">
                        <textarea
                            id="inputText"
                            value={inputText}
                            onChange={e => updateState({ inputText: e.target.value })}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleTranslation();
                                }
                            }}
                            rows={10}
                            className="w-full h-full p-4 pr-12 border-2 border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-300 resize-y"
                            placeholder="Nhập văn bản cần dịch..."
                            disabled={isLoading}
                        />
                        <button onClick={handlePaste} className="absolute bottom-3 right-3 bg-gray-600 text-white p-2 rounded-full hover:bg-gray-800 transition-colors" title="Dán từ clipboard">
                            <Clipboard size={16} />
                        </button>
                    </div>
                </div>

                {/* Output Column */}
                <div className="flex flex-col">
                    <label htmlFor="outputText" className="mb-2 font-semibold text-gray-700">Văn bản đã dịch</label>
                    <div className="relative flex-grow">
                        <textarea
                            id="outputText"
                            value={outputText}
                            readOnly
                            rows={10}
                            className="w-full h-full p-4 pr-12 border-2 border-gray-300 rounded-xl bg-gray-100 transition duration-300 resize-y"
                            placeholder="Kết quả dịch sẽ xuất hiện ở đây..."
                        />
                        <button onClick={handleCopy} className="absolute bottom-3 right-3 bg-gray-600 text-white p-2 rounded-full hover:bg-gray-800 transition-colors" title="Sao chép kết quả">
                            {isCopied ? <ClipboardCheck size={16} className="text-green-400" /> : <Clipboard size={16} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="mt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="languageSelect" className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ đích</label>
                        <select
                            id="languageSelect"
                            value={targetLanguage}
                            onChange={e => updateState({ targetLanguage: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-300"
                            disabled={isLoading}
                        >
                            {TRANSLATE_LANGUAGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="styleSelect" className="block text-sm font-medium text-gray-700 mb-1">Phong cách dịch</label>
                        <select
                            id="styleSelect"
                            value={translationStyle}
                            onChange={e => updateState({ translationStyle: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-300"
                            disabled={isLoading}
                        >
                            {TRANSLATE_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label htmlFor="customStyleInput" className="block text-sm font-medium text-gray-700 mb-1">Hoặc nhập phong cách tùy chỉnh</label>
                        <input
                            id="customStyleInput"
                            type="text"
                            value={customStyle}
                            onChange={e => updateState({ customStyle: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-300"
                            placeholder="Ví dụ: 'như một nhà thơ', 'cho trẻ em 5 tuổi'..."
                            disabled={isLoading}
                        />
                    </div>
                    <button
                        id="translateButton"
                        onClick={handleTranslation}
                        disabled={!hasActiveSubscription || isLoading || !inputText.trim()}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg flex items-center justify-center transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <LoadingSpinner message="Đang dịch" noMargins={true} />
                        ) : (
                            <>
                                <Languages className="mr-2 h-5 w-5" />
                                <span>Dịch</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && <ErrorAlert message={error} />}
        </ModuleContainer>
    );
};

export default TranslateModule;
