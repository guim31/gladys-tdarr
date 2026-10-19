# Tdarr

Votre serveur [Tdarr](https://tdarr.io) dans Gladys, sur votre réseau local :
les files de transcodage et de contrôle sanitaire, les fichiers en cours et en
échec, la place gagnée, l'état de chaque nœud, un interrupteur de pause, et des
scènes qui réagissent quand tout est traité, quand un fichier échoue ou quand
un nœud se déconnecte.

L'intégration a été testée avec un vrai serveur Tdarr 3.01 (l'image Docker
officielle, avec son nœud interne), pas encore dans une vraie installation de
Gladys : vos retours sont les bienvenus sur le
[forum Gladys](https://community.gladysassistant.com) ou dans les
[issues](https://github.com/guim31/gladys-tdarr/issues).

## Ce qu'il faut

- Gladys Assistant 5.1.0 ou plus récent.
- Un serveur **Tdarr** (version 2 ou 3), joignable depuis Gladys (même réseau),
  sur le port de son interface web (`8265` par défaut).
- Si l'authentification de Tdarr est activée (Tdarr 2.24 ou plus ; activée par
  défaut dans Tdarr 3), une **clé d'API** : dans Tdarr, **Tools** → **API
  keys**, ou le `seededApiKey` de la configuration du serveur.

## Mise en route

1. Installez l'intégration depuis le catalogue de Gladys.
2. Dans **Configuration**, saisissez l'**Adresse** du serveur Tdarr (par
   exemple `192.168.1.2:8265` ; sans port, `8265` est utilisé) et, si
   l'authentification est activée, sa **Clé d'API**.
3. Enregistrez, puis cliquez sur **Tester la connexion** : le message sous le
   bouton donne la version de Tdarr, les nœuds en ligne, les bibliothèques et
   la file.
4. Ouvrez l'onglet **Découverte** : un appareil pour le serveur, un par nœud, un
   par bibliothèque. Cliquez sur **Ajouter** pour ceux que vous voulez,
   choisissez une pièce et enregistrez.

Options :

- **Autoriser la pause et la reprise** (activé par défaut) : Gladys peut mettre
  en pause et relancer les nœuds (interrupteurs, scènes, bouton du widget) et
  lancer un scan de bibliothèque. Désactivé, l'intégration ne fait que lire.
- **Intervalle de rafraîchissement** : de 30 secondes à 5 minutes (1 minute par
  défaut).
- **Langue des noms de fonctionnalités** : les noms donnés aux fonctionnalités à
  l'ajout d'un appareil, et la langue de la phrase de résumé.

## Les appareils

**Le serveur Tdarr**

| Fonctionnalité                 | Ce qu'elle indique                                                              |
| ------------------------------ | ------------------------------------------------------------------------------- |
| **En ligne**                   | 1 tant que le serveur répond.                                                   |
| **Tous les nœuds en pause**    | Interrupteur : met en pause ou relance tous les nœuds (« Pause all »).          |
| **File de transcodage**        | Fichiers en attente de transcodage.                                             |
| **File de contrôle sanitaire** | Fichiers en attente de contrôle sanitaire.                                      |
| **Fichiers en cours**          | Fichiers traités en ce moment, sur tous les nœuds.                              |
| **En attente de validation**   | Fichiers transcodés qui attendent votre accord (onglet Staged).                 |
| **Transcodés**                 | Fichiers transcodés avec succès (page d'accueil de Tdarr).                      |
| **Transcodages en échec**      | Fichiers dont le transcodage a échoué.                                          |
| **Contrôles en échec**         | Fichiers dont le contrôle sanitaire a échoué.                                   |
| **Place gagnée**               | Place gagnée par les transcodages, en Go (négative si les fichiers ont grossi). |
| **Nœuds en ligne**             | Nœuds connectés au serveur.                                                     |
| **Version**                    | Version de Tdarr.                                                               |

**Chaque nœud** (nommé d'après le nom du nœud réglé dans Tdarr)

| Fonctionnalité          | Ce qu'elle indique                                |
| ----------------------- | ------------------------------------------------- |
| **En ligne**            | 1 tant que le nœud est connecté au serveur.       |
| **Travailleurs actifs** | Travailleurs qui traitent un fichier sur ce nœud. |
| **En pause**            | Interrupteur : met en pause ou relance ce nœud.   |

**Chaque bibliothèque**

| Fonctionnalité   | Ce qu'elle indique                                              |
| ---------------- | --------------------------------------------------------------- |
| **Fichiers**     | Fichiers de la bibliothèque.                                    |
| **À traiter**    | Fichiers en attente de transcodage ou de contrôle sanitaire.    |
| **En échec**     | Fichiers de la bibliothèque en échec (transcodage ou contrôle). |
| **Place gagnée** | Place gagnée dans cette bibliothèque, en Go.                    |

Un nœud en pause termine les fichiers en cours et n'en commence aucun nouveau :
rien n'est perdu. Un nœud qui se déconnecte reste dans Gladys, hors ligne,
jusqu'à son retour.

## Tableau de bord

Le widget **Tdarr** affiche quatre tuiles (fichiers en file, en cours, en échec,
place gagnée), une ligne par nœud (travailleurs actifs, en pause, hors ligne) et
un bouton : **Tout mettre en pause** pendant que Tdarr travaille, **Tout
reprendre** une fois en pause. Pas de bouton quand les commandes sont
désactivées dans la configuration.

## Scènes

### Déclencheurs

- **File Tdarr vidée** : tout est traité, les files de transcodage et de
  contrôle sont vides et plus aucun travailleur n'est occupé. Variables : les
  fichiers transcodés, les transcodages et contrôles en échec (totaux), la place
  gagnée.
- **Fichier Tdarr en échec** : un fichier vient d'échouer à son transcodage ou
  à son contrôle sanitaire. Filtres : la bibliothèque, l'étape (transcodage ou
  contrôle sanitaire). Variables : le nom du fichier, son chemin complet, la
  bibliothèque.
- **Nœud Tdarr hors ligne** : un nœud connecté s'est déconnecté (arrêt,
  plantage, réseau). Filtre : le nœud. Variable : le nom du nœud.

### Actions

- **Mettre Tdarr en pause** : un nœud, ou tous si aucun nœud n'est choisi.
- **Relancer Tdarr** : même choix.
- **Scanner une bibliothèque Tdarr** : cherche les nouveaux fichiers d'une
  bibliothèque, ou de toutes (le « Scan → Find new » de Tdarr). Sortie : le
  nombre de bibliothèques scannées.
- **Lire le résumé Tdarr** : une phrase pour un message ou une annonce vocale
  (« Tdarr: 12 fichier(s) en file, 2 en cours, 1 en échec, 35,2 Go gagnés. »),
  et la file, les fichiers en cours et les échecs en nombres.

### Idées de scènes

- À 18 h, **Mettre Tdarr en pause** pour garder le processeur et les disques au
  film du soir ; à 1 h, **Relancer Tdarr**.
- **Fichier Tdarr en échec** → un message Telegram avec le nom du fichier et la
  bibliothèque.
- **File Tdarr vidée** → une notification : « Tdarr a fini, place gagnée : … ».
- Après un téléchargement importé par Sonarr ou Radarr, **Scanner une
  bibliothèque Tdarr** pour que le nouvel épisode soit traité tout de suite.

## Dépannage

- **« Tdarr ne répond pas »** : vérifiez l'adresse et le port (`8265`, celui de
  l'interface web, pas le `8266` des nœuds), et que Gladys atteint le serveur
  (pare-feu, réseau Docker).
- **« Clé d'API refusée ou manquante »** : l'authentification de Tdarr est
  activée. Créez une clé dans **Tools** → **API keys** et collez-la dans la
  configuration.
- **« Aucun serveur Tdarr à cette adresse »** : une autre application répond sur
  ce port.
- **Un nœud apparaît deux fois** : Tdarr reconnaît un nœud à son nom. Renommer
  un nœud dans sa configuration (`nodeName`) crée un nouvel appareil dans
  Gladys ; supprimez l'ancien.
- **L'interrupteur ne fait rien** : vérifiez **Autoriser la pause et la
  reprise** dans la configuration.
- Plus de détails dans les logs de l'intégration (**Intégrations** → Tdarr →
  logs), au niveau `debug` si besoin.

## Limites

- Un seul serveur Tdarr par intégration.
- Les chiffres sont lus à chaque intervalle de rafraîchissement : un transcodage
  court peut se terminer entre deux lectures, et **Fichier Tdarr en échec**
  annonce au plus dix fichiers par lecture. Les échecs de plus d'une heure ne
  sont pas annoncés.
- **En attente de validation** compte les fichiers que Tdarr garde dans l'onglet
  Staged jusqu'à votre accord (quand « Auto accept successful transcodes » est
  désactivé). Tdarr les compte encore dans le **À traiter** de leur
  bibliothèque.
- L'intégration ne modifie ni les réglages de transcodage, ni les plugins, ni
  les flux de Tdarr, et ne supprime rien.
- Sans lien avec Tdarr ni ses auteurs.
