
import React, { useEffect, useState } from 'react';
import { getData } from '@/utils/storage';
import SetupPage from './SetupPage';
import Dashboard from './Dashboard';

const PopupApp = () => {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const data = await getData();
        setIsSetupComplete(data.setupComplete);
      } catch (error) {
        console.error("Error checking setup:", error);
        setIsSetupComplete(false);
      }
    };

    checkSetup();
  }, []);

  if (isSetupComplete === null) {
    return (
      <div className="flex items-center justify-center h-64 w-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4B2EE3]"></div>
      </div>
    );
  }

  return (
    <div className="w-96 min-h-96">
      {isSetupComplete ? <Dashboard /> : <SetupPage />}
    </div>
  );
};

export default PopupApp;
