'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Download, AlertCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const generationSteps = [
  'Extraction des documents uploadés',
  'Recherche de sources fiables',
  'Analyse et sélection des passages',
  'Rédaction du document',
  'Ajout des citations et références'
];

export function GenerationView() {
  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const startGeneration = async () => {
    setGenerating(true);
    setError(null);
    setCurrentStep(0);
    setResult(null);

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev < generationSteps.length - 1 ? prev + 1 : prev));
    }, 2000);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST'
      });

      const data = await res.json();

      clearInterval(stepInterval);
      setCurrentStep(generationSteps.length);

      if (!data.success) {
        setError({
          message: data.error,
          recommendations: data.recommendations
        });
        setGenerating(false);
        return;
      }

      setResult(data);
    } catch (err) {
      clearInterval(stepInterval);
      setError({ message: err.message });
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    startGeneration();
  }, []);

  const handleDownload = () => {
    if (result?.downloadUrl) {
      window.location.href = result.downloadUrl;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Génération</h2>
        <p className="text-muted-foreground">
          Création de votre document sourcé
        </p>
      </div>

      {generating && (
        <div className="space-y-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
          </div>
          <div className="space-y-3">
            {generationSteps.map((step, index) => (
              <div
                key={index}
                className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${
                  index <= currentStep ? 'bg-primary/10' : 'bg-muted/30'
                }`}
              >
                {index < currentStep ? (
                  <Check className="h-5 w-5 text-primary" />
                ) : index === currentStep ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                )}
                <span
                  className={index <= currentStep ? 'font-medium' : 'text-muted-foreground'}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Impossible de générer le document</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>{error.message}</p>
              {error.recommendations && (
                <div className="mt-4">
                  <p className="font-medium">Recommandations :</p>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {error.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="space-y-6">
          <Alert>
            <Check className="h-4 w-4" />
            <AlertTitle>Document généré avec succès !</AlertTitle>
            <AlertDescription>
              Votre document est prêt à être téléchargé.
            </AlertDescription>
          </Alert>

          <div className="bg-muted rounded-lg p-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Informations du document</h3>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Citations : </span>
                  <span className="font-medium">{result.citations?.length || 0}</span>
                </p>
                {result.validation && !result.validation.valid && (
                  <div className="mt-3">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Certaines sections ont moins de citations que recommandé.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Button onClick={handleDownload} size="lg" className="w-full">
            <Download className="mr-2 h-5 w-5" />
            Télécharger le document (DOCX)
          </Button>
        </div>
      )}
    </div>
  );
}
