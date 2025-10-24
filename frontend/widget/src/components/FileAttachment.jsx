import { useState } from 'react';

export default function FileAttachment({ files, onAddFile, onRemoveFile, maxFiles = 5 }) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFiles = (fileList) => {
    const filesArray = Array.from(fileList);

    // Check max files limit
    if (files.length + filesArray.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    filesArray.forEach(file => {
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB`);
        return;
      }

      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
        'image/gif'
      ];

      if (!allowedTypes.includes(file.type)) {
        alert(`File type not supported for "${file.name}". Please use PDF, DOC, XLS, or images.`);
        return;
      }

      onAddFile(file);
    });
  };

  const getFileIcon = (file) => {
    if (file.type && file.type.includes('pdf')) return '📄';
    if (file.type && (file.type.includes('word') || file.type.includes('document'))) return '📝';
    if (file.type && (file.type.includes('excel') || file.type.includes('sheet'))) return '📊';
    if (file.type && file.type.includes('image')) return '🖼️';
    return '📎';
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (files.length === 0) return null;

  return (
    <div
      className="ic-p-3 ic-bg-gray-50 ic-border-b ic-border-gray-200"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div className="ic-absolute ic-inset-0 ic-bg-blue-100 ic-bg-opacity-90 ic-flex ic-items-center ic-justify-center ic-z-10 ic-rounded-lg ic-border-2 ic-border-dashed ic-border-blue-400">
          <p className="ic-text-blue-600 ic-font-semibold">Drop files here</p>
        </div>
      )}

      <div className="ic-flex ic-items-center ic-justify-between ic-mb-2">
        <p className="ic-text-xs ic-font-semibold ic-text-gray-600">
          📎 Attached Files ({files.length}/{maxFiles})
        </p>
      </div>

      <div className="ic-grid ic-grid-cols-1 ic-gap-2">
        {files.map((file, index) => (
          <div
            key={index}
            className="ic-flex ic-items-center ic-justify-between ic-p-2 ic-bg-white ic-rounded ic-border ic-border-gray-200 ic-shadow-sm"
          >
            <div className="ic-flex ic-items-center ic-gap-2 ic-flex-1 ic-min-w-0">
              <span className="ic-text-xl ic-flex-shrink-0">{getFileIcon(file)}</span>
              <div className="ic-flex-1 ic-min-w-0">
                <p className="ic-text-sm ic-font-medium ic-text-gray-900 ic-truncate">
                  {file.name}
                </p>
                <p className="ic-text-xs ic-text-gray-500">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
            <button
              onClick={() => onRemoveFile(index)}
              className="ic-ml-2 ic-text-red-500 hover:ic-text-red-700 ic-flex-shrink-0"
              aria-label="Remove file"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="ic-w-5 ic-h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
