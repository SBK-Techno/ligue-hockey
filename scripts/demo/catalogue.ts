/**
 * Jeu de données de démonstration de la ligue du dimanche matin.
 *
 * Les noms, les adresses et les messages sont fictifs.
 */

import type {
	DemoChatLine,
	DemoLocation,
	DemoPlayer,
	DemoPoll,
	DemoRules,
	DemoScore
} from './types.ts';

/**
 * Le résultat de chaque match joué, dans l'ordre chronologique. Le générateur
 * de démonstration en tire les buts et les aides; aucun score n'est inventé
 * par le script.
 */
export const SCORES: DemoScore[] = [
	{ white: 4, black: 2 },
	{ white: 1, black: 3 },
	{ white: 5, black: 5 },
	{ white: 2, black: 1 },
	{ white: 3, black: 4 },
	{ white: 6, black: 3 },
	{ white: 2, black: 2 },
	{ white: 4, black: 5 },
	{ white: 3, black: 1 },
	{ white: 5, black: 4 },
	{ white: 1, black: 2 },
	{ white: 4, black: 3 }
];

export const PLAYERS: DemoPlayer[] = [
	{ firstName: 'Vincent', lastName: 'Ouellet', position: 'goalie', age: 35, jersey: 31, substitute: false, login: true },
	{ firstName: 'Samuel', lastName: 'Tremblay', position: 'defense', age: 34, jersey: 4, substitute: false, login: true },
	{ firstName: 'Mathieu', lastName: 'Bouchard', position: 'forward', age: 33, jersey: 10, substitute: false, login: true },
	{ firstName: 'Julien', lastName: 'Bélanger', position: 'forward', age: 29, jersey: 25, substitute: true, login: true },
	{ firstName: 'Tiago', lastName: 'Ferreira', position: 'goalie', age: 37, jersey: 33, substitute: true, login: false },
	{ firstName: 'Félix', lastName: 'Bergeron', position: 'goalie', age: 23, jersey: 30, substitute: false, login: false },
	{ firstName: 'Dany', lastName: 'Petiquay', position: 'goalie', age: 53, jersey: 35, substitute: false, login: false },
	{ firstName: 'Jean-Philippe', lastName: 'Côté', position: 'defense', age: 39, jersey: 8, substitute: false, login: false },
	{ firstName: 'Marc-Olivier', lastName: 'Lavoie', position: 'defense', age: 30, jersey: 12, substitute: true, login: false },
	{ firstName: 'Karim', lastName: 'Haddad', position: 'defense', age: 32, jersey: 22, substitute: false, login: false },
	{ firstName: 'Kervens', lastName: 'Jean-Baptiste', position: 'defense', age: 27, jersey: 5, substitute: false, login: false },
	{ firstName: 'Andrés', lastName: 'Morales', position: 'defense', age: 31, jersey: 55, substitute: false, login: false },
	{ firstName: 'Philippe', lastName: 'Rhéaume', position: 'defense', age: 48, jersey: 77, substitute: false, login: false },
	{ firstName: 'Ibrahim', lastName: 'Traoré', position: 'defense', age: 24, jersey: 3, substitute: false, login: false },
	{ firstName: 'Thanh', lastName: 'Pham', position: 'defense', age: 29, jersey: 2, substitute: false, login: false },
	{ firstName: 'Pierre-Luc', lastName: 'Gauthier', position: 'defense', age: 51, jersey: 21, substitute: false, login: false },
	{ firstName: 'Étienne', lastName: 'Gagnon', position: 'forward', age: 19, jersey: 11, substitute: false, login: false },
	{ firstName: 'Olivier', lastName: 'Fortin', position: 'forward', age: 37, jersey: 14, substitute: false, login: false },
	{ firstName: 'Alexandre', lastName: 'Nadeau', position: 'forward', age: 28, jersey: 15, substitute: false, login: false },
	{ firstName: 'Gabriel', lastName: 'Beaulieu', position: 'forward', age: 26, jersey: 17, substitute: false, login: false },
	{ firstName: 'Antoine', lastName: 'Rousseau', position: 'forward', age: 32, jersey: 19, substitute: false, login: false },
	{ firstName: 'Patrick', lastName: 'Boulanger', position: 'forward', age: 31, jersey: 24, substitute: false, login: false },
	{ firstName: 'Widner', lastName: 'Célestin', position: 'forward', age: 34, jersey: 26, substitute: false, login: false },
	{ firstName: 'João', lastName: 'Da Silva', position: 'forward', age: 45, jersey: 32, substitute: false, login: false },
	{ firstName: 'Diego', lastName: 'Quintero', position: 'forward', age: 30, jersey: 34, substitute: false, login: false },
	{ firstName: 'Chidi', lastName: 'Okonkwo', position: 'forward', age: 27, jersey: 36, substitute: true, login: false },
	{ firstName: 'Jonathan', lastName: 'Awashish', position: 'forward', age: 43, jersey: 37, substitute: false, login: false },
	{ firstName: 'Xavier', lastName: 'Martel', position: 'forward', age: 24, jersey: 39, substitute: false, login: false },
];

export const LOCATIONS: DemoLocation[] = [
	{ name: 'Aréna du Boisé', address: '1420 rue du Boisé, Trois-Rivières', notes: 'Bâtiment de 1962, une seule glace, les estrades sont petites.' },
	{ name: 'Complexe sportif de la Rivière', address: '845 boulevard des Estacades, Drummondville', notes: 'Deux glaces, vestiaires au sous-sol, entrée par la porte ouest.' },
	{ name: 'Aréna du Vieux-Moulin', address: '310 rue Saint-Maurice, Shawinigan', notes: 'Stationnement extérieur seulement, arrive 20 minutes avant ton match.' },
	{ name: 'Centre sportif de la Colline', address: '1125 avenue du Bourg-Royal, Québec', notes: null },
];

export const CHAT_LINES: DemoChatLine[] = [
	{ author: 17, daysAgo: 30, hour: 19, body: 'Le souper d’équipe s’en vient. Je peux recevoir chez moi.' },
	{ author: 21, daysAgo: 25, hour: 21, body: 'La ligue veut les grandeurs de chandail avant la fin du mois.' },
	{ author: 14, daysAgo: 25, hour: 21, body: 'Grand pour moi.' },
	{ author: 19, daysAgo: 25, hour: 22, body: 'Moyen pour moi, comme d’habitude.' },
	{ author: 22, daysAgo: 18, hour: 12, body: 'Mon quart finit à 7 h 30, je vais être en retard.' },
	{ author: 2, daysAgo: 18, hour: 12, body: 'Pas de trouble, on te garde une place.' },
	{ author: 6, daysAgo: 14, hour: 8, body: 'La glace était lente hier, mes genoux s’en souviennent.' },
	{ author: 15, daysAgo: 14, hour: 20, body: 'À mon âge, la glace lente, c’est une excuse.' },
	{ author: 5, daysAgo: 11, hour: 7, body: 'Deux gardiens pour dimanche, on est corrects.' },
	{ author: 0, daysAgo: 11, hour: 7, body: 'Je prends la première moitié, tu prends la deuxième.' },
	{ author: 5, daysAgo: 11, hour: 8, body: 'Ça marche.' },
	{ author: 26, daysAgo: 9, hour: 21, body: 'Je ne serai pas là dimanche, mariage de mon frère.' },
	{ author: 2, daysAgo: 9, hour: 21, body: 'C’est noté, bonne journée à toi.' },
	{ author: 7, daysAgo: 7, hour: 9, body: 'Il reste deux paiements avant la fin de la saison. Je relance les retardataires cette semaine.' },
	{ author: 15, daysAgo: 7, hour: 9, body: 'Déjà payé de mon côté.' },
	{ author: 14, daysAgo: 7, hour: 10, body: 'Moi aussi.' },
	{ author: 10, daysAgo: 6, hour: 19, body: 'Je serai là dimanche, avec mon chandail blanc.' },
	{ author: 1, daysAgo: 6, hour: 19, body: 'On joue en noir cette semaine, mais on t’aime quand même.' },
	{ author: 10, daysAgo: 6, hour: 19, body: 'Bien vu.' },
	{ author: 12, daysAgo: 5, hour: 9, body: 'Le hors-jeu était clair, la rondelle n’avait pas encore franchi la ligne.' },
	{ author: 2, daysAgo: 5, hour: 9, body: 'Tes deux pieds étaient dans la zone avant la rondelle, c’est tout.' },
	{ author: 19, daysAgo: 5, hour: 10, body: 'J’ai revu la séquence, Philippe a raison.' },
	{ author: 12, daysAgo: 5, hour: 10, body: 'Enfin quelqu’un qui regarde les reprises.' },
	{ author: 7, daysAgo: 4, hour: 9, body: 'La passe à l’aveugle sur la ligne bleue, c’était pas mon meilleur moment.' },
	{ author: 17, daysAgo: 4, hour: 9, body: 'Le filet était vide, il fallait juste la mettre dedans.' },
	{ author: 7, daysAgo: 4, hour: 10, body: 'Merci du soutien.' },
	{ author: 13, daysAgo: 4, hour: 18, body: 'On a encore joué à un seul défenseur, ça paraissait en troisième.' },
	{ author: 9, daysAgo: 3, hour: 8, body: 'C’est quoi l’heure du match, déjà ?' },
	{ author: 2, daysAgo: 3, hour: 8, body: '8 h 30, présence à 8 h.' },
	{ author: 9, daysAgo: 3, hour: 9, body: 'Parfait.' },
	{ author: 13, daysAgo: 2, hour: 12, body: 'Je peux prendre trois gars en covoiturage, départ à 7 h.' },
	{ author: 25, daysAgo: 2, hour: 12, body: 'Moi, je suis sur ton chemin.' },
	{ author: 20, daysAgo: 2, hour: 19, body: 'Mon gars joue son tournoi à Shawinigan. Je vais arriver juste à temps.' },
	{ author: 15, daysAgo: 1, hour: 20, body: 'Il annonce de la pluie verglaçante pour dimanche matin. Prends le temps de déglacer ton char.' },
	{ author: 1, daysAgo: 1, hour: 20, body: 'Ça va fondre avant 8 h, pas de panique.' },
	{ author: 11, daysAgo: 1, hour: 21, body: 'J’ai les chandails dans mon coffre, je les apporte demain.' },
	{ author: 2, daysAgo: 0, hour: 6, body: 'Debout.' },
	{ author: 2, daysAgo: 0, hour: 7, body: 'Bon match les gars, on se retrouve sur la glace.' },
	{ author: 8, daysAgo: 0, hour: 7, body: 'J’arrive dans 10 minutes.' },
	{ author: 16, daysAgo: 0, hour: 7, body: 'Quelqu’un a un bâton de rechange ?' },
	{ author: 3, daysAgo: 0, hour: 8, body: 'Oui, j’en ai deux dans l’auto.' },
	{ author: 24, daysAgo: 0, hour: 12, body: 'Je passe au dépanneur, qui veut de la bière pour tantôt ?' },
	{ author: 18, daysAgo: 0, hour: 12, body: 'Une caisse de 24, ça devrait suffire.' },
	{ author: 0, daysAgo: 0, hour: 13, body: 'J’ai perdu un gant noir dans le vestiaire 3.' },
	{ author: 24, daysAgo: 0, hour: 13, body: 'Je l’ai, je te le remets dimanche.' },
];

export const POLLS: DemoPoll[] = [
	{
		author: 21,
		daysAgo: 20,
		closesInDays: 2,
		question: 'Qui apporte la bière dimanche ?',
		options: ['Mathieu', 'Samuel', 'Julien', 'À déterminer'],
		votes: [11, 4, 3, 2],
	},
	{
		author: 7,
		daysAgo: 14,
		closesInDays: 5,
		question: 'Quelle grandeur de chandail commandes-tu ?',
		options: ['Petit', 'Moyen', 'Grand', 'Très grand'],
		votes: [4, 12, 8, 3],
	},
	{
		author: 17,
		daysAgo: 28,
		// Sans échéance : la date se confirme au prochain match.
		closesInDays: null,
		question: 'Quel soir pour le souper d’équipe ?',
		options: ['Vendredi 12', 'Samedi 13', 'Dimanche 14'],
		votes: [7, 14, 5],
	},
	{
		author: 0,
		daysAgo: 3,
		closesInDays: 1,
		question: 'Qui garde le filet dimanche prochain ?',
		options: ['Vincent', 'Félix', 'Dany', 'Un remplaçant'],
		votes: [9, 8, 2, 1],
	},
	{
		author: 22,
		daysAgo: 9,
		closesInDays: 3,
		question: 'Peut-on déplacer le match du 22 au 29 ?',
		options: ['Oui, le 29 me va', 'Non, je travaille', 'Peu importe'],
		votes: [16, 5, 4],
	},
];

export const RULES: DemoRules = {
	together: [
		// Ibrahim et Chidi font du covoiturage ensemble.
		[13, 25],
		// Samuel et Jean-Philippe forment la première paire de défenseurs.
		[1, 7],
	],
	apart: [
		// Philippe et Mathieu se chicanent depuis le débat sur le hors-jeu.
		[12, 2],
		// Karim et Thanh ont déjà été coéquipiers et se cherchent encore.
		[9, 14],
	],
	// Gabriel et Alexandre se tiennent loin l’un de l’autre sans que ce soit bloquant.
	preferApart: [[19, 18]],
};
