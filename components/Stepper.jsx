'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  { id: 1, name: 'Profil', description: 'Informations de base' },
  { id: 2, name: 'Requête', description: 'Votre demande' },
  { id: 3, name: 'Documents', description: 'Upload (optionnel)' },
  { id: 4, name: 'Affinage', description: 'QCM' },
  { id: 5, name: 'Génération', description: 'Téléchargement' }
];

export function Stepper({ currentStep }) {
  return (
    <div className="w-full py-8">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all',
                  currentStep > step.id
                    ? 'bg-primary border-primary text-primary-foreground'
                    : currentStep === step.id
                    ? 'border-primary text-primary font-semibold'
                    : 'border-muted-foreground/30 text-muted-foreground'
                )}
              >
                {currentStep > step.id ? (
                  <Check className="w-6 h-6" />
                ) : (
                  <span className="text-lg">{step.id}</span>
                )}
              </div>
              <div className="mt-2 text-center">
                <div
                  className={cn(
                    'text-sm font-medium',
                    currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.name}
                </div>
                <div className="text-xs text-muted-foreground">{step.description}</div>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-2 transition-all',
                  currentStep > step.id ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
