import React, { useState } from 'react';
import styles from './CopyLinkButton.module.css';

const CopyLinkButton = ({ roomId, onCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const url = `${window.location.origin}/viewer?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    if (onCopy) onCopy();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button className={styles.button} onClick={handleCopy}>
      {copied ? '✅ Copied!' : '📋 Copy Viewer Link'}
    </button>
  );
};

export default CopyLinkButton;