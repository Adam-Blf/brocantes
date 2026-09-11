# Journal des versions

## 0.3.0 - 11/09/2026

Jalons 2 et 3 : l'interface et les pages de commune.

### Ajoute

- Site Next.js 16, App Router, TypeScript strict. Recherche par position ou par
  commune, rayon, periode. Liste et carte synchronisees, liste par defaut sur
  telephone. Fiche evenement avec bouton d'itineraire.
- Les filtres vivent dans l'URL : une recherche se partage par copie du lien,
  le retour arriere fonctionne, et le rendu reste serveur donc indexable.
- 28 pages de commune prerendues, avec balisage schema.org `ItemList` de
  `Event`, plan du site et `robots.txt`.
- Recherche de commune en base : `chercher_commune` compare deux formes
  normalisees, accents retires et apostrophes ramenees a des espaces. "l hay"
  trouve L'Hay-les-Roses, "perreux" trouve Le Perreux-sur-Marne. La saisie ne
  part chez aucun geocodeur tiers.
- Direction artistique journal de petites annonces : Newsreader et Schibsted
  Grotesk, rapatriees en local, aucun CDN a l'execution. Politique de securite
  qui rend cette promesse verifiable plutot qu'affichee.
- 17 tests unitaires, 8 parcours de bout en bout sur telephone et bureau,
  6 captures en 390 px dans les deux themes.

### Decisions

- **Next 16 et non 15**, comme ecrit au cahier des charges : l'App Router y est
  identique, et livrer sur une version deja depassee n'aurait servi personne.
- **Pas de shadcn/ui.** Des composants concus pour un langage visuel generique
  auraient combattu le registre demande. Les quelques elements necessaires,
  boutons de filtre et listes, tiennent en moins de code que leur installation.
- **Tuiles image IGN plutot que vectorielles.** Elles n'exigent ni fichier de
  metadonnees, ni jeu de glyphes, ni planche de symboles : trois points de
  defaillance en moins pour un fond un peu moins fin.
- **Aucun horaire affiche** quand la source n'en publie pas, plutot qu'un
  "00h00 - 23h59" qui aurait l'apparence d'une information.

### Corrige

- **Un temoin de test s'affichait sur la page publique de Chevilly-Larue.** La
  garde RLS avait besoin d'un evenement publie, j'en avais cree un ; il
  apparaissait donc aux visiteurs. Elle s'appuie desormais sur les evenements
  reels, et ne garde en base que le temoin BROUILLON, qui lui n'a pas
  d'equivalent : sans une ligne non publiee, "aucun brouillon ne sort"
  passerait au vert sur une table qui n'en contient aucune.

### Le piege qui a coute une heure

Sous Windows, `rm -rf .next` echoue **en silence** quand le serveur tient encore
des fichiers ouverts, et `pkill -f next-server` ne trouve rien parce que le
processus s'appelle `node`. Le serveur sert alors des fragments de code perimes
en erreur 500, et des pages mises en cache avant la derniere modification des
donnees.

Aucun symptome ne designait la cause : une carte vide sans la moindre erreur,
un composant bloque sur son message de chargement, une page affichant un
evenement supprime de la base une heure plus tot. Le style vectoriel de l'IGN,
la politique de securite et la taille du conteneur ont ete successivement
soupconnes a tort.

`npm run rebuild` echoue maintenant bruyamment si la suppression est incomplete,
au lieu de laisser croire qu'elle a eu lieu.

## 0.2.0 - 11/09/2026

Comble l'ecart entre ce que la collecte rendait et ce qui existe reellement.

### Ajoute

- Famille de collecteurs `html`, pour les douze communes qui publient une
  brocante sans exposer de flux. Elle ne parse aucune structure de page : elle
  releve les liens, filtre sur le texte, et lit la date sur la fiche.
- `--famille=<nom>` sur l'orchestrateur, pour rejouer tous les collecteurs
  d'une meme famille apres une correction dans un module partage.
- Extraction des horaires ecrits en francais, et de la forme a deux points
  "8:00 / 18:00".
- Garde sur les dates deja passees : un evenement termine est ecarte ET
  journalise, parce que sur une page HTML c'est presque toujours le signe d'une
  date parasite captee a la place de la bonne.

### Mesure

- 33 sources branchees, 28 communes couvertes, **18 evenements publies**,
  contre 11 en 0.1.0.
- 13 evenements portent une adresse geocodee, 5 sont places au centre de leur
  commune faute d'adresse publiee.

### Corrige

- **Horaires inventes.** Sans horaire lisible, le collecteur posait 8h-20h par
  defaut. Une braderie annoncee de 10h a 17h s'affichait de 8h a 20h, ce qui
  denature l'information au sens de l'article L322-1 du CRPA. En l'absence
  d'horaire, on retient desormais la journee entiere, visiblement approximative
  donc honnete.
- **"18h 47eme Brocante de Sucy" lu comme 18h47.** Le numero d'edition etait
  capte comme des minutes. Les minutes doivent maintenant etre bornees a 59 et
  ne pas etre suivies d'une lettre.
- **Les heures de "Que faire a Paris" sont fausses dans les champs
  structures.** Pour un evenement dont `date_description` annonce "de 09h00 a
  19h00", `date_start` vaut `10:00:00+00:00`, soit midi a Paris. Le champ qui a
  l'air exploitable ne l'est pas, le texte a cote est juste. On garde le jour du
  champ structure et l'heure du texte.
- Adresses tronquees au premier signe qui n'en fait plus partie : on recuperait
  "place Charles Digeon et dans le Val de Gaulle ! En savoir", ce qui faisait
  echouer le geocodage au lieu de l'aider. Ormesson est passe d'un score de
  0,46 a 0,97.
- Contenu des balises script et style retire avant lecture : du JavaScript de
  partage social atterrissait dans une description.
- Fil d'ariane retire en coupant a la derniere occurrence du titre.

### Limites connues

- Trois descriptions sur sept gardent un residu de navigation. Cosmetique : les
  donnees factuelles, date, horaire et lieu, sont justes, et chaque fiche
  pointe vers la source officielle.
- Cinq communes restent a zero malgre une brocante reperee a l'audit :
  Limeil-Brevannes annonce une ouverture d'inscriptions et non la brocante,
  Villiers-sur-Marne la cite sans date, Maisons-Alfort rend une page sans aucun
  lien exploitable, Ablon et Charenton n'exposent pas la fiche sur la page
  sondee.

## 0.1.0 - 11/09/2026

Jalon 1 : la chaine de collecte, branchee sur du reel.

### Ajoute

- Schema Postgres complet, quatre migrations : referentiel des communes,
  evenements, provenances, contributions et alertes, puis politiques RLS et
  fonction de recherche geographique.
- Referentiel de 1 266 communes franciliennes, importe en une requete par
  departement depuis `geo.api.gouv.fr`.
- Quatre familles de collecteurs en Deno : `tribe` pour l'API The Events
  Calendar, `rss` pour les flux d'agenda, `ics-wp` pour l'export iCalendar par
  fiche, `opendata-paris` pour le jeu de la Ville de Paris.
- `collector/lib/dates.ts` : cascade de cinq extracteurs, parce que les cinq
  flux branches encodent leur date de cinq facons differentes.
- `collector/lib/classer.ts` : reconnait une brocante dans un agenda
  generaliste, avec une liste d'exclusions tiree de cas reels.
- `tests/rls.ts` : sept controles de la RLS, vus depuis la cle publique.
- Tache planifiee quotidienne, GitHub Actions, avec conservation de l'instantane
  de chaque passe pendant quinze jours.
- `docs/SOURCES.md` : une ligne par source avec sa licence et sa date de
  verification, plus le fondement juridique de la collecte.

### Mesure

- 21 sources branchees, 21 communes couvertes, **11 evenements publies**.
- Huit evenements geocodes a l'adresse exacte, trois au centre de leur commune.
- La garde RLS passe au vert, et a ete vue en rouge sur une breche volontaire.

### Decisions

- **Ni brocabrac ni vide-greniers.org.** Leurs conditions interdisent
  textuellement l'extraction, et la jurisprudence de 2025 est defavorable au
  reutilisateur. Voir `docs/SOURCES.md`.
- **La couverture annoncee est le Val-de-Marne et Paris**, pas l'Ile-de-France.
  Aucune source ouverte ne porte de brocantes franciliennes en volume, mesure a
  cette date. Le modele de donnees reste national.
- **Une page de commune n'existe que si une source y est branchee.** Generer
  1 266 pages dont 1 245 vides serait mauvais pour le referencement et
  malhonnete pour le lecteur.
- **Rien n'est publie automatiquement.** Un evenement dont la date a ete deduite
  d'une date de publication plutot que declaree peut envoyer quelqu'un devant
  une salle fermee.

### Corrige en cours de route

- Les dates lues en francais etaient construites en UTC : un vide-grenier
  annonce a 8h30 s'affichait a 10h30. Le decalage de Paris est desormais calcule
  par le moteur, heure d'ete comprise, plutot que code a la main.
- Joomla prefixe ses descriptions par la date de l'evenement au format
  `12/09/2026 08:30`. Elle est maintenant lue en priorite : la cascade tombait
  auparavant sur la date de publication, qui porte la meme date mais declaree en
  UTC alors que l'heure ecrite est locale.
- Un rejeu partiel produisait un fichier qui devenait le plus recent du dossier
  et usurpait le rang de derniere passe complete. Il porte desormais un nom
  distinct.
- Le slug d'une commune n'est pas unique en France : Mondreville existe en
  Seine-et-Marne et dans les Yvelines. Le departement tranche.
- Le suffixe de rubrique ajoute par certains moteurs de site, du type
  ` (Sorties)`, part du titre affiche mais reste dans le titre de la source,
  qui n'est jamais modifie.

### Limites connues

- L'audit manuel des 47 communes a repere 17 brocantes reelles en Val-de-Marne,
  la collecte automatique n'en rend que 5. L'ecart tient aux flux, pas au
  classifieur : les communes qui exposent un flux structure n'ont pas de
  brocante en ce moment, celles qui en ont une ne la publient qu'en HTML.
- La deduplication entre sources n'est pas encore active. Elle ne sert que
  lorsque deux sources decrivent le meme evenement, ce qui n'arrive pas encore
  avec les sources actuelles.
- Aucune interface. C'est le jalon 2.
