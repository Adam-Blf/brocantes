# Journal des versions

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
