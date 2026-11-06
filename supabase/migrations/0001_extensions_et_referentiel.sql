-- 0001 - extensions, types, referentiel des communes
-- brocantes.beloucif.com, 11/09/2026
--
-- Regle qui gouverne ce fichier : toute table du schema public porte une RLS
-- activee. Elle est posee ici a la creation, les politiques arrivent en 0003.
-- Une table creee sans RLS reste ouverte le temps que quelqu'un y pense, et
-- ce temps la est exactement la fenetre du probleme.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Les six types du prompt. Une enumeration plutot qu'un texte libre : le jour
-- ou un collecteur invente "vide grenier " avec une espace finale, on veut une
-- erreur a l'ecriture, pas une categorie fantome dans les filtres.
create type public.type_evenement as enum (
  'brocante',
  'vide_grenier',
  'braderie',
  'puces',
  'bourse',
  'salon'
);

create type public.statut_publication as enum (
  'brouillon',    -- collecte, pas encore verifie
  'publie',       -- visible du public
  'annule',       -- a eu lieu dans le calendrier mais annule par l'organisateur
  'archive'       -- passe, conserve pour l'historique
);

create type public.genre_source as enum (
  'opendata',          -- jeu de donnees ouvert, licence explicite
  'agenda_municipal',  -- site officiel d'une commune
  'contribution'       -- declare par un organisateur via le formulaire
);

-- Referentiel des communes. Importe une fois depuis geo.api.gouv.fr, jamais
-- reconstruit par appels repetes : 1 270 communes franciliennes font 1 270
-- requetes, et l'API affiche 50 appels par seconde, ce qui n'autorise pas a
-- les consommer.
create table public.communes (
  code_insee      text primary key,
  nom             text not null,
  slug            text not null unique,
  codes_postaux   text[] not null default '{}',
  departement     text not null,
  region          text not null,
  population      integer,
  centre          extensions.geography(point, 4326) not null,

  -- Vrai seulement si une source est branchee sur cette commune. C'est ce
  -- drapeau qui decide si sa page publique existe : une page de ville sans
  -- source est une page vide, mauvaise pour le referencement et malhonnete
  -- pour le lecteur.
  couverte        boolean not null default false,

  cree_le         timestamptz not null default now(),
  maj_le          timestamptz not null default now()
);

comment on column public.communes.couverte is
  'Une source est branchee sur cette commune. Conditionne l''existence de sa page publique.';

create index communes_centre_idx on public.communes using gist (centre);
create index communes_departement_idx on public.communes (departement);
create index communes_nom_trgm_idx on public.communes using gin (nom extensions.gin_trgm_ops);

alter table public.communes enable row level security;

-- Provenance. Une ligne par source reellement branchee, avec sa licence et la
-- date a laquelle cette licence a ete verifiee. Une licence sans date de
-- verification ne vaut rien : elle a pu changer depuis.
create table public.sources (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  nom                   text not null,
  genre                 public.genre_source not null,
  url_base              text,

  licence               text not null,
  licence_verifiee_le   date not null,
  licence_url           text,

  -- Famille de collecteur, pas nom de commune : 47 mairies se traitent avec
  -- quelques familles de plateformes, pas 47 scripts.
  famille               text,
  code_insee            text references public.communes(code_insee),

  -- Cadence maximale que ce collecteur s'autorise. Regle maison : le quart de
  -- la limite affichee par la source, jamais la limite.
  cadence_max_par_sec   numeric(5,2) not null default 1.0,

  actif                 boolean not null default true,
  derniere_collecte_le  timestamptz,
  dernier_statut        text,
  dernier_message       text,

  cree_le               timestamptz not null default now(),
  maj_le                timestamptz not null default now()
);

create index sources_actif_idx on public.sources (actif) where actif;
create index sources_code_insee_idx on public.sources (code_insee);

alter table public.sources enable row level security;

-- Horodatage de mise a jour, pose une fois et reutilise par les deux tables
-- suivantes. Volontairement en invoker : une fonction de trigger n'a aucune
-- raison de s'executer avec les droits de son proprietaire.
create or replace function public.touch_maj_le()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.maj_le = now();
  return new;
end;
$$;

create trigger communes_touch before update on public.communes
  for each row execute function public.touch_maj_le();

create trigger sources_touch before update on public.sources
  for each row execute function public.touch_maj_le();
