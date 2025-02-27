import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import Modal from 'react-modal';
import { Key, Eye, EyeOff, Shield } from 'lucide-react';

// Enhanced Token Modal Component with show/hide password
const TokenInputModal = ({ isOpen, onRequestClose, onSubmit }) => {
  const [tokenValue, setTokenValue] = useState('');
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (tokenValue.trim()) {
      onSubmit(tokenValue.trim());
    }
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel="Authentication Required"
      style={{
        content: {
          top: '50%',
          left: '50%',
          right: 'auto',
          bottom: 'auto',
          marginRight: '-50%',
          transform: 'translate(-50%, -50%)',
          width: '400px',
          maxWidth: '90%',
          padding: '0',
          borderRadius: '8px',
          border: 'none',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
        },
      }}
    >
      {/* Header */}
      <div style={{
        backgroundColor: '#3B82F6',
        padding: '16px 20px',
        color: 'white',
        display: 'flex',
        alignItems: 'center'
      }}>
        <Shield size={18} style={{ marginRight: '8px' }} />
        <h3 style={{ margin: 0, fontWeight: '500', fontSize: '18px' }}>Authentication Required</h3>
      </div>
      
      {/* Body */}
      <div style={{ padding: '20px' }}>
        <form onSubmit={handleSubmit}>
          <p style={{ 
            fontSize: '14px', 
            color: '#4B5563', 
            marginTop: 0,
            marginBottom: '15px'
          }}>
            Please enter your access token to view the data.
          </p>
          
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <div style={{ 
              position: 'absolute', 
              left: '10px', 
              top: '50%', 
              transform: 'translateY(-50%)'
            }}>
              <Key size={16} color="#6B7280" />
            </div>
            
            <input
              type={isTokenVisible ? "text" : "password"}
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              placeholder="Enter your access token"
              style={{
                width: '100%',
                padding: '10px 36px 10px 32px',
                boxSizing: 'border-box',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '14px',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => e.target.style.borderColor = '#3B82F6'}
              onBlur={(e) => e.target.style.borderColor = '#D1D5DB'}
              autoFocus
            />
            
            <button
              type="button"
              onClick={() => setIsTokenVisible(!isTokenVisible)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                color: '#6B7280',
              }}
              aria-label={isTokenVisible ? "Hide token" : "Show token"}
            >
              {isTokenVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onRequestClose}
              style={{
                padding: '8px 16px',
                backgroundColor: '#F3F4F6',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#E5E7EB'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#F3F4F6'}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!tokenValue.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: tokenValue.trim() ? '#3B82F6' : '#93C5FD',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: tokenValue.trim() ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '500',
              }}
              onMouseOver={(e) => {
                if (tokenValue.trim()) e.target.style.backgroundColor = '#2563EB';
              }}
              onMouseOut={(e) => {
                if (tokenValue.trim()) e.target.style.backgroundColor = '#3B82F6';
              }}
            >
              Authenticate
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

// Token prompt function - keeps the same efficient implementation
let activePromptResolve = null;
let modalRoot = null;

export const promptForToken = () => {
  // Only create one prompt at a time
  if (activePromptResolve) {
    console.warn("Token prompt already active");
    return Promise.reject("Token prompt already active");
  }
  
  return new Promise((resolve) => {
    activePromptResolve = resolve;
    
    if (!modalRoot) {
      modalRoot = document.createElement('div');
      document.body.appendChild(modalRoot);
    }
    
    const handleClose = () => {
      cleanupModal();
      resolve(null);
    };
    
    const handleSubmit = (token) => {
      cleanupModal();
      resolve(token);
    };
    
    const cleanupModal = () => {
      ReactDOM.unmountComponentAtNode(modalRoot);
      activePromptResolve = null;
    };
    
    ReactDOM.render(
      <TokenInputModal 
        isOpen={true} 
        onRequestClose={handleClose} 
        onSubmit={handleSubmit} 
      />,
      modalRoot
    );
  });
};

// Cookie utility functions remain unchanged
export const setCookie = (name, value, days) => {
  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = '; expires=' + date.toUTCString();
  }
  document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/';
};

export const getCookie = (name) => {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
};

export const deleteCookie = (name) => {
  document.cookie = name + '=; Max-Age=-99999999; path=/';
};

// Keep the efficient fetch implementation unchanged
let pendingAuthRequest = null;

export const fetchWithTokenAuth = async ({
  url, 
  options = {}, 
  onSuccess, 
  onError, 
  setLoading
}) => {
  try {
    if (setLoading) setLoading(true);
    
    // Get token from cookies
    let token = getCookie('access_token');
    
    // If no token, get one (reuse in-progress request if exists)
    if (!token) {
      if (!pendingAuthRequest) {
        pendingAuthRequest = promptForToken().finally(() => {
          pendingAuthRequest = null;
        });
      }
      
      token = await pendingAuthRequest;
      
      if (!token) {
        throw new Error('Authentication required.');
      }
      
      setCookie('access_token', token, 7);
    }
    
    // Make the request with the token
    const requestUrl = new URL(url);
    requestUrl.searchParams.append('token', token);
    
    const response = await fetch(requestUrl.toString(), options);
    
    // Handle 401 error
    if (response.status === 401) {
      deleteCookie('access_token');
      
      // Get a new token
      if (!pendingAuthRequest) {
        pendingAuthRequest = promptForToken().finally(() => {
          pendingAuthRequest = null;
        });
      }
      
      const newToken = await pendingAuthRequest;
      
      if (!newToken) {
        throw new Error('Authentication required.');
      }
      
      setCookie('access_token', newToken, 7);
      
      // Retry with new token
      const retryUrl = new URL(url);
      retryUrl.searchParams.append('token', newToken);
      
      const retryResponse = await fetch(retryUrl.toString(), options);
      
      if (!retryResponse.ok) {
        throw new Error(`HTTP error! status: ${retryResponse.status}`);
      }
      
      const retryResult = await retryResponse.json();
      if (retryResult.error) {
        throw new Error(retryResult.error);
      }
      
      if (onSuccess) onSuccess(retryResult);
      return retryResult;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.error) {
      throw new Error(result.error);
    }
    
    if (onSuccess) onSuccess(result);
    return result;
  } catch (err) {
    if (onError) onError(err.message || 'Request failed');
    throw err;
  } finally {
    if (setLoading) setLoading(false);
  }
};