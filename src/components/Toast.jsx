import React from 'react';
import styles from './Toast.module.css';

const Toast = ({ message, type }) => {
  return (
    <div className={`${styles.toast} ${styles[type]}`}>
      {message}
    </div>
  );
};

export default Toast;