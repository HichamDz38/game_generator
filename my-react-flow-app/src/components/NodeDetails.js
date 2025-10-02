import React, { useRef, useState, useEffect } from 'react';
import styles from './MyComponent.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

function NodeDetails({ nodeData, onClose, onUpdate, scenarioName, nodes, edges, position  }) {
  const containerRef = useRef(null);
  const [imagePreviews, setImagePreviews] = useState({});
  const [uploading, setUploading] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});
  const [connectedSources, setConnectedSources] = useState([]);
  const [configValues, setConfigValues] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [conditionalFields, setConditionalFields] = useState({});

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close when node is deleted
  useEffect(() => {
    if (nodeData && !nodes.some(node => node.id === nodeData.id)) {
      onClose();
    }
  }, [nodes, nodeData, onClose]);

  // Initialize config values, previews, and conditional fields
  useEffect(() => {
    if (!nodeData || !nodeData.data?.config) return;

    const previews = {};
    const values = {};
    const conditionals = {};

    Object.entries(nodeData.data.config).forEach(([key, config]) => {
      values[key] = config.value ?? '';
      if (config.conditional) {
        conditionals[key] = Array.isArray(config.conditional) ? config.conditional : [config.conditional];
      }

      if (config.type === 'file' && config.value) {
        if (config.value.startsWith('data:image/')) {
          previews[key] = config.value;
        } else {
          const imageUrl = config.value.startsWith('/static/uploads/')
            ? `${API_BASE_URL}${config.value}`
            : config.value;
          previews[key] = imageUrl;
        }
      }
    });

    setImagePreviews(previews);
    setConfigValues(values);
    setConditionalFields(conditionals);

    // Handle connected sources for 'condition' devices
    if (nodeData.data.deviceType === 'condition') {
      const sourceNodeIds = edges.filter(edge => edge.target === nodeData.id).map(edge => edge.source);
      const sourceNodes = nodes.filter(node => sourceNodeIds.includes(node.id) && node.type !== 'input');
      setConnectedSources(sourceNodes);

      // Merge source checkboxes into configValues
      const updatedValues = { ...values };
      const updatedConfig = { ...nodeData.data.config };
      sourceNodes.forEach(sourceNode => {
        const key = `source_${sourceNode.id}`;
        if (!updatedConfig[key]) {
          updatedConfig[key] = {
            type: 'checkbox',
            value: false,
            sourceNodeId: sourceNode.id,
            sourceNodeLabel: sourceNode.data?.label || `Node ${sourceNode.id}`
          };
        }
        updatedValues[key] = updatedConfig[key].value ?? false;
      });

      nodeData.data.config = updatedConfig;
      setConfigValues(updatedValues);
    }
  }, [nodeData, nodes, edges]);

  const shouldDisplayField = (fieldName) => {
    const condition = conditionalFields[fieldName];
    if (!condition) return true;

    return condition.every(({ dependsOn, values }) => values.includes(configValues[dependsOn]));
  };

  const isFieldRequired = (fieldName, config) => {
    const condition = conditionalFields[fieldName];
    if (!condition) return config.required || false;
    return shouldDisplayField(fieldName) && (config.required || false);
  };

  const handleInputChange = (fieldName, value) => {
    setConfigValues(prev => ({ ...prev, [fieldName]: value }));
    if (nodeData.data.config[fieldName]) {
      nodeData.data.config[fieldName].value = value;
    }

    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const validateRequiredFields = () => {
    const errors = {};
    let isValid = true;

    Object.entries(nodeData.data.config).forEach(([key, config]) => {
      if (key.startsWith('source_') || !shouldDisplayField(key)) return;
      const required = isFieldRequired(key, config);

      if (required) {
        if (config.type === 'file') {
          if (!config.value && !config.tempDataUrl) {
            errors[key] = 'This field is required';
            isValid = false;
          }
        } else if (config.type === 'checkbox') {
          if (configValues[key] === undefined || configValues[key] === null) {
            errors[key] = 'This field is required';
            isValid = false;
          }
        } else if (!configValues[key] && configValues[key] !== 0 && configValues[key] !== false) {
          errors[key] = 'This field is required';
          isValid = false;
        }
      }
    });

    setValidationErrors(errors);
    return isValid;
  };

  const handleFileChange = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setImagePreviews(prev => ({ ...prev, [fieldName]: dataUrl }));
      if (nodeData.data.config[fieldName]) nodeData.data.config[fieldName].tempDataUrl = dataUrl;
    };
    reader.readAsDataURL(file);

    setUploading(prev => ({ ...prev, [fieldName]: true }));
    setUploadStatus(prev => ({ ...prev, [fieldName]: 'uploading' }));

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('nodeId', nodeData.id);
      formData.append('scenarioName', scenarioName);
      formData.append('fieldName', fieldName);

      const response = await fetch(`${API_BASE_URL}/upload-image`, { method: 'POST', body: formData });

      if (response.ok) {
        const data = await response.json();
        nodeData.data.config[fieldName].value = data.imageUrl;
        delete nodeData.data.config[fieldName].tempDataUrl;
        const fullImageUrl = `${API_BASE_URL}${data.imageUrl}`;
        setImagePreviews(prev => ({ ...prev, [fieldName]: fullImageUrl }));
        setUploadStatus(prev => ({ ...prev, [fieldName]: 'success' }));
        setTimeout(() => setUploadStatus(prev => { const n = { ...prev }; delete n[fieldName]; return n; }), 2000);
      } else {
        setUploadStatus(prev => ({ ...prev, [fieldName]: 'error' }));
      }
    } catch (err) {
      console.error(err);
      setUploadStatus(prev => ({ ...prev, [fieldName]: 'error' }));
    }

    setUploading(prev => ({ ...prev, [fieldName]: false }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!containerRef.current) return;
    if (!validateRequiredFields()) {
      alert('Please fill in all required fields (marked with *)');
      return;
    }

    const hasUploadingRequiredFiles = Object.keys(nodeData.data.config).some(key => {
      const config = nodeData.data.config[key];
      return config.required && config.type === 'file' && config.tempDataUrl && !config.value.startsWith('/static/uploads/');
    });

    if (hasUploadingRequiredFiles) {
      alert('Please wait for file uploads to complete before saving');
      return;
    }

    const formElements = containerRef.current.querySelectorAll('input, select, textarea');
    formElements.forEach(element => {
      if (element.type !== 'file') {
        if (nodeData.data.config[element.name]) {
          nodeData.data.config[element.name].value =
            element.type === 'checkbox' ? element.checked : element.value;
        }
      }
    });

  

    if (onUpdate) onUpdate(nodeData.id, nodeData.data);
    onClose();
  };

  const getUploadStatusMessage = (fieldName) => {
    const status = uploadStatus[fieldName];
    switch (status) {
      case 'uploading': return <span className={`${styles.uploadStatus} ${styles.uploading}`}>Uploading...</span>;
      case 'success': return <span className={`${styles.uploadStatus} ${styles.uploadSuccess}`}>Upload successful!</span>;
      case 'error': return <span className={`${styles.uploadStatus} ${styles.uploadError}`}>Upload failed. Please try again.</span>;
      default: return null;
    }
  };

  if (!nodeData) return null;

  const isAnyUploading = Object.values(uploading).some(Boolean);

  return (
    <div className={styles.nodeDetailsContainer}
  ref={containerRef}
  style={{
     position: 'absolute',
    top: (position?.y+10),  // offset so it’s not under the cursor
    left: (position?.x -10),
    zIndex: 9999
  }}
    >
      <div className={styles.nodeDetailsContent}>
        <p><strong>Name:</strong> {nodeData.data?.label}</p>
        <p><strong>IP:</strong> {nodeData.data?.originalDeviceId}</p>
        <p><strong>Type:</strong> {nodeData.type}</p>

        {nodeData.data?.deviceType === 'condition' && connectedSources.length > 0 && (
          <div className={styles.connectedSources}>
            <h4>Connected Source Nodes:</h4>
                      {connectedSources.map(sourceNode => {
              const checkboxKey = `source_${sourceNode.id}`;
              const config = nodeData.data.config[checkboxKey] || {
                type: 'checkbox',
                value: false,
                sourceNodeId: sourceNode.id,
                sourceNodeLabel: sourceNode.data?.label || `Node ${sourceNode.id}`
              };
              
              return (
                <div key={sourceNode.id} className={styles.sourceCheckbox}>
                  <label className={styles.sourcenode}>
                    <input
                      type="checkbox"
                      name={checkboxKey}
                      checked={configValues[checkboxKey] === true || configValues[checkboxKey] === 'true'}
                      onChange={(e) => {
                        handleInputChange(checkboxKey, e.target.checked);
                      }}
                    />
                    {`${sourceNode.data.label}`}
                  </label>
                </div>
              );
            })}
          </div>
          //   {connectedSources.map(sourceNode => {
          //     const key = `source_${sourceNode.id}`;
          //     const config = nodeData.data.config[key] || { type: 'checkbox', value: false };
          //     return (
          //       <div key={key} className={styles.sourceCheckbox}>
          //         <label>
          //           <input
          //             type="checkbox"
          //             name={key}
          //             checked={configValues[key] === true || configValues[key] === 'true'}
          //             onChange={e => handleInputChange(key, e.target.checked)}
          //           />
          //           {sourceNode.data.label}
          //         </label>
          //       </div>
          //     );
          //   })}
          // </div> 
        )}

        <div className={styles.nodeDetailsConfig}>
          {Object.entries(nodeData.data.config).map(([key, config]) => {
            if (key.startsWith('source_') || !shouldDisplayField(key)) return null;
            const isRequired = isFieldRequired(key, config);
            const hasError = validationErrors[key];

            return (
              <div key={key} className={`${styles.configField} ${hasError ? styles.fieldError : ''}`}>
                <label className={styles.inputLabelContainer}>
  <div className={styles.inputtitlecountainer}>
    <strong className={styles.titleinputNodeDetails}>
      {config.label || key}: {isRequired && <span className={styles.requiredStar}>*</span>}
    </strong>

    {config.type === 'select' ? (
      <select
        name={key}
        value={configValues[key] ?? config.value ?? ''}
        onChange={e => handleInputChange(key, e.target.value)}
        className={`${styles.optionNodeDetails} ${hasError ? styles.inputError : ''}`}
        required={isRequired}
      >
        <option value=""></option>
        {config.options.map((opt, i) => (
          <option key={i} value={opt}>{opt}</option>
        ))}
      </select>
    ) : config.type === 'file' ? (
      <div className={styles.fileInputContainer}>
        <label className={`${styles.fileInputLabel} ${hasError ? styles.inputError : ''}`}>
          Choose {config.label || key} {isRequired && <span className={styles.requiredStar}>*</span>}
          <input
            type="file"
            name={key}
            accept={config.accept || 'image/*'}
            onChange={e => handleFileChange(e, key)}
            disabled={uploading[key]}
            className={styles.hiddenFileInput}
            required={isRequired}
          />
        </label>
        {getUploadStatusMessage(key)}
        {imagePreviews[key] && (
          <div className={styles.imagePreviewContainer}>
            <img
              src={imagePreviews[key]}
              alt={`${config.label || key} preview`}
              className={styles.imagePreview}
              onError={e => e.target.style.display='none'}
            />
          </div>
        )}
        {hasError && <span className={styles.errorMessage}>{validationErrors[key]}</span>}
      </div>
    ) : config.type === 'checkbox' ? (
      <input
        type="checkbox"
        name={key}
        checked={configValues[key] === true || configValues[key] === 'true'}
        onChange={e => handleInputChange(key, e.target.checked)}
      />
    ) : (
      <input
        type={config.type}
        name={key}
        value={configValues[key] ?? ''}
        onChange={e => handleInputChange(key, e.target.value)}
        className={`${styles.inputNodeDetails} ${hasError ? styles.inputError : ''}`}
        {...(nodeData.data.deviceType === 'delay' && key === 'delaySeconds' ? { type: 'number', min: 1, step: 1 } : {})}
      />
    )}
  </div>
  {hasError && <span className={styles.errorMessage}>{validationErrors[key]}</span>}
</label>

                {/* <label>
                  <div className={styles.inputtitlecountainer}>
                    <strong className={styles.titleinputNodeDetails}>
                      {config.label || key}: {isRequired && <span className={styles.requiredStar}>*</span>}
                    </strong>

                    {config.type === 'select' ? (
                      <select
                        name={key}
                        value={configValues[key] ?? config.value ?? ''}
                        onChange={e => handleInputChange(key, e.target.value)}
                        className={hasError ? styles.inputError : ''}
                        required={isRequired}
                      >
                        <option value=""></option>
                        {config.options.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                      </select>
                    ) : config.type === 'file' ? (
                      <div className={styles.fileInputContainer}>
                        <label className={`${hasError ? styles.inputError : ''}`}>
                          Choose {key} {isRequired && '*'}
                          <input
                            type="file"
                            name={key}
                            accept={config.accept || 'image/*'}
                            onChange={e => handleFileChange(e, key)}
                            disabled={uploading[key]}
                            className={styles.hiddenFileInput}
                          />
                        </label>
                        {getUploadStatusMessage(key)}
                        {imagePreviews[key] && (
                          <img
                            src={imagePreviews[key]}
                            alt={`${key} preview`}
                            className={styles.imagePreview}
                            onError={e => e.target.style.display = 'none'}
                          />
                        )}
                        {hasError && <span className={styles.errorMessage}>{validationErrors[key]}</span>}
                      </div>
                    ) : config.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        name={key}
                        checked={configValues[key] === true || configValues[key] === 'true'}
                        onChange={e => handleInputChange(key, e.target.checked)}
                      />
                    ) : (
                      <input
                        type={config.type}
                        name={key}
                        value={configValues[key] ?? ''}
                        onChange={e => handleInputChange(key, e.target.value)}
                        className={hasError ? styles.inputError : ''}
                        {...(nodeData.data.deviceType === 'delay' && key === 'delaySeconds' ? { type: 'number', min: 1, step: 1 } : {})}
                      />
                    )}
                  </div>
                  {hasError && <span className={styles.errorMessage}>{validationErrors[key]}</span>}
                </label> */}
              </div>
            );
          })}

          <div className={styles.configButtons}>
            <button onClick={handleSave} disabled={isAnyUploading}> {isAnyUploading ? 'Uploading...' : 'Save'} </button>
            <button onClick={onClose} disabled={isAnyUploading}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NodeDetails;



// import React, { useRef, useState, useEffect } from 'react';
// import styles from './MyComponent.module.css';

// const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

// function NodeDetails({ nodeData, onClose, onUpdate, scenarioName, nodes, edges }) {
//   const containerRef = useRef(null);
//   const [imagePreviews, setImagePreviews] = useState({});
//   const [uploading, setUploading] = useState({});
//   const [uploadStatus, setUploadStatus] = useState({});
//   const [connectedSources, setConnectedSources] = useState([]);
//   const [configValues, setConfigValues] = useState({});
//   const [validationErrors, setValidationErrors] = useState({});
//   const [conditionalFields, setConditionalFields] = useState({});

//   // Close when clicking outside
//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (containerRef.current && !containerRef.current.contains(event.target)) {
//         onClose();
//       }
//     };

//     document.addEventListener('mousedown', handleClickOutside);
    
//     return () => {
//       document.removeEventListener('mousedown', handleClickOutside);
//     };
//   }, [onClose]);

//   // Close when node is deleted
//   useEffect(() => {
//     if (nodeData && !nodes.some(node => node.id === nodeData.id)) {
//       onClose();
//     }
//   }, [nodes, nodeData, onClose]);
  
//   useEffect(() => {
//     if (nodeData && nodeData.data && nodeData.data.config) {
//       const previews = {};
//       const values = {};
//       const conditionals = {};
      
//       Object.keys(nodeData.data.config).forEach(key => {
//         const config = nodeData.data.config[key];
        
//         values[key] = config.value !== undefined ? config.value : '';
        
//         if (config.conditional) {
//           conditionals[key] = Array.isArray(config.conditional) 
//             ? config.conditional 
//             : [config.conditional]; 
//         }
        
//         if (config.type === 'file' && config.value) {
//           if (config.value.startsWith('data:image/')) {
//             previews[key] = config.value;
//           } else {
//             const imageUrl = config.value.startsWith('/static/uploads/') 
//               ? `${API_BASE_URL}${config.value}`
//               : config.value;
//             previews[key] = imageUrl;
//           }
//         }
//       });
      
//       setImagePreviews(previews);
//       setConfigValues(values);
//       setConditionalFields(conditionals);
//       setValidationErrors({});
//     }

//     if (nodeData && nodeData.data?.deviceType === 'condition') {
//       const sourceNodeIds = edges
//         .filter(edge => edge.target === nodeData.id)
//         .map(edge => edge.source);
      
//       const sourceNodes = nodes.filter(node => 
//         sourceNodeIds.includes(node.id) && 
//         node.type !== 'input'
//       );
      
//       setConnectedSources(sourceNodes);

//       if (nodeData.data.config) {
//         const newConfigValues = { ...configValues };
//         const newConfig = { ...nodeData.data.config };
        
//         sourceNodes.forEach(sourceNode => {
//           const checkboxKey = `source_${sourceNode.id}`;
          
//           if (!newConfig[checkboxKey]) {
//             newConfig[checkboxKey] = {
//               type: 'checkbox',
//               value: false,
//               sourceNodeId: sourceNode.id,
//               sourceNodeLabel: sourceNode.data?.label || `Node ${sourceNode.id}`
//             };
//           }
          
//           newConfigValues[checkboxKey] = newConfig[checkboxKey]?.value || false;
//         });
        
//         nodeData.data.config = newConfig;
//         setConfigValues(newConfigValues);
//       }
//     }
//   }, [nodeData, nodes, edges, configValues]);

//   const shouldDisplayField = (fieldName) => {
//     const condition = conditionalFields[fieldName];
//     if (!condition) return true;
    
//     if (Array.isArray(condition)) {
//       return condition.every(cond => {
//         const { dependsOn, values } = cond;
//         const dependentValue = configValues[dependsOn];
//         return values.includes(dependentValue);
//       });
//     } else {
//       const { dependsOn, values } = condition;
//       const dependentValue = configValues[dependsOn];
//       return values.includes(dependentValue);
//     }
//   };

//   const isFieldRequired = (fieldName, config) => {
//     const condition = conditionalFields[fieldName];
//     if (!condition) return config.required || false;
    
//     const shouldDisplay = shouldDisplayField(fieldName);
    
//     return shouldDisplay && (config.required || false);
//   };


//   const handleInputChange = (fieldName, value) => {
//     setConfigValues(prev => ({
//       ...prev,
//       [fieldName]: value
//     }));
    
//     if (nodeData.data.config[fieldName]) {
//       if (fieldName === 'logicType') {
//         nodeData.data.config[fieldName].value = value;
//         console.log(`Logic type set to: ${value}`);
//       } else {
//         nodeData.data.config[fieldName].value = value;
//       }
//     }

//     if (validationErrors[fieldName]) {
//       setValidationErrors(prev => {
//         const newErrors = { ...prev };
//         delete newErrors[fieldName];
//         return newErrors;
//       });
//     }
//   };

//   const validateRequiredFields = () => {
//   const errors = {};
//   let isValid = true;

//   Object.keys(nodeData.data.config).forEach((item) => {
//     const config = nodeData.data.config[item];
    
//     if (item.startsWith('source_') || !shouldDisplayField(item)) {
//       return;
//     }

//     const fieldRequired = isFieldRequired(item, config);

//     if (fieldRequired) {
//       if (config.type === 'file') {
//         if (!config.value && !config.tempDataUrl) {
//           errors[item] = 'This field is required';
//           isValid = false;
//         }
//       } else if (config.type === 'checkbox') {
//         if (configValues[item] === undefined || configValues[item] === null) {
//           errors[item] = 'This field is required';
//           isValid = false;
//         }
//       } else {
//         if (!configValues[item] && configValues[item] !== 0 && configValues[item] !== false) {
//           errors[item] = 'This field is required';
//           isValid = false;
//         }
//       }
//     }
//   });

//   setValidationErrors(errors);
//   return isValid;
// };

//   if (!nodeData) return null;

//   const handleFileChange = async (e, fieldName) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onload = (e) => {
//       const dataUrl = e.target.result;
//       setImagePreviews(prev => ({ ...prev, [fieldName]: dataUrl }));
//       if (nodeData.data.config[fieldName]) {
//         nodeData.data.config[fieldName].tempDataUrl = dataUrl;
//       }
//     };
//     reader.readAsDataURL(file);
    
//     setUploading(prev => ({ ...prev, [fieldName]: true }));
//     setUploadStatus(prev => ({ ...prev, [fieldName]: 'uploading' }));
    
//     try {
//       const formData = new FormData();
//       formData.append('image', file);
//       formData.append('nodeId', nodeData.id);
//       formData.append('scenarioName', scenarioName);
//       formData.append('fieldName', fieldName);

//       const response = await fetch(`${API_BASE_URL}/upload-image`, {
//         method: 'POST',
//         body: formData,
//       });

//       if (response.ok) {
//         const data = await response.json();
//         nodeData.data.config[fieldName].value = data.imageUrl;
//         delete nodeData.data.config[fieldName].tempDataUrl;
        
//         const fullImageUrl = `${API_BASE_URL}${data.imageUrl}`;
//         setImagePreviews(prev => ({ ...prev, [fieldName]: fullImageUrl }));
        
//         setUploadStatus(prev => ({ ...prev, [fieldName]: 'success' }));
        
//         setValidationErrors(prev => {
//           const newErrors = { ...prev };
//           delete newErrors[fieldName];
//           return newErrors;
//         });
        
//         setTimeout(() => {
//           setUploadStatus(prev => {
//             const newStatus = { ...prev };
//             delete newStatus[fieldName];
//             return newStatus;
//           });
//         }, 2000);
//       } else { 
//         console.error('Upload failed');
//         setUploadStatus(prev => ({ ...prev, [fieldName]: 'error' }));
//       }
//     } catch (error) {
//       console.error('Upload error:', error);
//       setUploadStatus(prev => ({ ...prev, [fieldName]: 'error' }));
//     }
//     setUploading(prev => ({ ...prev, [fieldName]: false }));
//   };

//   const handleSave = async (e) => {
//   e.preventDefault();
//   if (!containerRef.current) return;
  
//   if (!validateRequiredFields()) {
//     alert('Please fill in all required fields (marked with *)');
//     return;
//   }

//   // if (nodeData.data.config.logicType) {
//   //   const logicTypeValue = configValues.logicType || nodeData.data.config.logicType.value;
//   //   nodeData.data.config.logicType.value = String(logicTypeValue).toUpperCase();
//   // }

//   console.log('Saving node with config:', nodeData.data.config);

//   const hasUploadingRequiredFiles = Object.keys(nodeData.data.config).some(key => {
//     const config = nodeData.data.config[key];
//     return config.required && 
//            config.type === 'file' && 
//            config.tempDataUrl && 
//            !config.value.startsWith('/static/uploads/');
//   });

//   if (hasUploadingRequiredFiles) {
//     alert('Please wait for file uploads to complete before saving');
//     return;
//   }

//   const formElements = containerRef.current.querySelectorAll('input, select, textarea');
//   formElements.forEach(element => {
//     if (element.type !== 'file') {
//       if (nodeData.data.config[element.name]) {
//         if (element.type === 'checkbox') {
//           nodeData.data.config[element.name].value = element.checked;
//         } else {
//           nodeData.data.config[element.name].value = element.value;
//         }
//       } else {
//         if (element.name.startsWith('source_')) {
//           if (!nodeData.data.config[element.name]) {
//             const sourceNodeId = element.name.replace('source_', '');
//             const sourceNode = nodes.find(node => node.id === sourceNodeId);
//             nodeData.data.config[element.name] = {
//               type: 'checkbox',
//               value: element.checked,
//               sourceNodeId: sourceNodeId,
//               sourceNodeLabel: sourceNode?.data?.label || `Node ${sourceNodeId}`
//             };
//           } else {
//             nodeData.data.config[element.name].value = element.checked;
//           }
//         }
//       }
//     }
//   });

//   if (onUpdate) {
//     onUpdate(nodeData.id, nodeData.data);
//   }
//   onClose();
// };

//   const getUploadStatusMessage = (fieldName) => {
//     const status = uploadStatus[fieldName];
//     switch (status) {
//       case 'uploading':
//         return <span className={`${styles.uploadStatus} ${styles.uploading}`}>Uploading...</span>;
//       case 'success':
//         return <span className={`${styles.uploadStatus} ${styles.uploadSuccess}`}>Upload successful!</span>;
//       case 'error':
//         return <span className={`${styles.uploadStatus} ${styles.uploadError}`}>Upload failed. Please try again.</span>;
//       default:
//         return null;
//     }
//   };

//   const isAnyUploading = Object.values(uploading).some(status => status);

//   return (
//     <div className={styles.nodeDetailsContainer} ref={containerRef}>
//       <div className={styles.nodeDetailsContent}>
//         <p><strong>Name:</strong> {nodeData.data?.label}</p>
//         <p><strong>Type:</strong> {nodeData.type}</p>
        
//         {nodeData.data?.deviceType === 'condition' && connectedSources.length > 0 && (
//           <div className={styles.connectedSources}>
//             <h4>Connected Source Nodes:</h4>
            
//             {connectedSources.map(sourceNode => {
//               const checkboxKey = `source_${sourceNode.id}`;
//               const config = nodeData.data.config[checkboxKey] || {
//                 type: 'checkbox',
//                 value: false,
//                 sourceNodeId: sourceNode.id,
//                 sourceNodeLabel: sourceNode.data?.label || `Node ${sourceNode.id}`
//               };
              
//               return (
//                 <div key={sourceNode.id} className={styles.sourceCheckbox}>
//                   <label className={styles.sourcenode}>
//                     <input
//                       type="checkbox"
//                       name={checkboxKey}
//                       checked={configValues[checkboxKey] === true || configValues[checkboxKey] === 'true'}
//                       onChange={(e) => {
//                         handleInputChange(checkboxKey, e.target.checked);
//                       }}
//                     />
//                     {`${sourceNode.data.label}`}
//                   </label>
//                 </div>
//               );
//             })}
//           </div>
//         )}

//         <div className={styles.nodeDetailsConfig}>
//           {Object.keys(nodeData.data.config).map((item) => {
//             const value = nodeData.data.config[item];
            
//             if (item.startsWith('source_') || !shouldDisplayField(item)) {
//               return null;
//             }

//             const isRequired = isFieldRequired(item, value);
//             const hasError = validationErrors[item];

//             return (
//               <div key={item} className={`${styles.configField} ${hasError ? styles.fieldError : ''}`}>
//                 <label>
//                   <div className={styles.inputtitlecountainer}>
//                     <strong className={styles.titleinputNodeDetails}>
//                       {item}: 
//                       {isRequired && <span className={styles.requiredStar}>*</span>}
//                     </strong>  
//                     {value.type === "select" ? (
//                       <select 
//                         name={item} 
//                         value={configValues[item] || nodeData.data.config[item]?.value || ''} 
//                         onChange={(e) => handleInputChange(item, e.target.value)}
//                         className={`${styles.optionNodeDetails} ${hasError ? styles.inputError : ''}`}
//                         required={isRequired}
//                       >
//                         <option value=""></option>
//                         {value.options.map((option, i) => (
//                           <option key={i} value={option}>{option}</option>
//                         ))}
//                       </select>
//                     ) : value.type === "file" ? (
//                       <div className={styles.fileInputContainer}>
//                         <label className={`${styles.fileInputLabel} ${hasError ? styles.inputError : ''} ${isRequired ? styles.requiredField : ''}`}>
//                           Choose {item}
//                           {isRequired && <span className={styles.requiredStar}>*</span>}
//                           <input 
//                             type="file" 
//                             name={item} 
//                             accept={value.accept || 'image/*'}
//                             onChange={(e) => handleFileChange(e, item)}
//                             className={styles.hiddenFileInput}
//                             disabled={uploading[item]}
//                             required={isRequired}
//                           />
//                         </label>
//                         {getUploadStatusMessage(item)}
                        
//                         {imagePreviews[item] && (
//                           <div className={styles.imagePreviewContainer}>
//                             <img 
//                               src={imagePreviews[item]} 
//                               alt={`${item} preview`} 
//                               className={styles.imagePreview}
//                               onError={(e) => {
//                                 console.error('Image failed to load:', imagePreviews[item]);
//                                 e.target.style.display = 'none';
//                               }}
//                             />
//                           </div>
//                         )}
//                         {hasError && <span className={styles.errorMessage}>{validationErrors[item]}</span>}

//                         {value.value && value.value.startsWith('/static/uploads/') && (
//                           <div className={styles.currentFileInfo}>
//                             <p>Current file: {value.value.split('/').pop()}</p>
//                           </div>
//                         )}
//                       </div>
//                     ) : value.type === "checkbox" ? (
//                       <div>
//                         <label>
//                           <input 
//                             type={value.type}
//                             name={item} 
//                             checked={configValues[item] === true || configValues[item] === 'true'}
//                             onChange={(e) => handleInputChange(item, e.target.checked)}
//                             required={isRequired}
//                           />
//                         </label>
//                         {hasError && <span className={styles.errorMessage}>{validationErrors[item]}</span>}
//                       </div>
//                     ) : (
//                       <div>
//                         <input 
//                           className={`${styles.inputNodeDetails} ${hasError ? styles.inputError : ''}`}
//                           name={item} 
//                           type={value.type} 
//                           value={configValues[item] || ''}
//                           onChange={(e) => handleInputChange(item, e.target.value)}
//                           required={isRequired}
//                           {...(nodeData.data.deviceType === 'delay' && item === 'delaySeconds' ? {
//                             type: 'number',
//                             min: '1',
//                             step: '1'
//                           } : {})}
//                         />
//                         {hasError && <span className={styles.errorMessage}>{validationErrors[item]}</span>}
//                       </div>
//                     )}
//                   </div>
//                 </label>
//               </div>
//             );
//           })}
//           <div className={styles.configButtons}>
//             <button 
//               className={styles.theme__button} 
//               onClick={handleSave} 
//               disabled={isAnyUploading}
//             >
//               {isAnyUploading ? 'Uploading...' : 'Save'}
//             </button>
//             <button 
//               onClick={onClose} 
//               className={styles.theme__button} 
//               disabled={isAnyUploading}
//             >
//               Close
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default NodeDetails;