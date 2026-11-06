-- 0002 - evenements, provenances, contributions, alertes
-- brocantes.beloucif.com, 11/09/2026

-- La table centrale. Elle ne contient AUCUNE donnee personnelle : le nom d'un
-- organisateur associatif y figure parce qu'il est deja public sur l'affiche,
-- mais jamais son telephone ni son courriel. Ces informations la vivent dans
-- public.contributions, fermee au public. Motif : cette table est lue par tout
-- le monde, et la minimisation se construit dans le schema, pas dans la requete
-- qui aurait pu oublier d'exclure une colonne.
create table public.evenements (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,

  titre               text not null,
  type                public.type_evenement not null,
  description         text,

  -- Horodates avec fuseau. Un evenement d'un seul jour a debut_le = fin_le sur
  -- la date, et ses horaires dans les deux colonnes suivantes : sans cela, un
  -- filtre "ce week-end" rate les evenements d'un jour une fois sur deux.
  debut_le            timestamptz not null,
  fin_le              timestamptz not null,
  ouvre_a             time,
  ferme_a             time,

  adresse_voie        text,
  code_postal         text,
  commune             text not null,
  code_insee          text references public.communes(code_insee),
  position            extensions.geography(point, 4326),

  nb_exposants        integer check (nb_exposants is null or nb_exposants >= 0),

  -- En centimes, jamais en flottant. Un tarif a 2,50 euros stocke en double
  -- precision finit par s'afficher 2,4999999.
  tarif_visiteur_c    integer check (tarif_visiteur_c is null or tarif_visiteur_c >= 0),
  tarif_exposant_c    integer check (tarif_exposant_c is null or tarif_exposant_c >= 0),

  restauration        boolean,
  acces_pmr           boolean,
  organisateur        text,

  statut              public.statut_publication not null default 'brouillon',

  cree_le             timestamptz not null default now(),
  maj_le              timestamptz not null default now(),

  constraint evenements_fin_apres_debut check (fin_le >= debut_le)
);

comment on table public.evenements is
  'Lue publiquement. Ne doit jamais porter de donnee personnelle de contact.';

-- L'index qui porte la requete principale du produit, "autour de moi, bientot".
create index evenements_position_idx on public.evenements using gist (position);
create index evenements_debut_idx on public.evenements (debut_le);
create index evenements_publies_idx on public.evenements (debut_le)
  where statut = 'publie';
create index evenements_insee_idx on public.evenements (code_insee);
create index evenements_titre_trgm_idx on public.evenements using gin (titre extensions.gin_trgm_ops);

alter table public.evenements enable row level security;

-- Rapprochement n-n avec les sources. Deux sources decrivent souvent le meme
-- evenement : on garde les deux provenances plutot que d'en choisir une, parce
-- que la fiche doit pouvoir dire d'ou vient chaque information.
create table public.evenement_sources (
  evenement_id    uuid not null references public.evenements(id) on delete cascade,
  source_id       uuid not null references public.sources(id) on delete cascade,

  -- Identifiant chez la source. C'est la cle qui evite de recreer le meme
  -- evenement a chaque passe de collecte.
  id_externe      text not null,
  url_source      text,

  vu_le           timestamptz not null default now(),
  charge_utile    jsonb,

  primary key (source_id, id_externe)
);

create index evenement_sources_evenement_idx on public.evenement_sources (evenement_id);

alter table public.evenement_sources enable row level security;

-- Contributions des organisateurs. Fermee au public en lecture : elle porte des
-- donnees personnelles, un courriel et parfois un telephone. Le formulaire
-- ecrit ici, un moderateur relit, et seule la version sans contact passe dans
-- public.evenements.
create table public.contributions (
  id                uuid primary key default gen_random_uuid(),

  -- Le contenu propose, dans la meme forme que l'evenement final.
  titre             text not null,
  type              public.type_evenement not null,
  description       text,
  debut_le          timestamptz not null,
  fin_le            timestamptz not null,
  ouvre_a           time,
  ferme_a           time,
  adresse_voie      text,
  code_postal       text,
  commune           text not null,
  nb_exposants      integer,
  tarif_visiteur_c  integer,
  tarif_exposant_c  integer,

  -- Donnees personnelles du declarant. Duree de conservation : effacees douze
  -- mois apres la date de l'evenement, par la tache de purge. Documente dans la
  -- politique de confidentialite, pas seulement ici.
  organisateur      text not null,
  contact_courriel  text not null,
  contact_telephone text,

  etat              text not null default 'en_attente'
                    check (etat in ('en_attente', 'accepte', 'refuse')),
  motif_refus       text,
  evenement_id      uuid references public.evenements(id) on delete set null,

  ip_hachee         text,   -- anti-abus, jamais l'adresse en clair
  cree_le           timestamptz not null default now(),
  traite_le         timestamptz
);

create index contributions_etat_idx on public.contributions (etat, cree_le);

alter table public.contributions enable row level security;

-- Alertes par courriel. Pas de compte utilisateur : une adresse, une zone, un
-- rayon, et deux jetons. Le double opt-in n'est pas une politesse, c'est ce qui
-- distingue une inscription d'une adresse saisie par un tiers.
create table public.alertes (
  id                uuid primary key default gen_random_uuid(),
  courriel          text not null,

  centre            extensions.geography(point, 4326) not null,
  rayon_km          integer not null check (rayon_km between 1 and 100),
  types             public.type_evenement[] not null default '{}',

  confirmee_le      timestamptz,
  jeton_confirmation text not null unique,
  jeton_desinscription text not null unique,

  derniere_envoi_le timestamptz,
  cree_le           timestamptz not null default now(),

  unique (courriel, centre, rayon_km)
);

create index alertes_confirmees_idx on public.alertes (confirmee_le)
  where confirmee_le is not null;

alter table public.alertes enable row level security;

create trigger evenements_touch before update on public.evenements
  for each row execute function public.touch_maj_le();
