// The automatic stop (AutoStop.svelte, auto-stop.js): after a quiet time or
// daily at an hour. Until the VM can delete itself (docs/auto-stop.md, phase
// 3), the texts say plainly that a paused Paperless still costs until the app
// is opened again. German is the original; English beside it, key for key.
export const autoStop = {
	de: {
		title: 'Automatisch beenden',
		lede: 'Paperless sichert sich und hält an, wenn du es eine Weile nicht benutzt oder zu einer festen Uhrzeit. Die Einstellung liegt in deinem Tresor und gilt auf jedem Gerät.',
		honest: 'Angehalten kostet die Maschine noch so viel wie laufend. Erst wenn du die App wieder öffnest, löscht sie die Maschine nach der Sicherung, und dann kostet sie nichts mehr.',
		idle: 'Nach Ruhezeit',
		idleOff: 'nie',
		minutes: (/** @type {number} */ n) => (n % 60 === 0 ? `${n / 60} ${n === 60 ? 'Stunde' : 'Stunden'}` : `${n} Minuten`),
		other: 'andere',
		otherLabel: 'Minuten (15 bis 1440)',
		daily: 'Täglich um',
		dailyOff: 'nicht täglich',
		zone: (/** @type {string} */ z) => `Zeitzone: ${z}`,
		quiet: 'Als Benutzung zählt, was du in Paperless tust. Abrufe von E-Mails zählen nicht; solange Paperless noch Dokumente verarbeitet, hält es nicht an.',
		save: 'Speichern',
		saving: 'Speichern …',
		saved: 'Gespeichert.',
		savedRunning: 'Gespeichert und an die laufende Maschine gegeben.',
		oldImage: 'Die laufende Maschine kann sich noch nicht selbst beenden; ab dem nächsten Image tut sie es.',
		invalid: 'Bitte zwischen 15 und 1440 Minuten wählen.',
		next: (/** @type {string} */ at) => `Beendet sich, wenn nichts passiert, um etwa ${at}.`,
		warn: (/** @type {string} */ at) => `Paperless sichert sich und hält um etwa ${at} an.`,
		later: '1 Stunde später',
		postponed: (/** @type {string} */ at) => `Verschoben bis ${at}.`,
		stopped: {
			idle: 'Paperless hat sich nach der Ruhezeit gesichert und angehalten. Die App löscht die Maschine, sobald diese Sicherung auf der Chain steht; beim nächsten Start kommt alles aus dieser Sicherung zurück.',
			schedule: 'Paperless hat sich zur gewählten Uhrzeit gesichert und angehalten. Die App löscht die Maschine, sobald diese Sicherung auf der Chain steht; beim nächsten Start kommt alles aus dieser Sicherung zurück.'
		},
		confirming: 'Letzte Sicherung vor dem automatischen Beenden auf der Chain prüfen',
		noBackups: 'Die Maschine hat sich selbst angehalten, aber ohne Sicherungen kann die App nichts prüfen. Lösche sie selbst in der VM-Liste unter „Technisch“.'
	},
	en: {
		title: 'Stop automatically',
		lede: 'Paperless backs itself up and pauses when you have not used it for a while, or at a set time. The setting lives in your vault and applies on every device.',
		honest: 'Paused, the machine still costs as much as running. Only when you open the app again does it delete the machine after the backup, and from then on it costs nothing.',
		idle: 'After a quiet time',
		idleOff: 'never',
		minutes: (/** @type {number} */ n) => (n % 60 === 0 ? `${n / 60} ${n === 60 ? 'hour' : 'hours'}` : `${n} minutes`),
		other: 'other',
		otherLabel: 'Minutes (15 to 1440)',
		daily: 'Daily at',
		dailyOff: 'not daily',
		zone: (/** @type {string} */ z) => `Time zone: ${z}`,
		quiet: 'Use is what you do in Paperless. Fetching mail does not count; while Paperless still processes documents, it does not pause.',
		save: 'Save',
		saving: 'Saving …',
		saved: 'Saved.',
		savedRunning: 'Saved and handed to the running machine.',
		oldImage: 'The running machine cannot stop itself yet; from the next image on it does.',
		invalid: 'Please choose between 15 and 1440 minutes.',
		next: (/** @type {string} */ at) => `Stops itself at about ${at} if nothing happens.`,
		warn: (/** @type {string} */ at) => `Paperless backs itself up and pauses at about ${at}.`,
		later: '1 hour later',
		postponed: (/** @type {string} */ at) => `Postponed until ${at}.`,
		stopped: {
			idle: 'Paperless backed itself up and paused after the quiet time. The app deletes the machine once that backup is on the chain; the next start brings everything back from it.',
			schedule: 'Paperless backed itself up and paused at the chosen time. The app deletes the machine once that backup is on the chain; the next start brings everything back from it.'
		},
		confirming: 'Checking the last backup before the automatic stop on the chain',
		noBackups: 'The machine paused itself, but without backups the app has nothing to check. Delete it yourself in the VM list under “Technical”.'
	}
};
