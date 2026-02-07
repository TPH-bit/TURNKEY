'use client';

import { useState, useEffect } from 'react';
import { ProfileForm } from '@/components/ProfileForm';
import { QueryInput } from '@/components/QueryInput';
import { FileUpload } from '@/components/FileUpload';
import { MCQForm } from '@/components/MCQForm';
import { GenerationView } from '@/components/GenerationView';
import { Loader2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    try {
      const res = await fetch('/api/session/init');
      const data = await res.json();
      setSessionId(data.sessionId);
      setCurrentStep(1);
    } catch (error) {
      console.error('Session init error:', error);
      alert('Erreur lors de l\'initialisation de la session');
    } finally {
      setLoading(false);
    }
  };

  const handleStepComplete = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const handleGoBack = () => {
    if (currentStep > 1 && currentStep < 5) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-center">TURNKEY</h1>
          <p className="text-center text-muted-foreground mt-1">
            Génération de documents sourcés et fiables
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {currentStep > 1 && currentStep < 5 && (
          <div className="max-w-3xl mx-auto mb-6">
            <Button variant="ghost" onClick={handleGoBack}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </div>
        )}

        <div className="mt-6 mb-12">
          {currentStep === 1 && <ProfileForm onComplete={handleStepComplete} />}
          {currentStep === 2 && <QueryInput onComplete={handleStepComplete} />}
          {currentStep === 3 && (
            <FileUpload
              onComplete={handleStepComplete}
              onSkip={handleStepComplete}
            />
          )}
          {currentStep === 4 && <MCQForm onComplete={handleStepComplete} />}
          {currentStep === 5 && <GenerationView />}
        </div>
      </main>

      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>TURNKEY v1.0 - Documents sourcés et vérifiés</p>
          <p className="mt-1">
            Conçu pour un public 13+ | Modération active | Données conservées 24h
          </p>
        </div>
      </footer>
    </div>
  );
}
