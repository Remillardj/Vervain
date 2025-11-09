
import React from 'react';
import { createRoot } from 'react-dom/client';
import OptionsPage from './components/OptionsPage';
import { Toaster } from '@/components/ui/toaster';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsPage />
    <Toaster />
  </React.StrictMode>
);
