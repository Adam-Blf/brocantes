-- 0003 - politiques RLS et fonction de recherche
-- brocantes.beloucif.com, 11/09/2026
--
-- Deux regles gouvernent ce fichier.
--
-- 1. Une table sans politique n'est pas une table ouverte : RLS etant activee
--    en 0001 et 0002, l'absence de politique ferme tout pour anon et
--    authenticated. C'est volontaire sur contributions et alertes, qui portent
--    des donnees personnelles et ne sont jamais lues depuis le navigateur.
-- 2. Toute fonction du schema public est publiee en /rest/v1/rpc et appelable
--    par n'importe qui. Celle d'en bas est donc ecrite comme une route exposee,
--    pas comme un utilitaire interne : bornes sur les parametres, invoker et
--    non definer, et rien dans son resultat qui ne soit deja public.

-- Referentiel ouvert : ce sont des donnees publiques de l'Etat, republiees.
create policy "communes lisibles par tous"
  on public.communes for select
  using (true);

-- Provenance ouverte : afficher d'ou vient une information fait partie du
-- produit. Aucune colonne secrete dans cette table, les jetons d'API vivent
-- dans l'environnement du collecteur, jamais en base.
create policy "sources lisibles par tous"
  on public.sources for select
  using (true);

-- Seuls les evenements publies sortent. Un brouillon issu d'une collecte non
-- verifiee ne doit pas fuiter, et un evenement archive non plus.
create policy "evenements publies lisibles par tous"
  on public.evenements for select
  using (statut in ('publie', 'annule'));

-- Un evenement annule reste visible, exprès : savoir qu'une brocante est
-- annulee est precisement l'information qui manque chez les concurrents.

create policy "provenances des evenements visibles"
  on public.evenement_sources for select
  using (
    exists (
      select 1 from public.evenements e
      where e.id = evenement_sources.evenement_id
        and e.statut in ('publie', 'annule')
    )
  );

-- public.contributions : aucune politique. Le formulaire n'ecrit pas
-- directement en base, il passe par une route serveur qui valide, limite la
-- cadence et hache l'adresse IP avant d'ecrire avec la cle de service. Donner
-- un droit d'insertion a anon reviendrait a publier un point d'ecriture
-- anonyme sur une table qui porte des courriels.

-- public.alertes : aucune politique, meme raison. Une lecture publique de
-- cette table serait une fuite de fichier d'adresses.

-- Recherche geographique. C'est la requete du produit : ce qui se passe autour
-- d'un point, dans une fenetre de dates.
--
-- Volontairement en security invoker, le defaut : la fonction s'execute avec
-- les droits de l'appelant, donc la politique ci-dessus s'applique et un
-- brouillon ne peut pas sortir par ce chemin. En security definer, elle
-- contournerait la RLS et deviendrait une porte ouverte sur toute la table.
create function public.recherche_evenements(
  p_lat        double precision,
  p_lng        double precision,
  p_rayon_km   integer default 20,
  p_debut      timestamptz default now(),
  p_fin        timestamptz default (now() + interval '30 days'),
  p_types      public.type_evenement[] default null,
  p_limite     integer default 100
)
returns table (
  id            uuid,
  slug          text,
  titre         text,
  type          public.type_evenement,
  debut_le      timestamptz,
  fin_le        timestamptz,
  ouvre_a       time,
  ferme_a       time,
  adresse_voie  text,
  code_postal   text,
  commune       text,
  code_insee    text,
  latitude      double precision,
  longitude     double precision,
  nb_exposants  integer,
  tarif_visiteur_c integer,
  organisateur  text,
  statut        public.statut_publication,
  distance_m    double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    e.id, e.slug, e.titre, e.type,
    e.debut_le, e.fin_le, e.ouvre_a, e.ferme_a,
    e.adresse_voie, e.code_postal, e.commune, e.code_insee,
    st_y(e.position::geometry) as latitude,
    st_x(e.position::geometry) as longitude,
    e.nb_exposants, e.tarif_visiteur_c, e.organisateur, e.statut,
    st_distance(e.position, st_makepoint(p_lng, p_lat)::extensions.geography) as distance_m
  from public.evenements e
  where e.position is not null
    -- ST_DWithin exploite l'index GiST, contrairement a un ST_Distance en
    -- clause where qui calculerait la distance pour chaque ligne de la table.
    and st_dwithin(
      e.position,
      st_makepoint(p_lng, p_lat)::extensions.geography,
      least(greatest(coalesce(p_rayon_km, 20), 1), 100) * 1000
    )
    and e.fin_le >= p_debut
    and e.debut_le <= p_fin
    and (p_types is null or e.type = any(p_types))
  order by e.debut_le asc, distance_m asc
  limit least(greatest(coalesce(p_limite, 100), 1), 200);
$$;

comment on function public.recherche_evenements is
  'Route publique. Rayon borne a 100 km et resultat a 200 lignes pour qu''un appel ne puisse pas servir a vider la table.';

revoke all on function public.recherche_evenements from public;
grant execute on function public.recherche_evenements to anon, authenticated;
