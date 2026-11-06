-- 0005 - recherche de commune pour la barre de saisie
-- brocantes.beloucif.com, 11/09/2026
--
-- Deux raisons d'etre en base plutot que dans la page.
--
-- 1. PostgREST rend une colonne geography en WKB hexadecimal. Decoder ce
--    format cote navigateur pour obtenir deux nombres serait absurde.
-- 2. La saisie de quelqu'un ne part chez aucun tiers : le referentiel est
--    local, la reponse est immediate, et aucun geocodeur externe n'apprend ou
--    habitent les visiteurs.
--
-- Route publique comme recherche_evenements : parametres bornes, invoker, et
-- au plus huit resultats.

create function public.chercher_commune(p_saisie text)
returns table (
  code_insee text,
  nom text,
  slug text,
  departement text,
  latitude double precision,
  longitude double precision,
  couverte boolean
)
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select
      btrim(coalesce(p_saisie, '')) as brut,
      -- Personne ne tape "L'Haÿ-les-Roses" avec son apostrophe, son y trema et
      -- ses tirets. Les deux cotes sont donc normalises de la meme facon.
      btrim(regexp_replace(
        regexp_replace(unaccent(lower(coalesce(p_saisie, ''))), '[''\-_.]', ' ', 'g'),
        '\s+', ' ', 'g')) as norme
  ),
  candidats as (
    select
      c.*,
      btrim(regexp_replace(
        regexp_replace(unaccent(lower(c.nom)), '[''\-_.]', ' ', 'g'),
        '\s+', ' ', 'g')) as nom_norme
    from public.communes c
  )
  select
    c.code_insee, c.nom, c.slug, c.departement,
    st_y(c.centre::geometry), st_x(c.centre::geometry),
    c.couverte
  from candidats c, q
  where length(q.norme) >= 2
    and (
      (q.brut ~ '^[0-9]{2,5}$' and exists (
        select 1 from unnest(c.codes_postaux) cp where cp like q.brut || '%'
      ))
      -- Debut du nom, ou debut d'un mot quelconque a l'interieur du nom. Sans
      -- la seconde forme, toutes les communes commencant par un article sont
      -- introuvables sous le nom que leurs habitants emploient : on cherche
      -- "perreux", jamais "le perreux sur marne".
      or c.nom_norme like q.norme || '%'
      or c.nom_norme like '% ' || q.norme || '%'
    )
  -- Les communes couvertes d'abord : une commune sans source branchee ne peut
  -- donner aucun resultat, la proposer serait une promesse vide. Puis une
  -- correspondance en tete de nom devant une correspondance interieure.
  order by
    c.couverte desc,
    (c.nom_norme like q.norme || '%') desc,
    c.population desc nulls last
  limit 8;
$$;

comment on function public.chercher_commune is
  'Route publique. Rend au plus huit communes, couvertes d''abord.';

revoke all on function public.chercher_commune from public;
grant execute on function public.chercher_commune to anon, authenticated;
