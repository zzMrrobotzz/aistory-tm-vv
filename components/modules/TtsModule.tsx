import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ApiSettings, GoogleCloudVoice, TtsModuleState, TtsProvider, AmazonPollyVoice, SubtitleLine, BrowserSpeechVoice, OpenAiTtsVoice, ElevenLabsApiKey, ElevenLabsVoice, UserProfile } from '../../types';
import { OPENAI_TTS_MODELS, OPENAI_TTS_VOICES, ELEVENLABS_MODELS } from '../../constants';
import ModuleContainer from '../ModuleContainer';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import InfoBox from '../InfoBox';
import { fetchGoogleCloudVoices, generateGoogleCloudSpeech } from '@/services/googleCloudTtsService';
import { fetchAmazonPollyVoices, generateAmazonPollySpeech } from '@/services/amazonPollyService';
import { generateOpenAiSpeech } from '../../services/openaiService';
import { fetchElevenLabsUser, fetchElevenLabsVoices, generateElevenLabsSpeech } from '../../services/elevenLabsService';
import { delay, isSubscribed } from '../../utils';
import { FileDown, Square, Trash2, Settings, RefreshCw, CheckCircle, Download, Copy, Loader2, ClipboardCheck, AlertTriangle, Key, Save, CheckCircle2, XCircle } from 'lucide-react';
import UpgradePrompt from '../UpgradePrompt';


interface TtsModuleProps {
  apiSettings: ApiSettings; 
  moduleState: TtsModuleState;
  setModuleState: React.Dispatch<React.SetStateAction<TtsModuleState>>;
  currentUser: UserProfile | null;
}

function isBrowserSpeechVoice(voice: any): voice is BrowserSpeechVoice { return voice && typeof voice.voiceURI === 'string' && typeof voice.lang === 'string'; }
function isOpenAiTtsVoice(voice: any): voice is OpenAiTtsVoice { return voice && typeof voice.id === 'string' && typeof voice.name === 'string' && !(voice as any).voice_id && !(voice as any).voiceURI; }
function isElevenLabsVoice(voice: any): voice is ElevenLabsVoice { return voice && typeof voice.voice_id === 'string'; }

const TtsModule: React.FC<TtsModuleProps> = ({ 
  moduleState, setModuleState, currentUser
}) => {
  const hasActiveSubscription = isSubscribed(currentUser);
  const {
    selectedProvider, googleCloudApiKey, amazonAccessKeyId, amazonSecretAccessKey, amazonRegion,
    chatGptApiKey, elevenLabsApiKeys, modelId, subtitleLines, voices, selectedVoiceId,
    error, loadingMessage, isProcessing, concurrencyLimit,
    mainText, sentencesPerChunk, outputFilename
  } = moduleState;

  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isFetchingVoices, setIsFetchingVoices] = useState(false);
  const voiceFetchController = useRef<AbortController | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [copiedLineId, setCopiedLineId] = useState<string | null>(null);
  const [apiKeysInput, setApiKeysInput] = useState(elevenLabsApiKeys.map(k => k.key).join('\n'));
  const [isCheckingKeys, setIsCheckingKeys] = useState(false);

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    return () => {
      subtitleLines.forEach(line => {
        if(line.outputUrl) URL.revokeObjectURL(line.outputUrl);
      });
      if (voiceFetchController.current) voiceFetchController.current.abort();
      if (typeof window !== 'undefined' && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = '';
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const filteredVoices = useMemo(() => {
    return voices;
  }, [voices]);

  const copyToClipboard = (text: string, lineId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        setCopiedLineId(lineId);
        setTimeout(() => {
            setCopiedLineId(null);
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        updateState({ error: 'Không thể sao chép văn bản.' });
    });
  };

  const updateState = (updates: Partial<TtsModuleState>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  };

  const updateLineStatus = (index: number, status: SubtitleLine['status'], data?: Partial<Omit<SubtitleLine, 'id'|'text'|'status'>>) => {
      setModuleState(prev => {
          const newLines = [...prev.subtitleLines];
          if(newLines[index]) newLines[index] = { ...newLines[index], status, ...data };
          return { ...prev, subtitleLines: newLines };
      });
  };

  const loadBrowserVoices = (): Promise<BrowserSpeechVoice[]> => {
    return new Promise((resolve) => {
        let browserVoices = window.speechSynthesis.getVoices();
        if (browserVoices.length > 0) {
            resolve(browserVoices.map(v => ({ name: v.name, lang: v.lang, localService: v.localService, voiceURI: v.voiceURI, default: v.default } as BrowserSpeechVoice)));
            return;
        }
        window.speechSynthesis.onvoiceschanged = () => {
            browserVoices = window.speechSynthesis.getVoices();
            resolve(browserVoices.map(v => ({ name: v.name, lang: v.lang, localService: v.localService, voiceURI: v.voiceURI, default: v.default } as BrowserSpeechVoice)));
        };
    });
  };

  const handleFetchVoices = useCallback(async () => {
    if (isFetchingVoices) return;
    if (voiceFetchController.current) { voiceFetchController.current.abort(); }

    const controller = new AbortController();
    voiceFetchController.current = controller;
    const signal = controller.signal;

    setIsFetchingVoices(true);
    updateState({ loadingMessage: 'Đang tải danh sách giọng đọc...', error: null, voices: [] });

    try {
        let fetchedVoices: any[] = [];
        if (selectedProvider === 'browser') {
            fetchedVoices = await loadBrowserVoices();
        } else if (selectedProvider === 'openai') {
            fetchedVoices = OPENAI_TTS_VOICES;
        } else if (selectedProvider === 'google') {
            if (!googleCloudApiKey) throw new Error("Vui lòng nhập Google Cloud API Key.");
            fetchedVoices = await fetchGoogleCloudVoices(googleCloudApiKey, signal);
        } else if (selectedProvider === 'amazon') {
            if (!amazonAccessKeyId || !amazonSecretAccessKey) throw new Error("Vui lòng nhập đầy đủ thông tin xác thực của Amazon Polly.");
            fetchedVoices = await fetchAmazonPollyVoices({ accessKeyId: amazonAccessKeyId, secretAccessKey: amazonSecretAccessKey, region: amazonRegion }, signal);
        } else if (selectedProvider === 'elevenlabs') {
            const firstValidKey = elevenLabsApiKeys.find(k => k.status === 'valid');
            if (!firstValidKey) throw new Error("Vui lòng thêm và xác thực ít nhất một API Key hợp lệ của ElevenLabs.");
            fetchedVoices = await fetchElevenLabsVoices(firstValidKey.key, signal);
        }

        if (signal.aborted) {
            updateState({ error: 'Tải giọng đọc đã bị hủy.' });
            return;
        }
        
        let defaultVoiceId = '';
        if (fetchedVoices.length > 0) {
            const firstVoice = fetchedVoices[0];
            if (isOpenAiTtsVoice(firstVoice)) defaultVoiceId = firstVoice.id;
            else if (isElevenLabsVoice(firstVoice)) defaultVoiceId = firstVoice.voice_id;
            else defaultVoiceId = (firstVoice as any).name || (firstVoice as any).Id;
        }
        updateState({ voices: fetchedVoices, selectedVoiceId: defaultVoiceId });
    } catch (err) {
        if ((err as Error).name !== 'AbortError') {
            updateState({ error: (err as Error).message });
        }
    } finally {
        setIsFetchingVoices(false);
        updateState({ loadingMessage: null });
        voiceFetchController.current = null;
    }
}, [selectedProvider, googleCloudApiKey, amazonAccessKeyId, amazonSecretAccessKey, amazonRegion, isFetchingVoices, elevenLabsApiKeys]);

    const handleCheckApiKeys = async () => {
        const keys = apiKeysInput.split('\n').map(k => k.trim()).filter(Boolean);
        if (keys.length === 0) {
            updateState({ elevenLabsApiKeys: [] });
            return;
        }

        setIsCheckingKeys(true);
        updateState({ error: null });

        const initialKeyStates: ElevenLabsApiKey[] = keys.map(key => ({ key, status: 'checking' }));
        updateState({ elevenLabsApiKeys: initialKeyStates });

        const results = await Promise.allSettled(
            keys.map(key => fetchElevenLabsUser(key))
        );

        const finalKeyStates = results.map((result, index) => {
            if (result.status === 'fulfilled') {
                const userData = result.value;
                return {
                    key: keys[index],
                    status: 'valid' as const,
                    credits: userData.subscription.character_limit - userData.subscription.character_count,
                    creditLimit: userData.subscription.character_limit,
                };
            } else {
                return {
                    key: keys[index],
                    status: 'invalid' as const,
                    error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
                };
            }
        });

        updateState({ elevenLabsApiKeys: finalKeyStates });
        setIsCheckingKeys(false);
    };

    const handleSplitText = () => {
        if (!mainText.trim()) {
            updateState({ error: "Vui lòng nhập văn bản chính." });
            return;
        }
        
        const sentences = mainText.trim().split(/(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|!)\s+/g);
        
        let chunks: string[] = [];
        for (let i = 0; i < sentences.length; i += sentencesPerChunk) {
            chunks.push(sentences.slice(i, i + sentencesPerChunk).join(' ').trim());
        }

        const lines: SubtitleLine[] = chunks.map((chunk, index) => ({
            id: `${Date.now()}-${index}`,
            text: chunk,
            status: 'pending',
        }));

        updateState({ subtitleLines: lines, error: null });
    };

    const handleProcessAll = async () => {
        const controller = new AbortController();
        setAbortController(controller);
        updateState({ isProcessing: true, error: null });

        const processQueue = subtitleLines.map((line, index) => ({...line, originalIndex: index}))
            .filter(line => line.status === 'pending' || line.status === 'error');
        
        const validElevenLabsKeys = elevenLabsApiKeys.filter(k => k.status === 'valid');
            
        const worker = async () => {
            while(processQueue.length > 0) {
                const lineToProcess = processQueue.shift();
                if (!lineToProcess) continue;
                
                if (controller.signal.aborted) {
                    updateLineStatus(lineToProcess.originalIndex, 'canceled');
                    continue;
                }

                updateLineStatus(lineToProcess.originalIndex, 'processing');
                
                try {
                    let audioBlob: Blob | null = null;
                    let voiceUsedDisplay = 'N/A';
                    
                    if (selectedProvider === 'google') {
                        if (!googleCloudApiKey) throw new Error("Google Cloud API Key is missing.");
                        audioBlob = await generateGoogleCloudSpeech(googleCloudApiKey, lineToProcess.text, selectedVoiceId, controller.signal);
                    } else if (selectedProvider === 'amazon') {
                         if (!amazonAccessKeyId || !amazonSecretAccessKey) throw new Error("Amazon Polly credentials are missing.");
                        audioBlob = await generateAmazonPollySpeech({ accessKeyId: amazonAccessKeyId, secretAccessKey: amazonSecretAccessKey, region: amazonRegion }, lineToProcess.text, selectedVoiceId, controller.signal);
                    } else if (selectedProvider === 'openai') {
                        if (!chatGptApiKey) throw new Error("OpenAI API Key is missing.");
                        audioBlob = await generateOpenAiSpeech(chatGptApiKey, lineToProcess.text, selectedVoiceId, modelId, controller.signal);
                    } else if (selectedProvider === 'elevenlabs') {
                        if (validElevenLabsKeys.length === 0) throw new Error("No valid ElevenLabs API keys available.");
                        const keyToUse = validElevenLabsKeys[lineToProcess.originalIndex % validElevenLabsKeys.length];
                        audioBlob = await generateElevenLabsSpeech(keyToUse.key, lineToProcess.text, selectedVoiceId, modelId, controller.signal);
                        voiceUsedDisplay = `Key ...${keyToUse.key.slice(-4)}`;
                    }
                    else if (selectedProvider === 'browser') {
                        if(window.speechSynthesis.speaking) window.speechSynthesis.cancel();
                        const utterance = new SpeechSynthesisUtterance(lineToProcess.text);
                        const voice = voices.find(v => isBrowserSpeechVoice(v) && v.name === selectedVoiceId);
                        if (voice) utterance.voice = voice as SpeechSynthesisVoice;
                        
                         window.speechSynthesis.speak(utterance);
                         await new Promise<void>(resolve => {
                            utterance.onend = () => resolve();
                            utterance.onerror = () => resolve();
                         });
                         audioBlob = null;
                    }
                    
                     if (controller.signal.aborted) {
                        updateLineStatus(lineToProcess.originalIndex, 'canceled');
                        continue;
                    }
                    
                    updateLineStatus(lineToProcess.originalIndex, 'done', {
                        outputUrl: audioBlob ? URL.createObjectURL(audioBlob) : undefined,
                        outputBlob: audioBlob || undefined,
                        error: undefined,
                        voiceUsed: voiceUsedDisplay,
                    });

                } catch (e: any) {
                    if (e.name !== 'AbortError') {
                       updateLineStatus(lineToProcess.originalIndex, 'error', { error: e.message });
                    } else {
                       updateLineStatus(lineToProcess.originalIndex, 'canceled');
                    }
                }
            }
        };

        const workers = Array(concurrencyLimit).fill(null).map(worker);
        await Promise.all(workers);

        updateState({ isProcessing: false });
        setAbortController(null);
    };

    const handleCancelProcessing = () => {
        if (abortController) {
            abortController.abort();
        }
    };
    
    const handleMergeAndDownload = () => alert("Chức năng hợp nhất và tải xuống tất cả sẽ được triển khai sau.");
    const handleDownloadSrt = () => alert("Chức năng tạo và tải file .srt sẽ được triển khai sau.");
    
    const handlePlaySingle = (url?: string, text?: string) => {
      if(selectedProvider === 'browser' && text) {
        if(window.speechSynthesis.speaking) window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = voices.find(v => isBrowserSpeechVoice(v) && v.name === selectedVoiceId);
        if (voice) utterance.voice = voice as SpeechSynthesisVoice;
        window.speechSynthesis.speak(utterance);
      } else if(url && audioPlayerRef.current) {
        if (!audioPlayerRef.current.paused) {
            audioPlayerRef.current.pause();
        }
        audioPlayerRef.current.src = url;
        audioPlayerRef.current.play().catch(e => updateState({error: `Lỗi phát audio: ${e.message}`}));
      }
    };

    const handleDownloadSingle = (url?: string, index?: number) => {
      if(!url) {
        updateState({error: "Không có audio để tải xuống cho dòng này."});
        return;
      }
      const link = document.createElement('a');
      link.href = url;
      link.download = `${outputFilename}_${index !== undefined ? index + 1 : 'file'}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const handleReset = () => {
        subtitleLines.forEach(line => {
            if (line.outputUrl) URL.revokeObjectURL(line.outputUrl);
        });
        updateState({ subtitleLines: [], mainText: '', error: null, loadingMessage: null });
        if(typeof window !== 'undefined' && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    };

    const totalCredits = useMemo(() => {
        return elevenLabsApiKeys.reduce((total, key) => {
            if (key.status === 'valid' && typeof key.credits === 'number') {
                return total + key.credits;
            }
            return total;
        }, 0);
    }, [elevenLabsApiKeys]);

    return (
        <ModuleContainer title="🎙️ Đọc Truyện AI (TTS)">
            {!hasActiveSubscription && <UpgradePrompt />}
            <InfoBox>
                <p>Chuyển đổi văn bản thành giọng nói chất lượng cao. Hỗ trợ nhiều nhà cung cấp AI.</p>
                <p className="mt-2 text-blue-800 bg-blue-100 p-2 rounded-md text-sm">
                    <AlertTriangle className="inline-block h-4 w-4 mr-1"/>
                    <strong>Mới:</strong> Hỗ trợ ElevenLabs với nhiều API key. Nhập các key của bạn vào ô bên dưới, sau đó "Kiểm Tra & Lưu" để xem tổng số credit và bắt đầu sử dụng.
                </p>
            </InfoBox>

            <audio ref={audioPlayerRef} style={{ display: 'none' }} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <div className="p-4 border rounded-lg bg-white shadow-sm">
                        <h3 className="font-semibold text-gray-700 mb-2">1. Nhà cung cấp & Giọng đọc</h3>
                        <select
                            value={selectedProvider}
                            onChange={(e) => {
                                const newProvider = e.target.value as TtsProvider;
                                let newModelId = modelId;
                                if (newProvider === 'openai') newModelId = OPENAI_TTS_MODELS[0].id;
                                if (newProvider === 'elevenlabs') newModelId = ELEVENLABS_MODELS[0].id;
                                updateState({ selectedProvider: newProvider, voices: [], selectedVoiceId: '', modelId: newModelId });
                            }}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            disabled={isProcessing}
                        >
                            <option value="elevenlabs">ElevenLabs</option>
                            <option value="openai">OpenAI</option>
                            <option value="google">Google Cloud TTS</option>
                            <option value="amazon">Amazon Polly</option>
                            <option value="browser">Trình duyệt (Miễn phí)</option>
                        </select>
                        
                         <div className="flex gap-2 mt-4">
                            <select
                                value={selectedVoiceId}
                                onChange={e => updateState({ selectedVoiceId: e.target.value })}
                                className="w-full p-2 border border-gray-300 rounded-md"
                                disabled={isProcessing || isFetchingVoices || (selectedProvider !== 'browser' && voices.length === 0)}
                            >
                                 <option value="">{isFetchingVoices ? "Đang tải..." : (voices.length === 0 ? "Nhấn 'Tải Giọng'" : (filteredVoices.length === 0 ? "Không tìm thấy" : "-- Chọn Giọng --"))}</option>
                                {filteredVoices.map((v: any) => {
                                    let voiceId, name, label;
                                    if (isOpenAiTtsVoice(v)) { voiceId = v.id; name = v.name; label = name; } 
                                    else if (isBrowserSpeechVoice(v)) { voiceId = v.name; name = v.name; label = `${name} (${v.lang})`;} 
                                    else if (isElevenLabsVoice(v)) { voiceId = v.voice_id; name = v.name; label = name; }
                                    else { voiceId = v.name || v.Id; name = v.name || v.Id; label = name; }
                                    return <option key={voiceId} value={voiceId}>{label}</option>
                                })}
                            </select>
                             <button onClick={() => handleFetchVoices()} disabled={!hasActiveSubscription || isFetchingVoices || isProcessing} className="px-3 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 disabled:bg-gray-400">
                                {isFetchingVoices ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
                            </button>
                        </div>
                    </div>
                    {selectedProvider === 'elevenlabs' && (
                        <div className="p-4 border rounded-lg bg-white shadow-sm space-y-3">
                            <h3 className="font-semibold text-gray-700">Cài đặt ElevenLabs (Nhiều API)</h3>
                             <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                                <p className="text-sm text-blue-700">Tổng số ký tự còn lại:</p>
                                <p className="text-2xl font-bold text-blue-800">{isCheckingKeys ? '...' : totalCredits.toLocaleString()}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Nhập danh sách API Keys (mỗi key một dòng):</label>
                                <textarea 
                                    value={apiKeysInput}
                                    onChange={e => setApiKeysInput(e.target.value)}
                                    rows={4}
                                    className="w-full mt-1 p-2 border border-gray-300 rounded-md font-mono text-xs"
                                    placeholder="dán key 1...&#10;dán key 2...&#10;dán key 3..."
                                    disabled={isProcessing || isCheckingKeys}
                                />
                            </div>
                            <button onClick={handleCheckApiKeys} disabled={!hasActiveSubscription || isCheckingKeys || isProcessing} className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                                {isCheckingKeys ? <><Loader2 className="animate-spin mr-2" size={16}/> Đang kiểm tra...</> : <><Key className="mr-2" size={16}/> Kiểm Tra & Lưu API Keys</>}
                            </button>
                             <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                {elevenLabsApiKeys.map((k, i) => (
                                    <div key={i} className="text-xs p-2 border rounded-md flex justify-between items-center">
                                        <span className="font-mono text-gray-500">...{k.key.slice(-4)}</span>
                                        {k.status === 'checking' && <span className="text-blue-500">Đang check...</span>}
                                        {k.status === 'valid' && <span className="text-green-600 flex items-center"><CheckCircle2 size={12} className="mr-1"/>{k.credits?.toLocaleString()} credits</span>}
                                        {k.status === 'invalid' && <span className="text-red-500 flex items-center" title={k.error}><XCircle size={12} className="mr-1"/>Invalid</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                     {selectedProvider === 'openai' && (
                        <div className="p-4 border rounded-lg bg-white shadow-sm"><h3 className="font-semibold text-gray-700 mb-2">Cài đặt OpenAI</h3><input type="password" value={chatGptApiKey} onChange={e => updateState({ chatGptApiKey: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Dán OpenAI API Key" disabled={isProcessing}/><p className="text-xs text-gray-500 mt-1">Key này cũng có thể được dùng cho DALL-E trong Xưởng Ảnh.</p></div>
                    )}
                     {selectedProvider === 'google' && (
                        <div className="p-4 border rounded-lg bg-white shadow-sm"><h3 className="font-semibold text-gray-700 mb-2">Cài đặt Google Cloud</h3><input type="password" value={googleCloudApiKey} onChange={e => updateState({ googleCloudApiKey: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Dán Google Cloud API Key" disabled={isProcessing}/></div>
                    )}
                     {selectedProvider === 'amazon' && (
                        <div className="p-4 border rounded-lg bg-white shadow-sm space-y-2"><h3 className="font-semibold text-gray-700 mb-2">Cài đặt Amazon Polly</h3><input type="text" value={amazonRegion} onChange={e => updateState({ amazonRegion: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="AWS Region (e.g., us-east-1)" disabled={isProcessing}/><input type="password" value={amazonAccessKeyId} onChange={e => updateState({ amazonAccessKeyId: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Access Key ID" disabled={isProcessing}/><input type="password" value={amazonSecretAccessKey} onChange={e => updateState({ amazonSecretAccessKey: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Secret Access Key" disabled={isProcessing}/></div>
                    )}
                     <div className="p-4 border rounded-lg bg-white shadow-sm">
                         <button onClick={() => setShowSettings(!showSettings)} className="font-semibold text-gray-700 w-full text-left flex justify-between items-center">
                            <span>2. Cài đặt Nâng cao</span>
                            <Settings size={16} className={`transition-transform duration-300 ${showSettings ? 'rotate-90' : ''}`}/>
                         </button>
                         {showSettings && (
                             <div className="mt-4 pt-4 border-t space-y-2 animate-fadeIn">
                                 {selectedProvider === 'openai' && (
                                     <div><label className="text-sm font-medium">Model (OpenAI):</label><select value={modelId} onChange={e => updateState({ modelId: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" disabled={isProcessing}>{OPENAI_TTS_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                                 )}
                                  {selectedProvider === 'elevenlabs' && (
                                     <div><label className="text-sm font-medium">Model (ElevenLabs):</label><select value={modelId} onChange={e => updateState({ modelId: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" disabled={isProcessing}>{ELEVENLABS_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                                 )}
                                 <div><label className="text-sm font-medium">Số câu mỗi đoạn:</label><input type="number" min="1" value={sentencesPerChunk} onChange={e => updateState({ sentencesPerChunk: parseInt(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-md"/></div>
                                 <div><label className="text-sm font-medium">Tên file đầu ra:</label><input type="text" value={outputFilename} onChange={e => updateState({ outputFilename: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md"/></div>
                             </div>
                         )}
                     </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="p-4 border rounded-lg bg-white shadow-sm">
                         <h3 className="font-semibold text-gray-700 mb-2">3. Nhập và Phân Đoạn Văn Bản</h3>
                        <textarea value={mainText} onChange={e => updateState({ mainText: e.target.value })} rows={8} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Dán hoặc nhập văn bản của bạn vào đây..." disabled={isProcessing}/>
                         <div className="mt-4 flex flex-col sm:flex-row gap-4">
                            <button onClick={handleSplitText} disabled={!hasActiveSubscription || isProcessing || !mainText.trim()} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400">Phân đoạn Văn bản</button>
                             <button onClick={handleProcessAll} disabled={!hasActiveSubscription || isProcessing || subtitleLines.filter(l=>l.status !== 'done').length === 0} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400">Bắt đầu Tạo Audio</button>
                             {isProcessing && (<button onClick={handleCancelProcessing} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"><Square size={16}/></button>)}
                         </div>
                    </div>
                     <div className="p-4 border rounded-lg bg-white shadow-sm">
                         <h3 className="font-semibold text-gray-700 mb-2">4. Kết quả ({subtitleLines.length} đoạn)</h3>
                         {isProcessing && <div className="text-sm text-indigo-600 animate-pulse flex items-center"><Loader2 size={16} className="animate-spin mr-2"/>Đang xử lý...</div>}
                         {error && <ErrorAlert message={error}/>}
                         <div className="max-h-96 overflow-y-auto pr-2">
                             <table className="w-full text-sm text-left">
                                 <thead className="sticky top-0 bg-gray-100">
                                     <tr>
                                         <th className="p-2 w-1/12">#</th>
                                         <th className="p-2 w-7/12">Nội dung</th>
                                         <th className="p-2 w-4/12 text-center">Hành động</th>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     {subtitleLines.map((line, index) => (
                                         <tr key={line.id} className="border-b hover:bg-gray-50">
                                             <td className="p-2 align-top">{index + 1}</td>
                                             <td className="p-2 align-top break-words">{line.text}</td>
                                             <td className="p-2 align-top">
                                                 <div className="flex flex-col items-center justify-center h-full space-y-2">
                                                     {line.status === 'pending' && <span className="text-xs text-gray-500">Sẵn sàng</span>}
                                                     {line.status === 'processing' && <span className="text-xs text-blue-500 animate-pulse">Đang tạo...</span>}
                                                     {line.status === 'error' && <span className="text-xs text-red-500" title={line.error}>Lỗi</span>}
                                                     {line.status === 'canceled' && <span className="text-xs text-yellow-500">Đã hủy</span>}
                                                     {line.status === 'done' && (
                                                         <div className="flex flex-col items-center space-y-1">
                                                            <div className="flex space-x-2">
                                                                <button onClick={() => handlePlaySingle(line.outputUrl, line.text)} className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200" title="Phát"><CheckCircle size={16}/></button>
                                                                {line.outputUrl && <button onClick={() => handleDownloadSingle(line.outputUrl, index)} className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200" title="Tải xuống"><Download size={16}/></button>}
                                                                <button onClick={() => copyToClipboard(line.text, `copy-${line.id}`)} className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200" title="Sao chép văn bản">
                                                                    {copiedLineId === line.id ? <ClipboardCheck size={16}/> : <Copy size={16}/>}
                                                                </button>
                                                            </div>
                                                            {line.voiceUsed && <span className="text-xs text-gray-400 mt-1">{line.voiceUsed}</span>}
                                                         </div>
                                                     )}
                                                 </div>
                                             </td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                         {subtitleLines.some(l => l.status === 'done') && (
                             <div className="mt-4 flex flex-col sm:flex-row gap-4">
                                <button onClick={handleMergeAndDownload} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50" disabled={!hasActiveSubscription}>Hợp nhất & Tải tất cả</button>
                                <button onClick={handleDownloadSrt} className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50" disabled={!hasActiveSubscription}>Tải file .SRT</button>
                                <button onClick={handleReset} className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"><Trash2 size={16} className="inline-block mr-1"/>Xóa & Làm lại</button>
                             </div>
                         )}
                     </div>
                </div>
            </div>
        </ModuleContainer>
    );
};

export default TtsModule;
