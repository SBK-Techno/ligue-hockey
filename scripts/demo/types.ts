/**
 * Forme du jeu de données de démonstration.
 *
 * Ce fichier ne contient aucune donnée : il fixe le contrat que
 * `catalogue.ts` remplit et que `seed-demo.ts` consomme. Les noms, les lieux
 * et les messages restent des faits de démonstration, jamais des valeurs
 * codées dans la logique.
 */

export type DemoPosition = 'forward' | 'defense' | 'goalie';

export type DemoPlayer = {
	firstName: string;
	lastName: string;
	position: DemoPosition;
	/** Âge réel du joueur, borné par les limites de la ligue. */
	age: number;
	/** Numéro de chandail unique dans la ligue. */
	jersey: number;
	/** Remplaçant : ne confirme pas sa présence, réclame une place ouverte. */
	substitute: boolean;
	/** Compte de connexion avec mot de passe connu. Quatre au maximum. */
	login: boolean;
};

export type DemoLocation = {
	name: string;
	address: string;
	notes: string | null;
};

export type DemoChatLine = {
	/** Index dans `PLAYERS`. */
	author: number;
	/** Nombre de jours avant aujourd'hui. */
	daysAgo: number;
	/** Heure locale du message, 0 à 23. */
	hour: number;
	body: string;
};

export type DemoPoll = {
	author: number;
	daysAgo: number;
	/** Nombre de jours avant la fermeture; null pour un sondage sans échéance. */
	closesInDays: number | null;
	question: string;
	options: string[];
	/** Votes par option, dans le même ordre. La somme reste sous le nombre de joueurs. */
	votes: number[];
};

export type DemoScore = {
	/** Buts de l'équipe blanche. */
	white: number;
	/** Buts de l'équipe noire. */
	black: number;
};

export type DemoRules = {
	/** Paires qui doivent jouer ensemble. */
	together: [number, number][];
	/** Paires qui ne doivent pas jouer ensemble. */
	apart: [number, number][];
	/** Paires à éviter sans être bloquantes. */
	preferApart: [number, number][];
};
