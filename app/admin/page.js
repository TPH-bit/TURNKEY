'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, BarChart, Shield, Settings } from 'lucide-react';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const [analytics, setAnalytics] = useState(null);
  const [moderation, setModeration] = useState([]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur de connexion');
        return;
      }

      setAuthenticated(true);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [analyticsRes, moderationRes] = await Promise.all([
        fetch('/api/admin/analytics'),
        fetch('/api/admin/moderation')
      ]);

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      }

      if (moderationRes.ok) {
        const moderationData = await moderationRes.json();
        setModeration(moderationData.events || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const handlePurge = async () => {
    if (!confirm('Êtes-vous sûr de vouloir purger les sessions expirées ?')) {
      return;
    }

    try {
      const res = await fetch('/api/admin/purge', { method: 'POST' });
      const data = await res.json();
      alert(`Purge effectuée : ${data.sessionsDeleted} sessions, ${data.filesDeleted} fichiers supprimés`);
    } catch (err) {
      alert('Erreur lors de la purge');
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Admin TURNKEY</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Nom d'utilisateur</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Se connecter
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-4">
                Par défaut : admin / admin123
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Administration TURNKEY</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="analytics">
              <BarChart className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="moderation">
              <Shield className="h-4 w-4 mr-2" />
              Modération
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Paramètres
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Vue d'ensemble</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="text-sm text-muted-foreground">Taux de complétion</div>
                        <div className="text-3xl font-bold">{analytics.completionRate?.toFixed(1) || 0}%</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold">Événements</h3>
                      <div className="space-y-2">
                        {analytics.events?.map((event, i) => (
                          <div key={i} className="flex justify-between p-2 bg-muted rounded">
                            <span>{event.event_name}</span>
                            <span className="font-semibold">{event.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Chargement...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="moderation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Événements bloqués</CardTitle>
              </CardHeader>
              <CardContent>
                {moderation.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Raison</TableHead>
                        <TableHead>Règle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {moderation.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>{new Date(event.created_at).toLocaleString('fr-FR')}</TableCell>
                          <TableCell>{event.event_type}</TableCell>
                          <TableCell>{event.reason}</TableCell>
                          <TableCell>{event.rule_matched}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground">Aucun événement bloqué</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions système</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Purge automatique</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Supprimer les sessions et fichiers expirés (&gt;24h)
                  </p>
                  <Button onClick={handlePurge} variant="outline">
                    Lancer la purge
                  </Button>
                </div>
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Configuration</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rétention sessions</span>
                      <span className="font-medium">24 heures</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fichiers max par upload</span>
                      <span className="font-medium">5</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taille max fichier</span>
                      <span className="font-medium">2 MB</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
