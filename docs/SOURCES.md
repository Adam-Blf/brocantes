# Sources de donnees - audit du 11/09/2026

Etat des lieux mesure, pas suppose. Chaque ligne dit ou j'ai regarde, ce que j'ai
compte, et a quelle date. Un chiffre sans date de mesure ne vaut rien dans ce
document.

## Verdict en une ligne

Il n'existe pas, au 11/09/2026, de source ouverte permettant d'atteindre
50 brocantes franciliennes reelles et a venir. Le jalon 1 tel qu'ecrit dans le
prompt n'est pas atteignable avec les sources auditees ce jour.

## Mesures

| Source | Licence | Brocantes IDF a venir | Methode de mesure | Statut |
|---|---|---|---|---|
| DATAtourisme, export regional IDF | Licence Ouverte 2.0 | **0** | fichier complet telecharge (8,7 Mo, 10 670 POI, horodate 11/09/2026), comptage local des categories et des libelles | inexploitable en IDF |
| DATAtourisme, export Occitanie | Licence Ouverte 2.0 | 168 hors IDF | fichier complet telecharge (43 Mo, 53 714 POI), `GarageSale` 102, `BricABrac` 66 | prouve que le format et l'ontologie fonctionnent, mais pas en IDF |
| Que faire a Paris, opendata.paris.fr | ODbL | **9** dont 3 vrais vide-greniers | API Opendatasoft v2.1, filtre `qfap_tags like 'Brocante'` et `date_start >= 2026-09-11` | exploitable, volume insuffisant, Paris intra-muros seulement |
| data.gouv.fr, recherche nationale | - | 0 jeu de donnees | API `datasets/?q=`, 6 mots cles testes | aucune source dediee |
| Portails 92, 93, 94, 91, 78, 95, 77 | - | 0 | audit des catalogues | rien d'exploitable, le 94 n'a pas de portail open data |
| Grand Paris Sud, jeu evenements | Licence Ouverte 2.0 | non confirme | 11 321 enregistrements, echantillon date de 2021-2022 | flux a l'arret malgre une frequence annoncee quotidienne |
| OpenAgenda, API v2 | Licence ouverte annoncee | **non mesure** | HTTP 403 sans cle, `could not find user or agenda matching key` | seule piste non epuisee, exige une cle gratuite |
| OpenEventDatabase | Licence Ouverte | 0 | 9 jeux publies, tous anterieurs a 2017 | projet abandonne |

## Sources fermees juridiquement

| Site | Editeur | Ce qui bloque |
|---|---|---|
| brocabrac.fr | Brainbox SAS, SIREN 484 464 953 | CGU section 5 : toute reproduction partielle ou totale sans autorisation prealable est strictement interdite. Pas d'API, pas de flux, pas de procedure de licence publiee. |
| vide-greniers.org | SOPHEOS SARL, RCS Mulhouse 487 772 675 | CGU section 6.1, interdiction textuelle de "copier ou aspirer le Site". La formulation vise explicitement l'extraction automatisee. |
| vide-greniers.fr | non identifie | certificat auto-signe, contenu non verifiable, ecarte par defaut |

Cadre legal applicable : articles L341-1, L342-1 et L342-2 du code de la
propriete intellectuelle, droit sui generis du producteur de base de donnees.
L'article L342-2 vise precisement le cas d'une extraction repetee et
systematique de parties non substantielles, c'est a dire exactement ce que
ferait un robot qui synchroniserait un catalogue depuis ces sites.

Jurisprudence recente et defavorable au reutilisateur : Cour de cassation,
premiere chambre civile, 15 octobre 2025, La Centrale contre ADS4ALL, pourvoi
23-23.167. L'extraction massive vers un metamoteur concurrent a ete jugee
reutilisation substantielle. Decision en sens inverse mais plus ancienne :
Cour d'appel de Paris, 21 fevrier 2025, LBC France contre Directannonces,
21/09261, ou la contrefacon a ete ecartee faute de CGU opposables et en
presence d'une valeur ajoutee reelle.

Un fait brut isole, une brocante a telle date et telle adresse, n'est pas
protegeable en soi. La CJUE l'a juge pour les calendriers sportifs, Football
Dataco contre Yahoo, C-604/10, 1er mars 2012. La limite est le caractere
systematique et le volume, pas la reprise ponctuelle d'une information sourcee.

Ceci n'est pas un avis juridique. Pour un enjeu reel, faire valider par un
professionnel du droit.

## Briques techniques retenues

| Brique | Retenu | Motif |
|---|---|---|
| Geocodage | Geoplateforme, `data.geopf.fr/geocodage` | l'ancienne `api-adresse.data.gouv.fr` est decommissionnee depuis janvier 2026. Licence etalab-2.0, 50 appels par seconde et par IP. |
| Referentiel communes | fichier complet data.gouv.fr en un telechargement, `geo.api.gouv.fr` en ponctuel | evite de marteler l'API pour 1 270 communes |
| Fond de carte | IGN Geoplateforme, tuiles vectorielles | gratuit, perenne, licence etalab, 400 requetes par seconde. Repli Protomaps auto-heberge si les conditions changent. |
| Base geo | Supabase PostGIS, `geography(Point,4326)`, index GiST, `ST_DWithin` | PostGIS disponible sur l'offre gratuite |

Ecartes : Stadia Maps et Jawg interdisent l'usage commercial sur leur offre
gratuite. Les tuiles OpenStreetMap officielles sont tolerees mais revocables
sans preavis, donc pas une base de production.

## Pistes non epuisees au 11/09/2026

1. **OpenAgenda avec une cle de lecture.** Gratuite, compte personnel. Seule
   piste dont le volume reel reste inconnu. A mesurer avant toute decision
   definitive.
2. **Les agendas des 47 communes du Val-de-Marne.** Une mairie n'est pas un
   annuaire commercial protege par un droit sui generis, et son agenda est une
   information publique. Juridiquement bien plus solide qu'un agregateur prive.
   Effort reel : 47 sites aux formats differents.
3. **Les declarations prealables de vente au deballage**, article R310-9 du code
   de commerce. Avis CADA 20232716 favorable a la communication, sous reserve
   d'occultation des donnees personnelles. Piste structurellement exhaustive
   mais lente, et commune par commune.
4. **La contribution des organisateurs.** Deja prevue au MVP, mais elle ne peut
   pas etre la source d'amorcage : un ecran qui s'ouvre vide se lit comme
   "il n'y a rien".

## Ce que la premiere collecte a reellement rendu, 11/09/2026

Passe complete sur 21 sources, zero erreur.

| Source | Famille | Entrees vues | Brocantes retenues |
|---|---|---|---|
| Paris, Que faire a Paris | opendata-paris | 9 | 6 |
| Chevilly-Larue | ics-wp | 26 | 2 |
| L'Hay-les-Roses | rss | 10 | 2 |
| Fresnes | rss | 8 | 1 |
| Valenton, La Queue-en-Brie, Noiseau | tribe | 29 | 0 |
| 13 autres communes | rss | 120 | 0 |

**11 evenements retenus**, dont 8 geocodes a l'adresse exacte et 3 places au
centre de leur commune faute d'adresse publiee.

Ce chiffre est a lire avec sa contrepartie : l'audit manuel des 47 communes du
Val-de-Marne a repere 17 brocantes reelles. L'ecart ne vient pas du
classifieur, il vient des flux. Les communes qui exposent un flux structure
n'ont pas de brocante en ce moment, et celles qui en ont une ne l'exposent que
dans leur HTML. C'est le travail du jalon suivant.

Brocantes vues a l'audit et non collectees, faute de flux : Sucy-en-Brie,
Limeil-Brevannes, Le Kremlin-Bicetre, Saint-Mande, Ormesson-sur-Marne,
Ablon-sur-Seine, Saint-Maur-des-Fosses, Villejuif, Maisons-Alfort,
Le Perreux-sur-Marne, Villiers-sur-Marne, Charenton-le-Pont.

## Fondement juridique de la collecte sur les sites de mairies

Verifie le 11/09/2026 par un avis de synthese, a faire confirmer par un
professionnel du droit avant tout usage commercial.

1. **L'agenda municipal est une information publique.** Articles L300-2 et
   L321-1 du code des relations entre le public et l'administration. Il est
   librement reutilisable par toute personne, y compris a des fins
   commerciales.
2. **Les clauses de mentions legales sont inopposables.** L'article L323-2
   impose qu'une licence de reutilisation gratuite soit choisie parmi une liste
   fixee par decret, qui ne retient que la Licence Ouverte d'Etalab et l'ODbL.
   Un texte redige par une agence web n'est pas une licence homologuee. Fait
   revelateur : ces clauses sont identiques mot pour mot entre communes qui
   partagent le meme prestataire, ce qui etablit l'absence de toute deliberation
   communale.
3. **Une commune ne peut pas opposer un droit sui generis.** L'article L321-3
   du meme code l'interdit expressement, et la directive 2019/1024 le confirme.
   Le debat sur l'investissement substantiel est donc surabondant, mais il
   serait perdu de toute facon : CJUE, British Horseracing Board, C-203/02, qui
   distingue l'investissement dans la CREATION des donnees de celui consacre a
   leur OBTENTION. Une mairie cree ses evenements, elle ne les collecte pas.
4. **Les obligations reelles, article L322-1**, appliquees dans ce depot :
   ne pas alterer l'information, d'ou les champs `titre_source` et
   `adresse_source` jamais modifies ; ne pas en denaturer le sens, d'ou
   l'absence de toute mention d'annulation que la source ne porte pas ;
   mentionner la source et la date de derniere mise a jour, d'ou la table
   `evenement_sources` et le champ `releve_le` rendu par la fonction de
   recherche.

## Politesse technique, cablee dans le code

- une seule requete a la fois par domaine, trois secondes d'ecart, dans
  `collector/lib/http.ts`
- `If-None-Match` et `If-Modified-Since` a chaque passage, une reponse 304 ne
  coute rien a la mairie
- user-agent identifiant, `BrocantesVDM/0.1 (+https://brocantes.beloucif.com/robot)`
- une passe par jour, jamais plus
- aucun contournement d'authentification, de captcha ou de limitation technique
