# Sécurité

## Versions soutenues

| Version | Soutien |
|---|---|
| 1.x | oui |

Les versions antérieures ne reçoivent pas de correctif.

## Signaler une vulnérabilité

Utilisez l'avis privé GitHub du dépôt:

<https://github.com/SBK-Techno/ligue-hockey/security/advisories/new>

N'ouvrez pas d'issue publique et n'incluez aucun secret, jeton, mot de passe ou donnée de membre dans un rapport.

Un rapport utile contient:

- la version ou le commit touché;
- les étapes de reproduction;
- l'impact observé ou attendu;
- le vecteur d'attaque et les préconditions;
- une preuve minimale, sans donnée réelle.

## Délais

- Accusé de réception sous trois jours ouvrables.
- Évaluation et plan de correction sous dix jours ouvrables.
- Correctif selon la gravité, avec une version publiée et une note de sécurité.

## Périmètre

Sont prioritaires:

- l'authentification, les sessions, les invitations et les réinitialisations;
- le contrôle d'accès entre joueur et administrateur;
- toute fuite des notes, des écarts d'alignement ou des soldes;
- les paiements et les échéances;
- Web Push et les courriels transactionnels;
- les migrations, les sauvegardes et l'image de production.

## Dépendances

Dependabot propose les mises à jour, la revue des dépendances bloque les changements à risque élevé, CodeQL analyse le code et `npm audit --omit=dev --audit-level=high` tourne chaque semaine. Une alerte de sécurité se corrige avant la prochaine publication.

## Secrets

Les secrets vivent dans l'environnement de l'hôte, jamais dans le dépôt, une image, un journal ou un rapport. `.env` est ignoré par Git. Le secret Better Auth et les clés VAPID se génèrent une seule fois et se conservent hors du dépôt.
