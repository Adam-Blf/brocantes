-- 0004 - conformite CRPA : separer ce que la source ecrit de ce qu'on affiche
-- brocantes.beloucif.com, 11/09/2026
--
-- L'article L322-1 du code des relations entre le public et l'administration
-- interdit d'ALTERER une information publique reutilisee. Sans separation entre
-- le titre de la source et le titre affiche, neutraliser un cas precis, le seul
-- ou un titre peut porter un droit d'auteur au sens de l'article L112-4 du code
-- de la propriete intellectuelle, obligerait a ecraser la donnee d'origine.
--
-- Meme raisonnement pour l'adresse : le geocodage est une lecture, il ne doit
-- pas remplacer ce que la mairie a ecrit.

alter table public.evenements rename column titre to titre_source;

alter table public.evenements
  add column titre_affiche text,
  add column adresse_source text;

update public.evenements set titre_affiche = titre_source;

comment on column public.evenements.titre_source is
  'Le titre tel que la source l''a publie. Ne jamais le modifier : L322-1 CRPA.';
comment on column public.evenements.titre_affiche is
  'Ce que le site montre. Egal a titre_source sauf neutralisation ponctuelle.';

drop index evenements_titre_trgm_idx;
create index evenements_titre_trgm_idx
  on public.evenements using gin (titre_source extensions.gin_trgm_ops);

-- La fonction publiee rend desormais les deux titres, l'adresse de la source et
-- la date du dernier releve, que chaque fiche doit afficher avec sa provenance.
drop function public.recherche_evenements(
  double precision, double precision, integer, timestamptz, timestamptz,
  public.type_evenement[], integer
);

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
  titre_source  text,
  titre_affiche text,
  type          public.type_evenement,
  debut_le      timestamptz,
  fin_le        timestamptz,
  ouvre_a       time,
  ferme_a       time,
  adresse_source text,
  code_postal   text,
  commune       text,
  code_insee    text,
  latitude      double precision,
  longitude     double precision,
  nb_exposants  integer,
  tarif_visiteur_c integer,
  organisateur  text,
  statut        public.statut_publication,
  distance_m    double precision,
  releve_le     timestamptz
)
language sql
stable
set search_path = public, extensions
as $$
  select
    e.id, e.slug, e.titre_source, coalesce(e.titre_affiche, e.titre_source),
    e.type, e.debut_le, e.fin_le, e.ouvre_a, e.ferme_a,
    coalesce(e.adresse_source, e.adresse_voie), e.code_postal, e.commune, e.code_insee,
    st_y(e.position::geometry), st_x(e.position::geometry),
    e.nb_exposants, e.tarif_visiteur_c, e.organisateur, e.statut,
    st_distance(e.position, st_makepoint(p_lng, p_lat)::extensions.geography),
    (select max(es.vu_le) from public.evenement_sources es where es.evenement_id = e.id)
  from public.evenements e
  where e.position is not null
    and st_dwithin(
      e.position,
      st_makepoint(p_lng, p_lat)::extensions.geography,
      least(greatest(coalesce(p_rayon_km, 20), 1), 100) * 1000
    )
    and e.fin_le >= p_debut
    and e.debut_le <= p_fin
    and (p_types is null or e.type = any(p_types))
  order by e.debut_le asc, 21 asc
  limit least(greatest(coalesce(p_limite, 100), 1), 200);
$$;

comment on function public.recherche_evenements is
  'Route publique. Rayon borne a 100 km et resultat a 200 lignes. Rend la date de dernier releve, que chaque fiche doit afficher avec sa source (L322-1 CRPA).';

revoke all on function public.recherche_evenements from public;
grant execute on function public.recherche_evenements to anon, authenticated;
