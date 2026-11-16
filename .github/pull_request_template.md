## Résumé

Décrivez le comportement changé et la raison.

## Vérifications

- [ ] `npm run gate` passe localement.
- [ ] `npm run docs:check` passe si la documentation change.
- [ ] Le conteneur démarre et `/api/health` répond si l'image change.
- [ ] Les migrations sont générées et testées si le schéma change.
- [ ] Aucun secret, jeton ou donnée de membre n'est ajouté au dépôt.

## Risques et retour arrière

Décrivez les données touchées, la migration et le retour arrière.
