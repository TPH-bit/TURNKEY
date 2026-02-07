'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function QueryInput({ onComplete }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const maxChars = 2000;

  const handleSubmit = async () => {
    if (query.length < 50) {
      setError('La requête doit contenir au moins 50 caractères');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/query/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.blocked) {
          setError(`Contenu bloqué: ${data.reason}`);
        } else {
          throw new Error(data.error || 'Erreur');
        }
        return;
      }

      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Votre Requête</h2>
        <p className="text-muted-foreground">
          Décrivez précisément ce que vous souhaitez dans le document
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="query" className="text-base">Requête</Label>
        <Textarea
          id="query"
          value={query}
          onChange={(e) => setQuery(e.target.value.slice(0, maxChars))}
          placeholder="Décrivez votre besoin en détail..."
          className="min-h-[300px] text-base"
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Minimum 50 caractères</span>
          <span>
            {query.length} / {maxChars}
          </span>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleSubmit}
        disabled={loading || query.length < 50}
        className="w-full"
        size="lg"
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Continuer
      </Button>
    </div>
  );
}
