import React, { useState, useEffect } from 'react';
import { uploadApi } from '../../api/index.js';

interface UploadFileItem {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  uploadedUrl?: string;
  error?: string;
}

interface PhotoUploaderProps {
  onUrlsChange: (urls: string[]) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  maxFiles?: number;
}

export function PhotoUploader({ onUrlsChange, onUploadingChange, maxFiles = 5 }: PhotoUploaderProps) {
  const [items, setItems] = useState<UploadFileItem[]>([]);

  // Очистка памяти при размонтировании
  useEffect(() => {
    return () => {
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  // Сообщаем наверх актуальные ссылки и статус загрузки при любом изменении
  useEffect(() => {
    const urls = items.filter(i => i.status === 'success' && i.uploadedUrl).map(i => i.uploadedUrl as string);
    const isUploading = items.some(i => i.status === 'uploading');
    
    onUrlsChange(urls);
    if (onUploadingChange) onUploadingChange(isUploading);
  }, [items, onUrlsChange, onUploadingChange]);

  const uploadSingleItem = async (newItem: UploadFileItem) => {
    setItems(prev => prev.map(i => i.id === newItem.id ? { ...i, status: 'uploading', progress: 0, error: undefined } : i));

    try {
      const url = await uploadApi.uploadPhoto(newItem.file, (percent) => {
        setItems(prev => prev.map(i => i.id === newItem.id ? { ...i, progress: percent } : i));
      });
      setItems(prev => prev.map(i => i.id === newItem.id ? { ...i, status: 'success', progress: 100, uploadedUrl: url } : i));
    } catch (err: any) {
      setItems(prev => prev.map(i => i.id === newItem.id ? { ...i, status: 'error', error: err.response?.data?.message || 'Ошибка сети' } : i));
    }
  };

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const currentCount = items.length;
    const selectedFiles = Array.from(e.target.files).slice(0, maxFiles - currentCount);
    
    const newItems = selectedFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: 'pending' as const,
    }));

    // Добавляем в стейт и сразу запускаем загрузку
    setItems((prev) => [...prev, ...newItems]);
    newItems.forEach(uploadSingleItem);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const isFull = items.length >= maxFiles;

  return (
    <div className="w-full">
      {/* Зона выбора файлов */}
      {!isFull && (
        <label className="block w-full cursor-pointer bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 text-center hover:border-blue-500 transition-colors mb-3">
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            + Прикрепить фото (макс. {maxFiles})
          </span>
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleSelectFiles}
          />
        </label>
      )}

      {/* Список файлов */}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700">
            <img src={item.previewUrl} alt="preview" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-200" />
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate pr-2">{item.file.name}</p>
                <span className="text-[10px] font-mono text-gray-500">
                  {item.status === 'uploading' && `${item.progress}%`}
                  {item.status === 'success' && <span className="text-emerald-500">Готово</span>}
                  {item.status === 'error' && <span className="text-red-500">Ошибка</span>}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${item.status === 'error' ? 'bg-red-500' : item.status === 'success' ? 'bg-emerald-500' : 'bg-blue-600'}`}
                  style={{ width: `${item.status === 'pending' ? 0 : item.progress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              {item.status === 'error' && (
                <button type="button" onClick={() => uploadSingleItem(item)} className="p-1 text-blue-600 hover:bg-blue-50 rounded-md text-xs">🔄</button>
              )}
              <button type="button" onClick={() => removeItem(item.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md text-xs">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}