import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SenderPage from './pages/SenderPage';
import ViewerPage from './pages/ViewerPage';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/sender" element={<SenderPage />} />
        <Route path="/viewer" element={<ViewerPage />} />
        <Route path="*" element={<Navigate to="/sender" replace />} />
      </Routes>
    </Router>
  );
};

export default App;