
import React from 'react';
import { createRoot } from 'react-dom/client';
import PopupApp from './components/PopupApp';
import { Toaster } from '@/components/ui/toaster';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupApp />
    <Toaster />
  </React.StrictMode>
);
