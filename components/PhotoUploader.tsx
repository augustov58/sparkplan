import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, X, Image as ImageIcon, Loader } from 'lucide-react';

interface PhotoUploaderProps {
  projectId: string;
  onPhotosUploaded: (urls: string[]) => void;
  existingPhotos?: string[];
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  projectId,
  onPhotosUploaded,
  existingPhotos = []
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>(existingPhotos);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // Create synthetic event for handleFileUpload
    const syntheticEvent = {
      target: { files }
    } as React.ChangeEvent<HTMLInputElement>;

    await handleFileUpload(syntheticEvent);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const uploadPromises = Array.from(files).map(async (file) => {
        // Create unique filename: user_id/project_id/timestamp_filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${projectId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('site-visit-photos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('site-visit-photos')
          .getPublicUrl(data.path);

        return publicUrl;
      });

      const urls = await Promise.all(uploadPromises);
      const newPhotos = [...uploadedPhotos, ...urls];
      setUploadedPhotos(newPhotos);
      onPhotosUploaded(newPhotos);

    } catch (error: any) {
      console.error('Error uploading photos:', error);
      alert('Failed to upload photos: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url: string) => {
    const newPhotos = uploadedPhotos.filter(p => p !== url);
    setUploadedPhotos(newPhotos);
    onPhotosUploaded(newPhotos);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Site Photos</label>

      {/* Upload Button */}
      <label className="cursor-pointer">
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
            isDragging
              ? 'border-[#2d3b2d] bg-[#e8f5e8]'
              : 'border-gray-300 hover:border-[#2d3b2d] hover:bg-[#f0f5f0]'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            {uploading ? (
              <>
                <Loader className="w-8 h-8 text-gray-400 animate-spin" />
                <p className="text-sm text-gray-600">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400" />
                <p className="text-sm text-gray-600">
                  Click to upload photos or drag and drop
                </p>
                <p className="text-xs text-gray-400">
                  PNG, JPG, WEBP up to 10MB
                </p>
              </>
            )}
          </div>
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
          disabled={uploading}
        />
      </label>

      {/* Photo Grid */}
      {uploadedPhotos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {uploadedPhotos.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Site photo ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
