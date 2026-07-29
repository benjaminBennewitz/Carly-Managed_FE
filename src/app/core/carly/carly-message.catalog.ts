/* src/app/core/carly/carly-message.catalog.ts */

export type CarlyMessageCategory =
  | 'task-overdue'
  | 'task-today'
  | 'task-soon'
  | 'task-priority'
  | 'project-deadline'
  | 'progress'
  | 'clear'
  | 'generic';

export interface CarlyMessageTemplate {
  id: string;
  category: CarlyMessageCategory;
  text: string;
}

/**
 * Feste Carly-Textbausteine. Platzhalter werden erst mit realen Workspace-Daten befüllt.
 * Dadurch bleibt Carly abwechslungsreich, ohne Aufgaben, Projekte oder Termine zu erfinden.
 */
export const CARLY_MESSAGE_TEMPLATES: readonly CarlyMessageTemplate[] = [
  { id: 'overdue-01', category: 'task-overdue', text: '„{{task}}“ ist {{overdueWhen}} überfällig. Das ist jetzt offiziell auffällig.' },
  { id: 'overdue-02', category: 'task-overdue', text: '„{{task}}“ wartet länger als geplant. Ich würde sie nicht noch dekorativer liegen lassen.' },
  { id: 'overdue-03', category: 'task-overdue', text: 'Überfällig: „{{task}}“. Ich sage es nur, weil der Kalender offenbar nicht laut genug war.' },
  { id: 'overdue-04', category: 'task-overdue', text: 'Ich habe „{{task}}“ im Blick. Der Termin liegt inzwischen hinter uns. Nur so als elegante Erinnerung.' },

  { id: 'today-01', category: 'task-today', text: '„{{task}}“ ist heute fällig. Ein erstaunlich guter Tag, sie heute zu erledigen.' },
  { id: 'today-02', category: 'task-today', text: 'Heute auf dem Plan: „{{task}}“. Ich halte mich schon bereit, beeindruckt zu sein.' },
  { id: 'today-03', category: 'task-today', text: '„{{task}}“ und heute haben einen Termin miteinander. Ich würde die beiden nicht warten lassen.' },

  { id: 'soon-01', category: 'task-soon', text: '„{{task}}“ ist {{dueWhen}} fällig. Noch entspannt – solange du nicht nur darüber nachdenkst.' },
  { id: 'soon-02', category: 'task-soon', text: 'Für „{{task}}“ bleibt noch etwas Luft. {{dueWhenCapitalized}} ist aber näher, als es klingt.' },
  { id: 'soon-03', category: 'task-soon', text: '„{{task}}“ kommt näher. Ich würde einen kleinen Vorsprung nehmen. Sieht außerdem kompetent aus.' },

  { id: 'priority-01', category: 'task-priority', text: '„{{task}}“ hat hohe Priorität. Die Kennzeichnung war vermutlich kein Deko-Element.' },
  { id: 'priority-02', category: 'task-priority', text: 'Hohe Priorität bei „{{task}}“. Ich würde dort anfangen. Rein zufällig ist das auch die kluge Wahl.' },
  { id: 'priority-03', category: 'task-priority', text: '„{{task}}“ steht ziemlich weit oben auf der Wichtigkeitsskala. Ich habe nachgesehen. Natürlich.' },

  { id: 'project-01', category: 'project-deadline', text: 'Bei „{{project}}“ gilt: {{projectDueLabel}}. Der Kalender hat es bemerkt. Ich auch.' },
  { id: 'project-02', category: 'project-deadline', text: 'Für „{{project}}“ gilt: {{projectDueLabel}}. Noch kein Drama, aber Fokus wäre jetzt stilvoll.' },
  { id: 'project-03', category: 'project-deadline', text: '„{{project}}“ nähert sich dem Termin. Ich empfehle Fortschritt. Überraschend, ich weiß.' },

  { id: 'progress-01', category: 'progress', text: '{{done}} von {{total}} Aufgaben erledigt. Nicht schlecht. Ich wäre fast beeindruckt.' },
  { id: 'progress-02', category: 'progress', text: 'Noch {{open}} offene Aufgaben in {{scope}}. Überschaubar. Also bitte kein künstliches Drama.' },
  { id: 'progress-03', category: 'progress', text: '{{percent}} % erledigt. Das sieht langsam nach Absicht aus.' },
  { id: 'progress-04', category: 'progress', text: 'In {{scope}} sind noch {{open}} Aufgaben offen. Eine davon wäre ein hervorragender nächster Schritt.' },

  { id: 'clear-01', category: 'clear', text: 'Keine überfälligen Aufgaben. Ich wusste natürlich, dass Potenzial vorhanden ist.' },
  { id: 'clear-02', category: 'clear', text: 'Der Kalender sieht erstaunlich friedlich aus. Behalte das bitte bei. Es steht dir.' },
  { id: 'clear-03', category: 'clear', text: 'Nichts überfällig. Sehr ordentlich. Ich werde versuchen, nicht zu überrascht auszusehen.' },

  { id: 'generic-01', category: 'generic', text: 'Ein klarer nächster Schritt schlägt zehn perfekte Pläne.' },
  { id: 'generic-02', category: 'generic', text: 'Aufgaben verschwinden selten durch intensives Anstarren. Ich habe es geprüft.' },
  { id: 'generic-03', category: 'generic', text: 'Fokus ist erstaunlich wirksam. Fast magisch.' },
  { id: 'generic-04', category: 'generic', text: 'Eine Pause ist erlaubt. Aufgeben war allerdings nicht Teil des Plans.' },
  { id: 'generic-05', category: 'generic', text: 'Ordnung im Board, Ruhe im Kopf. Ich akzeptiere beides.' },
  { id: 'generic-06', category: 'generic', text: 'Du brauchst keinen Zauber. Einen Anfang würde ich aber nehmen.' },
  { id: 'generic-07', category: 'generic', text: 'Ich bin nicht ungeduldig. Ich habe nur einen sehr guten Überblick über die Zeit.' },
  { id: 'generic-08', category: 'generic', text: 'Kleine Schritte. Große Wirkung. Ja, das wusste ich natürlich schon.' },
  { id: 'generic-09', category: 'generic', text: 'Ich bin nicht arrogant. Ich bin nur auffällig oft richtig.' },
  { id: 'generic-10', category: 'generic', text: 'Du arbeitest. Ich behalte den Überblick. Eine ausgesprochen vernünftige Arbeitsteilung.' },
  { id: 'generic-11', category: 'generic', text: 'Perfekt muss es nicht sein. Erledigt hat überraschend viele Vorteile.' },
  { id: 'generic-12', category: 'generic', text: 'Ich helfe gern. Dass ich dabei recht behalte, ist lediglich ein Bonus.' },
];
