'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    <div className="max-w-5xl mx-auto space-y-8">
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
              {result.mode === 'demo' && result.notice && (
                <p className="text-sm text-muted-foreground mt-2">{result.notice}</p>
              )}
            </AlertDescription>
          </Alert>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">{result.document?.title || 'Document généré'}</h3>
                  <Button onClick={handleDownload} size="lg">
                    <Download className="mr-2 h-5 w-5" />
                    Télécharger (DOCX)
                  </Button>
                </div>

                <div className="border-t pt-6 space-y-6 max-h-[600px] overflow-y-auto pr-2">
                  {result.document?.sections?.map((section, index) => (
                    <div key={index} className="space-y-3">
                      <h4 className="text-lg font-semibold text-primary">{section.title}</h4>
                      <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {section.content}
                      </div>
                    </div>
                  ))}
                </div>

                {result.citations && result.citations.length > 0 && (
                  <div className="border-t pt-6 space-y-3">
                    <h4 className="text-lg font-semibold">Sources & Références</h4>
                    <div className="space-y-2">
                      {result.citations.map((citation, index) => (
                        <div key={index} className="text-sm">
                          <span className="font-medium">[{citation.number}]</span>{' '}
                          <span className="italic">{citation.title}</span>
                          {citation.url && (
                            <span className="text-muted-foreground"> - {citation.url}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>Citations : {result.citations?.length || 0}</span>
                    {result.validation && !result.validation.valid && (
                      <span className="text-amber-600">
                        ⚠️ Certaines sections ont moins de citations que recommandé
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button onClick={handleDownload} size="lg" className="w-full max-w-md">
              <Download className="mr-2 h-5 w-5" />
              Télécharger le document complet (DOCX)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
