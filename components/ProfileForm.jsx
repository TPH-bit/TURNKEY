'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export function ProfileForm({ onComplete }) {
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const requiredFields = ['age', 'education', 'profession', 'domain', 'objective'];
    const missingFields = requiredFields.filter(field => !responses[field]);
    
    if (missingFields.length > 0) {
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
      <div className="space-y-6">
        <div className="space-y-3">
          <Label className="text-base font-medium">Âge</Label>
          <Select value={responses.age} onValueChange={(value) => setResponses(prev => ({ ...prev, age: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez votre tranche d'âge" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="13-17">13-17 ans</SelectItem>
              <SelectItem value="18-25">18-25 ans</SelectItem>
              <SelectItem value="26-35">26-35 ans</SelectItem>
              <SelectItem value="36-50">36-50 ans</SelectItem>
              <SelectItem value="51-65">51-65 ans</SelectItem>
              <SelectItem value="65+">65 ans et plus</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-medium">Niveau d'études</Label>
          <Select value={responses.education} onValueChange={(value) => setResponses(prev => ({ ...prev, education: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez votre niveau" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="college">Collège</SelectItem>
              <SelectItem value="lycee">Lycée</SelectItem>
              <SelectItem value="bac">Bac</SelectItem>
              <SelectItem value="bac+2">Bac+2 (BTS, DUT, Licence 2)</SelectItem>
              <SelectItem value="bac+3">Bac+3 (Licence)</SelectItem>
              <SelectItem value="bac+5">Bac+5 (Master, Ingénieur)</SelectItem>
              <SelectItem value="doctorat">Doctorat</SelectItem>
              <SelectItem value="autre">Autre / Formation professionnelle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-medium">Catégorie professionnelle</Label>
          <Select value={responses.profession} onValueChange={(value) => setResponses(prev => ({ ...prev, profession: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez votre catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="etudiant">Étudiant</SelectItem>
              <SelectItem value="enseignant">Enseignant / Formateur</SelectItem>
              <SelectItem value="chercheur">Chercheur / Universitaire</SelectItem>
              <SelectItem value="cadre">Cadre / Manager</SelectItem>
              <SelectItem value="employe">Employé</SelectItem>
              <SelectItem value="technicien">Technicien</SelectItem>
              <SelectItem value="professionliberal">Profession libérale</SelectItem>
              <SelectItem value="entrepreneur">Entrepreneur / Indépendant</SelectItem>
              <SelectItem value="sansemploi">Sans emploi</SelectItem>
              <SelectItem value="retraite">Retraité</SelectItem>
              <SelectItem value="autre">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-medium">Domaine du document</Label>
          <Select value={responses.domain} onValueChange={(value) => setResponses(prev => ({ ...prev, domain: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez le domaine" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="education">Éducation / Pédagogie</SelectItem>
              <SelectItem value="sante">Santé / Médical</SelectItem>
              <SelectItem value="technologie">Technologie / Informatique</SelectItem>
              <SelectItem value="juridique">Juridique / Droit</SelectItem>
              <SelectItem value="finance">Finance / Économie</SelectItem>
              <SelectItem value="sciences">Sciences / Recherche</SelectItem>
              <SelectItem value="humanities">Sciences humaines</SelectItem>
              <SelectItem value="business">Business / Management</SelectItem>
              <SelectItem value="marketing">Marketing / Communication</SelectItem>
              <SelectItem value="ingenierie">Ingénierie</SelectItem>
              <SelectItem value="environnement">Environnement / Écologie</SelectItem>
              <SelectItem value="autre">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-medium">Objectif du document</Label>
          <RadioGroup
            value={responses.objective}
            onValueChange={(value) => setResponses(prev => ({ ...prev, objective: value }))}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="recherche" id="obj-recherche" />
              <Label htmlFor="obj-recherche" className="cursor-pointer font-normal">
                Recherche / Étude académique
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="presentation" id="obj-presentation" />
              <Label htmlFor="obj-presentation" className="cursor-pointer font-normal">
                Présentation / Exposé
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="rapport" id="obj-rapport" />
              <Label htmlFor="obj-rapport" className="cursor-pointer font-normal">
                Rapport professionnel
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="synthese" id="obj-synthese" />
              <Label htmlFor="obj-synthese" className="cursor-pointer font-normal">
                Synthèse / Résumé
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="article" id="obj-article" />
              <Label htmlFor="obj-article" className="cursor-pointer font-normal">
                Article / Publication
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="memoire" id="obj-memoire" />
              <Label htmlFor="obj-memoire" className="cursor-pointer font-normal">
                Mémoire / Thèse
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="formation" id="obj-formation" />
              <Label htmlFor="obj-formation" className="cursor-pointer font-normal">
                Support de formation
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="personnel" id="obj-personnel" />
              <Label htmlFor="obj-personnel" className="cursor-pointer font-normal">
                Usage personnel / Culture générale
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={loading} className="w-full" size="lg">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Continuer
      </Button>
    </div>
  );
}
