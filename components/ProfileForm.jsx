'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';

const profileQuestions = [
  {
    id: 'domain',
    question: 'Dans quel domaine se situe votre requête ?',
    options: ['Éducation', 'Santé', 'Technologie', 'Juridique', 'Autre']
  },
  {
    id: 'expertise',
    question: 'Quel est votre niveau d\'expertise ?',
    options: ['Débutant', 'Intermédiaire', 'Expert']
  },
  {
    id: 'objective',
    question: 'Quel est l\'objectif du document ?',
    options: ['Recherche', 'Présentation', 'Rapport', 'Synthèse']
  }
];

export function ProfileForm({ onComplete }) {
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (Object.keys(responses).length < profileQuestions.length) {
      alert('Veuillez répondre à toutes les questions');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/profile/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileData: responses })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erreur');
      }

      onComplete();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Profil</h2>
        <p className="text-muted-foreground">
          Quelques questions pour mieux comprendre votre besoin
        </p>
      </div>

      <div className="space-y-6">
        {profileQuestions.map((q) => (
          <div key={q.id} className="space-y-3">
            <Label className="text-base font-medium">{q.question}</Label>
            <RadioGroup
              value={responses[q.id]}
              onValueChange={(value) =>
                setResponses((prev) => ({ ...prev, [q.id]: value }))
              }
            >
              {q.options.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${q.id}-${option}`} />
                  <Label htmlFor={`${q.id}-${option}`} className="cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        ))}
      </div>

      <Button onClick={handleSubmit} disabled={loading} className="w-full" size="lg">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Continuer
      </Button>
    </div>
  );
}
