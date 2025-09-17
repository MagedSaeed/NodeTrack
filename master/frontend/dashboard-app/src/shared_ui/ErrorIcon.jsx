import { useState, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

// Custom tooltip component for error display
const ErrorIcon = ({ message, size = "h-5 w-5" }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const iconRef = useRef(null);

  return (
    <div className="relative inline-block">
      <AlertCircle
        ref={iconRef}
        className={`${size} text-red-500 cursor-pointer`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      />
      {showTooltip && (
        <div
          className="fixed px-3 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-xl whitespace-nowrap max-w-sm border border-gray-600"
          style={{
            zIndex: 10000,
            top: iconRef.current ? `${iconRef.current.getBoundingClientRect().top - 10}px` : '0px',
            left: iconRef.current ? `${iconRef.current.getBoundingClientRect().left + iconRef.current.getBoundingClientRect().width / 2}px` : '0px',
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none'
          }}
        >
          {message}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
};

export default ErrorIcon;