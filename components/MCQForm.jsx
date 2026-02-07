'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';

export function MCQForm({ onComplete }) {
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const res = await fetch('/api/mcq/generate', {
        method: 'POST'
      });

      if (!res.ok) {
        throw new Error('Erreur lors de la génération des questions');
      }

      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (error) {
      console.error('Error loading questions:', error);
      alert('Erreur lors du chargement des questions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(responses).length < questions.length) {
      alert('Veuillez répondre à toutes les questions');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/mcq/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erreur');
      }

      onComplete();
    } catch (error) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Analyse de votre requête et génération des questions d'affinage...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <p className="text-muted-foreground text-center">
        Questions personnalisées basées sur votre requête et vos documents
      </p>

      <div className="space-y-6">
        {questions.map((q, index) => (
          <div key={index} className="space-y-3">
            <Label className="text-base font-medium">{q.question}</Label>
            <RadioGroup
              value={responses[`q${index}`]}
              onValueChange={(value) =>
                setResponses((prev) => ({ ...prev, [`q${index}`]: value }))
              }
            >
              {q.options.map((option, optIdx) => (
                <div key={optIdx} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`q${index}-opt${optIdx}`} />
                  <Label htmlFor={`q${index}-opt${optIdx}`} className="cursor-pointer font-normal">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        ))}
      </div>

      <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Continuer
      </Button>
    </div>
  );
}
