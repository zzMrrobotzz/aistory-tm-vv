import React, { useState, useRef } from 'react';
import { ApiSettings, ImageEditorModuleState, ImageEditorResultHistoryItem } from '../../types';
import { editImageWithText, editImageWithMultipleImagesAndText } from '../../services/geminiService';
import { checkAndTrackRequest, REQUEST_ACTIONS, showRequestLimitError } from '../../services/requestTrackingService';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import { Upload, Download, ArrowLeft, ArrowRight, Eye, RefreshCw, Plus, ImageUp, X, RotateCcw, Trash, History as HistoryIcon, Trash2 } from 'lucide-react';

interface ImageEditorModuleProps {
    apiSettings: ApiSettings;
    moduleState: ImageEditorModuleState;
    setModuleState: React.Dispatch<React.SetStateAction<ImageEditorModuleState>>;
}

const parseDataUrl = (dataUrl: string): { base64: string; mimeType: string } | null => {
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1], base64: match[2] };
};

// Helper to read file as a promise
const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};


const ImageEditorModule: React.FC<ImageEditorModuleProps> = ({ apiSettings, moduleState, setModuleState }) => {
    const {
        originalImage,
        sourceImages,
        prompt,
        editedImage,
        isLoading,
        error,
        editHistory,
        historyIndex,
        resultHistory
    } = moduleState;
    
    const [isComparing, setIsComparing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const sourceFileInputRef = useRef<HTMLInputElement>(null);

    const updateState = (updates: Partial<ImageEditorModuleState>) => {
        setModuleState(prev => ({ ...prev, ...updates }));
    };

    const handleBaseImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const imageAsDataUrl = reader.result as string;
                updateState({ 
                    originalImage: imageAsDataUrl,
                    editedImage: imageAsDataUrl,
                    sourceImages: [],
                    prompt: '',
                    error: null,
                    editHistory: [imageAsDataUrl], // Initialize history
                    historyIndex: 0 // Point to the first state
                });
            };
            reader.onerror = () => {
                updateState({ error: "Không thể đọc file ảnh." });
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSourceImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            try {
                // Create an array of promises, one for each file
                const fileReadPromises = Array.from(files).map(readFileAsDataURL);
                
                // Wait for all files to be read
                const dataUrls = await Promise.all(fileReadPromises);

                // Update the state once with all the new images
                setModuleState(prev => ({
                    ...prev,
                    sourceImages: [...prev.sourceImages, ...dataUrls],
                    error: null
                }));

            } catch (err) {
                updateState({ error: `Không thể đọc một hoặc nhiều file ảnh: ${(err as Error).message}` });
            }
        }
        // Reset file input value to allow re-uploading the same file
        if (event.target) {
            event.target.value = '';
        }
    };
    
    const handleRemoveSourceImage = (indexToRemove: number) => {
        setModuleState(prev => ({
            ...prev,
            sourceImages: prev.sourceImages.filter((_, index) => index !== indexToRemove)
        }));
    };

    const handleEditImage = async () => {
        const imageToEdit = editedImage || originalImage;
        if (!imageToEdit || !originalImage) {
            updateState({ error: "Vui lòng tải ảnh gốc lên trước." });
            return;
        }
        if (!prompt.trim()) {
            updateState({ error: "Vui lòng nhập yêu cầu chỉnh sửa." });
            return;
        }

        // Check request limit FIRST - before starting any processing
        const requestCheck = await checkAndTrackRequest(REQUEST_ACTIONS.IMAGE_EDIT);
        if (!requestCheck.success) {
            showRequestLimitError(requestCheck);
            return;
        }

        updateState({ isLoading: true, error: null });

        try {
            const baseImageParsed = parseDataUrl(imageToEdit);
            if (!baseImageParsed) {
                throw new Error("Định dạng ảnh gốc không hợp lệ.");
            }

            let editedImageB64: string;
            
            if (sourceImages.length > 0) {
                const allImages = [
                    { base64Data: baseImageParsed.base64, mimeType: baseImageParsed.mimeType },
                    ...sourceImages.map((src, index) => {
                        const parsed = parseDataUrl(src);
                        if (!parsed) throw new Error(`Định dạng ảnh nguồn #${index + 1} không hợp lệ.`);
                        return { base64Data: parsed.base64, mimeType: parsed.mimeType };
                    })
                ];

                const finalPrompt = `You are given a primary base image and ${sourceImages.length} additional source image(s).
- The first image provided is the main base image.
- The subsequent image(s) contain source elements/logos/styles.
Your task is to execute the user's instruction below by taking elements from the source image(s) and applying them to the base image.

**User's Instruction:** "${prompt.trim()}"

**CRITICAL RULES:**
1. The final output image MUST have the exact same dimensions and aspect ratio as the first (base) image.
2. Use the element(s) from the source image(s) and apply them to the base image as described in the user's instruction.
3. The user's prompt will specify how to use the elements from the source images. Follow it carefully.`;
                
                editedImageB64 = await editImageWithMultipleImagesAndText(allImages, finalPrompt, apiSettings.geminiApiKey);
            } else {
                const finalPrompt = `${prompt.trim()} The output image MUST maintain the same aspect ratio as the original input image.`;
                editedImageB64 = await editImageWithText(baseImageParsed.base64, baseImageParsed.mimeType, finalPrompt, apiSettings.geminiApiKey);
            }
            
            const newEditedImage = `data:image/png;base64,${editedImageB64}`;
            
            // Manage undo/redo history
            const newUndoHistory = editHistory.slice(0, historyIndex + 1);
            newUndoHistory.push(newEditedImage);

            // Create and manage result history
            const newResultHistoryItem: ImageEditorResultHistoryItem = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                resultImage: newEditedImage,
                prompt: prompt,
                originalImage: originalImage,
                sourceImages: sourceImages,
            };
            const updatedResultHistory = [newResultHistoryItem, ...resultHistory].slice(0, 5);

            updateState({ 
                editedImage: newEditedImage,
                editHistory: newUndoHistory,
                historyIndex: newUndoHistory.length - 1,
                resultHistory: updatedResultHistory
            });

        } catch (e) {
            updateState({ error: `Lỗi khi chỉnh sửa ảnh: ${(e as Error).message}` });
        } finally {
            updateState({ isLoading: false });
        }
    };

    const handleReloadHistoryItem = (itemToReload: ImageEditorResultHistoryItem) => {
        if (window.confirm("Thao tác này sẽ thay thế nội dung chỉnh sửa hiện tại. Bạn có muốn tiếp tục?")) {
            updateState({
                originalImage: itemToReload.originalImage,
                sourceImages: itemToReload.sourceImages,
                prompt: itemToReload.prompt,
                editedImage: itemToReload.resultImage, // The reloaded image becomes the current one
                editHistory: [itemToReload.resultImage], // Reset undo/redo history with this state
                historyIndex: 0,
                error: null,
            });
        }
    };

    const handleDeleteHistoryItem = (idToDelete: string) => {
        updateState({
            resultHistory: resultHistory.filter(item => item.id !== idToDelete)
        });
    };
    
    const handleClearHistory = () => {
        if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử kết quả?")) {
            updateState({
                resultHistory: []
            });
        }
    };


    const handleDownloadImage = () => {
        if (!editedImage) return;
        const link = document.createElement('a');
        link.href = editedImage;
        link.download = `ddphotoshop-edited-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleClearMainImage = () => {
        updateState({
            originalImage: null,
            editedImage: null,
            sourceImages: [],
            prompt: '',
            error: null,
            isLoading: false,
            editHistory: [],
            historyIndex: -1
        });
    };
    
    const handleUploadNew = () => {
        if (window.confirm("Thao tác này sẽ xóa các ảnh hiện tại và bắt đầu lại. Bạn có muốn tiếp tục?")) {
            handleClearMainImage();
            fileInputRef.current?.click();
        }
    };
    
    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            updateState({
                historyIndex: newIndex,
                editedImage: editHistory[newIndex]
            });
        }
    };

    const handleRedo = () => {
        if (historyIndex < editHistory.length - 1) {
            const newIndex = historyIndex + 1;
            updateState({
                historyIndex: newIndex,
                editedImage: editHistory[newIndex]
            });
        }
    };
    
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < editHistory.length - 1;

    return (
        <div className="bg-slate-800 text-white min-h-screen -m-8 p-4 flex flex-col font-sans">
             <input type="file" accept="image/*" onChange={handleBaseImageUpload} ref={fileInputRef} className="hidden" />
             <input type="file" accept="image/*" onChange={handleSourceImageUpload} ref={sourceFileInputRef} className="hidden" multiple />

            <header className="flex items-center p-4">
                 <h1 className="text-xl font-bold flex items-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path><path d="M2 17L12 22L22 17" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path><path d="M2 12L12 17L22 12" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                    Chỉnh Sửa Ảnh AI
                </h1>
            </header>
            
            <main className="flex-1 flex flex-col lg:flex-row items-start justify-center p-4 gap-8">
                {/* Left/Main Column: Editor */}
                <div className="flex-1 w-full max-w-5xl flex flex-col items-center">
                    {!originalImage ? (
                        <div className="w-full max-w-2xl h-80 border-2 border-dashed border-slate-600 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:border-sky-500 hover:text-sky-500 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <ImageUp size={48} className="mb-4"/>
                            <h2 className="text-xl font-semibold">Tải Ảnh Gốc (Base Image)</h2>
                            <p className="text-sm">Ảnh chính bạn muốn chỉnh sửa.</p>
                        </div>
                    ) : (
                        <div className="w-full flex flex-col items-center">
                            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                <div className="relative w-full rounded-lg overflow-hidden shadow-2xl bg-slate-900 aspect-square flex flex-col">
                                    <label className="text-sm font-semibold p-2 bg-slate-700/50 text-center">Ảnh Gốc & Kết Quả</label>
                                    <button onClick={handleClearMainImage} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg z-10" title="Xóa ảnh và bắt đầu lại"><X size={16}/></button>
                                    <div className="flex-1 flex items-center justify-center p-2">
                                        <img src={isComparing ? originalImage : editedImage || originalImage} alt={isComparing ? "Ảnh gốc" : "Ảnh chỉnh sửa"} className="max-w-full max-h-full object-contain transition-all duration-200"/>
                                    </div>
                                    {isLoading && ( <div className="absolute inset-0 bg-black/70 flex items-center justify-center"><LoadingSpinner message="AI đang chỉnh sửa..."/></div> )}
                                    <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded-full">ai</div>
                                </div>
                                <div className="relative w-full rounded-lg overflow-hidden shadow-2xl bg-slate-900 aspect-square flex flex-col">
                                    <label className="text-sm font-semibold p-2 bg-slate-700/50 text-center">Ảnh Nguồn (Thêm vào)</label>
                                    <div className="flex-1 flex items-center justify-center p-2">
                                        <div className="w-full h-full grid grid-cols-3 gap-2 overflow-y-auto">
                                            {sourceImages.map((src, index) => (
                                                <div key={index} className="relative aspect-square">
                                                    <img src={src} alt={`Ảnh nguồn ${index + 1}`} className="w-full h-full object-contain rounded-md bg-slate-800"/>
                                                    <button onClick={() => handleRemoveSourceImage(index)} className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg text-xs"><X size={12}/></button>
                                                </div>
                                            ))}
                                            <div 
                                                className="w-full h-full aspect-square border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-sky-500 hover:text-sky-500 transition-colors cursor-pointer"
                                                onClick={() => sourceFileInputRef.current?.click()}
                                            >
                                                <Plus size={32} className="mb-2"/>
                                                <p className="text-sm font-semibold text-center">Thêm Ảnh Nguồn</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full max-w-3xl flex items-center space-x-3 mb-6">
                                <input 
                                    type="text"
                                    value={prompt}
                                    onChange={e => updateState({ prompt: e.target.value })}
                                    onKeyDown={e => {if (e.key === 'Enter') handleEditImage()}}
                                    placeholder="Nhập yêu cầu (vd: thêm vương miện cho nhân vật, đổi nền thành bãi biển...)"
                                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    disabled={isLoading}
                                />
                                <button 
                                    onClick={handleEditImage} 
                                    disabled={isLoading || !prompt.trim()} 
                                    className="bg-blue-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-slate-500 transition-colors"
                                >
                                    Tạo
                                </button>
                            </div>
                            {error && <div className="w-full max-w-3xl"><ErrorAlert message={error}/></div>}
                        </div>
                    )}
                </div>
                
                {/* Right Column: History */}
                {originalImage && (
                    <div className="w-full lg:w-96 flex-shrink-0">
                        <div className="bg-slate-900 p-4 rounded-lg shadow-inner">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold flex items-center"><HistoryIcon size={20} className="mr-2"/>Lịch sử Kết quả</h3>
                                <button onClick={handleClearHistory} disabled={resultHistory.length === 0} className="text-xs text-slate-400 hover:text-red-400 disabled:text-slate-600 flex items-center"><Trash2 size={14} className="mr-1"/> Xóa tất cả</button>
                            </div>
                            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
                                {resultHistory.length === 0 ? (
                                    <p className="text-sm text-slate-500 text-center py-8">Chưa có kết quả nào được lưu.</p>
                                ) : (
                                    resultHistory.map(item => (
                                        <div key={item.id} className="bg-slate-800 p-3 rounded-lg">
                                            <div className="flex gap-3">
                                                <img src={item.resultImage} alt="Kết quả đã lưu" className="w-20 h-20 object-contain rounded-md flex-shrink-0 bg-slate-900"/>
                                                <div className="flex-1">
                                                    <p className="text-xs text-slate-400 truncate" title={item.prompt}>{item.prompt}</p>
                                                    <p className="text-xs text-slate-500 mt-1">{new Date(item.timestamp).toLocaleString('vi-VN')}</p>
                                                    <div className="flex gap-2 mt-2">
                                                        <button onClick={() => handleReloadHistoryItem(item)} className="text-xs bg-sky-600 hover:bg-sky-700 px-2 py-1 rounded-md flex items-center"><RotateCcw size={12} className="mr-1"/> Tải lại</button>
                                                        <button onClick={() => handleDeleteHistoryItem(item.id)} className="text-xs bg-slate-700 hover:bg-red-600 px-2 py-1 rounded-md"><Trash size={12}/></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
            
             {originalImage && (
                <footer className="w-full max-w-6xl mx-auto p-4 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <button onClick={handleUndo} className="p-2 bg-slate-700/50 rounded-md text-slate-300 hover:bg-slate-600 disabled:text-slate-500 disabled:cursor-not-allowed" disabled={!canUndo || isLoading} title="Hoàn tác"><ArrowLeft size={18}/></button>
                        <button onClick={handleRedo} className="p-2 bg-slate-700/50 rounded-md text-slate-300 hover:bg-slate-600 disabled:text-slate-500 disabled:cursor-not-allowed" disabled={!canRedo || isLoading} title="Làm lại"><ArrowRight size={18}/></button>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button 
                            className="px-4 py-2 bg-slate-700/50 rounded-md text-slate-300 hover:bg-slate-600 flex items-center space-x-2"
                            onMouseDown={() => setIsComparing(true)}
                            onMouseUp={() => setIsComparing(false)}
                            onTouchStart={() => setIsComparing(true)}
                            onTouchEnd={() => setIsComparing(false)}
                        >
                            <Eye size={18}/> <span>So sánh</span>
                        </button>
                        <button onClick={handleUploadNew} className="px-4 py-2 bg-slate-700/50 rounded-md text-slate-300 hover:bg-slate-600 flex items-center space-x-2">
                           <Plus size={18}/> <span>Tải Ảnh Mới</span>
                        </button>
                    </div>
                     <button 
                        onClick={handleDownloadImage}
                        disabled={!editedImage || editedImage === originalImage}
                        className="bg-green-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-slate-500 transition-colors flex items-center space-x-2"
                    >
                       <Download size={18}/> <span>Tải Ảnh Về</span>
                    </button>
                </footer>
             )}
        </div>
    );
};

export default ImageEditorModule;