import React, { useRef, useState, useEffect } from 'react';
import styles from './MyComponent.module.css';

function NodeDetails({ nodeData, onClose, onUpdate, scenarioName }) {
  const containerRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  
  useEffect(() => {
    if (nodeData && nodeData.data && nodeData.data.config) {
      const imageConfig = nodeData.data.config.image;
      if (imageConfig && imageConfig.value) {
        if (imageConfig.value.startsWith('data:image/')) {
          setImagePreview(imageConfig.value);
        } else {
          setImagePreview(imageConfig.value);
        }
      }
    }
  }, [nodeData]);

  if (!nodeData) return null;

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setImagePreview(dataUrl);
      if (nodeData.data.config.image) {
        nodeData.data.config.image.tempDataUrl = dataUrl;
      }
    };
    reader.readAsDataURL(file);
    setUploading(true);
    setUploadStatus('uploading');
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('nodeId', nodeData.id);
      formData.append('scenarioName', scenarioName);

      const response = await fetch('/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        nodeData.data.config.image.value = data.imageUrl;
        delete nodeData.data.config.image.tempDataUrl;
        setUploadStatus('success');
        setTimeout(() => setUploadStatus(''), 2000);
      } else {
        console.error('Upload failed');
        setUploadStatus('error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
    }
    setUploading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!containerRef.current) return;
    
    const formElements = containerRef.current.querySelectorAll('input, select');
    formElements.forEach(element => {
      if (element.type !== 'file') {
        nodeData.data.config[element.name].value = element.value;
      }
    });

    if (nodeData.data.config.image && 
        nodeData.data.config.image.tempDataUrl && 
        !nodeData.data.config.image.value.startsWith('/static/uploads/')) {
      return;
    }

    if (onUpdate) {
      onUpdate(nodeData.id, nodeData.data);
    }
    onClose();
  };

  const getUploadStatusMessage = () => {
    switch (uploadStatus) {
      case 'uploading':
        return <span className={`${styles.uploadStatus} ${styles.uploading}`}>Uploading...</span>;
      case 'success':
        return <span className={`${styles.uploadStatus} ${styles.uploadSuccess}`}>Upload successful!</span>;
      case 'error':
        return <span className={`${styles.uploadStatus} ${styles.uploadError}`}>Upload failed. Please try again.</span>;
      default:
        return null;
    }
  };

  return (
    <div className={styles.nodeDetailsContainer} ref={containerRef}>
      <div className={styles.nodeDetailsContent}>
        <p><strong>Name:</strong> {nodeData.data?.label}</p>
        <p><strong>Type:</strong> {nodeData.type}</p>
        <div className={styles.nodeDetailsConfig}>
          {Object.keys(nodeData.data.config).map((item) => {
            const value = nodeData.data.config[item];
            return (
              <div key={item}>
                <label>
                  <div className={styles.inputtitlecountainer}>
                    <strong className={styles.titleinputNodeDetails}>{item}: </strong>  
                    {value.type === "select" ? (
                      <select name={item} defaultValue={value.value} className={styles.optionNodeDetails}>
                        <option value=""></option>
                        {value.options.map((option, i) => (
                          <option key={i} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : value.type === "file" ? (
                      <div className={styles.fileInputContainer}>
                        <label className={styles.fileInputLabel}>
                          Choose Image
                          <input 
                            type="file" 
                            name={item} 
                            accept={value.accept || 'image/*'}
                            onChange={handleFileChange}
                            className={styles.hiddenFileInput}
                            disabled={uploading}
                          />
                        </label>
                        {getUploadStatusMessage()}
                        
                        {imagePreview && (
                          <div className={styles.imagePreviewContainer}>
                            <img 
                              src={imagePreview} 
                              alt="Preview" 
                              className={styles.imagePreview}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <input 
                        className={styles.inputNodeDetails} 
                        name={item} 
                        type={value.type} 
                        defaultValue={value.value}
                      />
                    )}
                  </div>
                </label>
              </div>
            );
          })}
          <div className={styles.configButtons}>
            <button 
              className={styles.theme__button} 
              onClick={handleSave} 
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Save'}
            </button>
            <button 
              onClick={onClose} 
              className={styles.theme__button} 
              disabled={uploading}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NodeDetails;


