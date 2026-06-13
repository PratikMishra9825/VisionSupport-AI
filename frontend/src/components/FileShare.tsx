"use client";
import { API_BASE, SOCKET_BASE } from '@/config';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Upload, File, FileText, CheckCircle, AlertTriangle, Loader, Download, Eye } from 'lucide-react';

interface FileShareProps {
  sessionId: string;
}

interface FileMetadata {
  _id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  virusScanPassed: boolean;
  virusScanDetails: string;
  uploaderName: string;
  createdAt: string;
  minioKey: string;
}

export default function FileShare({ sessionId }: FileShareProps) {
  const { token, name: uploaderName, role } = useStore();
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadFilename, setUploadFilename] = useState('');
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSessionFiles();
  }, [sessionId]);

  const fetchSessionFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/files/session/${sessionId}`);
      const data = await res.json();
      if (res.ok) setFiles(data);
    } catch (err) {
      console.error('Failed to load session files', err);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFileUpload(e.target.files[0]);
    }
  };

  // Resumable Chunked Upload logic
  const processFileUpload = async (file: File) => {
    // Observers cannot upload
    if (role === 'observer') {
      setError('Observers are not allowed to upload files');
      return;
    }

    setError('');
    setUploadFilename(file.name);
    setUploadProgress(0);

    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunk sizes
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('uploadId', uploadId);
      formData.append('chunkIndex', String(chunkIndex));
      formData.append('totalChunks', String(totalChunks));
      formData.append('filename', file.name);
      formData.append('sessionId', sessionId);
      formData.append('uploaderId', uploaderName || 'cust');
      formData.append('uploaderName', uploaderName || 'Customer Guest');

      try {
        const res = await fetch(`${API_BASE}/files/upload/chunk`, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Upload failed');
          setUploadProgress(null);
          return;
        }

        if (data.success && data.progress !== undefined) {
          setUploadProgress(data.progress);
        } else if (data.success && data.fileId) {
          setUploadProgress(100);
          setTimeout(() => setUploadProgress(null), 1000);
          fetchSessionFiles(); // Reload
        }
      } catch (err) {
        setError('Connection interrupted during upload');
        setUploadProgress(null);
        return;
      }
    }
  };

  const downloadFile = async (fileId: string) => {
    try {
      const res = await fetch(`${API_BASE}/files/download/${fileId}`);
      const data = await res.json();
      if (res.ok && data.downloadUrl) {
        // Trigger download
        window.open(data.downloadUrl, '_blank');
      } else {
        alert(data.error || 'Failed to download file');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/40 border border-white/10 rounded-2xl p-4 glass-panel">
      <h3 className="text-xl font-semibold mb-4 text-purple-400 font-cyber">Shared Repository</h3>
      
      {error && <p className="text-red-400 text-xs mb-3 font-mono">{error}</p>}

      {/* Drag & Drop Box */}
      {role !== 'observer' && (
        <div 
          onDragEnter={handleDrag} 
          onDragOver={handleDrag} 
          onDragLeave={handleDrag} 
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 mb-4 text-center cursor-pointer transition ${
            dragActive ? 'border-purple-500 bg-purple-500/10' : 'border-white/15 bg-white/5 hover:bg-white/10'
          }`}
        >
          <input 
            type="file" 
            id="file-upload-input" 
            className="hidden" 
            onChange={handleFileInput}
          />
          <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center justify-center">
            <Upload className="w-8 h-8 text-purple-400 mb-2 animate-pulse" />
            <p className="text-sm text-gray-300">Drag & drop files or <span className="text-purple-400 font-semibold underline">browse</span></p>
            <p className="text-xs text-gray-500 mt-1">Image, PDF, DOCX, ZIP (Max 50MB)</p>
          </label>
        </div>
      )}

      {/* Upload progress indicator */}
      {uploadProgress !== null && (
        <div className="p-3 bg-white/5 border border-purple-500/20 rounded-xl mb-4">
          <div className="flex justify-between items-center text-xs text-gray-400 mb-2">
            <span className="truncate max-w-[70%]">{uploadFilename}</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden">
            <div style={{ width: `${uploadProgress}%` }} className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-300" />
          </div>
        </div>
      )}

      {/* Files List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {files.map((file) => (
          <div key={file._id} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between glass-panel-hover">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="p-2 bg-purple-950/35 border border-purple-800/35 text-purple-400 rounded-lg">
                {file.mimeType.includes('image') ? <File size={18} /> : <FileText size={18} />}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate text-gray-200">{file.filename}</p>
                <div className="flex items-center space-x-2 text-xs text-gray-500 mt-0.5">
                  <span>{(file.sizeBytes / 1024).toFixed(1)} KB</span>
                  <span>•</span>
                  <span>By: {file.uploaderName}</span>
                </div>
              </div>
            </div>

            {/* Check virus status */}
            <div className="flex items-center space-x-3">
              {file.virusScanPassed ? (
                <span title="Security Checked: Clean">
                  <CheckCircle size={14} className="text-green-500" />
                </span>
              ) : (
                <span title="Security Warning: Unverified">
                  <AlertTriangle size={14} className="text-red-400" />
                </span>
              )}
              
              {/* Preview Button */}
              {file.mimeType.includes('image') && (
                <button 
                  onClick={() => setPreviewFile(file)}
                  className="p-1.5 bg-white/5 hover:bg-white/10 text-blue-400 rounded-lg transition"
                  title="Preview"
                >
                  <Eye size={14} />
                </button>
              )}

              {/* Download */}
              <button 
                onClick={() => downloadFile(file._id)}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-purple-400 rounded-lg transition"
                title="Secure Download"
              >
                <Download size={14} />
              </button>
            </div>
          </div>
        ))}
        {files.length === 0 && (
          <p className="text-center text-gray-500 text-sm mt-8">No files shared yet.</p>
        )}
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-950 border border-white/10 rounded-2xl max-w-2xl w-full p-6 relative flex flex-col max-h-[85vh]">
            <h4 className="text-lg font-bold mb-4 text-purple-400 truncate">{previewFile.filename}</h4>
            <div className="flex-1 overflow-auto bg-black rounded-lg flex items-center justify-center p-2">
              <img 
                src={`${API_BASE}/files/download/local/visionsupport-files/${previewFile.minioKey}`} 
                alt={previewFile.filename} 
                className="max-w-full max-h-[50vh] object-contain"
              />
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button 
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-white/5 transition"
              >
                Close
              </button>
              <button 
                onClick={() => { downloadFile(previewFile._id); setPreviewFile(null); }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold transition"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
